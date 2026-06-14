#!/usr/bin/env tsx
/**
 * scripts/daily-digest-staged-planner.ts — Phase 5C-2C-C2
 *
 * Reads the daily-digest staged plan configuration and returns a structured
 * staged plan JSON. Pure read-only, no command execution, no network calls.
 *
 * Usage: tsx scripts/daily-digest-staged-planner.ts
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");

interface StagedPlanConfig {
  version: string;
  phase: string;
  generated_at: string;
  purpose: string;
  workflows: Array<{
    workflow_id: string;
    label_zh: string;
    description_zh: string;
    overall_risk_level: string;
    overall_execution_status: string;
    stages: Stage[];
    blocked_categories: string[];
    allowed_validation_scripts: string[];
    safety_model: Record<string, unknown>;
  }>;
}

interface Stage {
  stage_id: string;
  label_zh: string;
  risk_level: string;
  current_execution_status: string;
  allowed_now: boolean;
  blocked_reason: string | null;
  future_gate_required: string | null;
  related_actions: string[];
  expected_outputs: string[];
  calls_model: boolean;
  generates_media: boolean;
  modifies_timer: boolean;
  sends_external_message: boolean;
  notes: string;
}

interface StagedPlanResult {
  workflow_id: string;
  label_zh: string;
  overall_risk_level: string;
  overall_execution_status: string;
  stages: Stage[];
  summary: {
    total_stages: number;
    executable_stages: number;
    blocked_stages: number;
    candidate_stages: number;
    collect_blocked: boolean;
    send_blocked: boolean;
    timer_blocked: boolean;
    generate_blocked: boolean;
    git_blocked: boolean;
  };
  blocked_categories: string[];
  allowed_validation_scripts: string[];
  safety_model: Record<string, unknown>;
  timestamp: string;
}

function readJson<T>(filepath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function buildStagedPlan(): StagedPlanResult | null {
  const config = readJson<StagedPlanConfig>(
    path.join(HARVESTER_DIR, "dashboard", "daily-digest-staged-plan.json")
  );
  if (!config || !config.workflows || config.workflows.length === 0) {
    return null;
  }

  const workflow = config.workflows[0];
  const stages = workflow.stages;

  const executableStages = stages.filter((s) => s.allowed_now);
  const blockedStages = stages.filter((s) => !s.allowed_now && s.current_execution_status === "blocked_real_execution");
  const candidateStages = stages.filter((s) => s.current_execution_status === "dry_run_only_or_candidate");

  return {
    workflow_id: workflow.workflow_id,
    label_zh: workflow.label_zh,
    overall_risk_level: workflow.overall_risk_level,
    overall_execution_status: workflow.overall_execution_status,
    stages,
    summary: {
      total_stages: stages.length,
      executable_stages: executableStages.length,
      blocked_stages: blockedStages.length,
      candidate_stages: candidateStages.length,
      collect_blocked: stages.some((s) => s.stage_id.includes("collect") && !s.allowed_now),
      send_blocked: stages.some((s) => s.stage_id.includes("send") && !s.allowed_now),
      timer_blocked: stages.some((s) => s.stage_id.includes("timer") && !s.allowed_now),
      generate_blocked: stages.some((s) => s.stage_id.includes("build") && !s.allowed_now),
      git_blocked: true, // git always blocked in this phase
    },
    blocked_categories: workflow.blocked_categories,
    allowed_validation_scripts: workflow.allowed_validation_scripts,
    safety_model: workflow.safety_model,
    timestamp: new Date().toISOString(),
  };
}

// CLI support
if (require.main === module) {
  const plan = buildStagedPlan();
  if (!plan) {
    console.error("Failed to load daily-digest-staged-plan.json");
    process.exit(1);
  }
  console.log(JSON.stringify(plan, null, 2));
}
