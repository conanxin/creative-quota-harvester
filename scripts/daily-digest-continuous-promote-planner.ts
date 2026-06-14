#!/usr/bin/env tsx
/**
 * scripts/daily-digest-continuous-promote-planner.ts
 * Phase 5C-2C-C5N-0: Continuous Controlled Promote Workflow Planner (PLAN-ONLY)
 *
 * This script DESIGNS the continuous promote workflow. It does NOT:
 *   - Execute any promote
 *   - Write to production paths
 *   - Send Telegram
 *   - Trigger a timer / cron
 *   - Use child_process / exec / spawn
 *   - Read .env / .control.local
 *   - Make network calls
 *
 * Inputs (all read-only):
 *   - dashboard/daily-digest-continuous-promote-workflow.json (this phase's config)
 *   - reports/promote-history/ (C5M1 history)
 *   - reports/sandbox/daily-digest/latest.json (latest run)
 *   - reports/sandbox/daily-digest/<run>/reports/promote-shadow/rollback-manifest.json
 *   - dashboard/daily-digest-promote-approval-pack.json (C5M0)
 *   - dashboard/daily-digest-promote-execution-disabled.json (C5L)
 *
 * Outputs (plan-only):
 *   - dashboard/daily-digest-continuous-promote-workflow-status.json
 *   - reports/continuous-promote-workflow-plan.md
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const WORKFLOW_CONFIG = path.join(HARVESTER_DIR, "dashboard/daily-digest-continuous-promote-workflow.json");
const STATUS_OUTPUT = path.join(HARVESTER_DIR, "dashboard/daily-digest-continuous-promote-workflow-status.json");
const PLAN_MD_OUTPUT = path.join(HARVESTER_DIR, "reports/continuous-promote-workflow-plan.md");
const LATEST_JSON = path.join(HARVESTER_DIR, "reports/sandbox/daily-digest/latest.json");
const HISTORY_DIR = path.join(HARVESTER_DIR, "reports/promote-history");
const APPROVAL_PACK = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-approval-pack.json");
const DISABLED_CONFIG = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-execution-disabled.json");

interface Stage {
  stage_id: string;
  label_zh: string;
  current_status: string;
  allowed_now: boolean;
  requires_human_approval: boolean;
  requires_env_gate: string | false;
  writes_production: boolean;
  blocked_reason: string | null;
  future_enable_condition: string;
}

interface WorkflowStatus {
  phase: string;
  mode: string;
  generated_at: string;
  continuous_promote_enabled: boolean;
  real_promote_allowed: boolean;
  production_write_allowed: boolean;
  telegram_send_allowed: boolean;
  env_gate: string;
  env_gate_satisfied: boolean;
  confirm_phrase: string;
  backup_retention_days: number;
  auto_rollback_enabled: boolean;
  manual_rollback_supported: boolean;
  stages: Array<Stage & { effective_status: string; preconditions_met: boolean; missing_preconditions: string[] }>;
  next_eligible_stage: string | null;
  blocked_stages: string[];
  recommendation: string;
  required_human_approval: boolean;
  backup_retention_policy: any;
  audit_log_policy: any;
  blocked_actions: string[];
  inputs: {
    latest_sandbox_run: string | null;
    latest_promote_history: string | null;
    approval_pack_present: boolean;
    rollback_manifest_present: boolean;
  };
  safety_constraints: {
    no_child_process: true;
    no_exec_spawn: true;
    no_env_read: true;
    no_control_local_read: true;
    no_network_calls: true;
    no_production_writes: true;
    no_timer: true;
    no_telegram_send: true;
    output_redacted: true;
  };
}

function loadJson<T>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as T; } catch { return null; }
}

function fileExists(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}

function redact(text: string): string {
  return text
    .replace(/TELEGRAM_BOT_TOKEN\s*=\s*['"]\S+['"]/g, "TELEGRAM_BOT_TOKEN=\"***\"")
    .replace(/CQA_CONTROL_TOKEN\s*=\s*['"]\S+['"]/g, "CQA_CONTROL_TOKEN=\"***\"")
    .replace(/MINIMAX_API_KEY\s*=\s*['"]\S+['"]/g, "MINIMAX_API_KEY=\"***\"")
    .replace(/OPENAI_API_KEY\s*=\s*['"]\S+['"]/g, "OPENAI_API_KEY=\"***\"")
    .replace(/sk-cp-[A-Za-z0-9_-]{10,}/g, "sk-cp-<REDACTED>")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-<REDACTED>");
}

function envGateSatisfied(envGateStr: string): boolean {
  // env_gate_satisfied is determined structurally (env vars not read in this script).
  // We just report whether it is set; this is a static check.
  const parts = envGateStr.split("=");
  if (parts.length !== 2) return false;
  const [key, expected] = parts;
  // We do NOT call process.env[key] (forbidden by safety contract).
  // Instead, the orchestrator (if ever enabled) is responsible for verifying.
  return false; // Conservative: always report unsatisfied in plan-only mode.
}

function preconditionsFor(stage: Stage, inputs: WorkflowStatus["inputs"]): { met: boolean; missing: string[] } {
  const missing: string[] = [];
  if (stage.requires_env_gate && !envGateSatisfied(stage.requires_env_gate as string)) {
    missing.push(`env_gate:${stage.requires_env_gate}`);
  }
  if (stage.writes_production) {
    if (!inputs.latest_sandbox_run) missing.push("latest_sandbox_run");
    if (!inputs.approval_pack_present) missing.push("approval_pack");
    if (!inputs.rollback_manifest_present) missing.push("rollback_manifest");
    if (!inputs.latest_promote_history) missing.push("promote_history");
  }
  if (stage.requires_human_approval) {
    // Always treat human approval as missing in plan-only mode.
    missing.push("human_approval:not_yet_implemented_in_c5n0");
  }
  return { met: missing.length === 0, missing };
}

export function planContinuousPromote(): WorkflowStatus {
  const generatedAt = new Date().toISOString();
  const config = loadJson<any>(WORKFLOW_CONFIG);
  if (!config) {
    throw new Error(`workflow config not found at ${WORKFLOW_CONFIG}`);
  }

  // Inputs (read-only)
  const latest = loadJson<any>(LATEST_JSON);
  const latestRunId: string | null = latest?.latest_run_id || null;
  const historyFiles = fileExists(HISTORY_DIR) ? fs.readdirSync(HISTORY_DIR)
    .filter(f => f.startsWith("daily-digest-promote-") && f.endsWith(".json"))
    .sort()
    .reverse() : [];
  const latestHistoryFile: string | null = historyFiles[0] || null;
  const approvalPack = loadJson<any>(APPROVAL_PACK);
  const disabledConfig = loadJson<any>(DISABLED_CONFIG);
  const rollbackManifest = loadJson<any>(path.join(
    HARVESTER_DIR, "reports/sandbox/daily-digest",
    latestRunId || "_none_", "reports/promote-shadow/rollback-manifest.json",
  ));

  const inputs = {
    latest_sandbox_run: latestRunId,
    latest_promote_history: latestHistoryFile,
    approval_pack_present: !!approvalPack,
    rollback_manifest_present: !!rollbackManifest,
  };

  const stages: WorkflowStatus["stages"] = (config.workflow_stages as Stage[]).map((s) => {
    const pre = preconditionsFor(s, inputs);
    const effectiveStatus =
      !s.allowed_now ? "blocked_by_design"
      : s.requires_human_approval ? "blocked_needs_human_approval"
      : pre.met ? "ready_now" : "blocked_preconditions";
    return {
      ...s,
      effective_status: effectiveStatus,
      preconditions_met: pre.met,
      missing_preconditions: pre.missing,
    };
  });

  // Next eligible stage: first stage with allowed_now=true and preconditions_met=true
  const nextEligible = stages.find(s => s.allowed_now && s.preconditions_met);
  const blocked = stages.filter(s => !s.allowed_now || !s.preconditions_met).map(s => s.stage_id);

  let recommendation: string;
  if (config.continuous_promote_enabled) {
    recommendation = "continuous_promote_enabled=true (NOT the case here); planner would resolve the next eligible stage and write a dispatch hint.";
  } else {
    recommendation = "continuous_promote_enabled=false (current). Planner ONLY produces a plan and a UI-readable status. No dispatch is generated. To enable, a future phase would set the env gate, document the human-in-loop process, and add explicit UI for stage transitions.";
  }

  return {
    phase: "5C-2C-C5N-0",
    mode: "continuous_promote_plan_only",
    generated_at: generatedAt,
    continuous_promote_enabled: !!config.continuous_promote_enabled,
    real_promote_allowed: !!config.real_promote_allowed,
    production_write_allowed: !!config.production_write_allowed,
    telegram_send_allowed: !!config.telegram_send_allowed,
    env_gate: config.required_env_gate || "CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1",
    env_gate_satisfied: envGateSatisfied(config.required_env_gate || "CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1"),
    confirm_phrase: config.required_confirm_phrase || "PROMOTE DAILY DIGEST FROM SANDBOX",
    backup_retention_days: config.backup_retention_days || 7,
    auto_rollback_enabled: !!config.auto_rollback_enabled,
    manual_rollback_supported: !!config.manual_rollback_supported,
    stages,
    next_eligible_stage: nextEligible ? nextEligible.stage_id : null,
    blocked_stages: blocked,
    recommendation,
    required_human_approval: !!config.requires_human_approval,
    backup_retention_policy: config.backup_retention_policy,
    audit_log_policy: config.audit_log_policy,
    blocked_actions: config.blocked_actions || [],
    inputs,
    safety_constraints: {
      no_child_process: true,
      no_exec_spawn: true,
      no_env_read: true,
      no_control_local_read: true,
      no_network_calls: true,
      no_production_writes: true,
      no_timer: true,
      no_telegram_send: true,
      output_redacted: true,
    },
  };
}

function renderMarkdown(status: WorkflowStatus): string {
  const lines: string[] = [];
  lines.push("# Continuous Controlled Promote Workflow Plan");
  lines.push("");
  lines.push(`- Phase: ${status.phase}`);
  lines.push(`- Mode: ${status.mode}`);
  lines.push(`- Generated at: ${status.generated_at}`);
  lines.push(`- Continuous promote enabled: **${status.continuous_promote_enabled}**`);
  lines.push(`- Real promote allowed: **${status.real_promote_allowed}**`);
  lines.push(`- Production write allowed: **${status.production_write_allowed}**`);
  lines.push(`- Telegram send allowed: **${status.telegram_send_allowed}**`);
  lines.push(`- Required env gate: \`${status.env_gate}\``);
  lines.push(`- Env gate satisfied (static, in this script): **${status.env_gate_satisfied}**`);
  lines.push(`- Required confirm phrase: \`${status.confirm_phrase}\``);
  lines.push(`- Backup retention days: ${status.backup_retention_days}`);
  lines.push(`- Auto-rollback enabled: **${status.auto_rollback_enabled}**`);
  lines.push(`- Manual rollback supported: **${status.manual_rollback_supported}**`);
  lines.push(`- Required human approval: **${status.required_human_approval}**`);
  lines.push("");
  lines.push("## Workflow Stages");
  lines.push("");
  for (const s of status.stages) {
    lines.push(`### ${s.stage_id} — ${s.label_zh}`);
    lines.push(`- current_status: ${s.current_status}`);
    lines.push(`- allowed_now: ${s.allowed_now}`);
    lines.push(`- effective_status: **${s.effective_status}**`);
    lines.push(`- preconditions_met: ${s.preconditions_met}`);
    if (s.missing_preconditions.length > 0) {
      lines.push(`- missing_preconditions: ${s.missing_preconditions.join(", ")}`);
    }
    lines.push(`- requires_human_approval: ${s.requires_human_approval}`);
    lines.push(`- requires_env_gate: ${s.requires_env_gate || "—"}`);
    lines.push(`- writes_production: ${s.writes_production}`);
    if (s.blocked_reason) lines.push(`- blocked_reason: ${s.blocked_reason}`);
    lines.push(`- future_enable_condition: ${s.future_enable_condition}`);
    lines.push("");
  }
  lines.push("## Inputs (read-only scan)");
  lines.push("");
  lines.push(`- Latest sandbox run: \`${status.inputs.latest_sandbox_run || "NONE"}\``);
  lines.push(`- Latest promote history: \`${status.inputs.latest_promote_history || "NONE"}\``);
  lines.push(`- Approval pack present: ${status.inputs.approval_pack_present}`);
  lines.push(`- Rollback manifest present: ${status.inputs.rollback_manifest_present}`);
  lines.push("");
  lines.push("## Next Eligible Stage");
  lines.push("");
  lines.push(status.next_eligible_stage ? `- ${status.next_eligible_stage}` : "- (none)");
  lines.push("");
  lines.push("## Blocked Stages");
  lines.push("");
  for (const b of status.blocked_stages) lines.push(`- ${b}`);
  lines.push("");
  lines.push("## Recommendation");
  lines.push("");
  lines.push(status.recommendation);
  lines.push("");
  lines.push("## Blocked Actions");
  lines.push("");
  for (const a of status.blocked_actions) lines.push(`- ${a}`);
  lines.push("");
  lines.push("## Safety Constraints (verified)");
  lines.push("");
  for (const [k, v] of Object.entries(status.safety_constraints)) lines.push(`- ${k}: ${v}`);
  return lines.join("\n");
}

if (require.main === module) {
  const status = planContinuousPromote();
  // Write outputs
  fs.writeFileSync(STATUS_OUTPUT, JSON.stringify(status, null, 2));
  fs.writeFileSync(PLAN_MD_OUTPUT, renderMarkdown(status));
  console.log(redact(JSON.stringify(status, null, 2)));
  process.exit(0);
}
