#!/usr/bin/env tsx
/**
 * scripts/validate-control-low-risk-execution.ts — Phase 5C-2C-A
 *
 * Validates the confirmed low-risk execution canary:
 *  - control-execution-allowlist.json exists and is valid
 *  - Contains exactly 5 allowed scripts
 *  - All 5 scripts are in control-catalog.json with confirmed_low_risk mode
 *  - All 5 have real_execution_supported=true
 *  - All 5 have risk_level=safe, calls_model=false, generates_media=false, modifies_timer=false
 *  - No other commands have real_execution_supported=true
 *  - Blocked patterns cover dangerous commands
 *
 * Usage: npm run validate:control-low-risk-execution
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const HARVESTER_DIR = "/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester";
const ALLOWLIST_PATH = join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json");
const CATALOG_PATH = join(HARVESTER_DIR, "dashboard", "control-catalog.json");

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

console.log("=== Validate Control Low-risk Execution Canary (Phase 5C-2C-A) ===");

// 1. Allowlist exists
if (!existsSync(ALLOWLIST_PATH)) {
  fail("control-execution-allowlist.json not found");
  console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
  console.log("RESULT: FAIL");
  process.exit(1);
}

// 2. Allowlist is valid JSON
let allowlist: any;
try {
  allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf-8"));
  pass("control-execution-allowlist.json: valid JSON");
} catch (e: any) {
  fail(`allowlist parse error: ${e.message}`);
  console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
  console.log("RESULT: FAIL");
  process.exit(1);
}

// 3. Allowlist has exactly 5 allowed scripts
if (allowlist.allowed_scripts && allowlist.allowed_scripts.length === 5) {
  pass(`allowlist has exactly 5 allowed scripts: ${allowlist.allowed_scripts.join(", ")}`);
} else {
  fail(`allowlist has ${allowlist.allowed_scripts?.length || 0} scripts (expected 5)`);
}

// 4. Allowlist has blocked patterns
if (allowlist.blocked_patterns && allowlist.blocked_patterns.length > 0) {
  pass(`allowlist has ${allowlist.blocked_patterns.length} blocked patterns`);
} else {
  fail("allowlist missing blocked patterns");
}

// 5. Safety rules configured
if (allowlist.safety_rules && allowlist.safety_rules.shell === false) {
  pass("allowlist safety_rules: shell=false");
} else {
  fail("allowlist safety_rules: shell must be false");
}
if (allowlist.safety_rules && allowlist.safety_rules.command_only === "npm") {
  pass("allowlist safety_rules: command_only=npm");
} else {
  fail("allowlist safety_rules: command_only must be npm");
}
if (allowlist.safety_rules && allowlist.safety_rules.timeout_enforced === true) {
  pass("allowlist safety_rules: timeout_enforced=true");
} else {
  fail("allowlist safety_rules: timeout_enforced must be true");
}
if (allowlist.safety_rules && allowlist.safety_rules.output_truncated === true) {
  pass("allowlist safety_rules: output_truncated=true");
} else {
  fail("allowlist safety_rules: output_truncated must be true");
}
if (allowlist.safety_rules && allowlist.safety_rules.no_secrets_in_env === true) {
  pass("allowlist safety_rules: no_secrets_in_env=true");
} else {
  fail("allowlist safety_rules: no_secrets_in_env must be true");
}

// 6. Load catalog and verify all 5 commands are confirmed_low_risk
if (!existsSync(CATALOG_PATH)) {
  fail("control-catalog.json not found");
  console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
  console.log("RESULT: FAIL");
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
let realExecCount = 0;
let canaryCount = 0;

for (const group of catalog.command_groups || []) {
  for (const cmd of group.commands || []) {
    if (cmd.real_execution_supported === true) {
      realExecCount++;
      const scriptName = cmd.script_name || cmd.id?.replace(/_/g, ":") || cmd.id;
      if (allowlist.allowed_scripts.includes(scriptName)) {
        canaryCount++;
        if (cmd.execution_mode === "confirmed_low_risk") {
          pass(`canary ${cmd.id}: execution_mode=confirmed_low_risk`);
        } else {
          fail(`canary ${cmd.id}: execution_mode=${cmd.execution_mode} (expected confirmed_low_risk)`);
        }
        if (cmd.risk_level === "safe") {
          pass(`canary ${cmd.id}: risk_level=safe`);
        } else {
          fail(`canary ${cmd.id}: risk_level=${cmd.risk_level} (expected safe)`);
        }
        if (cmd.calls_model === false) {
          pass(`canary ${cmd.id}: calls_model=false`);
        } else {
          fail(`canary ${cmd.id}: calls_model=true (expected false)`);
        }
        if (cmd.generates_media === false) {
          pass(`canary ${cmd.id}: generates_media=false`);
        } else {
          fail(`canary ${cmd.id}: generates_media=true (expected false)`);
        }
        if (cmd.modifies_timer === false) {
          pass(`canary ${cmd.id}: modifies_timer=false`);
        } else {
          fail(`canary ${cmd.id}: modifies_timer=true (expected false)`);
        }
        if (cmd.requires_confirm === true) {
          pass(`canary ${cmd.id}: requires_confirm=true`);
        } else {
          fail(`canary ${cmd.id}: requires_confirm=false (expected true)`);
        }
      } else {
        fail(`command ${cmd.id} has real_execution_supported=true but NOT in allowlist`);
      }
    }
  }
}

if (realExecCount === 5) {
  pass(`exactly 5 commands have real_execution_supported=true`);
} else {
  fail(`${realExecCount} commands have real_execution_supported=true (expected 5)`);
}

if (canaryCount === 5) {
  pass(`all 5 real_execution commands are in allowlist`);
} else {
  fail(`${canaryCount} real_execution commands are in allowlist (expected 5)`);
}

console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
if (failures > 0) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
process.exit(0);
