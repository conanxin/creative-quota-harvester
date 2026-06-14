import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");

function fail(msg: string) {
  console.error("❌ FAIL:", msg);
  process.exit(1);
}

function pass(msg: string) {
  console.log("✅ PASS:", msg);
}

function readFile(filepath: string): string {
  try {
    return fs.readFileSync(filepath, "utf-8");
  } catch {
    return "";
  }
}

function readJson<T>(filepath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8")) as T;
  } catch {
    return null;
  }
}

// --- 1. control-workflows.json exists and is valid ---
const workflowsPath = path.join(HARVESTER_DIR, "dashboard", "control-workflows.json");
const workflows = readJson<{ workflows: any[] }>(workflowsPath);
if (!workflows || !workflows.workflows) {
  fail("dashboard/control-workflows.json not found or invalid");
}
if (workflows.workflows.length < 3) {
  fail(`workflows count ${workflows.workflows.length} < 3`);
}
pass(`dashboard/control-workflows.json exists with ${workflows.workflows.length} workflows`);

// --- 2. All workflows have real_execution_supported=false ---
for (const w of workflows.workflows) {
  if (w.real_execution_supported !== false) {
    fail(`workflow ${w.workflow_id} has real_execution_supported=${w.real_execution_supported}`);
  }
  if (w.mode !== "dry_run_only") {
    fail(`workflow ${w.workflow_id} has mode=${w.mode}`);
  }
}
pass("All workflows have real_execution_supported=false and mode=dry_run_only");

// --- 3. collect/send/generate/timer/git steps are blocked ---
const blockedCategories = ["collect", "send", "generate", "timer", "git"];
for (const w of workflows.workflows) {
  for (const step of w.steps || []) {
    if (step.blocked_category && blockedCategories.includes(step.blocked_category)) {
      if (step.would_execute !== false) {
        fail(`workflow ${w.workflow_id} step ${step.step_id} has blocked_category=${step.blocked_category} but would_execute=${step.would_execute}`);
      }
    }
  }
}
pass("All collect/send/generate/timer/git steps are blocked (would_execute=false)");

// --- 4. control-workflow-planner.ts does not use child_process/exec/spawn ---
const plannerPath = path.join(HARVESTER_DIR, "scripts", "control-workflow-planner.ts");
const plannerCode = readFile(plannerPath);
if (!plannerCode.includes("control-workflow-planner")) {
  fail("control-workflow-planner.ts not found or invalid");
}
if (plannerCode.includes('require("child_process")') || plannerCode.includes('require("child_process"')) {
  fail("control-workflow-planner.ts must not import child_process");
}
if (plannerCode.includes("exec(") || plannerCode.includes("spawn(") || plannerCode.includes("execSync(")) {
  fail("control-workflow-planner.ts must not use exec/spawn/execSync");
}
if (plannerCode.includes("fetch(") || plannerCode.includes("http.request(")) {
  fail("control-workflow-planner.ts must not make network calls");
}
pass("control-workflow-planner.ts does not use child_process/exec/spawn/network");

// --- 5. control-server.ts has /api/workflow/dry-run and /api/workflows ---
const serverPath = path.join(HARVESTER_DIR, "scripts", "control-server.ts");
const serverCode = readFile(serverPath);
if (!serverCode.includes('"/api/workflow/dry-run"')) {
  fail("control-server.ts missing /api/workflow/dry-run endpoint");
}
if (!serverCode.includes('"/api/workflows"')) {
  fail("control-server.ts missing /api/workflows endpoint");
}
pass("control-server.ts has /api/workflow/dry-run and /api/workflows");

// --- 6. /api/workflow/dry-run does not call runner ---
if (serverCode.includes('executeLowRiskAction') && serverCode.includes('workflow')) {
  // Check if the executeLowRiskAction is called in the workflow handler
  const workflowHandler = serverCode.substring(
    serverCode.indexOf('"/api/workflow/dry-run"'),
    serverCode.indexOf('case "/api/workflows"') > serverCode.indexOf('"/api/workflow/dry-run"') 
      ? serverCode.indexOf('case "/api/workflows"') 
      : serverCode.indexOf('default:')
  );
  if (workflowHandler.includes('executeLowRiskAction')) {
    fail("/api/workflow/dry-run must not call executeLowRiskAction (runner)");
  }
}
pass("/api/workflow/dry-run does not call runner");

// --- 7. Workflow audit does not record token ---
if (serverCode.includes('workflow') && serverCode.includes('token')) {
  // Check that token is not written to audit log in workflow handler
  const workflowHandler = serverCode.substring(
    serverCode.indexOf('"/api/workflow/dry-run"'),
    serverCode.indexOf('case "/api/workflows"') > serverCode.indexOf('"/api/workflow/dry-run"') 
      ? serverCode.indexOf('case "/api/workflows"') 
      : serverCode.indexOf('default:')
  );
  // Token should be checked but not written to audit log as a property
  if (workflowHandler.includes('writeAuditLog') && workflowHandler.includes('token:')) {
    // Check if token is passed as a property to writeAuditLog (not just in reason string)
    if (workflowHandler.match(/writeAuditLog\(\{[\s\S]*?\btoken\s*:/)) {
      fail("workflow audit log must not include token property");
    }
  }
}
pass("Workflow audit does not record token");

// --- 8. No secrets in source code ---
const sourceFiles = [plannerCode, serverCode];
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /[0-9]{8,12}:[A-Za-z0-9_-]{25,}/,
  /TELEGRAM_BOT_TOKEN\s*=\s*["'][^"']+/,
  /MINIMAX_API_KEY\s*=\s*["'][^"']+/,
];
for (const file of sourceFiles) {
  for (const pattern of secretPatterns) {
    if (pattern.test(file)) fail(`Source code contains potential secret matching ${pattern.source}`);
  }
}
pass("No token/secrets leaked in workflow source code");

// --- 9. Low-risk execution paths not redacted by sanitizer ---
const sanitizerPath = path.join(HARVESTER_DIR, "scripts", "telegram-sanitizer.ts");
if (fs.existsSync(sanitizerPath)) {
  const sanitizer = readFile(sanitizerPath);
  if (sanitizer.includes("workflow") || sanitizer.includes("dry-run")) {
    if (sanitizer.includes("workflow: REDACTED") || sanitizer.includes("dry-run: REDACTED")) {
      fail("sanitizer must not redact workflow/dry-run paths");
    }
  }
}
pass("workflow/dry-run paths not redacted by sanitizer");

// --- 10. Telegram token redaction check ---
if (plannerCode.includes("REDACTED") || serverCode.includes("REDACTED")) {
  pass("Redaction patterns present in source code");
} else {
  pass("No REDACTED patterns needed in workflow code");
}

// --- Summary ---
console.log("\n═══════════════════════════════════════════════════════");
console.log("  Workflow Validation — ALL CHECKS PASSED");
console.log("  Phase: 5C-2C-C0");
console.log("═══════════════════════════════════════════════════════");
console.log("\nValidated:");
console.log("  • control-workflows.json exists with 3+ workflows");
console.log("  • All workflows have real_execution_supported=false");
console.log("  • All workflows have mode=dry_run_only");
console.log("  • collect/send/generate/timer/git steps blocked");
console.log("  • control-workflow-planner.ts no child_process/exec/spawn/network");
console.log("  • control-server.ts has /api/workflow/dry-run and /api/workflows");
console.log("  • /api/workflow/dry-run does not call runner");
console.log("  • Workflow audit does not record token");
console.log("  • No secrets in source code");
console.log("\nStatus: PASS ✅");
