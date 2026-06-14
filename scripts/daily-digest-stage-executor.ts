/**
 * daily-digest-stage-executor.ts
 * Phase 5C-2C-C3: Daily Digest Stage Executor
 *
 * Only executes stage_3_validate_outputs (validation scripts).
 * All other stages (collect/build/send/timer) are blocked.
 * Reuses control-action-runner for safe execution.
 */
import { executeLowRiskAction } from "./control-action-runner";

const ALLOWED_STAGE = "stage_3_validate_outputs";
const CONFIRMATION_PHRASE = "EXECUTE DAILY VALIDATION";
const ALLOWED_SCRIPTS = [
  "validate:daily-archive",
  "dashboard:validate",
  "dashboard:control:validate",
];

export interface StageExecutionResult {
  stage_id: string;
  real_execution: boolean;
  steps_total: number;
  steps_completed: number;
  steps_failed: number;
  results: Array<{
    step_id: string;
    script_name: string;
    exit_code: number;
    timed_out: boolean;
    duration_ms: number;
    stdout_tail: string;
    stderr_tail: string;
  }>;
  error?: string;
  message: string;
}

export async function executeStage(
  stage_id: string,
  confirm_phrase: string
): Promise<StageExecutionResult> {
  // Stage allowlist check
  if (stage_id !== ALLOWED_STAGE) {
    return {
      stage_id,
      real_execution: false,
      steps_total: 0,
      steps_completed: 0,
      steps_failed: 0,
      results: [],
      error: `stage_not_allowed`,
      message: `Stage "${stage_id}" is not allowed. Only "${ALLOWED_STAGE}" can be executed.`,
    };
  }

  // Confirmation phrase check
  if (confirm_phrase !== CONFIRMATION_PHRASE) {
    return {
      stage_id,
      real_execution: false,
      steps_total: 0,
      steps_completed: 0,
      steps_failed: 0,
      results: [],
      error: `confirm_phrase_mismatch`,
      message: `Confirmation phrase mismatch. Expected: "${CONFIRMATION_PHRASE}".`,
    };
  }

  const results: StageExecutionResult["results"] = [];
  let steps_completed = 0;
  let steps_failed = 0;

  for (const scriptName of ALLOWED_SCRIPTS) {
    const step_id = `${stage_id}:${scriptName}`;
    const result = await executeLowRiskAction(scriptName, step_id);

    results.push({
      step_id,
      script_name: scriptName,
      exit_code: result.exitCode,
      timed_out: result.timedOut,
      duration_ms: result.duration_ms,
      stdout_tail: result.stdout_tail,
      stderr_tail: result.stderr_tail,
    });

    if (result.exitCode === 0) {
      steps_completed++;
    } else {
      steps_failed++;
      // stop_on_failure=true
      return {
        stage_id,
        real_execution: true,
        steps_total: ALLOWED_SCRIPTS.length,
        steps_completed,
        steps_failed,
        results,
        error: `step_failed`,
        message: `Step ${step_id} failed (exit_code=${result.exitCode}). Stopping execution.`,
      };
    }
  }

  return {
    stage_id,
    real_execution: true,
    steps_total: ALLOWED_SCRIPTS.length,
    steps_completed,
    steps_failed,
    results,
    message: `Stage ${stage_id} executed successfully. ${steps_completed}/${ALLOWED_SCRIPTS.length} scripts completed.`,
  };
}

// CLI usage for testing
if (require.main === module) {
  const stage_id = process.argv[2] || ALLOWED_STAGE;
  const confirm_phrase = process.argv[3] || CONFIRMATION_PHRASE;
  executeStage(stage_id, confirm_phrase).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.steps_failed > 0 ? 1 : 0);
  });
}
