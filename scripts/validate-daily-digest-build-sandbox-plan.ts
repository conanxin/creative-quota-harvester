/**
 * validate-daily-digest-build-sandbox-plan.ts
 * Phase 5C-2C-C4: Daily Digest Build Sandbox Plan Validator
 *
 * Validates sandbox plan JSON, planner safety, and server endpoint.
 */
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SANDBOX_PLAN_PATH = path.join(PROJECT_ROOT, "dashboard", "daily-digest-build-sandbox-plan.json");
const PLANNER_PATH = path.join(PROJECT_ROOT, "scripts", "daily-digest-build-sandbox-planner.ts");
const SERVER_PATH = path.join(PROJECT_ROOT, "scripts", "control-server.ts");

const CHECKS: { name: string; pass: boolean }[] = [];
function check(name: string, condition: boolean) {
  CHECKS.push({ name, pass: condition });
  console.log(condition ? `PASS  ${name}` : `FAIL  ${name}`);
}

function loadJson<T>(filepath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf8")) as T;
  } catch {
    return null;
  }
}

function loadText(filepath: string): string {
  try {
    return fs.readFileSync(filepath, "utf8");
  } catch {
    return "";
  }
}

function main() {
  console.log("=== Validate Daily Digest Build Sandbox Plan (Phase 5C-2C-C4) ===\n");

  // 1. Sandbox plan JSON exists and is valid
  const plan = loadJson<any>(SANDBOX_PLAN_PATH);
  check("sandbox-plan.json: valid JSON", !!plan);
  check("sandbox-plan.json: version exists", !!plan?.version);
  check("sandbox-plan.json: phase=5C-2C-C4", plan?.phase === "5C-2C-C4");
  check("sandbox-plan.json: mode=sandbox_plan_only", plan?.mode === "sandbox_plan_only");
  check("sandbox-plan.json: real_execution_supported=false", plan?.real_execution_supported === false);
  check("sandbox-plan.json: production_write_allowed=false", plan?.production_write_allowed === false);
  check("sandbox-plan.json: telegram_send_allowed=false", plan?.telegram_send_allowed === false);
  check("sandbox-plan.json: collect_allowed=false", plan?.collect_allowed === false);
  check("sandbox-plan.json: timer_allowed=false", plan?.timer_allowed === false);

  // 2. Blocked actions
  const blockedActions = plan?.blocked_actions || [];
  check("collect blocked", blockedActions.includes("collect"));
  check("send blocked", blockedActions.includes("send"));
  check("timer blocked", blockedActions.includes("timer"));
  check("generate blocked", blockedActions.includes("generate"));
  check("git blocked", blockedActions.includes("git"));
  check("promote blocked", blockedActions.includes("promote"));

  // 3. Protected paths
  const protectedPaths = plan?.protected_paths || [];
  check("protected_paths includes reports/daily-digest.md", protectedPaths.includes("reports/daily-digest.md"));
  check("protected_paths includes reports/telegram-digest.txt", protectedPaths.includes("reports/telegram-digest.txt"));
  check("protected_paths includes dashboard/status.json", protectedPaths.includes("dashboard/status.json"));
  check("protected_paths count >= 5", protectedPaths.length >= 5);

  // 4. Sandbox paths
  const sandboxPaths = plan?.sandbox_paths || [];
  check("sandbox paths under reports/sandbox/", sandboxPaths.every((p: string) => p.includes("reports/sandbox/")));

  // 5. Stages
  const stages = plan?.stages || [];
  check("has 6 stages", stages.length === 6);
  check("stage_a_prepare_sandbox exists", stages.some((s: any) => s.stage_id === "stage_a_prepare_sandbox"));
  check("stage_b_build_digest_sandbox exists", stages.some((s: any) => s.stage_id === "stage_b_build_digest_sandbox"));
  check("stage_c_validate_sandbox_outputs exists", stages.some((s: any) => s.stage_id === "stage_c_validate_sandbox_outputs"));
  check("stage_d_compare_with_production exists", stages.some((s: any) => s.stage_id === "stage_d_compare_with_production"));
  check("stage_e_promote_candidate exists", stages.some((s: any) => s.stage_id === "stage_e_promote_candidate"));
  check("stage_f_send_telegram exists", stages.some((s: any) => s.stage_id === "stage_f_send_telegram"));

  // 6. All stages blocked
  check("all stages allowed_now=false", stages.every((s: any) => s.allowed_now === false));

  // 7. Planner safety
  const plannerText = loadText(PLANNER_PATH);
  check("planner exists", plannerText.length > 0);
  check("planner: no child_process", !plannerText.includes('require("child_process")') && !plannerText.includes("import { spawn }"));
  check("planner: no exec", !plannerText.includes("exec(") && !plannerText.includes("execSync("));
  check("planner: no spawn", !plannerText.includes("spawn("));
  check("planner: no network", !plannerText.includes("fetch(") && !plannerText.includes("http.request"));
  check("planner: no secrets read", !plannerText.includes(".env") && !plannerText.includes(".control.local"));
  check("planner: no token/leaks", !plannerText.includes("CQA_CONTROL_TOKEN") && !plannerText.includes("TELEGRAM_BOT_TOKEN") && !plannerText.includes("MINIMAX_API_KEY"));

  // 8. Server endpoint - check that build-sandbox-plan block doesn't call runner
  const serverText = loadText(SERVER_PATH);
  // Find the exact case block for build-sandbox-plan
  const blockStart = serverText.indexOf('case "/api/daily-digest/build-sandbox-plan": {');
  const nextCase = serverText.indexOf('case "/api/daily-digest/sandbox', blockStart + 1);
  const defaultCase = serverText.indexOf('default:', blockStart + 1);
  const blockEnd = nextCase > 0 ? nextCase : (defaultCase > 0 ? defaultCase : serverText.length);
  const buildSandboxBlock = serverText.substring(blockStart, blockEnd);
  check("server: has /api/daily-digest/build-sandbox-plan", blockStart > 0);
  check("server: endpoint is GET only", buildSandboxBlock.includes('req.method !== "GET"') || buildSandboxBlock.includes('methodNotAllowed'));
  check("server: endpoint does not call runner", !buildSandboxBlock.includes("executeLowRiskAction") && !buildSandboxBlock.includes("executeLowRiskAction") && !buildSandboxBlock.includes("executeStage"));
  check("server: no token in endpoint", !buildSandboxBlock.includes("token") || buildSandboxBlock.includes("redact"));

  // 9. package.json
  const packageJson = loadJson<any>(path.join(PROJECT_ROOT, "package.json"));
  check("package.json: has validate:daily-digest-build-sandbox-plan script", !!packageJson?.scripts?.["validate:daily-digest-build-sandbox-plan"]);

  // 10. No secrets in plan JSON
  const planRaw = loadText(SANDBOX_PLAN_PATH);
  check("sandbox plan: no secrets", !planRaw.includes("CQA_CONTROL_TOKEN") && !planRaw.includes("TELEGRAM_BOT_TOKEN") && !planRaw.includes("MINIMAX_API_KEY") && !planRaw.includes("sk-cp"));

  const total = CHECKS.length;
  const passed = CHECKS.filter((c) => c.pass).length;
  const failed = CHECKS.filter((c) => !c.pass).length;

  console.log(`\nSummary: PASS=***  FAIL=${failed}`);
  console.log(`RESULT: ${failed === 0 ? "PASS" : "FAIL"}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
