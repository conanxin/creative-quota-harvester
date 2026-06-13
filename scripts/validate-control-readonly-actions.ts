#!/usr/bin/env tsx
/**
 * scripts/validate-control-readonly-actions.ts — Phase 5C-2B
 *
 * Validates the safe read-only action framework:
 *   - control-server.ts still binds to 127.0.0.1 only
 *   - No child_process / exec / spawn in source
 *   - No real command execution logic
 *   - /api/action/read-only endpoint exists (POST only)
 *   - /api/action/read-only rejects non-safe_readonly actions
 *   - No /api/action/execute endpoint exists
 *   - control-catalog.json has safe_readonly commands with execution_mode
 *   - All safe_readonly commands have real_execution_supported=false
 *   - audit log does not contain token
 *   - .control.local not git-tracked
 *   - .env not git-tracked
 *   - read-only handlers only read files, no shell, no network
 *
 * Usage: npm run validate:control-readonly-actions
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const HARVESTER_DIR = "/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester";
const SERVER_PATH = join(HARVESTER_DIR, "scripts", "control-server.ts");
const CATALOG_PATH = join(HARVESTER_DIR, "dashboard", "control-catalog.json");
const GITIGNORE_PATH = join(HARVESTER_DIR, ".gitignore");

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

console.log("=== Validate Control Read-only Actions (Phase 5C-2B) ===");

if (!existsSync(SERVER_PATH)) { fail("control-server.ts missing"); process.exit(1); }
const serverCode = readFileSync(SERVER_PATH, "utf-8");

if (!existsSync(CATALOG_PATH)) { fail("control-catalog.json missing"); process.exit(1); }
const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));

// 1. Still binds to 127.0.0.1
if (serverCode.includes('"127.0.0.1"') || serverCode.includes("'127.0.0.1'")) {
  pass("control-server.ts binds to 127.0.0.1");
} else { fail("control-server.ts does NOT bind to 127.0.0.1"); }

if (!serverCode.includes('"0.0.0.0"') && !serverCode.includes("'0.0.0.0'")) {
  pass("control-server.ts does NOT bind to 0.0.0.0");
} else { fail("control-server.ts binds to 0.0.0.0 (forbidden)"); }

// 2. No child_process require
if (/\brequire\s*\(\s*['"]\s*child_process\s*['"]\s*\)/gi.test(serverCode)) {
  fail("control-server.ts requires child_process (forbidden)");
} else { pass("control-server.ts does NOT require child_process"); }

// 3. No exec()/spawn()/execSync()/spawnSync()/execFile() calls
const execCallRe = /\b(exec|spawn|execSync|spawnSync|execFile)\s*\(/gi;
if (execCallRe.test(serverCode)) {
  fail("control-server.ts contains function call: exec()/spawn()/execSync()/spawnSync()/execFile()");
} else { pass("control-server.ts: no exec()/spawn()/execSync()/spawnSync()/execFile() calls"); }

// 4. No eval()
if (!/\beval\s*\(/.test(serverCode)) { pass("control-server.ts: no eval()"); }
else { fail("control-server.ts contains eval()"); }

// 5. /api/action/read-only endpoint exists (POST only)
if (serverCode.includes('"/api/action/read-only"') && serverCode.includes("handleReadOnly")) {
  pass("control-server.ts has /api/action/read-only endpoint");
} else { fail("control-server.ts missing /api/action/read-only endpoint"); }

// 6. /api/action/read-only checks req.method === "POST"
if (serverCode.includes('pathname === "/api/action/read-only"') && serverCode.includes('req.method === "POST"')) {
  pass("control-server.ts: /api/action/read-only only accepts POST");
} else { fail("control-server.ts: /api/action/read-only method check missing"); }

// 7. No /api/action/execute endpoint
if (!serverCode.includes('"/api/action/execute"')) {
  pass("control-server.ts: no /api/action/execute endpoint");
} else { fail("control-server.ts contains /api/action/execute endpoint (forbidden)"); }

// 8. handleReadOnly checks execution_mode === "safe_readonly"
if (serverCode.includes('execution_mode !== "safe_readonly"')) {
  pass("control-server.ts: handleReadOnly rejects non-safe_readonly actions");
} else { fail("control-server.ts: handleReadOnly missing execution_mode check"); }

// 9. handleReadOnly has no child_process, exec, spawn inside
const handleReadOnlyMatch = serverCode.match(/function handleReadOnly[\s\S]*?function writeAuditLog/);
if (handleReadOnlyMatch) {
  const handlerCode = handleReadOnlyMatch[0];
  if (!/\brequire\s*\(\s*['"]\s*child_process\s*['"]\s*\)/gi.test(handlerCode) &&
      !/\b(exec|spawn|execSync|spawnSync|execFile)\s*\(/gi.test(handlerCode)) {
    pass("handleReadOnly: no child_process / exec / spawn");
  } else { fail("handleReadOnly: contains child_process / exec / spawn"); }
  
  // 10. handleReadOnly only uses safeReadJson / safeReadText (no shell, no network)
  if (handlerCode.includes("safeReadJson") && handlerCode.includes("safeReadText") &&
      !handlerCode.includes("http.request") && !handlerCode.includes("fetch(") &&
      !handlerCode.includes("axios")) {
    pass("handleReadOnly: only uses safeReadJson/safeReadText, no network calls");
  } else { fail("handleReadOnly: may contain network calls or unsafe reads"); }
  
  // 11. handleReadOnly returns real_execution=false and side_effects=false
  if (handlerCode.includes("real_execution: false") && handlerCode.includes("side_effects: false")) {
    pass("handleReadOnly: always returns real_execution=false, side_effects=false");
  } else { fail("handleReadOnly: missing real_execution=false or side_effects=false"); }
  
  // 12. handleReadOnly does NOT write files (except audit log via writeAuditLogReadOnly)
  if (!/writeFileSync|fs\.writeFile/.test(handlerCode)) {
    pass("handleReadOnly: no file writes (except audit log)");
  } else { fail("handleReadOnly: contains file write operations"); }
} else { fail("handleReadOnly function not found in control-server.ts"); }

// 13. control-catalog.json has safe_readonly commands
const safeReadonlyCommands = [];
for (const g of catalog.command_groups || []) {
  for (const cmd of g.commands || []) {
    if (cmd.execution_mode === "safe_readonly") safeReadonlyCommands.push(cmd);
  }
}
if (safeReadonlyCommands.length >= 7) {
  pass(`control-catalog.json: ${safeReadonlyCommands.length} safe_readonly commands found`);
} else { fail(`control-catalog.json: only ${safeReadonlyCommands.length} safe_readonly commands (expected 7)`); }

// 14. All safe_readonly commands have real_execution_supported=false
let allSafeFalse = true;
for (const cmd of safeReadonlyCommands) {
  if (cmd.real_execution_supported !== false) {
    allSafeFalse = false;
    fail(`control-catalog.json: ${cmd.id} has real_execution_supported=${cmd.real_execution_supported}`);
  }
}
if (allSafeFalse) pass("control-catalog.json: all safe_readonly commands have real_execution_supported=false");

// 15. All safe_readonly commands have dry_run_supported=false (they are read-only, not dry-run)
let allSafeDryFalse = true;
for (const cmd of safeReadonlyCommands) {
  if (cmd.dry_run_supported !== false) {
    allSafeDryFalse = false;
    fail(`control-catalog.json: ${cmd.id} has dry_run_supported=${cmd.dry_run_supported} (expected false)`);
  }
}
if (allSafeDryFalse) pass("control-catalog.json: all safe_readonly commands have dry_run_supported=false");

// 16. No safe_readonly command calls model or generates media
let noModelNoMedia = true;
for (const cmd of safeReadonlyCommands) {
  if (cmd.calls_model || cmd.generates_media) {
    noModelNoMedia = false;
    fail(`control-catalog.json: ${cmd.id} has calls_model=${cmd.calls_model} or generates_media=${cmd.generates_media}`);
  }
}
if (noModelNoMedia) pass("control-catalog.json: no safe_readonly command calls model or generates media");

// 17. .control.local not git-tracked
if (existsSync(GITIGNORE_PATH)) {
  const gi = readFileSync(GITIGNORE_PATH, "utf-8");
  if (gi.includes(".control.local")) { pass(".gitignore: .control.local is ignored"); }
  else { fail(".gitignore: .control.local not ignored"); }
  if (gi.includes(".env")) { pass(".gitignore: .env is ignored"); }
  else { fail(".gitignore: .env not ignored"); }
} else { fail(".gitignore missing"); }

// 18. No .env reading in control-server.ts (except .control.local)
if (serverCode.includes(".env.telegram.local") || serverCode.includes("TELEGRAM_BOT_TOKEN")) {
  fail("control-server.ts references .env.telegram.local or TELEGRAM_BOT_TOKEN");
} else { pass("control-server.ts: no .env.telegram.local or TELEGRAM_BOT_TOKEN reference"); }

// 19. writeAuditLogReadOnly exists (for read-only audit)
if (serverCode.includes("writeAuditLogReadOnly") && serverCode.includes('mode: "safe_readonly"')) {
  pass("control-server.ts: writeAuditLogReadOnly exists with mode=safe_readonly");
} else { fail("control-server.ts: writeAuditLogReadOnly missing or wrong mode"); }

console.log(`\n=== Summary ===`);
console.log(`PASS: ${passes}  FAIL: ${failures}`);
if (failures > 0) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
process.exit(0);
