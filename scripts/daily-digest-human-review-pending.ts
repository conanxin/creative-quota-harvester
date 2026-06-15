#!/usr/bin/env tsx
/**
 * scripts/daily-digest-human-review-pending.ts
 * Phase 5C-2C-C5N3: Human Review Pending State Record (REAL STATE TRANSITION)
 *
 * This script ACTUALLY updates the human approval state from
 * 'approval_pack_ready' to 'human_review_pending' and writes a history
 * record. It does NOT:
 *   - Approve anything (real_approval_allowed=false)
 *   - Execute any promote (real_promote_allowed=false)
 *   - Write to production paths (production_write_allowed=false)
 *   - Send Telegram (telegram_send_allowed=false)
 *   - Trigger a timer / cron
 *   - Use child_process / exec / spawn
 *   - Read .env / .control.local / process.env
 *   - Make network calls
 *
 * This is a state machine advance, not an approval.
 *
 * Inputs (read-only):
 *   - dashboard/daily-digest-human-review-pending-policy.json (this phase)
 *   - dashboard/daily-digest-human-approval-state.json (C5N1 config)
 *   - dashboard/daily-digest-human-approval-state-status.json (C5N1 status)
 *   - dashboard/daily-digest-promote-approval-pack.json (C5M0)
 *
 * Outputs:
 *   - dashboard/daily-digest-human-approval-state.json (REWRITTEN with new state)
 *   - reports/human-approval-history/daily-digest-human-review-pending-<ts>.json
 *   - reports/human-approval-history/daily-digest-human-review-pending-<ts>.md
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const POLICY = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-review-pending-policy.json");
const APPROVAL_CONFIG = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-approval-state.json");
const APPROVAL_STATUS = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-approval-state-status.json");
const APPROVAL_PACK = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-approval-pack.json");
const HISTORY_DIR = path.join(HARVESTER_DIR, "reports/human-approval-history");
const STATE_REPORT_MD = path.join(HARVESTER_DIR, "reports/human-review-pending-state-record.md");

function loadJson<T>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as T; } catch { return null; }
}

function fileExists(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
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

function tsCompact(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "-" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

export interface RecordResult {
  phase: string;
  mode: string;
  version: string;
  timestamp_utc: string;
  previous_state: string | null;
  new_state: string | null;
  transition_executed: boolean;
  transition_kind: string;
  confirm_phrase_matched: boolean;
  real_approval: boolean;
  real_promote_allowed: boolean;
  production_write_allowed: boolean;
  telegram_send_allowed: boolean;
  history_json_path: string | null;
  history_md_path: string | null;
  updated_state_config_path: string;
  evidence_snapshot: any;
  review_checklist: any[];
  blocked_next_transitions: string[];
  blocked_actions: string[];
  audit_log_entry_summary: any;
  next_step: string;
  blocked_reason: string | null;
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
    no_skip_evidence: true;
    output_redacted: true;
  };
}

function snapshotEvidence(): any {
  const status = loadJson<any>(APPROVAL_STATUS);
  const packReadyEvidence = status?.evidence_for_approval_pack_ready || [];
  return {
    upstream_state: status?.approval_state || null,
    pack_ready_evidence_met: packReadyEvidence.filter((e: any) => e.met).length,
    pack_ready_evidence_total: packReadyEvidence.length,
    pack_ready_evidence: packReadyEvidence,
    approval_pack_present: !!loadJson<any>(APPROVAL_PACK),
    approval_pack_run_id: loadJson<any>(APPROVAL_PACK)?.latest_run_id || null,
  };
}

function buildReviewChecklist(): any[] {
  return [
    {
      key: "approval_pack_reviewed_by_human",
      label_zh: "审批包已由人工审阅",
      required: true,
      status: "pending",
      note: "In C5N-4 (future), human reviewer marks this as reviewed",
    },
    {
      key: "human_confirms_target_files",
      label_zh: "人工确认目标文件",
      required: true,
      status: "pending",
      note: "Targets: reports/daily-digest.md + reports/telegram-digest.txt (per C5M1 contract)",
    },
    {
      key: "human_confirms_backup_retention_acceptable",
      label_zh: "人工确认备份保留可接受",
      required: true,
      status: "pending",
      note: "Backup retention = 7 days (per C5N0); human must confirm",
    },
    {
      key: "human_confirms_no_telegram_send",
      label_zh: "人工确认不发送 Telegram",
      required: true,
      status: "pending",
      note: "human_review_pending does NOT trigger Telegram send",
    },
    {
      key: "human_decision_recorded",
      label_zh: "人工决定记录已写入",
      required: false,
      status: "pending",
      note: "Will be recorded when human marks approved/rejected in C5N-4",
    },
  ];
}

function renderMarkdown(r: RecordResult): string {
  const lines: string[] = [];
  lines.push("# Human Review Pending State Record (Phase 5C-2C-C5N3)");
  lines.push("");
  lines.push(`- Phase: ${r.phase}`);
  lines.push(`- Mode: ${r.mode}`);
  lines.push(`- Timestamp (UTC): ${r.timestamp_utc}`);
  lines.push(`- Transition executed: **${r.transition_executed}**`);
  lines.push(`- Transition kind: \`${r.transition_kind}\``);
  lines.push(`- Previous state: \`${r.previous_state || "(unknown)"}\``);
  lines.push(`- New state: \`${r.new_state || "(blocked)"}\``);
  lines.push(`- Confirm phrase matched: **${r.confirm_phrase_matched}**`);
  lines.push(`- Real approval: **${r.real_approval}** (always false)`);
  lines.push(`- Real promote allowed: **${r.real_promote_allowed}** (always false)`);
  lines.push(`- Production write allowed: **${r.production_write_allowed}** (always false)`);
  lines.push(`- Telegram send allowed: **${r.telegram_send_allowed}** (always false)`);
  lines.push("");
  if (r.history_json_path) lines.push(`- History JSON: \`${r.history_json_path}\``);
  if (r.history_md_path) lines.push(`- History MD: \`${r.history_md_path}\``);
  lines.push(`- Updated state config: \`${r.updated_state_config_path}\``);
  lines.push("");
  lines.push("## Evidence Snapshot");
  lines.push("");
  for (const [k, v] of Object.entries(r.evidence_snapshot || {})) {
    if (k === "pack_ready_evidence") continue;
    lines.push(`- ${k}: ${JSON.stringify(v)}`);
  }
  if (r.evidence_snapshot?.pack_ready_evidence) {
    lines.push(`- pack_ready_evidence (${r.evidence_snapshot.pack_ready_evidence_met}/${r.evidence_snapshot.pack_ready_evidence_total} met):`);
    for (const e of r.evidence_snapshot.pack_ready_evidence) {
      lines.push(`  - [${e.met ? "x" : " "}] ${e.key} — ${e.note}`);
    }
  }
  lines.push("");
  lines.push("## Review Checklist (for human reviewer)");
  lines.push("");
  for (const c of r.review_checklist) {
    lines.push(`- [ ] ${c.key} — ${c.label_zh} (status: ${c.status})`);
    lines.push(`  - required: ${c.required}`);
    lines.push(`  - note: ${c.note}`);
  }
  lines.push("");
  lines.push("## Blocked Next Transitions");
  lines.push("");
  for (const b of r.blocked_next_transitions) lines.push(`- ${b}`);
  lines.push("");
  lines.push("## Blocked Actions");
  lines.push("");
  for (const a of r.blocked_actions) lines.push(`- ${a}`);
  lines.push("");
  lines.push("## Audit Log Entry Summary");
  lines.push("");
  for (const [k, v] of Object.entries(r.audit_log_entry_summary || {})) lines.push(`- ${k}: ${v}`);
  lines.push("");
  lines.push("## Next Step");
  lines.push("");
  lines.push(r.next_step);
  return lines.join("\n");
}

export function recordHumanReviewPending(opts: { confirmPhrase: string }): RecordResult {
  const generatedAt = new Date().toISOString();
  const timestampCompact = tsCompact();
  const policy = loadJson<any>(POLICY);
  if (!policy) throw new Error(`policy not found at ${POLICY}`);

  const requiredPhrase = policy.required_confirm_phrase || "BEGIN DAILY HUMAN REVIEW";
  const phraseMatched = opts.confirmPhrase === requiredPhrase;
  const from = policy.transition?.from || "approval_pack_ready";
  const to = policy.transition?.to || "human_review_pending";

  const status = loadJson<any>(APPROVAL_STATUS);
  const previousState = status?.approval_state || null;

  const evidence = snapshotEvidence();
  const allPackReadyMet = evidence.pack_ready_evidence_met === evidence.pack_ready_evidence_total && evidence.pack_ready_evidence_total > 0;
  const previousStateValid = previousState === from;

  const evidenceChecksMet = previousStateValid && allPackReadyMet;
  const canExecute = evidenceChecksMet && phraseMatched;

  const auditSummary = {
    action_id: "daily_digest_human_review_pending_record",
    risk_level: "low",
    real_execution: false,
    real_transition: canExecute,
    real_approval: false,
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    target_files_unmodified: true,
    result: canExecute ? "success" : "blocked",
  };

  let newState: string | null = null;
  let historyJsonPath: string | null = null;
  let historyMdPath: string | null = null;
  let blockedReason: string | null = null;
  let updatedStateConfigPath = APPROVAL_CONFIG;

  if (!evidenceChecksMet) {
    blockedReason = !previousStateValid
      ? `previous_state_mismatch: expected ${from}, got ${previousState}`
      : `pack_ready_evidence_incomplete: ${evidence.pack_ready_evidence_met}/${evidence.pack_ready_evidence_total}`;
  } else if (!phraseMatched) {
    blockedReason = `confirm_phrase_mismatch: expected "${requiredPhrase}"`;
  } else {
    // Execute the real state transition
    newState = to;

    // 1. Update the approval state config to reflect new state
    const config = loadJson<any>(APPROVAL_CONFIG);
    if (config) {
      config.approval_state = to;
      // Add a transition history entry to the config too
      if (!Array.isArray(config.transition_history)) config.transition_history = [];
      config.transition_history.push({
        from,
        to,
        timestamp_utc: generatedAt,
        transition_kind: "state_record_only",
        confirm_phrase: requiredPhrase,
        real_approval: false,
        real_promote: false,
        production_write: false,
        telegram_send: false,
      });
      fs.writeFileSync(APPROVAL_CONFIG, JSON.stringify(config, null, 2));
    }

    // 2. Write history record
    ensureDir(HISTORY_DIR);
    historyJsonPath = path.join(HISTORY_DIR, `daily-digest-human-review-pending-${timestampCompact}.json`);
    const historyRecord: RecordResult = {
      phase: "5C-2C-C5N3",
      mode: "human_review_pending_state_record",
      version: "0.1.0",
      timestamp_utc: generatedAt,
      previous_state: previousState,
      new_state: to,
      transition_executed: true,
      transition_kind: "state_record_only",
      confirm_phrase_matched: phraseMatched,
      real_approval: false,
      real_promote_allowed: false,
      production_write_allowed: false,
      telegram_send_allowed: false,
      history_json_path: historyJsonPath,
      history_md_path: null, // set below
      updated_state_config_path: APPROVAL_CONFIG,
      evidence_snapshot: evidence,
      review_checklist: buildReviewChecklist(),
      blocked_next_transitions: policy.blocked_next_transitions || [],
      blocked_actions: policy.blocked_actions || [],
      audit_log_entry_summary: auditSummary,
      next_step: "human_review_pending state recorded. To advance to approved_for_future_promote, a future phase (C5N-4) would be required with explicit human review + env gate + audit. This phase does NOT trigger any production write or Telegram send.",
      blocked_reason: null,
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
        no_skip_evidence: true,
        output_redacted: true,
      },
    };
    historyMdPath = path.join(HISTORY_DIR, `daily-digest-human-review-pending-${timestampCompact}.md`);
    historyRecord.history_md_path = historyMdPath;
    fs.writeFileSync(historyJsonPath, JSON.stringify(historyRecord, null, 2));
    fs.writeFileSync(historyMdPath, renderMarkdown(historyRecord));

    // 3. Also write the state record MD report (separate location)
    fs.writeFileSync(STATE_REPORT_MD, renderMarkdown(historyRecord));

    return historyRecord;
  }

  // Blocked path
  return {
    phase: "5C-2C-C5N3",
    mode: "human_review_pending_state_record",
    version: "0.1.0",
    timestamp_utc: generatedAt,
    previous_state: previousState,
    new_state: newState,
    transition_executed: false,
    transition_kind: "state_record_only",
    confirm_phrase_matched: phraseMatched,
    real_approval: false,
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    history_json_path: historyJsonPath,
    history_md_path: historyMdPath,
    updated_state_config_path: updatedStateConfigPath,
    evidence_snapshot: evidence,
    review_checklist: buildReviewChecklist(),
    blocked_next_transitions: policy.blocked_next_transitions || [],
    blocked_actions: policy.blocked_actions || [],
    audit_log_entry_summary: auditSummary,
    next_step: "State transition blocked: " + (blockedReason || "unknown") + ". Resolve the missing requirements before retrying.",
    blocked_reason: blockedReason,
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
      no_skip_evidence: true,
      output_redacted: true,
    },
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const phraseIdx = args.indexOf("--confirm-phrase");
  const phrase = phraseIdx >= 0 ? args[phraseIdx + 1] : "";
  const result = recordHumanReviewPending({ confirmPhrase: phrase });
  console.log(redact(JSON.stringify(result, null, 2)));
  process.exit(result.transition_executed ? 0 : 1);
}
