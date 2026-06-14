import * as path from "path";
import { executeLowRiskAction } from "./control-action-runner";

const HARVESTER_DIR = path.resolve(__dirname, "..");

interface WorkflowStep {
  step_id: string;
  action_id: string;
  script_name: string;
  risk_level: string;
  would_execute: boolean;
  allowed_for_low_risk_execution?: boolean;
  blocked_reason?: string | null;
  blocked_category?: string | null;
  requires_confirm: boolean;
}

interface Workflow {
  workflow_id: string;
  label_zh: string;
  description_zh: string;
  mode: string;
  real_execution_supported: boolean;
  confirmation_phrase?: string;
  allowed_for_execution?: boolean;
  blocked_reason?: string;
  steps: WorkflowStep[];
}

interface WorkflowResult {
  workflow_id: string;
  real_execution: boolean;
  mode: string;
  steps_total: number;
  steps_completed: number;
  steps_failed: number;
  timed_out: boolean;
  results: Array<{
    step_id: string;
    action_id: string;
    script_name: string;
    exit_code: number;
    duration_ms: number;
    stdout_tail: string;
    stderr_tail: string;
  }>;
}

function readJson<T>(filepath: string): T | null {
  try {
    return JSON.parse(require("fs").readFileSync(filepath, "utf-8")) as T;
  } catch {
    return null;
  }
}

export async function executeWorkflow(workflowId: string): Promise<WorkflowResult | null> {
  const workflows = readJson<{ workflows: Workflow[] }>(
    path.join(HARVESTER_DIR, "dashboard", "control-workflows.json")
  );
  if (!workflows || !workflows.workflows) {
    return null;
  }

  const workflow = workflows.workflows.find((w) => w.workflow_id === workflowId);
  if (!workflow) {
    return null;
  }

  // Only allow confirmed_low_risk_workflow mode
  if (workflow.mode !== "confirmed_low_risk_workflow") {
    throw new Error(`Workflow ${workflowId} is not confirmed_low_risk_workflow: mode=${workflow.mode}`);
  }
  if (!workflow.real_execution_supported) {
    throw new Error(`Workflow ${workflowId} does not support real execution`);
  }
  if (workflow.allowed_for_execution === false) {
    throw new Error(`Workflow ${workflowId} is not allowed for execution: ${workflow.blocked_reason || "blocked"}`);
  }

  // Load allowlist to verify each step
  const allowlist = readJson<any>(path.join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json"));
  const allowedScripts = new Set(allowlist?.allowed_scripts || []);
  const blockedPatterns = (allowlist?.blocked_patterns || []) as string[];

  const results: WorkflowResult["results"] = [];
  let steps_completed = 0;
  let steps_failed = 0;
  let timed_out = false;

  for (const step of workflow.steps) {
    // Skip blocked steps (they should not be in allowed workflow, but double-check)
    if (!step.would_execute || step.blocked_reason || step.blocked_category) {
      continue;
    }

    if (step.risk_level !== "safe") {
      throw new Error(`Step ${step.step_id} is not safe: ${step.risk_level}`);
    }

    // Verify script is in allowlist
    if (!allowedScripts.has(step.script_name)) {
      throw new Error(`Step ${step.step_id} script ${step.script_name} not in allowlist`);
    }

    // Verify script does not match blocked patterns
    for (const pattern of blockedPatterns) {
      if (step.script_name.toLowerCase().includes(pattern.toLowerCase()) ||
          step.action_id.toLowerCase().includes(pattern.toLowerCase())) {
        throw new Error(`Step ${step.step_id} matches blocked pattern: ${pattern}`);
      }
    }

    // Execute via existing runner
    try {
      const result = await executeLowRiskAction(step.script_name, step.action_id);
      results.push({
        step_id: step.step_id,
        action_id: step.action_id,
        script_name: step.script_name,
        exit_code: result.exitCode,
        duration_ms: result.duration_ms,
        stdout_tail: result.stdout_tail,
        stderr_tail: result.stderr_tail,
      });
      steps_completed++;
      if (result.exitCode !== 0) {
        steps_failed++;
      }
      if (result.timedOut) {
        timed_out = true;
      }
    } catch (err: any) {
      results.push({
        step_id: step.step_id,
        action_id: step.action_id,
        script_name: step.script_name,
        exit_code: -1,
        duration_ms: 0,
        stdout_tail: "",
        stderr_tail: err.message || "unknown",
      });
      steps_failed++;
      // stop_on_failure=true: always stop on failure
      throw new Error(`Workflow ${workflowId} failed at step ${step.step_id}: ${err.message}`);
    }
  }

  return {
    workflow_id: workflow.workflow_id,
    real_execution: true,
    mode: workflow.mode,
    steps_total: workflow.steps.length,
    steps_completed,
    steps_failed,
    timed_out,
    results,
  };
}

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Usage: tsx scripts/control-workflow-executor.ts <workflow-id>");
    process.exit(1);
  }

  executeWorkflow(args[0])
    .then((result) => {
      if (!result) {
        console.error("Workflow not found");
        process.exit(1);
      }
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}
