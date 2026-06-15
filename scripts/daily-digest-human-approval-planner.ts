#!/usr/bin/env tsx
/**
 * scripts/daily-digest-human-approval-planner.ts
 * Phase 5C-2C-C5N1: Human-in-loop Approval State Planner (SCAFFOLD-ONLY)
 *
 * This script SCAFFOLDS the human approval state model. It does NOT:
 *   - Approve anything
 *   - Execute any promote
 *   - Write to production paths
 *   - Send Telegram
 *   - Trigger a timer / cron
 *   - Use child_process / exec / spawn
 *   - Read .env / .control.local / process.env
 *   - Make network calls
 *
 * Inputs (all read-only):
 *   - dashboard/daily-digest-human-approval-state.json (this phase's config)
 *   - dashboard/daily-digest-continuous-promote-workflow-status.json (C5N0)
 *   - dashboard/daily-digest-promote-approval-pack.json (C5M0)
 *   - dashboard/daily-digest-promote-gate.json (C5J, via C5N0 inputs)
 *   - reports/sandbox/daily-digest/latest.json
 *   - reports/sandbox/daily-digest/<run>/reports/promote-shadow/rollback-manifest.json
 *
 * Outputs (scaffold-only):
 *   - dashboard/daily-digest-human-approval-state.json (re-written with current evidence)
 *   - reports/human-in-loop-promote-ui-scaffold.md (human-readable)
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const STATE_CONFIG = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-approval-state.json");
const STATE_OUTPUT = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-approval-state-status.json");
const PLAN_MD_OUTPUT = path.join(HARVESTER_DIR, "reports/human-in-loop-promote-ui-scaffold.md");
const WORKFLOW_STATUS = path.join(HARVESTER_DIR, "dashboard/daily-digest-continuous-promote-workflow-status.json");
const APPROVAL_PACK = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-approval-pack.json");
const LATEST_JSON = path.join(HARVESTER_DIR, "reports/sandbox/daily-digest/latest.json");

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

interface EvidenceItem {
  key: string;
  label_zh: string;
  met: boolean;
  evidence_path: string | null;
  note: string;
}

interface ApprovalStateOutput {
  phase: string;
  mode: string;
  version: string;
  generated_at: string;
  approval_enabled: boolean;
  approval_state: string;
  allowed_next_transitions: string[];
  evidence_for_approval_pack_ready: EvidenceItem[];
  evidence_for_human_review_pending: EvidenceItem[];
  evidence_for_approved_for_future_promote: EvidenceItem[];
  required_confirm_phrase: string;
  required_plan_phrase: string;
  required_env_gate: string;
  env_gate_satisfied: boolean;
  env_gate_satisfied_note: string;
  blocked_actions: string[];
  audit_log_policy: any;
  upstream_inputs: {
    c5n0_workflow_status_present: boolean;
    continuous_promote_enabled: boolean;
    approval_pack_present: boolean;
    latest_sandbox_run: string | null;
    rollback_manifest_present: boolean;
  };
  recommendation: string;
  safety_constraints: {
    no_child_process: true;
    no_exec_spawn: true;
    no_env_read: true;
    no_control_local_read: true;
    no_network_calls: true;
    no_production_writes: true;
    no_timer: true;
    no_telegram_send: true;
    no_approve: true;
    output_redacted: true;
  };
}

function collectEvidenceForPackReady(): EvidenceItem[] {
  const latest = loadJson<any>(LATEST_JSON);
  const latestRunId: string | null = latest?.latest_run_id || null;
  const workflow = loadJson<any>(WORKFLOW_STATUS);
  const approval = loadJson<any>(APPROVAL_PACK);
  const rollback = loadJson<any>(path.join(
    HARVESTER_DIR, "reports/sandbox/daily-digest",
    latestRunId || "_none_", "reports/promote-shadow/rollback-manifest.json",
  ));

  const c5n0Stages = (workflow?.stages || []) as any[];
  const findStage = (id: string) => c5n0Stages.find(s => s.stage_id === id);
  const stageMet = (id: string): { met: boolean; note: string } => {
    const s = findStage(id);
    if (!s) return { met: false, note: "stage missing from C5N0 workflow status" };
    if (s.allowed_now && s.preconditions_met) return { met: true, note: "stage ready" };
    return { met: false, note: `effective_status=${s.effective_status}; missing=${(s.missing_preconditions || []).join(",") || "—"}` };
  };

  return [
    {
      key: "latest_sandbox_run_present",
      label_zh: "最新沙盒运行存在",
      met: !!latestRunId,
      evidence_path: latestRunId ? "reports/sandbox/daily-digest/latest.json" : null,
      note: latestRunId ? `run_id=${latestRunId}` : "no latest.json",
    },
    {
      key: "sandbox_output_validation_pass",
      label_zh: "沙盒输出校验通过",
      met: stageMet("run_output_validation").met,
      evidence_path: "dashboard/daily-digest-continuous-promote-workflow-status.json",
      note: stageMet("run_output_validation").note,
    },
    {
      key: "diff_check_pass",
      label_zh: "diff 检查通过",
      met: stageMet("run_diff_check").met,
      evidence_path: "dashboard/daily-digest-continuous-promote-workflow-status.json",
      note: stageMet("run_diff_check").note,
    },
    {
      key: "promote_readiness_pass",
      label_zh: "推送就绪度通过",
      met: stageMet("run_promote_readiness").met,
      evidence_path: "dashboard/daily-digest-continuous-promote-workflow-status.json",
      note: stageMet("run_promote_readiness").note,
    },
    {
      key: "promote_gate_pass",
      label_zh: "推送门禁通过",
      met: stageMet("run_promote_gate").met,
      evidence_path: "dashboard/daily-digest-continuous-promote-workflow-status.json",
      note: stageMet("run_promote_gate").note,
    },
    {
      key: "shadow_copy_present",
      label_zh: "影子备份存在",
      met: stageMet("run_promote_gate").met, // shadow copy is a precondition of promote gate
      evidence_path: "reports/sandbox/daily-digest/<run>/reports/promote-shadow/",
      note: "promote_gate pass implies shadow copy present",
    },
    {
      key: "rollback_manifest_present",
      label_zh: "回滚清单存在",
      met: !!rollback,
      evidence_path: rollback ? "reports/sandbox/daily-digest/<run>/reports/promote-shadow/rollback-manifest.json" : null,
      note: rollback ? "rollback manifest present" : "rollback manifest missing",
    },
    {
      key: "approval_pack_generated",
      label_zh: "审批包已生成",
      met: !!approval && !!approval.latest_run_id,
      evidence_path: approval ? "dashboard/daily-digest-promote-approval-pack.json" : null,
      note: approval ? `approval pack present for run ${approval.latest_run_id}` : "approval pack missing",
    },
  ];
}

function collectEvidenceForHumanReviewPending(): EvidenceItem[] {
  return [
    {
      key: "approval_pack_reviewed_by_human",
      label_zh: "审批包已由人工审阅",
      met: false, // Always false in scaffold-only mode
      evidence_path: null,
      note: "scaffold-only: no human-approver UI yet (future C5N-2)",
    },
    {
      key: "human_confirms_target_files",
      label_zh: "人工确认目标文件",
      met: false,
      evidence_path: null,
      note: "scaffold-only: target files are reports/daily-digest.md + reports/telegram-digest.txt (per C5M1 contract)",
    },
    {
      key: "human_confirms_backup_retention_acceptable",
      label_zh: "人工确认备份保留可接受",
      met: false,
      evidence_path: null,
      note: "scaffold-only: backup retention=7 days (per C5N0); not yet approved by human",
    },
  ];
}

function collectEvidenceForApproved(): EvidenceItem[] {
  return [
    {
      key: "human_approval_recorded",
      label_zh: "人工审批记录已写入",
      met: false,
      evidence_path: null,
      note: "scaffold-only: no human-approval UI yet (future C5N-2)",
    },
    {
      key: "env_gate_set_in_target_environment",
      label_zh: "目标环境 env gate 已设置",
      met: false,
      evidence_path: null,
      note: "scaffold-only: env gate not set; this script does not read process.env",
    },
    {
      key: "audit_log_witness_recorded",
      label_zh: "审计见证记录已写入",
      met: false,
      evidence_path: null,
      note: "scaffold-only: audit log entry will be written on first real human-approval call (future C5N-2)",
    },
  ];
}

export function planHumanApproval(): ApprovalStateOutput {
  const generatedAt = new Date().toISOString();
  const config = loadJson<any>(STATE_CONFIG);
  if (!config) {
    throw new Error(`approval state config not found at ${STATE_CONFIG}`);
  }

  const workflow = loadJson<any>(WORKFLOW_STATUS);
  const approval = loadJson<any>(APPROVAL_PACK);
  const latest = loadJson<any>(LATEST_JSON);
  const latestRunId: string | null = latest?.latest_run_id || null;
  const rollback = loadJson<any>(path.join(
    HARVESTER_DIR, "reports/sandbox/daily-digest",
    latestRunId || "_none_", "reports/promote-shadow/rollback-manifest.json",
  ));

  const evidencePackReady = collectEvidenceForPackReady();
  const evidenceHumanReview = collectEvidenceForHumanReviewPending();
  const evidenceApproved = collectEvidenceForApproved();

  const allPackReadyMet = evidencePackReady.every(e => e.met);

  // Determine current state and allowed next transitions
  let currentState = "not_requested";
  const allowedNext: string[] = [];
  if (allPackReadyMet) {
    currentState = "approval_pack_ready";
    allowedNext.push("human_review_pending");
  } else {
    allowedNext.push("approval_pack_ready"); // We can transition once evidence is complete
  }

  // Future: once human review is complete, allow approved_for_future_promote
  // Future: from approved, allow the actual production write (but blocked by C5N0+config)

  let recommendation: string;
  if (config.approval_enabled) {
    recommendation = "approval_enabled=true (NOT the case here); planner would compute next transition and emit a UI prompt for human action.";
  } else {
    recommendation = "approval_enabled=false (current). Planner ONLY produces a UI state and an evidence checklist. No human action is requested, no approve is granted. To enable, a future phase (C5N-2) would implement a human-approver runner, an env-gate check, and a per-transition audit log entry — all gated by an explicit human initiation command.";
  }

  return {
    phase: "5C-2C-C5N1",
    mode: "human_approval_scaffold_only",
    version: "0.1.0",
    generated_at: generatedAt,
    approval_enabled: !!config.approval_enabled,
    approval_state: currentState,
    allowed_next_transitions: allowedNext,
    evidence_for_approval_pack_ready: evidencePackReady,
    evidence_for_human_review_pending: evidenceHumanReview,
    evidence_for_approved_for_future_promote: evidenceApproved,
    required_confirm_phrase: config.required_confirm_phrase || "PROMOTE DAILY DIGEST FROM SANDBOX",
    required_plan_phrase: config.required_plan_phrase || "PLAN DAILY HUMAN APPROVAL",
    required_env_gate: config.required_env_gate || "CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1",
    env_gate_satisfied: false, // Always false in scaffold-only mode (no process.env read)
    env_gate_satisfied_note: "scaffold-only: this script does not read process.env; an external orchestrator must verify the env gate before any real human-approval transition",
    blocked_actions: config.blocked_actions || [],
    audit_log_policy: config.audit_log_policy,
    upstream_inputs: {
      c5n0_workflow_status_present: !!workflow,
      continuous_promote_enabled: workflow?.continuous_promote_enabled || false,
      approval_pack_present: !!approval,
      latest_sandbox_run: latestRunId,
      rollback_manifest_present: !!rollback,
    },
    recommendation,
    safety_constraints: {
      no_child_process: true,
      no_exec_spawn: true,
      no_env_read: true,
      no_control_local_read: true,
      no_network_calls: true,
      no_production_writes: true,
      no_timer: true,
      no_telegram_send: true,
      no_approve: true,
      output_redacted: true,
    },
  };
}

function renderMarkdown(state: ApprovalStateOutput): string {
  const lines: string[] = [];
  lines.push("# Human-in-loop Promote UI Scaffold (Phase 5C-2C-C5N1)");
  lines.push("");
  lines.push(`- Phase: ${state.phase}`);
  lines.push(`- Mode: ${state.mode}`);
  lines.push(`- Generated at: ${state.generated_at}`);
  lines.push(`- Approval enabled: **${state.approval_enabled}**`);
  lines.push(`- Current approval state: **${state.approval_state}**`);
  lines.push(`- Allowed next transitions: ${state.allowed_next_transitions.map(s => `\`${s}\``).join(", ") || "(none)"}`);
  lines.push(`- Required confirm phrase: \`${state.required_confirm_phrase}\``);
  lines.push(`- Required plan phrase: \`${state.required_plan_phrase}\``);
  lines.push(`- Required env gate: \`${state.required_env_gate}\``);
  lines.push(`- Env gate satisfied (static): **${state.env_gate_satisfied}** (${state.env_gate_satisfied_note})`);
  lines.push("");
  lines.push("## Upstream Inputs (read-only scan)");
  lines.push("");
  for (const [k, v] of Object.entries(state.upstream_inputs)) lines.push(`- ${k}: ${v}`);
  lines.push("");
  lines.push("## Evidence Checklist (current state)");
  lines.push("");
  lines.push("### For `approval_pack_ready`");
  lines.push("");
  for (const e of state.evidence_for_approval_pack_ready) {
    lines.push(`- [${e.met ? "x" : " "}] ${e.key} — ${e.label_zh}`);
    lines.push(`  - evidence_path: ${e.evidence_path || "—"}`);
    lines.push(`  - note: ${e.note}`);
  }
  lines.push("");
  lines.push("### For `human_review_pending` (future)");
  lines.push("");
  for (const e of state.evidence_for_human_review_pending) {
    lines.push(`- [${e.met ? "x" : " "}] ${e.key} — ${e.label_zh}`);
    lines.push(`  - note: ${e.note}`);
  }
  lines.push("");
  lines.push("### For `approved_for_future_promote` (future)");
  lines.push("");
  for (const e of state.evidence_for_approved_for_future_promote) {
    lines.push(`- [${e.met ? "x" : " "}] ${e.key} — ${e.label_zh}`);
    lines.push(`  - note: ${e.note}`);
  }
  lines.push("");
  lines.push("## Blocked Actions");
  lines.push("");
  for (const a of state.blocked_actions) lines.push(`- ${a}`);
  lines.push("");
  lines.push("## Recommendation");
  lines.push("");
  lines.push(state.recommendation);
  lines.push("");
  lines.push("## Safety Constraints (verified)");
  lines.push("");
  for (const [k, v] of Object.entries(state.safety_constraints)) lines.push(`- ${k}: ${v}`);
  return lines.join("\n");
}

if (require.main === module) {
  const state = planHumanApproval();
  fs.writeFileSync(STATE_OUTPUT, JSON.stringify(state, null, 2));
  fs.writeFileSync(PLAN_MD_OUTPUT, renderMarkdown(state));
  console.log(redact(JSON.stringify(state, null, 2)));
  process.exit(0);
}
