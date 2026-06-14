/**
 * daily-digest-build-sandbox-planner.ts
 * Phase 5C-2C-C4: Daily Digest Build Sandbox Planner
 *
 * Read-only planner that loads the sandbox plan JSON and outputs structured plan.
 * No command execution, no child_process, no exec/spawn, no network calls.
 */
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SANDBOX_PLAN_PATH = path.join(PROJECT_ROOT, "dashboard", "daily-digest-build-sandbox-plan.json");
const STAGED_PLAN_PATH = path.join(PROJECT_ROOT, "dashboard", "daily-digest-staged-plan.json");
const CATALOG_PATH = path.join(PROJECT_ROOT, "dashboard", "control-catalog.json");

interface SandboxPlanResult {
  mode: string;
  real_execution: boolean;
  production_write_allowed: boolean;
  stages: Array<{
    stage_id: string;
    label_zh: string;
    current_status: string;
    allowed_now: boolean;
    blocked_reason: string;
    future_gate_required: string;
    expected_outputs: string[];
    protected_paths: string[];
    sandbox_paths: string[];
  }>;
  protected_paths: string[];
  sandbox_paths: string[];
  blocked_actions: string[];
  next_gate_required: boolean;
  next_gate_description: string;
  safety_model: Record<string, boolean>;
  summary: {
    total_stages: number;
    plan_only_stages: number;
    blocked_stages: number;
    protected_paths_count: number;
    sandbox_paths_count: number;
  };
}

function loadJson<T>(filepath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf8")) as T;
  } catch {
    return null;
  }
}

export function buildSandboxPlan(): SandboxPlanResult | null {
  const plan = loadJson<any>(SANDBOX_PLAN_PATH);
  if (!plan) return null;

  const stages = (plan.stages || []).map((s: any) => ({
    stage_id: s.stage_id,
    label_zh: s.label_zh,
    current_status: s.current_status,
    allowed_now: s.allowed_now,
    blocked_reason: s.blocked_reason || "",
    future_gate_required: s.future_gate_required || "",
    expected_outputs: s.expected_outputs || [],
    protected_paths: s.protected_paths || [],
    sandbox_paths: s.sandbox_paths || [],
  }));

  const planOnlyStages = stages.filter((s: any) => s.current_status === "sandbox_plan_only").length;
  const blockedStages = stages.filter((s: any) => s.current_status === "blocked").length;

  return {
    mode: plan.mode || "sandbox_plan_only",
    real_execution: false,
    production_write_allowed: false,
    stages,
    protected_paths: plan.protected_paths || [],
    sandbox_paths: plan.sandbox_paths || [],
    blocked_actions: plan.blocked_actions || [],
    next_gate_required: plan.next_gate_required || true,
    next_gate_description: plan.next_gate_description || "",
    safety_model: plan.safety_model || {},
    summary: {
      total_stages: stages.length,
      plan_only_stages: planOnlyStages,
      blocked_stages: blockedStages,
      protected_paths_count: (plan.protected_paths || []).length,
      sandbox_paths_count: (plan.sandbox_paths || []).length,
    },
  };
}

// CLI usage
if (require.main === module) {
  const result = buildSandboxPlan();
  if (!result) {
    console.error("ERROR: Could not load sandbox plan");
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}
