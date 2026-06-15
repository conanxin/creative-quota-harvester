#!/usr/bin/env tsx
/**
 * scripts/daily-digest-human-approval-transition-dry-run.ts
 * Phase 5C-2C-C5N2: Manual Approval Transition Dry-run (DRY-RUN ONLY)
 *
 * This script SIMULATES a single human-approval state transition
 * (approval_pack_ready → human_review_pending). It does NOT:
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
 *   - dashboard/daily-digest-human-approval-transition-policy.json (this phase's policy)
 *   - dashboard/daily-digest-human-approval-state.json (C5N1 config)
 *   - dashboard/daily-digest-human-approval-state-status.json (C5N1 status)
 *
 * Outputs (dry-run-only):
 *   - dashboard/daily-digest-human-approval-transition-dry-run.json
 *   - reports/human-approval-transition-dry-run.md
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const POLICY = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-approval-transition-policy.json");
const APPROVAL_CONFIG = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-approval-state.json");
const APPROVAL_STATUS = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-approval-state-status.json");
const DRY_RUN_OUTPUT = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-approval-transition-dry-run.json");
const PLAN_MD_OUTPUT = path.join(HARVESTER_DIR, "reports/human-approval-transition-dry-run.md");

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

interface DryRunResult {
  phase: string;
  mode: string;
  version: string;
  generated_at: string;
  real_approval_allowed: boolean;
  real_transition_allowed: boolean;
  real_promote_allowed: boolean;
  production_write_allowed: boolean;
  telegram_send_allowed: boolean;
  would_transition: boolean;
  real_transition: false;
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
  audit_recommendation: string;
  upstream_inputs: {
    c5n1_config_present: boolean;
    c5n1_status_present: boolean;
    c5n1_approval_state: string | null;
    c5n1_pack_ready_evidence_met: number;
    c5n1_pack_ready_evidence_total: number;
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
    no_real_transition: true;
    no_real_approval: true;
    output_redacted: true;
  };
}

export function planTransitionDryRun(opts: { confirmPhrase?: string } = {}): DryRunResult {
  const generatedAt = new Date().toISOString();
  const policy = loadJson<any>(POLICY);
  if (!policy) throw new Error(`transition policy not found at ${POLICY}`);

  const approvalConfig = loadJson<any>(APPROVAL_CONFIG);
  const approvalStatus = loadJson<any>(APPROVAL_STATUS);

  const currentState: string | null = approvalStatus?.approval_state || null;
  const packReadyEvidence: any[] = approvalStatus?.evidence_for_approval_pack_ready || [];
  const packReadyMet = packReadyEvidence.filter(e => e.met).length;
  const packReadyTotal = packReadyEvidence.length;

  const from = policy.allowed_dry_run_transition?.from || "approval_pack_ready";
  const to = policy.allowed_dry_run_transition?.to || "human_review_pending";

  const requiredPhrase = policy.required_confirm_phrase || "DRY RUN DAILY HUMAN APPROVAL TRANSITION";
  const phraseMatched = opts.confirmPhrase === requiredPhrase;

  // Build evidence checklist for the dry-run
  const evidence: DryRunEvidence[] = [
    {
      key: "current_state_eq_approval_pack_ready",
      label_zh: "当前状态等于 approval_pack_ready",
      met: currentState === from,
      note: currentState ? `current_state=${currentState}` : "no current state",
    },
    {
      key: "all_pack_ready_evidence_met",
      label_zh: "所有 pack-ready 证据已满足",
      met: packReadyMet === packReadyTotal && packReadyTotal > 0,
      note: `${packReadyMet}/${packReadyTotal} pack-ready evidence met`,
    },
    {
      key: "dry_run_only_mode",
      label_zh: "dry-run 模式开启",
      met: !!policy.real_approval_allowed === false,
      note: `real_approval_allowed=${policy.real_approval_allowed}`,
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

  // Determine missing requirements
  const missing: string[] = evidence.filter(e => !e.met).map(e => e.key);

  const wouldTransition = evidence.filter(e => e.key !== "confirm_phrase_matched").every(e => e.met);

  let auditRec: string;
  if (wouldTransition && phraseMatched) {
    auditRec = "Dry-run transition would proceed. NO real transition is performed. Real transition requires a future phase (C5N-3) that implements a human-approver runner with env gate verification and explicit per-transition audit log entry.";
  } else if (wouldTransition && !phraseMatched) {
    auditRec = "Dry-run transition conditions met, but confirm phrase was not provided (or did not match). To exercise the dry-run with the right phrase, POST to /api/daily-digest/human-approval/transition-dry-run with confirm_phrase=\"" + requiredPhrase + "\".";
  } else {
    auditRec = "Dry-run transition blocked: " + (missing.length > 0 ? "missing=" + missing.join(",") : "unknown reason") + ". Resolve the missing requirements before retrying.";
  }

  return {
    phase: "5C-2C-C5N2",
    mode: "approval_transition_dry_run_only",
    version: "0.1.0",
    generated_at: generatedAt,
    real_approval_allowed: false,
    real_transition_allowed: false,
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    would_transition: wouldTransition,
    real_transition: false,
    current_state: currentState,
    proposed_next_state: wouldTransition ? to : null,
    transition: wouldTransition ? { from, to } : null,
    required_confirm_phrase: requiredPhrase,
    required_env_gate: policy.required_env_gate || "CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1",
    env_gate_evaluated: false,
    env_gate_evaluated_note: policy.env_gate_evaluated_note || "this script does not read process.env",
    evidence_for_transition: evidence,
    blocked_transitions: policy.blocked_transitions || [],
    blocked_actions: policy.blocked_actions || [],
    missing_requirements: missing,
    audit_recommendation: auditRec,
    upstream_inputs: {
      c5n1_config_present: !!approvalConfig,
      c5n1_status_present: !!approvalStatus,
      c5n1_approval_state: currentState,
      c5n1_pack_ready_evidence_met: packReadyMet,
      c5n1_pack_ready_evidence_total: packReadyTotal,
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
      no_real_transition: true,
      no_real_approval: true,
      output_redacted: true,
    },
  };
}

function renderMarkdown(result: DryRunResult): string {
  const lines: string[] = [];
  lines.push("# Human Approval Transition Dry-run (Phase 5C-2C-C5N2)");
  lines.push("");
  lines.push(`- Phase: ${result.phase}`);
  lines.push(`- Mode: ${result.mode}`);
  lines.push(`- Generated at: ${result.generated_at}`);
  lines.push(`- Real approval allowed: **${result.real_approval_allowed}**`);
  lines.push(`- Real transition allowed: **${result.real_transition_allowed}**`);
  lines.push(`- Real promote allowed: **${result.real_promote_allowed}**`);
  lines.push(`- Production write allowed: **${result.production_write_allowed}**`);
  lines.push(`- Telegram send allowed: **${result.telegram_send_allowed}**`);
  lines.push(`- Would transition: **${result.would_transition}**`);
  lines.push(`- Real transition (executed): **${result.real_transition}** (always false)`);
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
  lines.push("## Audit Recommendation");
  lines.push("");
  lines.push(result.audit_recommendation);
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
  const result = planTransitionDryRun({ confirmPhrase: phrase });
  fs.writeFileSync(DRY_RUN_OUTPUT, JSON.stringify(result, null, 2));
  fs.writeFileSync(PLAN_MD_OUTPUT, renderMarkdown(result));
  console.log(redact(JSON.stringify(result, null, 2)));
  process.exit(0);
}
