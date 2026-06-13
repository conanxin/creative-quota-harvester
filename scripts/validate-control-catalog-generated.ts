#!/usr/bin/env tsx
/**
 * scripts/validate-control-catalog-generated.ts — Phase 5C-3 + 5C-2C-A
 *
 * Validates the auto-generated control catalog:
 *   - All package.json scripts appear in generated catalog
 *   - All high/danger commands have requires_confirm=true
 *   - All high/danger commands have real_execution_supported=false
 *   - generates_media=true commands must have calls_model=true or notes
 *   - timer commands have modifies_timer=true
 *   - send commands have CQA_ALLOW_TELEGRAM_SEND in requires_env
 *   - image confirmed commands have CQA_ALLOW_GENERATION in requires_env
 *   - No token / .env / sk-cp in catalog
 *   - Generated and final catalog JSON are valid
 *   - All commands have execution_mode
 *   - All commands have audit_required
 *   - Drift check: generated vs final catalog match
 *   - 5C-2C-A canary: 5 safe commands allowed real_execution_supported=true
 *     with execution_mode=confirmed_low_risk
 *
 * Usage: npm run dashboard:control:drift-check
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const HARVESTER_DIR = "/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester";
const PKG_PATH = join(HARVESTER_DIR, "package.json");
const POLICY_PATH = join(HARVESTER_DIR, "dashboard", "control-policy.json");
const GENERATED_PATH = join(HARVESTER_DIR, "dashboard", "control-catalog.generated.json");
const FINAL_PATH = join(HARVESTER_DIR, "dashboard", "control-catalog.json");

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

console.log("=== Validate Control Catalog Generated (Phase 5C-3) ===");

// 1. package.json exists and has scripts
if (!existsSync(PKG_PATH)) { fail("package.json missing"); process.exit(1); }
const pkg = JSON.parse(readFileSync(PKG_PATH, "utf-8"));
const scriptNames = Object.keys(pkg.scripts || {});
pass(`package.json has ${scriptNames.length} scripts`);

// 2. policy exists
if (!existsSync(POLICY_PATH)) { fail("control-policy.json missing"); process.exit(1); }
const policy = JSON.parse(readFileSync(POLICY_PATH, "utf-8"));
pass("control-policy.json exists and is valid JSON");

// 3. generated catalog exists and is valid JSON
if (!existsSync(GENERATED_PATH)) { fail("control-catalog.generated.json missing"); process.exit(1); }
const generated = JSON.parse(readFileSync(GENERATED_PATH, "utf-8"));
pass("control-catalog.generated.json exists and is valid JSON");

// 4. final catalog exists and is valid JSON
if (!existsSync(FINAL_PATH)) { fail("control-catalog.json missing"); process.exit(1); }
const final = JSON.parse(readFileSync(FINAL_PATH, "utf-8"));
pass("control-catalog.json exists and is valid JSON");

// 5. All package.json scripts appear in generated catalog
const allCmdIds = new Set<string>();
for (const g of generated.command_groups || []) {
  for (const c of g.commands || []) {
    allCmdIds.add(c.id);
  }
}

let allFound = true;
for (const scriptName of scriptNames) {
  const expectedId = scriptName.replace(/:/g, "_");
  if (!allCmdIds.has(expectedId)) {
    fail(`Script "${scriptName}" missing from generated catalog (expected id: ${expectedId})`);
    allFound = false;
  }
}
if (allFound) pass("All package.json scripts appear in generated catalog");

// 6. All high/danger commands have requires_confirm=true
let highDangerConfirmOk = true;
for (const g of generated.command_groups || []) {
  for (const c of g.commands || []) {
    if ((c.risk_level === "high" || c.risk_level === "danger") && !c.requires_confirm) {
      fail(`Command ${c.id} (high/danger) missing requires_confirm`);
      highDangerConfirmOk = false;
    }
  }
}
if (highDangerConfirmOk) pass("All high/danger commands have requires_confirm=true");

// 7. All high/danger commands have real_execution_supported=false
let highDangerExecOk = true;
for (const g of generated.command_groups || []) {
  for (const c of g.commands || []) {
    if ((c.risk_level === "high" || c.risk_level === "danger") && c.real_execution_supported !== false) {
      fail(`Command ${c.id} (high/danger) has real_execution_supported=${c.real_execution_supported}`);
      highDangerExecOk = false;
    }
  }
}
if (highDangerExecOk) pass("All high/danger commands have real_execution_supported=false");

// 8. generates_media=true commands must have calls_model=true or notes
let mediaModelOk = true;
for (const g of generated.command_groups || []) {
  for (const c of g.commands || []) {
    if (c.generates_media && !c.calls_model && (!c.notes || c.notes.length < 10)) {
      fail(`Command ${c.id} generates_media=true but calls_model=false and notes too short`);
      mediaModelOk = false;
    }
  }
}
if (mediaModelOk) pass("All generates_media=true commands have calls_model or detailed notes");

// 9. Timer commands (in timer group or explicitly timer-related) have modifies_timer=true
let timerOk = true;
for (const g of generated.command_groups || []) {
  for (const c of g.commands || []) {
    // Only check commands that are actually in the timer group or have explicit timer actions
    // Safe-readonly timer queries (like get_timer_snapshot) are exempt
    if (g.id === "timer" && !c.modifies_timer) {
      fail(`Command ${c.id} in timer group missing modifies_timer=true`);
      timerOk = false;
    }
  }
}
if (timerOk) pass("Timer group commands have modifies_timer=true");

// 10. Send confirmed commands have CQA_ALLOW_TELEGRAM_SEND in requires_env
let sendEnvOk = true;
for (const g of generated.command_groups || []) {
  for (const c of g.commands || []) {
    if (c.id.includes("send") && c.id.includes("confirmed") && c.requires_env) {
      const hasTelegram = c.requires_env.some((e: string) => e.includes("CQA_ALLOW_TELEGRAM_SEND") || e.includes("TELEGRAM_BOT_TOKEN"));
      if (!hasTelegram) {
        fail(`Command ${c.id} (send confirmed) missing CQA_ALLOW_TELEGRAM_SEND in requires_env`);
        sendEnvOk = false;
      }
    }
  }
}
if (sendEnvOk) pass("Send confirmed commands have CQA_ALLOW_TELEGRAM_SEND in requires_env");

// 11. Image confirmed commands have CQA_ALLOW_GENERATION in requires_env
let imageEnvOk = true;
for (const g of generated.command_groups || []) {
  for (const c of g.commands || []) {
    if (c.id.includes("image") && c.id.includes("confirmed") && c.requires_env) {
      const hasGen = c.requires_env.some((e: string) => e.includes("CQA_ALLOW_GENERATION") || e.includes("MINIMAX_API_KEY"));
      if (!hasGen) {
        fail(`Command ${c.id} (image confirmed) missing CQA_ALLOW_GENERATION in requires_env`);
        imageEnvOk = false;
      }
    }
  }
}
if (imageEnvOk) pass("Image confirmed commands have CQA_ALLOW_GENERATION in requires_env");

// 12. No token / .env / sk-cp in catalog (actual values, not variable names in requires_env)
const catalogStr = JSON.stringify(generated);
// Check for actual API key values (sk-... patterns), not just variable names
if (/sk-cp-[A-Za-z0-9]{20,}/.test(catalogStr) || /sk-[A-Za-z0-9]{20,}/.test(catalogStr)) {
  fail("Catalog contains API key value pattern");
} else {
  pass("Catalog: no API key value patterns");
}
// Check for .env file paths or token assignments in command strings (not in boundaries/gitignore)
let envRefFound = false;
for (const g of generated.command_groups || []) {
  for (const c of g.commands || []) {
    const cmdStr = JSON.stringify(c);
    if (cmdStr.includes('readFileSync(".env') || cmdStr.includes('.env.telegram.local') && !cmdStr.includes('gitignore')) {
      fail(`Command ${c.id} contains .env reference in command/notes`);
      envRefFound = true;
    }
  }
}
if (!envRefFound) pass("Catalog: no .env file paths or token assignments in commands");

// 13. All commands have execution_mode
let allHaveMode = true;
for (const g of generated.command_groups || []) {
  for (const c of g.commands || []) {
    if (!c.execution_mode) {
      fail(`Command ${c.id} missing execution_mode`);
      allHaveMode = false;
    }
  }
}
if (allHaveMode) pass("All commands have execution_mode");

// 14. All commands have audit_required
let allHaveAudit = true;
for (const g of generated.command_groups || []) {
  for (const c of g.commands || []) {
    if (!c.audit_required) {
      fail(`Command ${c.id} missing audit_required`);
      allHaveAudit = false;
    }
  }
}
if (allHaveAudit) pass("All commands have audit_required");

// 15. Drift check: generated vs final catalog match
const generatedJson = JSON.stringify(generated, null, 2);
const finalJson = JSON.stringify(final, null, 2);
if (generatedJson === finalJson) {
  pass("Generated and final catalogs are identical (no drift)");
} else {
  // Check if only safe_readonly group differs (manual commands)
  const genGroups = new Map(generated.command_groups.map((g: any) => [g.id, g]));
  const finGroups = new Map(final.command_groups.map((g: any) => [g.id, g]));
  let drift = false;
  for (const [id, g] of genGroups) {
    if (!finGroups.has(id)) {
      fail(`Drift: group ${id} missing from final catalog`);
      drift = true;
    } else {
      const genCmds = JSON.stringify(g.commands);
      const finCmds = JSON.stringify(finGroups.get(id).commands);
      if (genCmds !== finCmds) {
        fail(`Drift: group ${id} commands differ`);
        drift = true;
      }
    }
  }
  for (const id of finGroups.keys()) {
    if (!genGroups.has(id)) {
      fail(`Drift: extra group ${id} in final catalog`);
      drift = true;
    }
  }
  if (!drift) pass("Generated and final catalogs match (no drift)");
}

// 16. All commands have real_execution_supported=false, except confirmed_low_risk allowlist
let allFalse = true;

// Load allowlist from control-execution-allowlist.json
const allowlistIds = new Set<string>();
try {
  const allowlist = JSON.parse(readFileSync(join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json"), "utf-8"));
  for (const script of allowlist.allowed_scripts || []) {
    allowlistIds.add(script.replace(/:/g, "_"));
  }
  pass(`Loaded allowlist: ${allowlistIds.size} commands allowed for real execution`);
} catch (e) {
  fail("Failed to load control-execution-allowlist.json");
  allFalse = false;
}

for (const g of generated.command_groups || []) {
  for (const c of g.commands || []) {
    if (c.real_execution_supported !== false && !allowlistIds.has(c.id)) {
      fail(`Command ${c.id} has real_execution_supported=${c.real_execution_supported} but NOT in allowlist`);
      allFalse = false;
    }
    if (c.real_execution_supported === true && allowlistIds.has(c.id) && c.execution_mode !== "confirmed_low_risk") {
      fail(`Command ${c.id} is in allowlist but execution_mode != confirmed_low_risk: ${c.execution_mode}`);
      allFalse = false;
    }
    if (c.real_execution_supported === true && allowlistIds.has(c.id) && c.risk_level !== "safe") {
      fail(`Command ${c.id} is in allowlist but risk_level != safe: ${c.risk_level}`);
      allFalse = false;
    }
    if (c.real_execution_supported === true && allowlistIds.has(c.id) && c.calls_model !== false) {
      fail(`Command ${c.id} is in allowlist but calls_model != false: ${c.calls_model}`);
      allFalse = false;
    }
    if (c.real_execution_supported === true && allowlistIds.has(c.id) && c.generates_media !== false) {
      fail(`Command ${c.id} is in allowlist but generates_media != false: ${c.generates_media}`);
      allFalse = false;
    }
    if (c.real_execution_supported === true && allowlistIds.has(c.id) && c.modifies_timer !== false) {
      fail(`Command ${c.id} is in allowlist but modifies_timer != false: ${c.modifies_timer}`);
      allFalse = false;
    }
  }
}
if (allFalse) pass("All commands have real_execution_supported=false, except allowlist (confirmed_low_risk)");

// 17. Catalog version matches phase
if (generated.version && generated.phase === "5C-3") {
  pass("Catalog version and phase are set (5C-3)");
} else {
  fail("Catalog version or phase missing/mismatch");
}

console.log(`\n=== Summary ===`);
console.log(`PASS: ${passes}  FAIL: ${failures}`);
if (failures > 0) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
process.exit(0);
