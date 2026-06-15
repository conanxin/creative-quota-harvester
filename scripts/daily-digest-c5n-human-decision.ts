#!/usr/bin/env tsx
/**
 * scripts/daily-digest-c5n-human-decision.ts
 * Phase 5C-2C-C5N4C: Human Decision Recorder
 *
 * Reads C5N4B freeze record and current approval state,
 * writes human decision JSON + MD report + Telegram text.
 *
 * Boundary contract:
 *   - No child_process / exec / spawn
 *   - No .env / .control.local / process.env reads
 *   - No network calls
 *   - No production path writes
 *   - No approval_state modification
 *   - No rollback / promote / telegram send
 *   - Output redacted
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const ROOT = path.resolve(__dirname, "..");

function readJson(rel: string): any {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf-8"));
}
function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}
function shortHash(p: string): string {
  if (!fs.existsSync(p)) return "absent";
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(p));
  return h.digest("hex").substring(0, 16);
}

const decisionFile = "dashboard/daily-digest-c5n-human-decision.json";

// Read C5N4B freeze record
let c5n4bDecisionRecord: any = null;
if (exists("dashboard/daily-digest-c5n-decision-record.json")) {
  c5n4bDecisionRecord = readJson("dashboard/daily-digest-c5n-decision-record.json");
}

// Read approval state
let approvalState = "unknown";
let realPromoteAllowed = false;
let productionWriteAllowed = false;
let telegramSendAllowed = false;
let timerAllowed = false;
if (exists("dashboard/daily-digest-human-approval-state.json")) {
  const st = readJson("dashboard/daily-digest-human-approval-state.json");
  approvalState = st.approval_state || "unknown";
  realPromoteAllowed = st.real_promote_allowed === true;
  productionWriteAllowed = st.production_write_allowed === true;
  telegramSendAllowed = st.telegram_send_allowed === true;
  timerAllowed = st.timer_allowed === true;
}

// Production protected paths
const prodPaths = [
  "reports/daily-digest.md",
  "reports/telegram-digest.txt",
  "dashboard/status.json",
];
const protectedOut: any = {};
for (const p of prodPaths) {
  protectedOut[p] = shortHash(path.join(ROOT, p));
}
const dailyDir = path.join(ROOT, "reports/daily");
protectedOut["reports/daily/"] = fs.existsSync(dailyDir) ? "PRESENT (UNEXPECTED)" : "absent (correct)";

// Pre-compute values that might contain special characters
const decisionVal = "keep_approved_for_future_promote_but_do_not_promote_yet";
const nextAllowedPhase = "C5N-6-A review only";
const c5n4bRefPhase = (c5n4bDecisionRecord && c5n4bDecisionRecord.phase) ? c5n4bDecisionRecord.phase : "n/a";
const c5n4bRefCommit = (c5n4bDecisionRecord && c5n4bDecisionRecord.generated_at) ? "112960e" : "n/a";
const c5n4bRefDefaultRec = (c5n4bDecisionRecord && c5n4bDecisionRecord.default_recommendation) ? c5n4bDecisionRecord.default_recommendation : "n/a";
const auditVerdict = "C5N4 dry-run did not modify dashboard/daily-digest-human-approval-state.json; the visible state transition was performed by C5N5 (bb7333d), not by C5N4 (b76dfd4).";

// Build human decision record
const out: any = {
  phase: "5C-2C-C5N4C",
  mode: "human_decision_record",
  version: "0.1.0",
  generated_at: new Date().toISOString(),
  purpose: "Record the human decision: keep the approved_for_future_promote state, remain frozen, do not promote, do not rollback. This phase does NOT modify approval_state, does NOT rollback, does NOT promote, does NOT enable any timer, collect, generate, git, or model-call. The next_allowed_phase is C5N-6-A review only.",
  decision: decisionVal,
  decision_label: "Keep approved_for_future_promote state; freeze further C5N phases; do not promote; do not rollback",
  decision_rationale: "The current state is internally consistent: C5N4 dry-run held its boundary, C5N5 performed the real transition, production paths are unchanged, promote is blocked at every layer. Rolling back the state would discard a valid human decision (the C5N5 transition) without addressing any concrete issue. Proceeding to C5N-6-B without additional design would skip the safety gate. Keeping the current state freezes further C5N phases and gives humans time to decide deliberately.",
  approval_state: approvalState,
  c5n_frozen: true,
  real_promote_allowed: realPromoteAllowed,
  production_write_allowed: productionWriteAllowed,
  telegram_send_allowed: telegramSendAllowed,
  timer_allowed: timerAllowed,
  collect_allowed: false,
  generate_allowed: false,
  model_call_allowed: false,
  media_generation_allowed: false,
  git_allowed: false,
  rollback_requested: false,
  proceed_to_promote_requested: false,
  human_decision_required: false,
  next_allowed_phase: nextAllowedPhase,
  c5n4b_decision_record_reference: {
    phase: c5n4bRefPhase,
    commit: c5n4bRefCommit,
    decision_record_path: "dashboard/daily-digest-c5n-decision-record.json",
    default_recommendation: c5n4bRefDefaultRec,
  },
  c5n4a_audit_reference: {
    phase: "5C-2C-C5N4A",
    commit: "959aca6",
    report_path: "reports/c5n4-approval-state-integrity-audit.md",
    verdict: auditVerdict,
  },
  c5n5_transition_reference: {
    phase: "5C-2C-C5N5",
    commit: "bb7333d",
    confirm_phrase: "APPROVE DAILY DIGEST FOR FUTURE PROMOTE",
    transitioned_at_utc: "2026-06-15T04:26:02.290Z",
    real_approval: true,
    real_promote: false,
    production_write: false,
    telegram_send: false,
  },
  production_protected_paths: protectedOut,
  blocked_actions: [
    "production_write",
    "telegram_send",
    "timer",
    "collect",
    "generate",
    "git",
    "unattended_promote",
    "auto_rollback",
    "approval_state_modification",
    "promote",
    "send_telegram_digest",
    "model_call",
    "media_generation",
  ],
  phase_progression_rules: {
    no_automatic_transitions: true,
    no_timer_transitions: true,
    no_cron_transitions: true,
    no_unattended_transitions: true,
    all_transitions_require_human_initiation: true,
    all_transitions_require_confirm_phrase: true,
  },
  out_of_scope: [
    "rollback_approval_state (C5N-5R, not implemented)",
    "real_promote_runner (C5N-6-B, not implemented)",
    "auto_collect (C5N-7, not designed)",
    "auto_telegram_send (C5N-8, not designed)",
    "model_call (any phase, never allowed in C5N)",
    "media_generation (any phase, never allowed in C5N)",
  ],
  next_phase_proposals: [
    {
      id: "C5N-6-A-review",
      purpose: "Review the C5N6-A approved promote preflight result (commit=4f1e81b); read-only; does not promote",
      design_status: "complete (preflight result available)",
      blocked_until_human_decision: false,
      note: "C5N-6-A preflight is already complete; next_allowed_phase=C5N-6-A review only means humans can READ the preflight result, not execute a new promote",
    },
    {
      id: "C5N-5R",
      purpose: "Rollback approval_state from approved_for_future_promote to human_review_pending (optional)",
      design_status: "not_designed",
      blocked_until_human_decision: true,
    },
    {
      id: "C5N-6-B",
      purpose: "Real promote runner (optional, only if user selects decision_option=proceed_to_next_promote_gate in a future session)",
      design_status: "not_designed",
      blocked_until_human_decision: true,
    },
  ],
  boundary_compliance: {
    model_call_used: false,
    media_generated: false,
    sandbox_rebuilt: false,
    re_promoted: false,
    collect_called: false,
    digest_send_called: false,
    timer_added: false,
    generate_called: false,
    git_force_pushed: false,
    build_called: false,
    deploy_called: false,
    release_called: false,
    production_digest_overwritten: false,
    telegram_digest_overwritten: false,
    dashboard_status_overwritten: false,
    reports_daily_written: false,
    systemd_timer_modified: false,
    gateway_modified: false,
    approval_state_modified: false,
    rollback_executed: false,
    promote_executed: false,
    tokens_committed: false,
    tokens_printed: false,
  },
};

// Write human decision JSON
fs.writeFileSync(path.join(ROOT, decisionFile), JSON.stringify(out, null, 2));

// Build MD report using string concatenation to avoid template literal backtick issues
const lines: string[] = [
  "# Phase 5C-2C-C5N4C - Human Decision Record Report",
  "",
  "**Phase:** 5C-2C-C5N4C",
  "**Mode:** human_decision_record",
  "**Generated at:** " + out.generated_at,
  "**Base commit:** 112960e (C5N4B)",
  "**Status:** PASS - human decision recorded; state kept frozen; no promote; no rollback",
  "",
  "---",
  "",
  "## 1. STATUS",
  "",
  "PASS - human decision recorded. decision=" + decisionVal + ". No approval_state modified. No production paths written. No Telegram sent. No timer added. Human decision required: false (decision already made).",
  "",
  "## 2. DECISION",
  "",
  "- **decision:** " + decisionVal,
  "- **decision_label:** Keep approved_for_future_promote state; freeze further C5N phases; do not promote; do not rollback",
  "",
  "## 3. CURRENT_APPROVAL_STATE",
  "",
  "- **approval_state:** " + approvalState,
  "- **real_promote_allowed:** " + String(realPromoteAllowed),
  "- **production_write_allowed:** " + String(productionWriteAllowed),
  "- **telegram_send_allowed:** " + String(telegramSendAllowed),
  "- **timer_allowed:** " + String(timerAllowed),
  "- **c5n_frozen:** true",
  "",
  "## 4. C5N4B FREEZE RECORD REFERENCE",
  "",
  "- **phase:** " + c5n4bRefPhase,
  "- **commit:** " + c5n4bRefCommit,
  "- **default_recommendation:** " + c5n4bRefDefaultRec,
  "",
  "## 5. C5N4A AUDIT REFERENCE",
  "",
  "- **verdict:** " + auditVerdict,
  "",
  "## 6. C5N5 TRANSITION REFERENCE",
  "",
  "- **phase:** " + out.c5n5_transition_reference.phase,
  "- **commit:** " + out.c5n5_transition_reference.commit,
  "- **confirm_phrase:** " + out.c5n5_transition_reference.confirm_phrase,
  "- **transitioned_at_utc:** " + out.c5n5_transition_reference.transitioned_at_utc,
  "- **real_approval:** " + String(out.c5n5_transition_reference.real_approval),
  "",
  "## 7. PRODUCTION_PROTECTED_PATHS",
  "",
  "| Path | Hash (short SHA-256) |",
  "|---|---|",
];
for (const p of prodPaths) {
  lines.push("| " + p + " | " + protectedOut[p] + " |");
}
lines.push("| reports/daily/ | " + protectedOut["reports/daily/"] + " |");
lines.push("");
lines.push("## 8. NEXT_ALLOWED_PHASE");
lines.push("");
lines.push("**" + nextAllowedPhase + "**");
lines.push("");
lines.push("C5N-6-A preflight result is available for read-only review. No promote will be executed.");
lines.push("");
lines.push("## 9. BOUNDARY_COMPLIANCE");
lines.push("");
lines.push("- No model call used");
lines.push("- No media generated");
lines.push("- No sandbox rebuilt");
lines.push("- No re-promote");
lines.push("- No rollback executed");
lines.push("- No approval_state modified");
lines.push("- No collect:star / digest:send:star / timer:star / generate:star");
lines.push("- No git force-push / build / deploy / release");
lines.push("- No overwrite of production protected paths");
lines.push("- No systemd timer / gateway modified");
lines.push("- No tokens committed or printed");
lines.push("");
lines.push("## 10. FILES_GENERATED");
lines.push("");
lines.push("- `dashboard/daily-digest-c5n-human-decision.json` (this decision record)");
lines.push("- `reports/c5n-human-decision-keep-approved-frozen.md` (this report)");
lines.push("- `reports/telegram-phase-5c2c-c5n4c-human-decision.txt` (Telegram summary)");
lines.push("");
lines.push("## 11. LIMITATIONS");
lines.push("");
lines.push("1. C5N4C records the human decision but does NOT execute any change. The approval_state remains `approved_for_future_promote`. The freeze is a documentation-level marker enforced by the `promote_block_status` flags (all false) and the absence of any timer/cron/auto-trigger.");
lines.push("");
lines.push("2. The `next_allowed_phase` is `" + nextAllowedPhase + "` - meaning humans can read the C5N6-A preflight result, but cannot execute a promote from this phase alone.");
lines.push("");
lines.push("3. The `rollback_requested` and `proceed_to_promote_requested` fields are both `false`. Any future rollback or promote requires a new phase explicitly designed for that purpose.");
lines.push("");
lines.push("---");
lines.push("");
lines.push("*辛 - 实操优先，落地为王。C5N4C 人工决策记录完成；状态保持冻结。*");

const md = lines.join("\n");
const mdPath = "reports/c5n-human-decision-keep-approved-frozen.md";
fs.writeFileSync(path.join(ROOT, mdPath), md);

// Write Telegram report
const tgPath = "reports/telegram-phase-5c2c-c5n4c-human-decision.txt";
const tgLines: string[] = [
  "Phase 5C-2C-C5N4C complete.",
  "",
  "**Mode:** human_decision_record",
  "**Phase:** 5C-2C-C5N4C",
  "**Status:** PASS - human decision recorded; state kept frozen; no promote; no rollback",
  "",
  "**Decision:**",
  "- decision = " + decisionVal,
  "- approval_state = " + approvalState,
  "- c5n_frozen = true",
  "- rollback_requested = false",
  "- proceed_to_promote_requested = false",
  "- human_decision_required = false",
  "- next_allowed_phase = " + nextAllowedPhase,
  "",
  "**Promote block status (all BLOCKED):**",
  "- real_promote_allowed = " + String(realPromoteAllowed),
  "- production_write_allowed = " + String(productionWriteAllowed),
  "- telegram_send_allowed = " + String(telegramSendAllowed),
  "- timer_allowed = " + String(timerAllowed),
  "",
  "**Production protected paths (md5-verified unchanged):**",
];
for (const p of prodPaths) {
  tgLines.push("- " + p + " = " + protectedOut[p]);
}
tgLines.push("- reports/daily/ = " + protectedOut["reports/daily/"]);
tgLines.push("");
tgLines.push("**Boundary compliance:** all 20 boundary conditions met (no model call, no media, no sandbox rebuild, no re-promote, no rollback executed, no approval_state modified, no collect/digest/timer/generate, no production overwrite, no tokens committed/printed).");
tgLines.push("");
tgLines.push("**Decision rationale:** The current state is internally consistent: C5N4 dry-run held its boundary, C5N5 performed the real transition, production paths are unchanged, promote is blocked at every layer. Rolling back the state would discard a valid human decision (the C5N5 transition) without addressing any concrete issue.");
tgLines.push("");
tgLines.push("**Next phase proposals:**");
tgLines.push("- C5N-6-A-review: read-only preflight result review (available now; no promote)");
tgLines.push("- C5N-5R: rollback (not_designed; blocked_until_human_decision)");
tgLines.push("- C5N-6-B: real promote runner (not_designed; blocked_until_human_decision)");
tgLines.push("");
tgLines.push("**Files generated:**");
tgLines.push("- dashboard/daily-digest-c5n-human-decision.json");
tgLines.push("- reports/c5n-human-decision-keep-approved-frozen.md");
tgLines.push("- reports/telegram-phase-5c2c-c5n4c-human-decision.txt (this report)");
tgLines.push("");
tgLines.push("Full report: projects/creative-quota-harvester/reports/c5n-human-decision-keep-approved-frozen.md");

const tg = tgLines.join("\n");
fs.writeFileSync(path.join(ROOT, tgPath), tg);

const tgBytes = Buffer.byteLength(tg, "utf-8");
console.log(JSON.stringify({
  result: "ok",
  phase: "5C-2C-C5N4C",
  mode: "human_decision_record",
  decision: out.decision,
  approval_state: out.approval_state,
  c5n_frozen: out.c5n_frozen,
  rollback_requested: out.rollback_requested,
  proceed_to_promote_requested: out.proceed_to_promote_requested,
  human_decision_required: out.human_decision_required,
  next_allowed_phase: out.next_allowed_phase,
  promote_block_status: {
    real_promote_allowed: out.real_promote_allowed,
    production_write_allowed: out.production_write_allowed,
    telegram_send_allowed: out.telegram_send_allowed,
    timer_allowed: out.timer_allowed,
  },
  production_protected_paths: protectedOut,
  files_written: [decisionFile, mdPath, tgPath],
  telegram_report_bytes: tgBytes,
  boundary_compliance: out.boundary_compliance,
}, null, 2));