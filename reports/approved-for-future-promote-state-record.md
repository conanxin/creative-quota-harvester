# Phase 5C-2C-C5N5 — Approved-for-future-promote State Record Report

**Phase:** 5C-2C-C5N5
**Mode:** approved_for_future_promote_state_record
**Generated at:** 2026-06-15T12:26:00+08:00
**Base commit:** b76dfd4 (C5N4)
**Status:** PASS — REAL state transition executed (NOT enabled for production write or Telegram)

---

## 1. STATUS

PASS — state ACTUALLY transitioned from `human_review_pending` → `approved_for_future_promote`. 16/16 validations PASS. 32/32 new validator checks PASS. Smoke test PASS (GET + POST). Protected paths md5-verified unchanged.

## 2. WHAT_CHANGED

**Added:**
- `dashboard/daily-digest-approved-for-future-promote-policy.json` — policy (allowed_transition={from: human_review_pending, to: approved_for_future_promote}; real_approval_allowed=true; real_promote_allowed=false; blocked_transitions; confirm_phrase, env_gate, etc.)
- `scripts/daily-digest-approved-for-future-promote.ts` — real state recorder (no env reads, no network, no production writes, no Telegram send).
- `scripts/validate-daily-digest-approved-for-future-promote.ts` — 32-check validator.
- `reports/human-approval-history/daily-digest-approved-for-future-promote-20260615-042602.json` — history record.
- `reports/human-approval-history/daily-digest-approved-for-future-promote-20260615-042602.md` — history record (markdown).
- `reports/approved-for-future-promote-state-record.md` — this report.

**Modified:**
- `dashboard/daily-digest-human-approval-state.json` — `approval_state` flipped to `approved_for_future_promote`; `transition_history` appended.
- `scripts/control-server.ts` — added `GET /api/daily-digest/approved-for-future-promote-status` (read-only) and `POST /api/daily-digest/human-approval/approve-for-future-promote` (token + phrase gated, real state transition).
- `dashboard/control.html` — added Approved-for-future-promote panel + JS loader.
- `package.json` — added 2 scripts (`check:`, `validate:`).
- `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` — added C5N5 section.
- `README.md` — added C5N5 row.
- `ROADMAP.md` — added C5N5 row.

## 3. PREVIOUS_STATE

`human_review_pending` (set by C5N3, recorded as `transition_history[0]`)

## 4. NEW_STATE

`approved_for_future_promote` (set by C5N5 recorder; written to `dashboard/daily-digest-human-approval-state.json` and appended to its `transition_history[]`)

## 5. TRANSITION_RESULT

- `transition_executed`: `true`
- `previous_state`: `human_review_pending`
- `new_state`: `approved_for_future_promote`
- `transition_kind`: `approved_for_future_promote_state_record` (NOT approval-by-policy, NOT promote — state machine advance only)
- `confirm_phrase_matched`: `true` ("APPROVE DAILY DIGEST FOR FUTURE PROMOTE")
- `confirmed_by_phrase`: `true`
- `approved_for_future_promote`: `true`
- History JSON: `reports/human-approval-history/daily-digest-approved-for-future-promote-20260615-042602.json`
- History MD: `reports/human-approval-history/daily-digest-approved-for-future-promote-20260615-042602.md`

## 6. REAL_APPROVAL_STATUS

- `real_approval`: `true` (this phase IS a real state machine advance; the `approval_state` IS changed)
- `real_approval_allowed`: `true` (policy)
- The state machine advanced from `human_review_pending` to `approved_for_future_promote`. This is recorded in `transition_history` with `real_approval=true`, `confirmed_by_phrase=true`, `approved_for_future_promote=true`. The advance is a state record ONLY — it does NOT promote, does NOT write production, does NOT send Telegram.

## 7. REAL_PROMOTE_STATUS

- `real_promote_allowed`: `false` (always; enforced in policy and executor)
- `production_write_allowed`: `false` (always)
- `telegram_send_allowed`: `false` (always)
- No promote was triggered. No production paths were written.

## 8. PROTECTED_PATH_CHECK (md5-verified unchanged)

| Path | Hash (C5M1A baseline) | Current | Status |
|---|---|---|---|
| `reports/daily-digest.md` | `735002a3969746aefabc57c75b5220e8` | `735002a3969746aefabc57c75b5220e8` | ✅ UNCHANGED |
| `reports/telegram-digest.txt` | `53c2a73d440eb32967d1a9185763a6b3` | `53c2a73d440eb32967d1a9185763a6b3` | ✅ UNCHANGED |
| `dashboard/status.json` | `d98c500cb52c78f57edd941cdedc7b49` | `d98c500cb52c78f57edd941cdedc7b49` | ✅ UNCHANGED |

## 9. API_ENDPOINTS

### `GET /api/daily-digest/approved-for-future-promote-status`

Read-only. Returns the current approval state + recent approved_for_future_promote history (secrets stripped).
- Tested during smoke test (port 8795): returned `current_state=approved_for_future_promote`, `approved_for_future_promote=true`, `real_approval=true`, `real_promote_allowed=false`, `production_write_allowed=false`, `telegram_send_allowed=false`, `latest_history_timestamp_utc=2026-06-15T04:26:02.290Z`, `latest_history_previous_state=human_review_pending`, `latest_history_new_state=approved_for_future_promote`.

### `POST /api/daily-digest/human-approval/approve-for-future-promote`

Token-gated + confirm-phrase-gated. **Performs the real state transition** (`approved_for_future_promote_state_record`).
- Token check came first in the smoke test; placeholder `wrong-token` was rejected with `Forbidden: Invalid or missing control token` (expected behavior).
- Wrong phrase `WRONG PHRASE` was rejected with `blocked_reason=confirm_phrase_mismatch` (expected behavior).
- Correct token + correct phrase was tested via CLI (not via HTTP) to record the actual transition; subsequent HTTP POST returned `blocked_reason=previous_state_mismatch` because the state had already advanced.
- Audit log: `action_id=daily_digest_approved_for_future_promote`, `risk_level=low`. No token recorded. ✅

## 10. VALIDATION_RESULTS (16/16 PASS)

| # | Suite | Status |
|---|---|---|
| 1 | `validate:daily-digest-approved-for-future-promote` | ✅ PASS (32/32) |
| 2 | `validate:daily-digest-approval-dry-run` | ✅ PASS (29/29) |
| 3 | `validate:daily-digest-human-review-pending` | ✅ PASS (26/26) |
| 4 | `validate:daily-digest-human-approval-transition-dry-run` | ✅ PASS (28/28) |
| 5 | `validate:daily-digest-human-approval-scaffold` | ✅ PASS (26/26) |
| 6 | `validate:daily-digest-continuous-promote-workflow` | ✅ PASS (27/27) |
| 7 | `validate:dashboard-control-safety` | ✅ PASS (12/12) |
| 8 | `dashboard:control:validate` | ✅ PASS |
| 9 | `validate:daily-digest-promote-approval-pack` | ✅ PASS |
| 10 | `validate:daily-digest-promote-executor-disabled` | ✅ PASS |
| 11 | `validate:daily-digest-promote-execution-review` | ✅ PASS |
| 12 | `validate:daily-digest-promote-gate` | ✅ PASS |
| 13 | `validate:sanitizer-secret-completeness` | ✅ PASS |
| 14 | `validate:sanitizer-false-positives` | ✅ PASS |
| 15 | `validate:telegram-sanitizer` | ✅ PASS |
| 16 | `validate:project-report-send` | ✅ PASS |

## 11. MODEL_CALL_STATUS

NONE — pure JSON + TS source edits. Executor uses `fs` + `path` only.

## 12. GENERATED_MEDIA_STATUS

NONE — no images / videos / music generated.

## 13. SMOKE_TEST_RESULT

| Step | Action | Expected | Actual | Status |
|---|---|---|---|---|
| 1 | Start control server on port 8795 | bind 127.0.0.1:8795, routes printed | routes printed, /health → 200 | ✅ PASS |
| 2 | GET /api/daily-digest/approved-for-future-promote-status | current_state=approved_for_future_promote | current_state=approved_for_future_promote, approved_for_future_promote=true, real_approval=true, real_promote_allowed=false | ✅ PASS |
| 3 | POST approve-for-future-promote with wrong phrase | blocked, confirm_phrase_mismatch | blocked, confirm_phrase_mismatch | ✅ PASS |
| 4 | POST approve-for-future-promote with wrong token | 403 forbidden | "Forbidden: Invalid or missing control token" | ✅ PASS |
| 5 | POST approve-for-future-promote with correct token+phrase (after state already advanced) | blocked, previous_state_mismatch | blocked, previous_state_mismatch (expected human_review_pending, got approved_for_future_promote) | ✅ PASS |
| 6 | Verify audit log has no token | no token patterns | confirmed (no `sk-cp`, no TELEGRAM_BOT_TOKEN, no MINIMAX_API_KEY, no CQA_CONTROL_TOKEN values) | ✅ PASS |
| 7 | Verify protected paths unchanged | md5 same as baseline | all 3 paths UNCHANGED | ✅ PASS |
| 8 | Shutdown server | port 8795 free, no process | port 8795 free, no tsx process | ✅ PASS |

## 14. LIMITATIONS

1. The state transition is a real state machine advance (NOT a dry-run, NOT a promotion). The `approval_state` field in the config IS changed to `approved_for_future_promote`; `transition_history[]` IS appended.
2. The recorder does **not** read `process.env`, so `env_gate_evaluated` is conservatively reported as `false`. A future orchestrator (C5N-6) would verify the env var externally before any actual promote.
3. Even after C5N5, the next transition (`approved_for_future_promote → promote`) is in `blocked_transitions`. A future orchestrator (C5N-6, not yet implemented) would be required to actually promote.
4. The 32-check validator uses precise regex patterns to avoid false positives from property names like `no_child_process: true` (a property flag) vs actual `child_process` module usage.
5. The smoke test ran on port 8795 (not the default 8788) to avoid conflicts. The server was cleanly shut down.
6. `.control.local` already contained `CQA_CONTROL_TOKEN=test-local-control-token` from a previous phase; it was not created or deleted by C5N5 (it's already in `.gitignore`). The test succeeded against the existing token.

## 15. NEXT_PHASE_PROPOSAL

- **C5N-6 (proposed only, not implemented)**: `approved_for_future_promote → promote` (real production write + Telegram send). Would require:
  - A real promote runner (CLI or web UI) that re-verifies the env gate (`CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`) AND an explicit per-promote confirm phrase BEFORE any production write or Telegram send.
  - The runner would write `reports/daily-digest.md` and `reports/telegram-digest.txt` from the sandbox output, with backup+rollback.
  - The runner would call `digest:send:confirmed` to send the Telegram digest.
  - All transitions remain manual-initiation gated; no timer / cron / auto-trigger.
  - The runner would be invoked ONLY by explicit human action — never by a scheduled job.

## 16. Files Added / Modified

**Added:**
- `dashboard/daily-digest-approved-for-future-promote-policy.json`
- `scripts/daily-digest-approved-for-future-promote.ts`
- `scripts/validate-daily-digest-approved-for-future-promote.ts`
- `reports/human-approval-history/daily-digest-approved-for-future-promote-20260615-042602.json`
- `reports/human-approval-history/daily-digest-approved-for-future-promote-20260615-042602.md`
- `reports/approved-for-future-promote-state-record.md`

**Modified:**
- `dashboard/daily-digest-human-approval-state.json` (state flipped to `approved_for_future_promote`, `transition_history` appended)
- `scripts/control-server.ts` (+2 endpoints)
- `dashboard/control.html` (+1 panel + JS loader)
- `package.json` (+2 scripts)
- `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` (+1 phase section)
- `README.md` (+1 row)
- `ROADMAP.md` (+1 row)

## 17. Commit

- Branch: `master`
- Base commit: `b76dfd4` (C5N4)
- New commit (this phase): `git commit -m "Phase 5C-2C-C5N5: Record approved-for-future-promote state"`
- Push: `origin/master`

---

*辛 🔮 — 实操优先，落地为王。Phase 5C-2C-C5N5 完成。*