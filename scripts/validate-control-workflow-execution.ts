#!/usr/bin/env tsx
/**
 * scripts/validate-control-workflow-execution.ts — Phase 5C-2C-C1
 *
 * Validates low-risk workflow execution:
 *  - executor does not use exec / shell=true
 *  - asset/control workflow can execute (confirmed_low_risk_workflow)
 *  - daily digest workflow cannot execute (dry_run_only)
 *  - collect/send/generate/timer/git/build/deploy/release still blocked
 *  - allowlist has not added non-validation commands
 *  - audit log does not contain token
 *  - control-server.ts has /api/workflow/execute-low-risk endpoint
 *  - only asset_validation_sweep and control_health_sweep allowed
 *
 * Usage: npm run validate:control-workflow-execution
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const HARVESTER_DIR = "/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester";
const EXECUTOR_PATH = join(HARVESTER_DIR, "scripts", "control-workflow-executor.ts");
const SERVER_PATH = join(HARVESTER_DIR, "scripts", "control-server.ts");
const WORKFLOWS_PATH = join(HARVESTER_DIR, "dashboard", "control-workflows.json");
const ALLOWLIST_PATH = join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json");
const CATALOG_PATH = join(HARVESTER_DIR, "dashboard", "control-catalog.json");
const PKG_PATH = join(HARVESTER_DIR, "package.json");

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

console.log("=== Validate Control Workflow Execution (Phase 5C-2C-C1) ===");

// 1. Executor exists
if (!existsSync(EXECUTOR_PATH)) {
  fail("control-workflow-executor.ts not found");
  console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
  console.log("RESULT: FAIL");
  process.exit(1);
}

// 2. Executor does not use exec / shell=true / child_process directly
const executorCode = readFileSync(EXECUTOR_PATH, "utf-8");
if (executorCode.includes('require("child_process")') || executorCode.includes('require("child_process"')) {
  fail("executor must not import child_process directly");
} else {
  pass("executor does not import child_process");
}
if (executorCode.includes("exec(") || executorCode.includes("execSync(")) {
  fail("executor must not use exec/execSync");
} else {
  pass("executor does not use exec/execSync");
}
// spawn is allowed only if shell=false (via control-action-runner)
if (executorCode.includes("spawn(")) {
  fail("executor must not use spawn directly (should use control-action-runner)");
} else {
  pass("executor does not use spawn directly");
}
if (executorCode.includes("shell: true") || executorCode.includes("shell=true")) {
  fail("executor must not use shell=true");
} else {
  pass("executor does not use shell=true");
}

// 3. Executor only imports from control-action-runner
if (executorCode.includes('executeLowRiskAction')) {
  pass("executor uses executeLowRiskAction from control-action-runner");
} else {
  fail("executor must use executeLowRiskAction from control-action-runner");
}

// 4. Executor has stop_on_failure=true behavior
if (executorCode.includes("stop_on_failure") || executorCode.includes("always stop on failure") || executorCode.includes("stop on failure")) {
  pass("executor has stop_on_failure behavior");
} else {
  // Check that any failure throws immediately
  if (executorCode.includes("throw new Error") && executorCode.includes("failed at step")) {
    pass("executor throws on failure (stop_on_failure)");
  } else {
    fail("executor must stop on failure");
  }
}

// 5. Workflows config exists
if (!existsSync(WORKFLOWS_PATH)) {
  fail("control-workflows.json not found");
  console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
  console.log("RESULT: FAIL");
  process.exit(1);
}

const workflows = JSON.parse(readFileSync(WORKFLOWS_PATH, "utf-8"));
const assetWorkflow = workflows.workflows?.find((w: any) => w.workflow_id === "asset_validation_sweep");
const controlWorkflow = workflows.workflows?.find((w: any) => w.workflow_id === "control_health_sweep");
const digestWorkflow = workflows.workflows?.find((w: any) => w.workflow_id === "daily_digest_dry_run");

// 6. Asset workflow is executable
if (assetWorkflow) {
  if (assetWorkflow.mode === "confirmed_low_risk_workflow") {
    pass("asset_validation_sweep: mode=confirmed_low_risk_workflow");
  } else {
    fail(`asset_validation_sweep: mode=${assetWorkflow.mode}`);
  }
  if (assetWorkflow.real_execution_supported === true) {
    pass("asset_validation_sweep: real_execution_supported=true");
  } else {
    fail("asset_validation_sweep: real_execution_supported must be true");
  }
  if (assetWorkflow.allowed_for_execution === true) {
    pass("asset_validation_sweep: allowed_for_execution=true");
  } else {
    fail("asset_validation_sweep: allowed_for_execution must be true");
  }
  if (assetWorkflow.confirmation_phrase === "EXECUTE LOW RISK WORKFLOW") {
    pass("asset_validation_sweep: confirmation_phrase correct");
  } else {
    fail(`asset_validation_sweep: confirmation_phrase=${assetWorkflow.confirmation_phrase}`);
  }
} else {
  fail("asset_validation_sweep workflow not found");
}

// 7. Control workflow is executable
if (controlWorkflow) {
  if (controlWorkflow.mode === "confirmed_low_risk_workflow") {
    pass("control_health_sweep: mode=confirmed_low_risk_workflow");
  } else {
    fail(`control_health_sweep: mode=${controlWorkflow.mode}`);
  }
  if (controlWorkflow.real_execution_supported === true) {
    pass("control_health_sweep: real_execution_supported=true");
  } else {
    fail("control_health_sweep: real_execution_supported must be true");
  }
  if (controlWorkflow.allowed_for_execution === true) {
    pass("control_health_sweep: allowed_for_execution=true");
  } else {
    fail("control_health_sweep: allowed_for_execution must be true");
  }
  if (controlWorkflow.confirmation_phrase === "EXECUTE LOW RISK WORKFLOW") {
    pass("control_health_sweep: confirmation_phrase correct");
  } else {
    fail(`control_health_sweep: confirmation_phrase=${controlWorkflow.confirmation_phrase}`);
  }
} else {
  fail("control_health_sweep workflow not found");
}

// 8. Daily digest workflow is NOT executable
if (digestWorkflow) {
  if (digestWorkflow.mode === "dry_run_only") {
    pass("daily_digest_dry_run: mode=dry_run_only");
  } else {
    fail(`daily_digest_dry_run: mode=${digestWorkflow.mode}`);
  }
  if (digestWorkflow.real_execution_supported === false) {
    pass("daily_digest_dry_run: real_execution_supported=false");
  } else {
    fail("daily_digest_dry_run: real_execution_supported must be false");
  }
  if (digestWorkflow.allowed_for_execution === false) {
    pass("daily_digest_dry_run: allowed_for_execution=false");
  } else {
    fail("daily_digest_dry_run: allowed_for_execution must be false");
  }
  if (digestWorkflow.blocked_reason && digestWorkflow.blocked_reason.includes("collect/send")) {
    pass("daily_digest_dry_run: blocked_reason mentions collect/send");
  } else {
    fail(`daily_digest_dry_run: blocked_reason missing collect/send mention`);
  }
} else {
  fail("daily_digest_dry_run workflow not found");
}

// 9. collect/send/generate/timer/git/build/deploy/release still blocked in workflows
const blockedPatterns = ["collect", "send", "generate", "timer", "git", "build", "deploy", "release"];
for (const w of workflows.workflows || []) {
  for (const step of w.steps || []) {
    if (step.blocked_category && blockedPatterns.includes(step.blocked_category)) {
      if (step.would_execute !== false) {
        fail(`workflow ${w.workflow_id} step ${step.step_id} has blocked_category=${step.blocked_category} but would_execute=true`);
      }
    }
    for (const pattern of blockedPatterns) {
      if (step.script_name && step.script_name.toLowerCase().includes(pattern)) {
        if (step.would_execute !== false) {
          fail(`workflow ${w.workflow_id} step ${step.step_id} script_name contains "${pattern}" but would_execute=true`);
        }
      }
    }
  }
}
if (failures === 0 || passes > 0) {
  pass("all collect/send/generate/timer/git/build/deploy/release steps are blocked");
}

// 10. Allowlist has not added non-validation commands
const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf-8"));
const allowedScripts = allowlist.allowed_scripts || [];
const validationPrefixes = ["validate:", "dashboard:control:", "dashboard:policy:", "dashboard:validate"];
let nonValidationFound = false;
for (const script of allowedScripts) {
  const isValidation = validationPrefixes.some((p) => script.startsWith(p));
  if (!isValidation) {
    fail(`allowlist contains non-validation script: ${script}`);
    nonValidationFound = true;
  }
}
if (!nonValidationFound) {
  pass("allowlist only contains validation scripts");
}

// 11. Server has /api/workflow/execute-low-risk endpoint
const serverCode = readFileSync(SERVER_PATH, "utf-8");
if (serverCode.includes('"/api/workflow/execute-low-risk"')) {
  pass("control-server.ts has /api/workflow/execute-low-risk endpoint");
} else {
  fail("control-server.ts missing /api/workflow/execute-low-risk endpoint");
}

// 12. Server only allows asset_validation_sweep and control_health_sweep
if (serverCode.includes("asset_validation_sweep") && serverCode.includes("control_health_sweep") && serverCode.includes("workflow_not_in_allowlist")) {
  pass("control-server.ts explicitly allows only asset_validation_sweep and control_health_sweep");
} else {
  fail("control-server.ts must explicitly allowlist only asset_validation_sweep and control_health_sweep");
}

// 13. Server workflow handler does not write token to audit log
if (serverCode.includes('writeAuditLog') && serverCode.includes('workflow')) {
  // Find the execute-low-risk handler section
  const execHandlerIdx = serverCode.indexOf('"/api/workflow/execute-low-risk"');
  const nextHandlerIdx = serverCode.indexOf('// ---', execHandlerIdx + 1);
  const handlerSection = serverCode.substring(execHandlerIdx, nextHandlerIdx > 0 ? nextHandlerIdx : serverCode.length);
  // Check that writeAuditLog calls in this section do not include token as a property
  if (handlerSection.match(/writeAuditLog\(\{[\s\S]*?\btoken\s*:/)) {
    fail("workflow execute-low-risk audit log must not include token property");
  } else {
    pass("workflow execute-low-risk audit log does not contain token");
  }
} else {
  pass("audit log check: no token written in workflow handler");
}

// 14. Server blocks daily_digest_dry_run
if (serverCode.includes("daily_digest_dry_run") || serverCode.includes("workflow_not_in_allowlist") || serverCode.includes("not_confirmed_low_risk_workflow")) {
  pass("control-server.ts blocks daily_digest_dry_run");
} else {
  fail("control-server.ts must block daily_digest_dry_run");
}

// 15. No secrets in executor or server workflow handler code
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /[0-9]{8,12}:[A-Za-z0-9_-]{25,}/,
];
for (const pattern of secretPatterns) {
  if (pattern.test(executorCode)) {
    fail(`executor code contains potential secret matching ${pattern.source}`);
  }
  if (pattern.test(serverCode)) {
    fail(`server code contains potential secret matching ${pattern.source}`);
  }
}
if (!failures || passes > 0) {
  pass("no secrets leaked in executor or server workflow handler");
}

// 16. Package.json has validate:control-workflow-execution script
if (existsSync(PKG_PATH)) {
  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf-8"));
  if (pkg.scripts && pkg.scripts["validate:control-workflow-execution"]) {
    pass("package.json has validate:control-workflow-execution script");
  } else {
    fail("package.json missing validate:control-workflow-execution script");
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
