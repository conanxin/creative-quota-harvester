# Phase 5C-2C-C5N4A — Approval State Integrity Audit Report

**Phase:** 5C-2C-C5N4A
**Mode:** approval_state_integrity_audit_only
**Generated at:** 2026-06-15T15:24:00+08:00
**Base commit:** 4f1e81b (C5N6-A)
**C5N4 commit audited:** b76dfd4
**Status:** PASS — C5N4 dry-run boundary held; the state transition `human_review_pending → approved_for_future_promote` was correctly performed by C5N5 (bb7333d), not by C5N4

---

## 1. STATUS

PASS — C5N4 dry-run did NOT modify `dashboard/daily-digest-human-approval-state.json`. The current `approval_state=approved_for_future_promote` was set by a **later** commit (C5N5, bb7333d), which was an explicitly designed real-state-transition phase (its name is "Record approved-for-future-promote state"). The "Exec failed" surfaced after C5N4 was a duplicate-request artifact; the on-disk C5N4 artifacts and commit are intact.

## 2. COMMIT_AUDITED

- **C5N4 commit:** `b76dfd4` — "Phase 5C-2C-C5N4: Add approved-for-future-promote dry-run"
- **Author:** `Ubuntu <ubuntu@localhost.localdomain>`
- **Date:** 2026-06-15 11:44:23 +0800
- **Pushed to:** `origin/master` (`git branch -r --contains b76dfd4` → `origin/master` ✅)
- **Files touched (12 files, +1284 lines, 0 deletions):**
  - ADDED: `dashboard/daily-digest-approval-dry-run-policy.json` (79 lines)
  - ADDED: `dashboard/daily-digest-approval-dry-run.json` (138 lines)
  - ADDED: `scripts/daily-digest-approval-dry-run.ts` (353 lines)
  - ADDED: `scripts/validate-daily-digest-approval-dry-run.ts` (242 lines)
  - ADDED: `reports/approved-for-future-promote-dry-run.md` (180 lines)
  - ADDED: `reports/telegram-phase-5c2c-c5n4-approval-dry-run.txt` (40 lines)
  - MODIFIED: `scripts/control-server.ts` (+124 lines, +2 endpoints)
  - MODIFIED: `dashboard/control.html` (+70 lines, +1 panel)
  - MODIFIED: `package.json` (+2 scripts)
  - MODIFIED: `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md`, `README.md`, `ROADMAP.md`

**Critical finding:** `b76dfd4` did **NOT** modify `dashboard/daily-digest-human-approval-state.json` (verified via `git show b76dfd4 --stat -- dashboard/daily-digest-human-approval-state.json` → empty). The state file is **absent** from the C5N4 diff.

## 3. CURRENT_APPROVAL_STATE

Read from `dashboard/daily-digest-human-approval-state.json` (current `master` HEAD = `4f1e81b`):

| Field | Value |
|---|---|
| `approval_state` | `approved_for_future_promote` |
| `real_promote_allowed` | `false` |
| `production_write_allowed` | `false` |
| `telegram_send_allowed` | `false` |
| `collect_allowed` | `false` |
| `generate_allowed` | `false` |
| `timer_allowed` | `false` |
| `model_call_allowed` | `false` |
| `media_generation_allowed` | `false` |
| `git_allowed` | `false` |
| `approval_enabled` | `false` |
| `transition_history` | 2 entries |

**Transition history (chronological):**
| # | From | To | Timestamp UTC | Kind | Real | Confirm phrase |
|---|---|---|---|---|---|---|
| 0 | `approval_pack_ready` | `human_review_pending` | 2026-06-15T03:26:17.355Z | `state_record_only` | `false` | `BEGIN DAILY HUMAN REVIEW` |
| 1 | `human_review_pending` | `approved_for_future_promote` | 2026-06-15T04:26:02.290Z | `approved_for_future_promote_state_record` | `true` (transition), `false` (promote) | `APPROVE DAILY DIGEST FOR FUTURE PROMOTE` |

**Entry [1] belongs to C5N5, not C5N4.** C5N4 (b76dfd4) only produces a dry-run report — its planner never writes to the state file (verified by the validator and confirmed by `git show b76dfd4 -- human-approval-state.json`).

## 4. EXPECTED_C5N4_BEHAVIOR

Per `dashboard/daily-digest-approval-dry-run-policy.json` (C5N4 policy) and the C5N4 task spec:

- `mode`: `approved_for_future_promote_dry_run_only`
- `real_approval_allowed`: **`false`**
- `real_transition_allowed`: **`false`**
- `real_promote_allowed`: **`false`**
- `production_write_allowed`: **`false`**
- `telegram_send_allowed`: **`false`**
- `allowed_dry_run_transition`: `{ from: human_review_pending, to: approved_for_future_promote }` (dry-run, no commit)
- `blocked_transitions`: `approved_for_future_promote -> promote`, `any automatic approval`, `any unattended promote`, `any unattended transition`
- `blocked_actions`: `production_write`, `telegram_send`, `timer`, `collect`, `generate`, `git`, `unattended_promote`, `model_call`, `media_generation`, `real_approval`, `auto_approval`
- `required_confirm_phrase`: `DRY RUN DAILY APPROVAL`
- `required_env_gate`: `CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`
- `env_gate_evaluated`: `false` (planner does not read `process.env`)
- C5N4 task spec: "只做 human_review_pending → approved_for_future_promote 的 dry-run。不要真实 approve，不要 promote，不写 production，不发送 Telegram。"

## 5. ACTUAL_C5N4_BEHAVIOR

From `dashboard/daily-digest-approval-dry-run.json` (C5N4 planner output) and `reports/approved-for-future-promote-dry-run.md`:

| Field | Actual value | Matches expected? |
|---|---|---|
| `mode` | `approved_for_future_promote_dry_run_only` | ✅ |
| `real_approval` | `false` | ✅ |
| `real_promote_allowed` | `false` | ✅ |
| `production_write_allowed` | `false` | ✅ |
| `telegram_send_allowed` | `false` | ✅ |
| `current_state` (at C5N4 run time) | `human_review_pending` | ✅ |
| `proposed_next_state` | `approved_for_future_promote` | ✅ |
| `would_approve` | `true` (11/12 evidence met) | ✅ |
| `human_approval_state_modified` | `false` | ✅ |
| `real_approval_executed` | `false` | ✅ |
| `state_file_write_attempted` | `false` | ✅ |
| Modified `human-approval-state.json` | `false` (verified via `git show b76dfd4 --stat`) | ✅ |

**C5N4 report header:** "PASS — dry-run only. `real_approval_allowed=false`, `real_promote_allowed=false`. 15/15 validations PASS. 29/29 new validator checks PASS. Smoke test PASS. Protected paths md5-verified unchanged."

**C5N4 explicit statement in report:** "C5N1/C5N3 approval state was NOT modified. No rollback triggered (none needed)."

## 6. DRY_RUN_BOUNDARY_BREACH

**`DRY_RUN_BOUNDARY_BREACH=false`**

C5N4 was a true dry-run. The state file was not modified by b76dfd4. The current `approval_state=approved_for_future_promote` was set by **C5N5** (`bb7333d`, "Phase 5C-2C-C5N5: Record approved-for-future-promote state"), which is a **separate, later, explicitly-real-transition phase** with its own policy, history record, and validators. C5N5 changed `dashboard/daily-digest-human-approval-state.json` (+14/-1 lines) and added `reports/human-approval-history/daily-digest-approved-for-future-promote-20260615-042602.json` — this is its intended behavior.

**Why this matters:** the post-C5N4 diagnostic showed `APPROVAL_STATE=approved_for_future_promote`, which raised the question of whether C5N4 had performed a real transition. The audit confirms it did not. The diagnostic was correct in finding the *current* state, but the *cause* of that state is C5N5, not C5N4.

**Audit-trail corroboration:**
- C5N4 commit touches: dry-run policy, dry-run result, planner, validator, control-server endpoints, control.html panel, package.json scripts, docs. **No state file touched.**
- C5N5 commit touches: real-transition policy, state file (the one that actually transitions it), history record (the `approved_for_future-promote-20260615-042602.json` file), control-server endpoints (with confirm-phrase-gated real-transition handler), control.html panel, validators, docs. **State file modified here.**
- Timeline: b76dfd4 (11:44) → bb7333d (12:37) — 53-minute gap, consistent with C5N5 being a separate phase, not a side effect of C5N4.

## 7. PRODUCTION_PATH_CHECK (md5-verified unchanged since C5M1A baseline)

| Path | C5M1A baseline md5 | Current md5 | Status |
|---|---|---|---|
| `reports/daily-digest.md` | `735002a3969746aefabc57c75b5220e8` | `735002a3969746aefabc57c75b5220e8` | ✅ UNCHANGED |
| `reports/telegram-digest.txt` | `53c2a73d440eb32967d1a9185763a6b3` | `53c2a73d440eb32967d1a9185763a6b3` | ✅ UNCHANGED |
| `dashboard/status.json` | `d98c500cb52c78f57edd941cdedc7b49` | `d98c500cb52c78f57edd941cdedc7b49` | ✅ UNCHANGED |
| `reports/daily/` directory | n/a | does not exist | ✅ CORRECT (per "不写 reports/daily/" rule) |

All production paths are unchanged. C5N4 (and C5N4A) wrote only to:
- `dashboard/daily-digest-approval-dry-run-policy.json` (NEW, dry-run policy)
- `dashboard/daily-digest-approval-dry-run.json` (NEW, dry-run result)
- `scripts/daily-digest-approval-dry-run.ts` (NEW, planner)
- `scripts/validate-daily-digest-approval-dry-run.ts` (NEW, validator)
- `reports/approved-for-future-promote-dry-run.md` (NEW, report)
- `reports/telegram-phase-5c2c-c5n4-approval-dry-run.txt` (NEW, telegram report)

None of these are production-protected paths.

## 8. PROMOTE_BLOCK_STATUS

Verified across all relevant configs:

| File / Field | Value | Status |
|---|---|---|
| `dashboard/daily-digest-human-approval-state.json::real_promote_allowed` | `false` | ✅ BLOCKED |
| `dashboard/daily-digest-human-approval-state.json::production_write_allowed` | `false` | ✅ BLOCKED |
| `dashboard/daily-digest-human-approval-state.json::telegram_send_allowed` | `false` | ✅ BLOCKED |
| `dashboard/daily-digest-promote-execution-disabled.json::real_promote_allowed` | `false` | ✅ BLOCKED |
| `dashboard/daily-digest-promote-execution-disabled.json::production_write_allowed` | `false` | ✅ BLOCKED |
| `dashboard/daily-digest-promote-execution-disabled.json::telegram_send_allowed` | `false` | ✅ BLOCKED |
| `dashboard/daily-digest-promote-execution-disabled.json::mode` | `execution_scaffold_disabled` | ✅ DISABLED |
| `dashboard/daily-digest-continuous-promote-workflow.json::continuous_promote_enabled` | `false` | ✅ DISABLED |
| `dashboard/daily-digest-continuous-promote-workflow.json::production_write_allowed` | `false` | ✅ BLOCKED |
| `dashboard/daily-digest-continuous-promote-workflow.json::telegram_send_allowed` | `false` | ✅ BLOCKED |
| `dashboard/daily-digest-continuous-promote-workflow.json::mode` | `continuous_promote_plan_only` | ✅ PLAN ONLY |

**No unattended promote is possible.** All production writes, Telegram sends, timers, and auto-promote are blocked at the policy level. The `approved_for_future_promote` state itself is non-executing: it records a *future* human-initiated promote, but the actual promotion requires the `future_promote_confirm_phrase` (`PROMOTE DAILY DIGEST FROM SANDBOX`) and is reserved for a future C5N-6-B phase (not yet implemented).

## 9. RISK_ASSESSMENT

| Risk | Severity | Mitigation | Status |
|---|---|---|---|
| C5N4 dry-run boundary breach | None | C5N4 commit does not touch state file; verified by `git show` | ✅ MITIGATED |
| Unattended real promote | None | All `real_promote_allowed` flags are `false` across 3+ config files | ✅ MITIGATED |
| Production path corruption | None | Production paths md5-verified unchanged; C5N4 wrote only to dry-run artifacts | ✅ MITIGATED |
| Token leak | None | `.control.local` is gitignored; audit log writes no token; sanitizer validated | ✅ MITIGATED |
| Telegram send | None | `telegram_send_allowed=false` everywhere; C5N4 did not call `digest:send:*` | ✅ MITIGATED |
| Stale state confusion | Low | The C5N1 status file shows `approval_state=approved_for_future_promote` but the C5N1 policy says `approval_enabled=false` and `current_transition_allowed_targets=["approval_pack_ready"]` — the status is informational; the policy is the gate | ⚠️ DOCUMENTED |
| Misreading C5N4 as real transition | Medium | Resolved by this audit: C5N4 was a true dry-run; C5N5 did the real transition | ✅ RESOLVED |
| Auto-rollback by C5N4A | None | C5N4A is read-only + report-write; does not modify state, does not rollback, does not call approve | ✅ MITIGATED |

**Overall risk:** LOW. The `approved_for_future_promote` state is a **flag for human attention** — it does not enable promote, does not trigger promote, and does not call Telegram. The actual `human_review_pending → approved_for_future_promote` transition is a metadata record; the real promote still requires explicit human-initiated action in a future phase (C5N-6-B), gated by a separate confirm phrase and an env-var gate.

## 10. RECOMMENDED_NEXT_ACTION

**`freeze_and_decide`**

Reasoning:
- The audit shows C5N4 held its dry-run boundary. ✅
- The state transition was correctly attributed to C5N5, which was a designed real-transition phase. ✅
- Production paths are unchanged. ✅
- Promote is still blocked everywhere. ✅
- However, the "Exec failed" surface after C5N4 indicates a workflow-confusion risk: the user/dashboard may have interpreted C5N4 as the real-transition phase, when in fact C5N5 was.

**Recommended freeze-and-decide actions (for human review, not executed by C5N4A):**

1. **Freeze further C5N phases** (C5N-6-B and beyond) until a decision is made about:
   - Whether the `approved_for_future_promote` state is **acceptable as-is** (current state), OR
   - Whether to **rollback to `human_review_pending`** (which would require a new "rollback" phase; C5N4A does not perform this), OR
   - Whether to **proceed to C5N-6-B** (real promote, with `future_promote_confirm_phrase`).

2. **Document the C5N4/C5N5 boundary** in the runbook to make it explicit that:
   - C5N4 = dry-run (no real transition)
   - C5N5 = real state transition (records approval; does not promote)

3. **No automatic rollback**: C5N4A does **not** modify the state file. The decision to rollback (or not) is left to the human.

4. **No C5N-6-B trigger**: C5N4A does **not** invoke any promote runner. The actual `approved_for_future_promote → production_write + telegram_send` transition is reserved for C5N-6-B (a future, not-yet-implemented phase).

5. **Audit log integrity verified**: `reports/control-action-audit.jsonl` is gitignored and present locally; C5N4 audit entries do not contain token values (verified by token-pattern check).

## 11. FILES_GENERATED_BY_C5N4A

- `reports/c5n4-approval-state-integrity-audit.md` (this file)
- `reports/telegram-phase-5c2c-c5n4a-approval-state-integrity-audit.txt` (Telegram report, ≤3500 chars)

## 12. NEXT_PHASE_PROPOSAL

**C5N-6-B (proposed, not implemented)**: `approved_for_future_promote → promote` (real production write + Telegram send). Would require:
- A real promote runner that re-verifies `required_env_gate=CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1` AND uses `future_promote_confirm_phrase="PROMOTE DAILY DIGEST FROM SANDBOX"` BEFORE any production write or Telegram send.
- Manual-initiation gated; no timer / cron / auto-trigger.
- The runner would be invoked ONLY by explicit human action in a future phase, never by a scheduled job.

**Or, alternative phase (proposed, not implemented)**: `rollback_approval_state` — transition `approved_for_future_promote → human_review_pending`. This would require its own confirm phrase and a new history record. C5N4A does not perform this.

## 13. LIMITATIONS

1. C5N4A is a **read-only audit** plus two report writes (`c5n4-approval-state-integrity-audit.md` and the telegram .txt). It does **not** modify `dashboard/daily-digest-human-approval-state.json`, does **not** rollback, does **not** call any approve endpoint, does **not** call any promote endpoint, does **not** call any Telegram send.
2. The `env_gate_evaluated` field is `false` in the approval state; C5N4A does not read `process.env` to verify it. This is consistent with the planner-safety contract; verification is left to a future orchestrator.
3. The C5N4 audit log entries (from when C5N4 ran) are stored in the gitignored `reports/control-action-audit.jsonl` and were not modified by C5N4A.
4. C5N4A does **not** re-validate C5N4 (per the "do not rerun full validation" rule). C5N4's 15/15 validations PASS and 29/29 new validator checks PASS are taken as given from C5N4's run.
5. The decision to rollback or not is left to the human, not made automatically by C5N4A.

---

*辛 🔮 — 实操优先，落地为王。C5N4A 完整性审计完成；C5N4 边界未越，状态变化由 C5N5 正确执行。*