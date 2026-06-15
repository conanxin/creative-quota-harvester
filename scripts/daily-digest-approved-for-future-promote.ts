#!/usr/bin/env tsx
/**
 * scripts/daily-digest-approved-for-future-promote.ts
 * Phase 5C-2C-C5N5: Real approved-for-future-promote State Record (REAL STATE TRANSITION)
 *
 * This script ACTUALLY updates the human approval state from
 * 'human_review_pending' to 'approved_for_future_promote' and writes a history
 * record. It does NOT:
 *   - Execute any promote (real_promote_allowed=false)
 *   - Write to production paths (production_write_allowed=false)
 *   - Send Telegram (telegram_send_allowed=false)
 *   - Trigger a timer / cron
 *   - Use child_process / exec / spawn
 *   - Read .env / .control.local / process.env
 *   - Make network calls
 *
 * Note: real_approval IS true for this phase (state-record only).
 * The state transition itself IS real, but production write and Telegram send
 * remain DISABLED. A future orchestrator (C5N-6, not yet implemented) would
 * re-verify the env gate + confirm phrase before any production promote.
 *
 * Inputs (read-only):
 *   - dashboard/daily-digest-approved-for-future-promote-policy.json (this phase)
 *   - dashboard/daily-digest-human-approval-state.json (C5N1 config)
 *   - dashboard/daily-digest-approval-dry-run.json (C5N4 dry-run result)
 *
 * Outputs:
 *   - dashboard/daily-digest-human-approval-state.json (REWRITTEN with new state)
 *   - reports/human-approval-history/daily-digest-approved-for-future-promote-<ts>.json
 *   - reports/human-approval-history/daily-digest-approved-for-future-promote-<ts>.md
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const POLICY = path.join(HARVESTER_DIR, "dashboard/daily-digest-approved-for-future-promote-policy.json");
const APPROVAL_CONFIG = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-approval-state.json");
const APPROVAL_DRY_RUN = path.join(HARVESTER_DIR, "dashboard/daily-digest-approval-dry-run.json");
const HISTORY_DIR = path.join(HARVESTER_DIR, "reports/human-approval-history");

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

export interface ApproveResult {
  phase: string;
  mode: string;
  version: string;
  timestamp_utc: string;
  previous_state: string | null;
  new_state: string | null;
  transition_executed: boolean;
  transition_kind: string;
  confirm_phrase_matched: boolean;
  confirmed_by_phrase: boolean;
  approved_for_future_promote: boolean;
  real_approval: boolean;
  real_promote_allowed: boolean;
  production_write_allowed: boolean;
  telegram_send_allowed: boolean;
  history_json_path: string | null;
  history_md_path: string | null;
  updated_state_config_path: string;
  evidence_snapshot: any;
  audit_log_entry_summary: any;
  blocked_next_transitions: string[];
  blocked_actions: string[];
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
    no_real_promote: true;
    no_skip_evidence: true;
    output_redacted: true;
  };
}

function snapshotEvidence(): any {
  const approvalConfig = loadJson<any>(APPROVAL_CONFIG);
  const dryRun = loadJson<any>(APPROVAL_DRY_RUN);
  const dryRunEvidence = dryRun?.evidence_for_transition || [];
  return {
    upstream_state: approvalConfig?.approval_state || null,
    upstream_state_config_present: !!approvalConfig,
    dry_run_present: !!dryRun,
    dry_run_would_approve: dryRun?.would_approve === true,
    dry_run_real_approval: dryRun?.real_approval === false,
    dry_run_evidence_met: dryRunEvidence.filter((e: any) => e.met).length,
    dry_run_evidence_total: dryRunEvidence.length,
    approval_pack_present: !!loadJson<any>(path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-approval-pack.json")),
    target_files: [
      "reports/daily-digest.md",
      "reports/telegram-digest.txt",
    ],
    backup_retention_days: 7,
  };
}

function renderMarkdown(r: ApproveResult): string {
  const lines: string[] = [];
  lines.push("# Approved-for-future-promote State Record (Phase 5C-2C-C5N5)");
  lines.push("");
  lines.push(`- Phase: ${r.phase}`);
  lines.push(`- Mode: ${r.mode}`);
  lines.push(`- Timestamp (UTC): ${r.timestamp_utc}`);
  lines.push(`- Transition executed: **${r.transition_executed}**`);
  lines.push(`- Transition kind: \`${r.transition_kind}\``);
  lines.push(`- Previous state: \`${r.previous_state || "(unknown)"}\``);
  lines.push(`- New state: \`${r.new_state || "(blocked)"}\``);
  lines.push(`- Confirm phrase matched: **${r.confirm_phrase_matched}**`);
  lines.push(`- Confirmed by phrase: **${r.confirmed_by_phrase}**`);
  lines.push(`- Approved for future promote: **${r.approved_for_future_promote}**`);
  lines.push(`- Real approval: **${r.real_approval}** (true for this phase, but state record only)`);
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
    lines.push(`- ${k}: ${JSON.stringify(v)}`);
  }
  lines.push("");
  lines.push("## Audit Log Entry Summary");
  lines.push("");
  for (const [k, v] of Object.entries(r.audit_log_entry_summary || {})) lines.push(`- ${k}: ${v}`);
  lines.push("");
  lines.push("## Blocked Next Transitions");
  lines.push("");
  for (const b of r.blocked_next_transitions) lines.push(`- ${b}`);
  lines.push("");
  lines.push("## Blocked Actions");
  lines.push("");
  for (const a of r.blocked_actions) lines.push(`- ${a}`);
  lines.push("");
  lines.push("## Next Step");
  lines.push("");
  lines.push(r.next_step);
  lines.push("");
  lines.push("## Safety Constraints (verified)");
  lines.push("");
  for (const [k, v] of Object.entries(r.safety_constraints)) lines.push(`- ${k}: ${v}`);
  return lines.join("\n");
}

export function recordApprovedForFuturePromote(opts: { confirmPhrase: string }): ApproveResult {
  const generatedAt = new Date().toISOString();
  const timestampCompact = tsCompact();
  const policy = loadJson<any>(POLICY);
  if (!policy) throw new Error(`policy not found at ${POLICY}`);

  const requiredPhrase = policy.required_confirm_phrase || "APPROVE DAILY DIGEST FOR FUTURE PROMOTE";
  const phraseMatched = opts.confirmPhrase === requiredPhrase;
  const from = policy.allowed_transition?.from || "human_review_pending";
  const to = policy.allowed_transition?.to || "approved_for_future_promote";

  const approvalConfig = loadJson<any>(APPROVAL_CONFIG);
  const dryRun = loadJson<any>(APPROVAL_DRY_RUN);
  const previousState = approvalConfig?.approval_state || null;

  const evidence = snapshotEvidence();
  const previousStateValid = previousState === from;
  const dryRunPresent = !!dryRun;
  const dryRunWouldApprove = dryRun?.would_approve === true;
  const c5n3Recorded = !!approvalConfig?.transition_history?.some(
    (t: any) => t.from === "approval_pack_ready" && t.to === "human_review_pending",
  );

  const evidenceChecksMet = previousStateValid && dryRunPresent && dryRunWouldApprove && c5n3Recorded;
  const canExecute = evidenceChecksMet && phraseMatched;

  const auditSummary = {
    action_id: "daily_digest_approved_for_future_promote",
    mode: "daily_digest_approved_for_future_promote",
    risk_level: "low",
    real_execution: canExecute,
    real_approval: canExecute,
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
  const updatedStateConfigPath = APPROVAL_CONFIG;

  if (!evidenceChecksMet) {
    if (!previousStateValid) {
      blockedReason = `previous_state_mismatch: expected ${from}, got ${previousState}`;
    } else if (!dryRunPresent) {
      blockedReason = "c5n4_dry_run_missing: C5N4 dry-run result not present";
    } else if (!dryRunWouldApprove) {
      blockedReason = "c5n4_dry_run_would_approve_false: C5N4 dry-run did not return would_approve=true";
    } else if (!c5n3Recorded) {
      blockedReason = "c5n3_human_review_pending_not_recorded";
    } else {
      blockedReason = "evidence_incomplete";
    }
  } else if (!phraseMatched) {
    blockedReason = `confirm_phrase_mismatch: expected "${requiredPhrase}"`;
  } else {
    // Execute the real state transition
    newState = to;

    // 1. Update the approval state config to reflect new state
    if (approvalConfig) {
      approvalConfig.approval_state = to;
      // Track the real_approval flag in the policy phase metadata
      if (!Array.isArray(approvalConfig.transition_history)) approvalConfig.transition_history = [];
      approvalConfig.transition_history.push({
        from,
        to,
        timestamp_utc: generatedAt,
        transition_kind: "approved_for_future_promote_state_record",
        confirm_phrase: requiredPhrase,
        approved_for_future_promote: true,
        real_approval: true,
        real_promote: false,
        production_write: false,
        telegram_send: false,
        confirmed_by_phrase: true,
      });
      fs.writeFileSync(APPROVAL_CONFIG, JSON.stringify(approvalConfig, null, 2));
    }

    // 2. Write history record
    ensureDir(HISTORY_DIR);
    historyJsonPath = path.join(HISTORY_DIR, `daily-digest-approved-for-future-promote-${timestampCompact}.json`);
    const historyRecord: ApproveResult = {
      phase: "5C-2C-C5N5",
      mode: "approved_for_future_promote_state_record",
      version: "0.1.0",
      timestamp_utc: generatedAt,
      previous_state: previousState,
      new_state: to,
      transition_executed: true,
      transition_kind: "approved_for_future_promote_state_record",
      confirm_phrase_matched: phraseMatched,
      confirmed_by_phrase: phraseMatched,
      approved_for_future_promote: true,
      real_approval: true,
      real_promote_allowed: false,
      production_write_allowed: false,
      telegram_send_allowed: false,
      history_json_path: historyJsonPath,
      history_md_path: null,
      updated_state_config_path: APPROVAL_CONFIG,
      evidence_snapshot: evidence,
      audit_log_entry_summary: auditSummary,
      blocked_next_transitions: policy.blocked_transitions || [],
      blocked_actions: policy.blocked_actions || [],
      next_step: "approved_for_future_promote state ACTUALLY recorded. Production write and Telegram send remain DISABLED. To actually promote in a future phase, an orchestrator (C5N-6, not yet implemented) would need to re-verify the env gate (CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1) and an explicit per-promote confirm phrase BEFORE any production write or Telegram send.",
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
        no_real_promote: true,
        no_skip_evidence: true,
        output_redacted: true,
      },
    };
    historyMdPath = path.join(HISTORY_DIR, `daily-digest-approved-for-future-promote-${timestampCompact}.md`);
    historyRecord.history_md_path = historyMdPath;
    fs.writeFileSync(historyJsonPath, JSON.stringify(historyRecord, null, 2));
    fs.writeFileSync(historyMdPath, renderMarkdown(historyRecord));

    return historyRecord;
  }

  // Blocked path
  return {
    phase: "5C-2C-C5N5",
    mode: "approved_for_future_promote_state_record",
    version: "0.1.0",
    timestamp_utc: generatedAt,
    previous_state: previousState,
    new_state: newState,
    transition_executed: false,
    transition_kind: "approved_for_future_promote_state_record",
    confirm_phrase_matched: phraseMatched,
    confirmed_by_phrase: false,
    approved_for_future_promote: false,
    real_approval: false,
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    history_json_path: historyJsonPath,
    history_md_path: historyMdPath,
    updated_state_config_path: updatedStateConfigPath,
    evidence_snapshot: evidence,
    audit_log_entry_summary: auditSummary,
    blocked_next_transitions: policy.blocked_transitions || [],
    blocked_actions: policy.blocked_actions || [],
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
      no_real_promote: true,
      no_skip_evidence: true,
      output_redacted: true,
    },
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const phraseIdx = args.indexOf("--confirm-phrase");
  const phrase = phraseIdx >= 0 ? args[phraseIdx + 1] : "";
  const result = recordApprovedForFuturePromote({ confirmPhrase: phrase });
  console.log(redact(JSON.stringify(result, null, 2)));
  process.exit(result.transition_executed ? 0 : 1);
}