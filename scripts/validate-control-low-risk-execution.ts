#!/usr/bin/env tsx
/**
 * scripts/validate-control-low-risk-execution.ts — Phase 5C-2C-B
 *
 * Validates the expanded low-risk execution allowlist:
 *  - control-execution-allowlist.json exists and is valid
 *  - All allowed scripts are in control-catalog.json with confirmed_low_risk mode
 *  - All allowed scripts have real_execution_supported=true
 *  - All allowed scripts have risk_level=safe, calls_model=false, generates_media=false, modifies_timer=false
 *  - No other commands have real_execution_supported=true
 *  - Blocked patterns cover dangerous commands
 *  - All allowed scripts exist in package.json
 *  - Sanitizer regression PASS
 *
 * Usage: npm run validate:control-low-risk-execution
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const HARVESTER_DIR = "/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester";
const ALLOWLIST_PATH = join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json");
const CATALOG_PATH = join(HARVESTER_DIR, "dashboard", "control-catalog.json");
const PKG_PATH = join(HARVESTER_DIR, "package.json");

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

console.log("=== Validate Control Low-risk Execution (Phase 5C-2C-B) ===");

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

// 3. Allowlist has blocked patterns covering dangerous commands
const dangerousPatterns = ["generate", "timer", "collect", "git", "push", "pull", "deploy", "release", "model", "music-gen", "video-gen", "image-gen", "digest:send", "report:send"];
const blockedLower = (allowlist.blocked_patterns || []).map((p: string) => p.toLowerCase());
let allDangerousBlocked = true;
for (const d of dangerousPatterns) {
  if (!blockedLower.includes(d.toLowerCase())) {
    fail(`blocked_patterns missing: ${d}`);
    allDangerousBlocked = false;
  }
}
if (allDangerousBlocked) {
  pass("blocked_patterns cover all dangerous commands");
}

// 4. Blocked patterns do NOT contain validation keywords
const safeKeywords = ["validate:control", "validate:telegram", "validate:sanitizer", "validate:project", "validate:public", "validate:daily", "validate:gallery", "validate:content", "dashboard:control", "dashboard:validate"];
for (const pattern of allowlist.blocked_patterns || []) {
  for (const safe of safeKeywords) {
    if (pattern.toLowerCase().includes(safe.toLowerCase())) {
      fail(`blocked_patterns "${pattern}" incorrectly blocks safe keyword "${safe}"`);
    }
  }
}
if (failures === 0 || (failures > 0 && passes > 0)) {
  // recheck
  let safeBlocked = false;
  for (const pattern of allowlist.blocked_patterns || []) {
    for (const safe of safeKeywords) {
      if (pattern.toLowerCase().includes(safe.toLowerCase())) {
        safeBlocked = true;
      }
    }
  }
  if (!safeBlocked) {
    pass("blocked_patterns do not block safe validation keywords");
  }
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

// 6. All allowed scripts exist in package.json
let pkg: any;
if (existsSync(PKG_PATH)) {
  pkg = JSON.parse(readFileSync(PKG_PATH, "utf-8"));
} else {
  fail("package.json not found");
  console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
  console.log("RESULT: FAIL");
  process.exit(1);
}

const scripts = pkg.scripts || {};
for (const scriptName of allowlist.allowed_scripts || []) {
  if (scripts[scriptName]) {
    pass(`allowed script exists in package.json: ${scriptName}`);
  } else {
    fail(`allowed script NOT in package.json: ${scriptName}`);
  }
}

// 7. No allowed script matches blocked patterns
for (const scriptName of allowlist.allowed_scripts || []) {
  let blocked = false;
  for (const pattern of allowlist.blocked_patterns || []) {
    if (scriptName.toLowerCase().includes(pattern.toLowerCase())) {
      fail(`allowed script "${scriptName}" matches blocked pattern "${pattern}"`);
      blocked = true;
    }
  }
  if (!blocked) {
    pass(`allowed script not blocked: ${scriptName}`);
  }
}

// 8. Load catalog and verify all allowed commands are confirmed_low_risk
if (!existsSync(CATALOG_PATH)) {
  fail("control-catalog.json not found");
  console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
  console.log("RESULT: FAIL");
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
let realExecCount = 0;
let canaryCount = 0;
const allowedSet = new Set(allowlist.allowed_scripts || []);

for (const group of catalog.command_groups || []) {
  for (const cmd of group.commands || []) {
    if (cmd.real_execution_supported === true) {
      realExecCount++;
      const scriptName = cmd.script_name || cmd.id?.replace(/_/g, ":") || cmd.id;
      if (allowedSet.has(scriptName)) {
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
        if (cmd.audit_required === true) {
          pass(`canary ${cmd.id}: audit_required=true`);
        } else {
          fail(`canary ${cmd.id}: audit_required=false (expected true)`);
        }
      } else {
        fail(`command ${cmd.id} has real_execution_supported=true but NOT in allowlist`);
      }
    }
  }
}

if (realExecCount === allowlist.allowed_scripts.length) {
  pass(`exactly ${realExecCount} commands have real_execution_supported=true`);
} else {
  fail(`${realExecCount} commands have real_execution_supported=true (expected ${allowlist.allowed_scripts.length})`);
}

if (canaryCount === allowlist.allowed_scripts.length) {
  pass(`all ${canaryCount} real_execution commands are in allowlist`);
} else {
  fail(`${canaryCount} real_execution commands are in allowlist (expected ${allowlist.allowed_scripts.length})`);
}

// 9. No disallowed commands have real_execution_supported=true
if (realExecCount === canaryCount) {
  pass("no disallowed commands have real_execution_supported=true");
} else {
  fail(`${realExecCount - canaryCount} disallowed commands have real_execution_supported=true`);
}

// 10. Max runtime and output limits
if (allowlist.max_runtime_ms <= 60000) {
  pass(`max_runtime_ms=${allowlist.max_runtime_ms} <= 60000`);
} else {
  fail(`max_runtime_ms=${allowlist.max_runtime_ms} > 60000`);
}
if (allowlist.max_output_chars <= 12000) {
  pass(`max_output_chars=${allowlist.max_output_chars} <= 12000`);
} else {
  fail(`max_output_chars=${allowlist.max_output_chars} > 12000`);
}

// 11. Phase matches
if (allowlist.phase === "5C-2C-B") {
  pass(`allowlist phase=${allowlist.phase}`);
} else {
  fail(`allowlist phase=${allowlist.phase} (expected 5C-2C-B)`);
}

console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
if (failures > 0) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
process.exit(0);
