/**
 * control-workflow-planner.ts
 * Phase 5C-2C-C0: Workflow Dry-run Planner
 *
 * Generates a dry-run plan for a specified workflow without executing any commands.
 * Only reads configuration files and returns a plan with risk assessment.
 */
import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");

function readJson<T>(filepath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8")) as T;
  } catch {
    return null;
  }
}

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
  steps: WorkflowStep[];
  risk_summary: Record<string, number>;
  blocked_categories: string[];
}

interface WorkflowPlan {
  workflow_id: string;
  mode: string;
  real_execution: boolean;
  steps: Array<{
    step_id: string;
    action_id: string;
    script_name: string;
    risk_level: string;
    would_execute: boolean;
    allowed_for_low_risk_execution: boolean;
    blocked_reason: string | null;
    requires_confirm: boolean;
  }>;
  summary: {
    total_steps: number;
    allowed_low_risk_steps: number;
    blocked_steps: number;
    model_calls: number;
    media_generation: number;
    telegram_send: number;
    timer_modification: number;
    git_operations: number;
    collect_operations: number;
  };
  blocked_categories: string[];
  timestamp: string;
}

export function planWorkflow(workflowId: string): WorkflowPlan | null {
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

  const catalog = readJson<any>(path.join(HARVESTER_DIR, "dashboard", "control-catalog.json")) || {};
  const allowlist = readJson<any>(path.join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json")) || {};
  const allowedScripts = new Set(allowlist.allowed_scripts || []);
  const blockedPatterns = (allowlist.blocked_patterns || []) as string[];

  const planSteps = workflow.steps.map((step) => {
    // Check if step is allowed for low-risk execution
    let allowed = false;
    if (step.would_execute && step.risk_level === "safe" && step.blocked_category === null) {
      // Check if script is in allowlist
      if (allowedScripts.has(step.script_name)) {
        // Check if script matches any blocked pattern
        let blocked = false;
        for (const pattern of blockedPatterns) {
          if (step.script_name.toLowerCase().includes(pattern.toLowerCase())) {
            blocked = true;
            break;
          }
        }
        // Also check action_id
        if (!blocked) {
          for (const pattern of blockedPatterns) {
            if (step.action_id.toLowerCase().includes(pattern.toLowerCase())) {
              blocked = true;
              break;
            }
          }
        }
        allowed = !blocked;
      }
    }

    return {
      step_id: step.step_id,
      action_id: step.action_id,
      script_name: step.script_name,
      risk_level: step.risk_level,
      would_execute: step.would_execute,
      allowed_for_low_risk_execution: allowed,
      blocked_reason: step.blocked_reason || null,
      requires_confirm: step.requires_confirm,
    };
  });

  const summary = {
    total_steps: planSteps.length,
    allowed_low_risk_steps: planSteps.filter((s) => s.allowed_for_low_risk_execution).length,
    blocked_steps: planSteps.filter((s) => !s.would_execute).length,
    model_calls: 0,
    media_generation: 0,
    telegram_send: workflow.risk_summary.telegram_send || 0,
    timer_modification: workflow.risk_summary.timer_modification || 0,
    git_operations: workflow.risk_summary.git_operations || 0,
    collect_operations: workflow.risk_summary.collect_operations || 0,
  };

  return {
    workflow_id: workflow.workflow_id,
    mode: workflow.mode,
    real_execution: false,
    steps: planSteps,
    summary,
    blocked_categories: workflow.blocked_categories,
    timestamp: new Date().toISOString(),
  };
}

export function listWorkflows(): Array<{ workflow_id: string; label_zh: string; description_zh: string; mode: string }> {
  const workflows = readJson<{ workflows: Workflow[] }>(
    path.join(HARVESTER_DIR, "dashboard", "control-workflows.json")
  );
  if (!workflows || !workflows.workflows) {
    return [];
  }
  return workflows.workflows.map((w) => ({
    workflow_id: w.workflow_id,
    label_zh: w.label_zh,
    description_zh: w.description_zh,
    mode: w.mode,
  }));
}

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Usage: tsx scripts/control-workflow-planner.ts <workflow-id>");
    console.log("       tsx scripts/control-workflow-planner.ts --list");
    process.exit(1);
  }

  if (args[0] === "--list") {
    const workflows = listWorkflows();
    console.log(JSON.stringify(workflows, null, 2));
  } else {
    const plan = planWorkflow(args[0]);
    if (!plan) {
      console.error(`Workflow not found: ${args[0]}`);
      process.exit(1);
    }
    console.log(JSON.stringify(plan, null, 2));
  }
}
