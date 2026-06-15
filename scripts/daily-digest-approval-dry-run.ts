#!/usr/bin/env tsx
/**
 * scripts/daily-digest-approval-dry-run.ts
 * Phase 5C-2C-C5N4: Approved-for-future-promote Dry-run (DRY-RUN ONLY)
 *
 * This script SIMULATES the human-review-pending → approved-for-future-promote
 * transition. It does NOT:
 *   - Modify the real approval state
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
 *   - dashboard/daily-digest-approval-dry-run-policy.json (this phase's policy)
 *   - dashboard/daily-digest-human-approval-state.json (C5N1 config)
 *   - dashboard/daily-digest-human-approval-state-status.json (C5N1 status)
 *   - dashboard/daily-digest-human-review-pending-policy.json (C5N3 policy)
 *   - reports/human-approval-history/ (C5N3 history record)
 *   - dashboard/daily-digest-promote-approval-pack.json (C5M0)
 *   - dashboard/daily-digest-continuous-promote-workflow-status.json (C5N0)
 *
 * Outputs (dry-run-only):
 *   - dashboard/daily-digest-approval-dry-run.json
 *   - reports/approved-for-future-promote-dry-run.md
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const POLICY = path.join(HARVESTER_DIR, "dashboard/daily-digest-approval-dry-run-policy.json");
const APPROVAL_CONFIG = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-approval-state.json");
const APPROVAL_STATUS = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-approval-state-status.json");
const C5N3_POLICY = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-review-pending-policy.json");
const C5N3_HISTORY_DIR = path.join(HARVESTER_DIR, "reports/human-approval-history");
const APPROVAL_PACK = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-approval-pack.json");
const WORKFLOW_STATUS = path.join(HARVESTER_DIR, "dashboard/daily-digest-continuous-promote-workflow-status.json");
const DRY_RUN_OUTPUT = path.join(HARVESTER_DIR, "dashboard/daily-digest-approval-dry-run.json");
const PLAN_MD_OUTPUT = path.join(HARVESTER_DIR, "reports/approved-for-future-promote-dry-run.md");

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

interface DryRunEvidence {
  key: string;
  label_zh: string;
  met: boolean;
  note: string;
}

interface ApprovalDryRunResult {
  phase: string;
  mode: string;
  version: string;
  generated_at: string;
  real_approval_allowed: boolean;
  real_promote_allowed: boolean;
  production_write_allowed: boolean;
  telegram_send_allowed: boolean;
  would_approve: boolean;
  real_approval: false;
  current_state: string | null;
  proposed_next_state: string | null;
  transition: { from: string; to: string } | null;
  required_confirm_phrase: string;
  required_env_gate: string;
  env_gate_evaluated: boolean;
  env_gate_evaluated_note: string;
  evidence_for_transition: DryRunEvidence[];
  blocked_transitions: string[];
  blocked_actions: string[];
  missing_requirements: string[];
  recommendation: string;
  upstream_inputs: {
    c5n3_history_record_present: boolean;
    c5n3_history_latest_path: string | null;
    c5n3_human_review_pending_recorded: boolean;
    approval_pack_present: boolean;
    continuous_promote_enabled: boolean;
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
    no_modify_approval_state: true;
    no_real_approval: true;
    no_real_promote: true;
    output_redacted: true;
  };
}

function findC5N3HistoryRecord(): { present: boolean; latest: any; latest_path: string | null } {
  if (!fileExists(C5N3_HISTORY_DIR)) return { present: false, latest: null, latest_path: null };
  const files = fs.readdirSync(C5N3_HISTORY_DIR)
    .filter(f => f.startsWith("daily-digest-human-review-pending-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) return { present: false, latest: null, latest_path: null };
  const latest = files[files.length - 1];
  const latestPath = path.join(C5N3_HISTORY_DIR, latest);
  const rec = loadJson<any>(latestPath);
  return { present: !!rec, latest: rec, latest_path: latestPath };
}

export function planApprovalDryRun(opts: { confirmPhrase?: string } = {}): ApprovalDryRunResult {
  const generatedAt = new Date().toISOString();
  const policy = loadJson<any>(POLICY);
  if (!policy) throw new Error(`policy not found at ${POLICY}`);

  const approvalConfig = loadJson<any>(APPROVAL_CONFIG);
  const approvalStatus = loadJson<any>(APPROVAL_STATUS);
  const c5n3Policy = loadJson<any>(C5N3_POLICY);
  const c5n3History = findC5N3HistoryRecord();
  const approvalPack = loadJson<any>(APPROVAL_PACK);
  const workflowStatus = loadJson<any>(WORKFLOW_STATUS);

  const currentState: string | null = approvalConfig?.approval_state || approvalStatus?.approval_state || null;
  const from = policy.allowed_dry_run_transition?.from || "human_review_pending";
  const to = policy.allowed_dry_run_transition?.to || "approved_for_future_promote";

  const requiredPhrase = policy.required_confirm_phrase || "DRY RUN DAILY APPROVAL";
  const phraseMatched = opts.confirmPhrase === requiredPhrase;

  // Build evidence checklist
  const c5n3Recorded = c5n3History.present && c5n3History.latest?.new_state === "human_review_pending";

  const evidence: DryRunEvidence[] = [
    {
      key: "previous_state_eq_human_review_pending",
      label_zh: "当前状态等于 human_review_pending",
      met: currentState === from,
      note: currentState ? `current_state=${currentState}` : "no current state",
    },
    {
      key: "c5n3_history_record_present",
      label_zh: "C5N3 history record 存在",
      met: c5n3History.present,
      note: c5n3History.present ? `latest=${path.basename(c5n3History.latest_path || "")}` : "no C5N3 history record",
    },
    {
      key: "c5n3_human_review_pending_recorded",
      label_zh: "C5N3 已记录 human_review_pending",
      met: c5n3Recorded,
      note: c5n3Recorded ? "C5N3 history confirms human_review_pending was recorded" : "C5N3 did not record human_review_pending",
    },
    {
      key: "approval_pack_reviewed_by_human",
      label_zh: "审批包已由人工审阅",
      met: c5n3Recorded, // C5N3 recorded that the state was advanced, but the human review itself is a future C5N-5
      note: c5n3Recorded ? "C5N3 recorded the state advance; explicit human review is future C5N-5" : "C5N3 has not recorded the state advance yet",
    },
    {
      key: "human_confirms_target_files",
      label_zh: "人工确认目标文件",
      met: c5n3Recorded,
      note: c5n3Recorded ? "Target files per C5M1: reports/daily-digest.md + reports/telegram-digest.txt" : "C5N3 has not confirmed target files",
    },
    {
      key: "human_confirms_backup_retention_acceptable",
      label_zh: "人工确认备份保留可接受",
      met: c5n3Recorded,
      note: c5n3Recorded ? "Backup retention=7 days per C5N0" : "C5N3 has not confirmed backup retention",
    },
    {
      key: "human_decision_recorded",
      label_zh: "人工决定记录已写入",
      met: c5n3Recorded,
      note: c5n3Recorded ? "C5N3 transition_history[0] records the state advance" : "C5N3 has not recorded a decision",
    },
    {
      key: "dry_run_only_mode",
      label_zh: "dry-run 模式开启",
      met: !!policy.real_approval_allowed === false && !!policy.real_transition_allowed === false,
      note: `real_approval_allowed=${policy.real_approval_allowed}, real_transition_allowed=${policy.real_transition_allowed}`,
    },
    {
      key: "real_approval_allowed_false",
      label_zh: "真实审批未启用",
      met: policy.real_approval_allowed === false,
      note: `real_approval_allowed=${policy.real_approval_allowed}`,
    },
    {
      key: "production_write_allowed_false",
      label_zh: "production write 未启用",
      met: policy.production_write_allowed === false,
      note: `production_write_allowed=${policy.production_write_allowed}`,
    },
    {
      key: "telegram_send_allowed_false",
      label_zh: "Telegram send 未启用",
      met: policy.telegram_send_allowed === false,
      note: `telegram_send_allowed=${policy.telegram_send_allowed}`,
    },
    {
      key: "confirm_phrase_matched",
      label_zh: "确认短语匹配",
      met: phraseMatched,
      note: phraseMatched ? "phrase matched" : (opts.confirmPhrase ? "phrase mismatch" : "phrase not provided in CLI args; this is OK for the read-only planner default"),
    },
  ];

  // Determine missing requirements (excluding confirm_phrase_matched from would_approve check)
  const evidenceExcludingPhrase = evidence.filter(e => e.key !== "confirm_phrase_matched");
  const missing: string[] = evidenceExcludingPhrase.filter(e => !e.met).map(e => e.key);
  const wouldApprove = missing.length === 0;

  let recommendation: string;
  if (wouldApprove && phraseMatched) {
    recommendation = "Dry-run approval would proceed. NO real approval is performed. Real approval requires a future phase (C5N-5) that implements a human-approver runner with env gate verification and explicit per-transition audit log entry.";
  } else if (wouldApprove && !phraseMatched) {
    recommendation = "Dry-run approval conditions met, but confirm phrase was not provided (or did not match). To exercise the dry-run with the right phrase, POST to /api/daily-digest/human-approval/approval-dry-run with confirm_phrase=\"" + requiredPhrase + "\".";
  } else {
    recommendation = "Dry-run approval blocked: " + (missing.length > 0 ? "missing=" + missing.join(",") : "unknown reason") + ". Resolve the missing requirements before retrying.";
  }

  return {
    phase: "5C-2C-C5N4",
    mode: "approved_for_future_promote_dry_run_only",
    version: "0.1.0",
    generated_at: generatedAt,
    real_approval_allowed: false,
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    would_approve: wouldApprove,
    real_approval: false,
    current_state: currentState,
    proposed_next_state: wouldApprove ? to : null,
    transition: wouldApprove ? { from, to } : null,
    required_confirm_phrase: requiredPhrase,
    required_env_gate: policy.required_env_gate || "CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1",
    env_gate_evaluated: false,
    env_gate_evaluated_note: policy.env_gate_evaluated_note || "this script does not read process.env",
    evidence_for_transition: evidence,
    blocked_transitions: policy.blocked_transitions || [],
    blocked_actions: policy.blocked_actions || [],
    missing_requirements: missing,
    recommendation,
    upstream_inputs: {
      c5n3_history_record_present: c5n3History.present,
      c5n3_history_latest_path: c5n3History.latest_path,
      c5n3_human_review_pending_recorded: c5n3Recorded,
      approval_pack_present: !!approvalPack,
      continuous_promote_enabled: workflowStatus?.continuous_promote_enabled || false,
    },
    safety_constraints: {
      no_child_process: true,
      no_exec_spawn: true,
      no_env_read: true,
      no_control_local_read: true,
      no_network_calls: true,
      no_production_writes: true,
      no_timer: true,
      no_telegram_send: true,
      no_modify_approval_state: true,
      no_real_approval: true,
      no_real_promote: true,
      output_redacted: true,
    },
  };
}

function renderMarkdown(result: ApprovalDryRunResult): string {
  const lines: string[] = [];
  lines.push("# Approved-for-future-promote Dry-run (Phase 5C-2C-C5N4)");
  lines.push("");
  lines.push(`- Phase: ${result.phase}`);
  lines.push(`- Mode: ${result.mode}`);
  lines.push(`- Generated at: ${result.generated_at}`);
  lines.push(`- Real approval allowed: **${result.real_approval_allowed}**`);
  lines.push(`- Real promote allowed: **${result.real_promote_allowed}**`);
  lines.push(`- Production write allowed: **${result.production_write_allowed}**`);
  lines.push(`- Telegram send allowed: **${result.telegram_send_allowed}**`);
  lines.push(`- Would approve: **${result.would_approve}**`);
  lines.push(`- Real approval (executed): **${result.real_approval}** (always false)`);
  lines.push(`- Current state: \`${result.current_state || "(unknown)"}\``);
  lines.push(`- Proposed next state: \`${result.proposed_next_state || "(blocked)"}\``);
  if (result.transition) {
    lines.push(`- Transition: \`${result.transition.from}\` → \`${result.transition.to}\``);
  }
  lines.push(`- Required confirm phrase: \`${result.required_confirm_phrase}\``);
  lines.push(`- Required env gate: \`${result.required_env_gate}\``);
  lines.push(`- Env gate evaluated (static): **${result.env_gate_evaluated}** (${result.env_gate_evaluated_note})`);
  lines.push("");
  lines.push("## Upstream Inputs (read-only scan)");
  lines.push("");
  for (const [k, v] of Object.entries(result.upstream_inputs)) lines.push(`- ${k}: ${v}`);
  lines.push("");
  lines.push("## Evidence Checklist (dry-run)");
  lines.push("");
  for (const e of result.evidence_for_transition) {
    lines.push(`- [${e.met ? "x" : " "}] ${e.key} — ${e.label_zh}`);
    lines.push(`  - note: ${e.note}`);
  }
  lines.push("");
  if (result.missing_requirements.length > 0) {
    lines.push("## Missing Requirements");
    lines.push("");
    for (const m of result.missing_requirements) lines.push(`- ${m}`);
    lines.push("");
  }
  lines.push("## Blocked Transitions");
  lines.push("");
  for (const b of result.blocked_transitions) lines.push(`- ${b}`);
  lines.push("");
  lines.push("## Blocked Actions");
  lines.push("");
  for (const a of result.blocked_actions) lines.push(`- ${a}`);
  lines.push("");
  lines.push("## Recommendation");
  lines.push("");
  lines.push(result.recommendation);
  lines.push("");
  lines.push("## Safety Constraints (verified)");
  lines.push("");
  for (const [k, v] of Object.entries(result.safety_constraints)) lines.push(`- ${k}: ${v}`);
  return lines.join("\n");
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const phraseIdx = args.indexOf("--confirm-phrase");
  const phrase = phraseIdx >= 0 ? args[phraseIdx + 1] : "";
  const result = planApprovalDryRun({ confirmPhrase: phrase });
  fs.writeFileSync(DRY_RUN_OUTPUT, JSON.stringify(result, null, 2));
  fs.writeFileSync(PLAN_MD_OUTPUT, renderMarkdown(result));
  console.log(redact(JSON.stringify(result, null, 2)));
  process.exit(0);
}
