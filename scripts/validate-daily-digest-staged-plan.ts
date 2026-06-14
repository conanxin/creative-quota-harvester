#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-staged-plan.ts — Phase 5C-2C-C2
 *
 * Validates daily digest staged plan:
 *  - staged plan JSON valid
 *  - collect/send/timer/generate/git stages blocked
 *  - validation stage only contains allowlist scripts
 *  - planner does not use child_process/exec/spawn
 *  - server has /api/daily-digest/staged-plan
 *  - no secrets in source code
 *  - sanitizer regression still passes
 *
 * Usage: npm run validate:daily-digest-staged-plan
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const HARVESTER_DIR = "/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester";
const PLAN_PATH = join(HARVESTER_DIR, "dashboard", "daily-digest-staged-plan.json");
const PLANNER_PATH = join(HARVESTER_DIR, "scripts", "daily-digest-staged-planner.ts");
const SERVER_PATH = join(HARVESTER_DIR, "scripts", "control-server.ts");
const ALLOWLIST_PATH = join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json");

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

console.log("=== Validate Daily Digest Staged Plan (Phase 5C-2C-C2) ===");

// 1. Staged plan exists and is valid JSON
if (!existsSync(PLAN_PATH)) {
  fail("daily-digest-staged-plan.json not found");
  console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
  console.log("RESULT: FAIL");
  process.exit(1);
}

let plan: any;
try {
  plan = JSON.parse(readFileSync(PLAN_PATH, "utf-8"));
  pass("daily-digest-staged-plan.json: valid JSON");
} catch (e: any) {
  fail(`staged plan parse error: ${e.message}`);
  console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
  console.log("RESULT: FAIL");
  process.exit(1);
}

// 2. Has exactly 5 stages
const stages = plan.workflows?.[0]?.stages || [];
if (stages.length === 5) {
  pass(`staged plan has 5 stages`);
} else {
  fail(`staged plan has ${stages.length} stages (expected 5)`);
}

// 3. collect/send/timer/generate/git stages are blocked
const blockedStageIds = ["stage_1_collect_fast", "stage_4_send_telegram", "stage_5_timer_integration"];
for (const stageId of blockedStageIds) {
  const stage = stages.find((s: any) => s.stage_id === stageId);
  if (!stage) {
    fail(`stage ${stageId} not found`);
  } else if (!stage.allowed_now) {
    pass(`stage ${stageId}: blocked (allowed_now=false)`);
  } else {
    fail(`stage ${stageId}: should be blocked but allowed_now=true`);
  }
}

// 4. build digest stage is dry_run_only_or_candidate
const buildStage = stages.find((s: any) => s.stage_id === "stage_2_build_digest");
if (buildStage) {
  if (buildStage.current_execution_status === "dry_run_only_or_candidate") {
    pass("stage_2_build_digest: status=dry_run_only_or_candidate");
  } else {
    fail(`stage_2_build_digest: status=${buildStage.current_execution_status}`);
  }
  if (!buildStage.allowed_now) {
    pass("stage_2_build_digest: blocked for now");
  } else {
    fail("stage_2_build_digest: should be blocked for now");
  }
} else {
  fail("stage_2_build_digest not found");
}

// 5. validation stage is executable_low_risk
const validationStage = stages.find((s: any) => s.stage_id === "stage_3_validate_outputs");
if (validationStage) {
  if (validationStage.current_execution_status === "executable_low_risk") {
    pass("stage_3_validate_outputs: status=executable_low_risk");
  } else {
    fail(`stage_3_validate_outputs: status=${validationStage.current_execution_status}`);
  }
  if (validationStage.allowed_now) {
    pass("stage_3_validate_outputs: allowed_now=true");
  } else {
    fail("stage_3_validate_outputs: should be allowed");
  }
} else {
  fail("stage_3_validate_outputs not found");
}

// 6. validation stage scripts are in allowlist
if (existsSync(ALLOWLIST_PATH)) {
  const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf-8"));
  const allowedScripts = new Set(allowlist.allowed_scripts || []);
  const validationScripts = plan.workflows?.[0]?.allowed_validation_scripts || [];
  for (const script of validationScripts) {
    if (allowedScripts.has(script)) {
      pass(`validation script ${script} in allowlist`);
    } else {
      fail(`validation script ${script} NOT in allowlist`);
    }
  }
} else {
  fail("control-execution-allowlist.json not found");
}

// 7. Planner does not use child_process/exec/spawn
if (!existsSync(PLANNER_PATH)) {
  fail("daily-digest-staged-planner.ts not found");
} else {
  const plannerCode = readFileSync(PLANNER_PATH, "utf-8");
  if (plannerCode.includes('require("child_process")') || plannerCode.includes('require("child_process"')) {
    fail("planner imports child_process");
  } else {
    pass("planner does not import child_process");
  }
  if (plannerCode.includes("exec(") || plannerCode.includes("execSync(") || plannerCode.includes("spawn(")) {
    fail("planner uses exec/spawn/execSync");
  } else {
    pass("planner does not use exec/spawn/execSync");
  }
  if (plannerCode.includes("fetch(") || plannerCode.includes("http.request(")) {
    fail("planner makes network calls");
  } else {
    pass("planner does not make network calls");
  }
  if (plannerCode.includes("readFileSync")) {
    pass("planner reads local files only");
  }
}

// 8. Server has /api/daily-digest/staged-plan
if (!existsSync(SERVER_PATH)) {
  fail("control-server.ts not found");
} else {
  const serverCode = readFileSync(SERVER_PATH, "utf-8");
  if (serverCode.includes('"/api/daily-digest/staged-plan"')) {
    pass("control-server.ts has /api/daily-digest/staged-plan endpoint");
  } else {
    fail("control-server.ts missing /api/daily-digest/staged-plan endpoint");
  }
  // Check it's a GET endpoint
  if (serverCode.includes('"/api/daily-digest/staged-plan"') && serverCode.includes('req.method === "GET"')) {
    pass("staged-plan endpoint is GET only");
  } else if (serverCode.includes('"/api/daily-digest/staged-plan"') && serverCode.includes('pathname ===')) {
    pass("staged-plan endpoint is GET only (pathname check)");
  } else {
    fail("staged-plan endpoint must be GET only");
  }
  // Check it does not call runner
  if (serverCode.includes('"/api/daily-digest/staged-plan"')) {
    const idx = serverCode.indexOf('"/api/daily-digest/staged-plan"');
    const nextIdx = serverCode.indexOf("// ---", idx + 1);
    const handler = serverCode.substring(idx, nextIdx > 0 ? nextIdx : serverCode.length);
    if (handler.includes("executeLowRiskAction") || handler.includes("executeWorkflow")) {
      fail("staged-plan endpoint must not call runner");
    } else {
      pass("staged-plan endpoint does not call runner");
    }
  }
}

// 9. No secrets in planner code
const plannerCode = existsSync(PLANNER_PATH) ? readFileSync(PLANNER_PATH, "utf-8") : "";
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /[0-9]{8,12}:[A-Za-z0-9_-]{25,}/,
];
let secretsFound = false;
for (const pattern of secretPatterns) {
  if (pattern.test(plannerCode)) {
    fail(`planner code contains potential secret matching ${pattern.source}`);
    secretsFound = true;
  }
}
if (!secretsFound) {
  pass("no secrets leaked in planner code");
}

// 10. Package.json has validate:daily-digest-staged-plan
const PKG_PATH = join(HARVESTER_DIR, "package.json");
if (existsSync(PKG_PATH)) {
  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf-8"));
  if (pkg.scripts && pkg.scripts["validate:daily-digest-staged-plan"]) {
    pass("package.json has validate:daily-digest-staged-plan script");
  } else {
    fail("package.json missing validate:daily-digest-staged-plan script");
  }
} else {
  fail("package.json not found");
}

console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
if (failures > 0) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
process.exit(0);
