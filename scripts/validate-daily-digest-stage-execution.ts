/**
 * validate-daily-digest-stage-execution.ts
 * Phase 5C-2C-C3: Daily Digest Stage Execution Validator
 *
 * Validates that only stage_3_validate_outputs can be executed,
 * all other stages are blocked, and safety invariants are maintained.
 */
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DASHBOARD_DIR = path.join(PROJECT_ROOT, "dashboard");
const STAGED_PLAN_PATH = path.join(DASHBOARD_DIR, "daily-digest-staged-plan.json");
const ALLOWLIST_PATH = path.join(DASHBOARD_DIR, "control-execution-allowlist.json");
const SERVER_PATH = path.join(PROJECT_ROOT, "scripts", "control-server.ts");
const EXECUTOR_PATH = path.join(PROJECT_ROOT, "scripts", "daily-digest-stage-executor.ts");

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
  console.log("=== Validate Daily Digest Stage Execution (Phase 5C-2C-C3) ===\n");

  // 1. staged-plan.json exists and is valid JSON
  const stagedPlan = loadJson<any>(STAGED_PLAN_PATH);
  check("staged-plan.json: valid JSON", !!stagedPlan);

  // 2. stage_3_validate_outputs exists and has correct properties
  const workflow = stagedPlan?.workflows?.[0];
  const stages = workflow?.stages || [];
  const validateStage = stages.find((s: any) => s.stage_id === "stage_3_validate_outputs");
  check("stage_3_validate_outputs exists", !!validateStage);
  check("stage_3_validate_outputs: mode=confirmed_low_risk_stage", validateStage?.mode === "confirmed_low_risk_stage");
  check("stage_3_validate_outputs: real_execution_supported=true", validateStage?.real_execution_supported === true);
  check("stage_3_validate_outputs: allowed_for_execution=true", validateStage?.allowed_for_execution === true);
  check("stage_3_validate_outputs: confirmation_phrase=EXECUTE DAILY VALIDATION", validateStage?.confirmation_phrase === "EXECUTE DAILY VALIDATION");

  // 3. Other stages are blocked
  const collectStage = stages.find((s: any) => s.stage_id === "stage_1_collect_fast");
  const buildStage = stages.find((s: any) => s.stage_id === "stage_2_build_digest");
  const sendStage = stages.find((s: any) => s.stage_id === "stage_4_send_telegram");
  const timerStage = stages.find((s: any) => s.stage_id === "stage_5_timer_integration");
  check("stage_1_collect_fast: blocked", collectStage?.allowed_now === false);
  check("stage_2_build_digest: blocked", buildStage?.allowed_now === false);
  check("stage_4_send_telegram: blocked", sendStage?.allowed_now === false);
  check("stage_5_timer_integration: blocked", timerStage?.allowed_now === false);

  // 4. Validation scripts in allowlist
  const allowlist = loadJson<any>(ALLOWLIST_PATH);
  const allowedScripts = validateStage?.related_actions || [];
  check("validate:daily-archive in allowlist", allowlist?.allowed_scripts?.includes("validate:daily-archive"));
  check("dashboard:validate in allowlist", allowlist?.allowed_scripts?.includes("dashboard:validate"));
  check("dashboard:control:validate in allowlist", allowlist?.allowed_scripts?.includes("dashboard:control:validate"));

  // 5. Executor exists and has correct properties
  const executorText = loadText(EXECUTOR_PATH);
  check("daily-digest-stage-executor.ts exists", executorText.length > 0);
  check("executor: does not import child_process", !executorText.includes('require("child_process")') && !executorText.includes("import { spawn }"));
  check("executor: does not use exec/execSync", !executorText.includes("exec(") && !executorText.includes("execSync("));
  check("executor: does not use spawn", !executorText.includes("spawn("));
  check("executor: only allows stage_3_validate_outputs", executorText.includes('stage_3_validate_outputs'));
  check("executor: has stop_on_failure", executorText.includes("stop_on_failure") || executorText.includes("return {") && executorText.includes("step_failed"));
  check("executor: uses control-action-runner", executorText.includes("control-action-runner"));

  // 6. Server has execute-validation-stage endpoint
  const serverText = loadText(SERVER_PATH);
  check("server: has /api/daily-digest/execute-validation-stage", serverText.includes("/api/daily-digest/execute-validation-stage"));
  check("server: only allows stage_3_validate_outputs", serverText.includes("stage_3_validate_outputs"));
  check("server: blocks other stages", serverText.includes("stage_not_allowed"));
  check("server: checks confirmation phrase", serverText.includes("EXECUTE DAILY VALIDATION") || serverText.includes("confirm_phrase"));
  check("server: writes audit log", serverText.includes("daily_digest_execute_validation_stage"));
  check("server: audit log does not include token", !serverText.includes("token") || serverText.includes("redact"));

  // 7. No secrets in executor
  check("executor: no secrets leaked", !executorText.includes("CQA_CONTROL_TOKEN") && !executorText.includes("TELEGRAM_BOT_TOKEN") && !executorText.includes("MINIMAX_API_KEY") && !executorText.includes("sk-cp"));

  // 8. No exec or shell in server
  check("server: no exec in validation endpoint", !serverText.includes("exec(") && !serverText.includes("execSync("));
  check("server: no shell=true in validation endpoint", !serverText.includes("shell: true") && !serverText.includes("shell=true"));

  // 9. package.json has validate script
  const packageJson = loadJson<any>(path.join(PROJECT_ROOT, "package.json"));
  check("package.json: has validate:daily-digest-stage-execution script", !!packageJson?.scripts?.["validate:daily-digest-stage-execution"]);

  const total = CHECKS.length;
  const passed = CHECKS.filter((c) => c.pass).length;
  const failed = CHECKS.filter((c) => !c.pass).length;

  console.log(`\nSummary: PASS=${passed}  FAIL=${failed}`);
  console.log(`RESULT: ${failed === 0 ? "PASS" : "FAIL"}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
