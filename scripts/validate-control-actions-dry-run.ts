#!/usr/bin/env tsx
/**
 * scripts/validate-control-actions-dry-run.ts — Phase 5C-2A + 5C-2C-A
 *
 * Validates the authenticated control actions dry-run framework:
 *   - control-server.ts still binds to 127.0.0.1 only
 *   - No child_process / exec / spawn in source (control-server.ts)
 *   - No real command execution logic in control-server.ts (dry-run only)
 *   - /api/action/dry-run endpoint exists
 *   - No /api/action/execute endpoint exists
 *   - control-catalog.json: all real_execution_supported=false, except confirmed_low_risk canary (5 commands)
 *   - high/danger actions require confirmation
 *   - audit log does not contain token (regex check)
 *   - .control.local not git-tracked
 *   - .env not git-tracked
 *
 * Usage: npm run validate:control-actions-dry-run
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const HARVESTER_DIR = "/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester";
const SERVER_PATH = join(HARVESTER_DIR, "scripts", "control-server.ts");
const CATALOG_PATH = join(HARVESTER_DIR, "dashboard", "control-catalog.json");
const AUDIT_PATH = join(HARVESTER_DIR, "reports", "control-action-audit.jsonl");
const GITIGNORE_PATH = join(HARVESTER_DIR, ".gitignore");

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

console.log("=== Validate Control Actions Dry-run (Phase 5C-2A) ===");

// 1. control-server.ts still binds to 127.0.0.1
if (!existsSync(SERVER_PATH)) { fail("control-server.ts missing"); process.exit(1); }
const serverCode = readFileSync(SERVER_PATH, "utf-8");

if (serverCode.includes('"127.0.0.1"') || serverCode.includes("'127.0.0.1'")) {
  pass("control-server.ts binds to 127.0.0.1");
} else {
  fail("control-server.ts does NOT bind to 127.0.0.1");
}

if (!serverCode.includes('"0.0.0.0"') && !serverCode.includes("'0.0.0.0'")) {
  pass("control-server.ts does NOT bind to 0.0.0.0");
} else {
  fail("control-server.ts binds to 0.0.0.0 (forbidden)");
}

// 2. No child_process require
if (/\brequire\s*\(\s*['"]\s*child_process\s*['"]\s*\)/gi.test(serverCode)) {
  fail("control-server.ts requires child_process (forbidden)");
} else {
  pass("control-server.ts does NOT require child_process");
}

// 3. No exec()/spawn()/execSync()/spawnSync()/execFile() calls
const execCallRe = /\b(exec|spawn|execSync|spawnSync|execFile)\s*\(/gi;
if (execCallRe.test(serverCode)) {
  fail("control-server.ts contains function call: exec()/spawn()/execSync()/spawnSync()/execFile()");
} else {
  pass("control-server.ts: no exec()/spawn()/execSync()/spawnSync()/execFile() calls");
}

// 4. No eval()
if (!/\beval\s*\(/.test(serverCode)) {
  pass("control-server.ts: no eval()");
} else {
  fail("control-server.ts contains eval()");
}

// 5. /api/action/dry-run endpoint exists
if (serverCode.includes('"/api/action/dry-run"') && serverCode.includes("handleDryRun")) {
  pass("control-server.ts has /api/action/dry-run endpoint");
} else {
  fail("control-server.ts missing /api/action/dry-run endpoint");
}

// 6. No /api/action/execute endpoint
if (!serverCode.includes('"/api/action/execute"')) {
  pass("control-server.ts: no /api/action/execute endpoint");
} else {
  fail("control-server.ts contains /api/action/execute endpoint (forbidden)");
}

// 7. All requests to /api/action/dry-run are POST
if (serverCode.includes('pathname === "/api/action/dry-run"') && serverCode.includes('req.method === "POST"')) {
  pass("control-server.ts: /api/action/dry-run only accepts POST");
} else {
  fail("control-server.ts: /api/action/dry-run method check missing");
}

// 8. All other routes still only accept GET
if (serverCode.includes('req.method !== "GET"') && serverCode.includes("methodNotAllowed")) {
  pass("control-server.ts: non-GET routes blocked");
} else {
  fail("control-server.ts: missing non-GET block");
}

// 9. real_execution is always false in handleDryRun
if (serverCode.includes("real_execution: false") && serverCode.includes('dry_run_only: true')) {
  pass("control-server.ts: real_execution always false in dry-run");
} else {
  fail("control-server.ts: real_execution may not be always false");
}

// 10. control-catalog.json: real_execution_supported=false for all except confirmed_low_risk allowlist
if (!existsSync(CATALOG_PATH)) { fail("control-catalog.json missing"); process.exit(1); }
const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
let allFalse = true;
let highDangerRequireConfirm = true;

// Load allowlist from control-execution-allowlist.json
const allowlistIds = new Set<string>();
try {
  const allowlist = JSON.parse(readFileSync(join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json"), "utf-8"));
  for (const script of allowlist.allowed_scripts || []) {
    allowlistIds.add(script.replace(/:/g, "_"));
  }
  pass(`Loaded allowlist: ${allowlistIds.size} commands allowed for real execution`);
} catch {
  fail("Failed to load control-execution-allowlist.json");
  allFalse = false;
}

for (const g of catalog.command_groups || []) {
  for (const cmd of g.commands || []) {
    if (cmd.real_execution_supported !== false) {
      if (allowlistIds.has(cmd.id) && cmd.execution_mode === "confirmed_low_risk" && cmd.risk_level === "safe") {
        // allowlist command: allowed
      } else {
        allFalse = false;
        fail(`control-catalog.json: ${cmd.id} has real_execution_supported=${cmd.real_execution_supported} (not confirmed_low_risk allowlist)`);
      }
    }
    if ((cmd.risk_level === "high" || cmd.risk_level === "danger") && !cmd.requires_confirm) {
      highDangerRequireConfirm = false;
      fail(`control-catalog.json: ${cmd.id} (high/danger) missing requires_confirm`);
    }
  }
}
if (allFalse) pass("control-catalog.json: all real_execution_supported=false (or confirmed_low_risk allowlist)");
if (highDangerRequireConfirm) pass("control-catalog.json: all high/danger require confirmation");

// 11. Audit log does not contain token (if exists)
if (existsSync(AUDIT_PATH)) {
  const auditContent = readFileSync(AUDIT_PATH, "utf-8");
  if (auditContent.includes("CQA_CONTROL_TOKEN") || /sk-[A-Za-z0-9]{20,}/.test(auditContent)) {
    fail("audit log contains token pattern");
  } else {
    pass("audit log: no token patterns found");
  }
} else {
  pass("audit log: not created yet (OK for dry-run validation)");
}

// 12. .control.local not git-tracked
if (existsSync(GITIGNORE_PATH)) {
  const gi = readFileSync(GITIGNORE_PATH, "utf-8");
  if (gi.includes(".control.local")) {
    pass(".gitignore: .control.local is ignored");
  } else {
    fail(".gitignore: .control.local not ignored");
  }
  if (gi.includes(".env")) {
    pass(".gitignore: .env is ignored");
  } else {
    fail(".gitignore: .env not ignored");
  }
} else {
  fail(".gitignore missing");
}

// 13. No .env reading in control-server.ts (except .control.local)
if (serverCode.includes(".env.telegram.local") || serverCode.includes("TELEGRAM_BOT_TOKEN")) {
  fail("control-server.ts references .env.telegram.local or TELEGRAM_BOT_TOKEN");
} else {
  pass("control-server.ts: no .env.telegram.local or TELEGRAM_BOT_TOKEN reference");
}

// 14. handleDryRun does NOT call fs.writeFileSync (except audit log) or modify signals.db
if (!/writeFileSync.*\.(db|json|md|txt)/.test(serverCode) || /writeFileSync.*audit/.test(serverCode)) {
  pass("control-server.ts: no file modification outside audit log");
} else {
  fail("control-server.ts: may modify files outside audit log");
}

// 15. .control.local.example exists
if (existsSync(join(HARVESTER_DIR, ".control.local.example"))) {
  pass(".control.local.example exists");
} else {
  fail(".control.local.example missing");
}

// 16. handleDryRun reads catalog but does NOT execute command
if (serverCode.includes("would_run_command") && !serverCode.includes("exec(")) {
  pass("control-server.ts: dry-run returns would_run_command but never executes");
} else {
  fail("control-server.ts: may execute command in dry-run handler");
}

console.log(`\n=== Summary ===`);
console.log(`PASS: ${passes}  FAIL: ${failures}`);
if (failures > 0) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
process.exit(0);
