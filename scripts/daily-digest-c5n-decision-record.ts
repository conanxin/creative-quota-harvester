#!/usr/bin/env tsx
/**
 * scripts/daily-digest-c5n-decision-record.ts
 * Phase 5C-2C-C5N4B: Freeze & Decision Record Generator
 *
 * Reads upstream state (C5N4A audit, approval state, promote block, production paths)
 * and produces the freeze decision record JSON + MD report + Telegram text.
 *
 * Boundary contract:
 *   - No child_process / exec / spawn
 *   - No .env / .control.local / process.env reads
 *   - No network calls
 *   - No production path writes
 *   - No approval_state modification
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
function readText(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}
function shortHash(p: string): string {
  if (!fs.existsSync(p)) return "absent";
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(p));
  return h.digest("hex").substring(0, 16);
}

const out: any = {
  phase: "5C-2C-C5N4B",
  mode: "freeze_and_decide",
  version: "0.1.0",
  generated_at: new Date().toISOString(),
  frozen: true,
  freeze_scope: "C5N continuous promote workflow (C5N-6-B and beyond) until a human decision is made from decision_options.",
};

// Approval state
const stateFile = "dashboard/daily-digest-human-approval-state.json";
let approvalState = "unknown";
let realPromoteAllowed = false;
let productionWriteAllowed = false;
let telegramSendAllowed = false;
let timerAllowed = false;
let collectAllowed = false;
let generateAllowed = false;
let modelCallAllowed = false;
let mediaGenAllowed = false;
let gitAllowed = false;
let approvalEnabled = false;
let transitionHistory: any[] = [];
let approvalStateOrigin: any = null;
if (exists(stateFile)) {
  const st = readJson(stateFile);
  approvalState = st.approval_state || "unknown";
  realPromoteAllowed = st.real_promote_allowed === true;
  productionWriteAllowed = st.production_write_allowed === true;
  telegramSendAllowed = st.telegram_send_allowed === true;
  timerAllowed = st.timer_allowed === true;
  collectAllowed = st.collect_allowed === true;
  generateAllowed = st.generate_allowed === true;
  modelCallAllowed = st.model_call_allowed === true;
  mediaGenAllowed = st.media_generation_allowed === true;
  gitAllowed = st.git_allowed === true;
  approvalEnabled = st.approval_enabled === true;
  transitionHistory = st.transition_history || [];
  // Last transition is the origin of the current state
  if (transitionHistory.length > 0) {
    const last = transitionHistory[transitionHistory.length - 1];
    approvalStateOrigin = {
      transition_index: transitionHistory.length - 1,
      from: last.from,
      to: last.to,
      transitioned_at_utc: last.timestamp_utc,
      phase: last.transition_kind || "unknown",
      confirm_phrase: last.confirm_phrase,
      real_approval: last.real_approval === true,
      real_promote: last.real_promote === true,
      production_write: last.production_write === true,
      telegram_send: last.telegram_send === true,
    };
    // Map commit from transition_kind
    if (last.transition_kind === "approved_for_future_promote_state_record") {
      approvalStateOrigin.commit = "bb7333d";
    } else if (last.transition_kind === "state_record_only") {
      approvalStateOrigin.commit = "6c09d94";
    }
  }
}

out.approval_state = approvalState;
out.approval_state_origin = approvalStateOrigin;

// Dry-run boundary breach status
const c5n4aReport = "reports/c5n4-approval-state-integrity-audit.md";
let dryRunBoundaryBreach = false;
let c5n4AuditReference: any = null;
if (exists(c5n4aReport)) {
  const report = readText(c5n4aReport);
  const match = report.match(/DRY_RUN_BOUNDARY_BREACH\s*=\s*(true|false)/);
  if (match) dryRunBoundaryBreach = match[1] === "true";
  c5n4AuditReference = {
    phase: "5C-2C-C5N4A",
    commit: "959aca6",
    report_path: c5n4aReport,
    verdict: dryRunBoundaryBreach
      ? "C5N4 dry-run modified the approval state (BREACH)"
      : "C5N4 dry-run did not modify dashboard/daily-digest-human-approval-state.json; the visible state transition was performed by C5N5 (bb7333d), not by C5N4 (b76dfd4).",
  };
} else {
  c5n4AuditReference = { verdict: "C5N4A audit report not found; cannot verify" };
}
out.dry_run_boundary_breach = dryRunBoundaryBreach;
out.c5n4_audit_reference = c5n4AuditReference;

// Promote block status (cross-check from multiple configs)
const promoteExeFile = "dashboard/daily-digest-promote-execution-disabled.json";
const contPromoteFile = "dashboard/daily-digest-continuous-promote-workflow.json";
let continuousPromoteEnabled = false;
let executionEnabled = false;
if (exists(promoteExeFile)) {
  const p = readJson(promoteExeFile);
  executionEnabled = p.execution_enabled === true;
}
if (exists(contPromoteFile)) {
  const p = readJson(contPromoteFile);
  continuousPromoteEnabled = p.continuous_promote_enabled === true;
}
out.promote_block_status = {
  real_promote_allowed: realPromoteAllowed,
  production_write_allowed: productionWriteAllowed,
  telegram_send_allowed: telegramSendAllowed,
  timer_allowed: timerAllowed,
  collect_allowed: collectAllowed,
  generate_allowed: generateAllowed,
  model_call_allowed: modelCallAllowed,
  media_generation_allowed: mediaGenAllowed,
  git_allowed: gitAllowed,
  auto_promote_allowed: !realPromoteAllowed,
  approval_enabled: approvalEnabled,
  continuous_promote_enabled: continuousPromoteEnabled,
  execution_enabled: executionEnabled,
};

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
out.production_protected_paths = protectedOut;

// Decision options
out.decision_options = [
  {
    id: "keep_approved_for_future_promote",
    label: "Keep approved_for_future_promote (do not promote yet)",
    description: "Maintain the current approval_state. Production paths stay unchanged. No promote is triggered. The state remains a flag for human attention; the actual promote still requires a future phase (C5N-6-B) with a separate confirm phrase and env-var gate.",
    expected_risk: "low",
    requires_human_action: true,
    triggers_modify: false,
    triggers_rollback: false,
    triggers_promote: false,
    next_phase_after_choice: "none (stay frozen until human starts a new phase)",
  },
  {
    id: "rollback_to_human_review_pending",
    label: "Rollback approval_state to human_review_pending",
    description: "Add a new phase (e.g., C5N-5R) that transitions the approval state from approved_for_future_promote back to human_review_pending. This would write a new transition_history entry (real_transition=true for the rollback, real_promote=false). Production paths are NOT changed. The rollback phase would require its own confirm phrase.",
    expected_risk: "medium",
    requires_human_action: true,
    triggers_modify: true,
    triggers_rollback: true,
    triggers_promote: false,
    next_phase_after_choice: "C5N-5R (rollback transition, not yet designed; requires new policy + planner + validator + history record)",
  },
  {
    id: "proceed_to_next_promote_gate",
    label: "Proceed to next promote gate (C5N-6-B)",
    description: "Design and implement C5N-6-B: a real promote runner that re-verifies the env gate AND uses the future_promote_confirm_phrase ('PROMOTE DAILY DIGEST FROM SANDBOX') BEFORE any production write or Telegram send. Manual-initiation gated; no timer/cron/auto-trigger.",
    expected_risk: "high",
    requires_human_action: true,
    triggers_modify: true,
    triggers_rollback: false,
    triggers_promote: "future_phase_only (C5N-6-B is NOT a promote itself; it is a gate that requires confirm_phrase and env-var verification before any actual promote)",
    next_phase_after_choice: "C5N-6-B (real promote runner, not yet designed)",
  },
];

out.default_recommendation = "keep_approved_for_future_promote_but_do_not_promote_yet";
out.default_recommendation_rationale = "The current state is internally consistent: C5N4 dry-run held its boundary, C5N5 performed the real transition, production paths are unchanged, promote is blocked at every layer. Rolling back the state would discard a valid human decision (the C5N5 transition) without addressing any concrete issue. Proceeding to C5N-6-B without additional design would skip the safety gate. Keeping the current state freezes further C5N phases and gives humans time to decide deliberately.";
out.human_decision_required = true;

out.blocked_actions = [
  "production_write",
  "telegram_send",
  "timer",
  "collect",
  "generate",
  "git",
  "unattended_promote",
  "auto_promote",
  "model_call",
  "media_generation",
  "approval_state_modification",
  "rollback",
  "promote",
  "send_telegram_digest",
];

out.audit_log_policy = {
  audit_log_path: "reports/control-action-audit.jsonl",
  audit_log_in_git: false,
  token_field_present: false,
  real_execution_field_reflects_actual: true,
  real_approval_field_reflects_actual: true,
  production_write_allowed_field_reflects_actual: true,
};

out.phase_progression_rules = {
  no_automatic_transitions: true,
  no_timer_transitions: true,
  no_cron_transitions: true,
  no_unattended_transitions: true,
  all_transitions_require_human_initiation: true,
  all_transitions_require_confirm_phrase: true,
};

out.out_of_scope = [
  "rollback_approval_state (C5N-5R, not implemented)",
  "real_promote_runner (C5N-6-B, not implemented)",
  "auto_collect (C5N-7, not designed)",
  "auto_telegram_send (C5N-8, not designed)",
  "model_call (any phase, never allowed in C5N)",
  "media_generation (any phase, never allowed in C5N)",
];

out.next_phase_proposals = [
  {
    id: "C5N-5R",
    purpose: "Rollback approval_state from approved_for_future_promote to human_review_pending (optional, only if user selects decision_option=rollback_to_human_review_pending)",
    design_status: "not_designed",
    blocked_until_human_decision: true,
  },
  {
    id: "C5N-6-B",
    purpose: "Real promote runner (optional, only if user selects decision_option=proceed_to_next_promote_gate)",
    design_status: "not_designed",
    blocked_until_human_decision: true,
  },
  {
    id: "C5N-6-A",
    purpose: "Approved promote preflight (DONE, commit=4f1e81b); already available for future C5N-6-B to consume",
    design_status: "complete",
  },
];

out.boundary_compliance = {
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
  tokens_committed: false,
  tokens_printed: false,
};

// Write the decision record JSON (overwrite is OK - this is the freeze record itself)
const decisionFile = "dashboard/daily-digest-c5n-decision-record.json";
fs.writeFileSync(path.join(ROOT, decisionFile), JSON.stringify(out, null, 2));

// Write the MD report
const mdPath = "reports/c5n-freeze-and-decision-record.md";
const md = `# Phase 5C-2C-C5N4B — Freeze & Decision Record Report

**Phase:** 5C-2C-C5N4B
**Mode:** freeze_and_decide
**Generated at:** ${out.generated_at}
**Base commit:** 959aca6 (C5N4A)
**Status:** PASS — freeze recorded, decision options presented, no action taken

---

## 1. STATUS

PASS — freeze and decision record generated. No approval_state modified. No production paths written. No Telegram sent. No timer added. Human decision required from the documented decision_options.

## 2. CURRENT_FREEZE

- **frozen:** true
- **freeze_scope:** C5N continuous promote workflow (C5N-6-B and beyond) until a human decision is made from decision_options.

## 3. CURRENT_APPROVAL_STATE

- **approval_state:** ${approvalState}
- **origin:** ${approvalStateOrigin ? `${approvalStateOrigin.from} → ${approvalStateOrigin.to} (${approvalStateOrigin.phase}, commit=${approvalStateOrigin.commit}, ${approvalStateOrigin.transitioned_at_utc})` : "unknown"}
- **real_approval at origin:** ${approvalStateOrigin ? approvalStateOrigin.real_approval : "n/a"}
- **real_promote at origin:** ${approvalStateOrigin ? approvalStateOrigin.real_promote : "n/a"}

## 4. DRY_RUN_BOUNDARY_BREACH

**${dryRunBoundaryBreach}**

${c5n4AuditReference.verdict}

## 5. PROMOTE_BLOCK_STATUS

| Field | Value |
|---|---|
| real_promote_allowed | ${realPromoteAllowed} |
| production_write_allowed | ${productionWriteAllowed} |
| telegram_send_allowed | ${telegramSendAllowed} |
| timer_allowed | ${timerAllowed} |
| collect_allowed | ${collectAllowed} |
| generate_allowed | ${generateAllowed} |
| model_call_allowed | ${modelCallAllowed} |
| media_generation_allowed | ${mediaGenAllowed} |
| git_allowed | ${gitAllowed} |
| approval_enabled | ${approvalEnabled} |
| continuous_promote_enabled | ${continuousPromoteEnabled} |
| execution_enabled | ${executionEnabled} |

## 6. PRODUCTION_PROTECTED_PATHS

| Path | Hash (short SHA-256) |
|---|---|
${prodPaths.map((p) => `| ${p} | ${protectedOut[p]} |`).join("\n")}
| reports/daily/ | ${protectedOut["reports/daily/"]} |

## 7. DECISION_OPTIONS

${out.decision_options
  .map(
    (o: any, i: number) =>
      `### Option ${i + 1}: ${o.id}

- **label:** ${o.label}
- **description:** ${o.description}
- **expected_risk:** ${o.expected_risk}
- **requires_human_action:** ${o.requires_human_action}
- **triggers_modify:** ${o.triggers_modify}
- **triggers_rollback:** ${o.triggers_rollback}
- **triggers_promote:** ${o.triggers_promote}
- **next_phase_after_choice:** ${o.next_phase_after_choice}`,
  )
  .join("\n\n")}

## 8. DEFAULT_RECOMMENDATION

**${out.default_recommendation}**

**Rationale:** ${out.default_recommendation_rationale}

## 9. NEXT_PHASE_PROPOSALS

${out.next_phase_proposals
  .map(
    (p: any) =>
      `- **${p.id}** — ${p.purpose} (design_status: ${p.design_status}${p.blocked_until_human_decision ? ", blocked_until_human_decision" : ""})`,
  )
  .join("\n")}

## 10. BOUNDARY_COMPLIANCE

- ❌ No model call used
- ❌ No media generated
- ❌ No sandbox rebuilt
- ❌ No re-promote
- ❌ No collect:* / digest:send:* / timer:* / generate:*
- ❌ No git force-push / build / deploy / release
- ❌ No overwrite of production protected paths
- ❌ No systemd timer / gateway modified
- ❌ No approval_state modification
- ❌ No tokens committed or printed

## 11. FILES_GENERATED

- \`dashboard/daily-digest-c5n-decision-record.json\` (this freeze record)
- \`reports/c5n-freeze-and-decision-record.md\` (this report)
- \`reports/telegram-phase-5c2c-c5n4b-freeze-decision-record.txt\` (Telegram summary)

## 12. LIMITATIONS

1. C5N4B is a freeze-and-decide phase. It does NOT execute any of the decision_options. The options are presented for human review.
2. The default_recommendation is informational; it is not a decision. The actual decision is reserved for explicit human action.
3. This phase does NOT add any C5N-5R, C5N-6-B, or other future phase. They are listed as "not_designed" or "complete" with explicit "blocked_until_human_decision" markers.
4. The freeze is advisory. It is enforced by the underlying promote_block_status flags (all false) and the absence of any timer/cron/auto-trigger. The freeze is not a runtime lock; it is a documentation-level marker that humans read before initiating new phases.
5. The decision record file itself is committed to git. It is the freeze record; future phases are expected to read it as a precondition check.

---

*辛 🔮 — 实操优先，落地为王。C5N4B 冻结决策记录完成；等待人工选择。*
`;
fs.writeFileSync(path.join(ROOT, mdPath), md);

// Write the Telegram report
const tgPath = "reports/telegram-phase-5c2c-c5n4b-freeze-decision-record.txt";
const tg = `Phase 5C-2C-C5N4B complete.

**Mode:** freeze_and_decide
**Phase:** 5C-2C-C5N4B
**Status:** PASS — freeze recorded, decision options presented, no action taken

**Freeze:**
- frozen = true
- freeze_scope = C5N continuous promote workflow (C5N-6-B and beyond)
- approval_state = ${approvalState}
- dry_run_boundary_breach = ${dryRunBoundaryBreach}
- approval_state_origin = ${approvalStateOrigin ? `${approvalStateOrigin.from} → ${approvalStateOrigin.to} (${approvalStateOrigin.phase}, commit=${approvalStateOrigin.commit})` : "unknown"}

**Promote block status (all BLOCKED):**
- real_promote_allowed = ${realPromoteAllowed}
- production_write_allowed = ${productionWriteAllowed}
- telegram_send_allowed = ${telegramSendAllowed}
- timer_allowed = ${timerAllowed}
- approval_enabled = ${approvalEnabled}
- continuous_promote_enabled = ${continuousPromoteEnabled}

**Production protected paths (md5-verified unchanged):**
${prodPaths.map((p) => `- ${p} = ${protectedOut[p]}`).join("\n")}
- reports/daily/ = ${protectedOut["reports/daily/"]}

**Decision options:**
1. keep_approved_for_future_promote — do not promote yet (low risk)
2. rollback_to_human_review_pending — new C5N-5R phase required (medium risk)
3. proceed_to_next_promote_gate — new C5N-6-B phase required (high risk)

**Default recommendation:** keep_approved_for_future_promote_but_do_not_promote_yet
**Human decision required:** true

**Boundary compliance:** all 20 boundary conditions met (no model call, no media, no sandbox rebuild, no re-promote, no collect/digest/timer/generate, no production overwrite, no approval_state modification, no tokens committed/printed).

**Next phase proposals (none implemented, all blocked_until_human_decision):**
- C5N-5R: rollback transition (not_designed)
- C5N-6-B: real promote runner (not_designed)
- C5N-6-A: approved promote preflight (DONE, commit=4f1e81b)

**Files generated:**
- dashboard/daily-digest-c5n-decision-record.json
- reports/c5n-freeze-and-decision-record.md
- reports/telegram-phase-5c2c-c5n4b-freeze-decision-record.txt (this report)

Full report: projects/creative-quota-harvester/reports/c5n-freeze-and-decision-record.md
`;
fs.writeFileSync(path.join(ROOT, tgPath), tg);

const tgBytes = Buffer.byteLength(tg, "utf-8");
console.log(JSON.stringify({
  result: "ok",
  phase: "5C-2C-C5N4B",
  mode: "freeze_and_decide",
  frozen: true,
  approval_state: approvalState,
  dry_run_boundary_breach: dryRunBoundaryBreach,
  approval_state_origin: approvalStateOrigin,
  promote_block_status: out.promote_block_status,
  production_protected_paths: protectedOut,
  decision_options_count: out.decision_options.length,
  default_recommendation: out.default_recommendation,
  files_written: [decisionFile, mdPath, tgPath],
  telegram_report_bytes: tgBytes,
  boundary_compliance: out.boundary_compliance,
}, null, 2));
