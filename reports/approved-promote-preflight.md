# Phase 5C-2C-C5N6-A — Approved Promote Execution Preflight Report

**Phase:** 5C-2C-C5N6-A
**Mode:** approved_promote_preflight_only
**Generated at:** 2026-06-15T13:12:00+08:00
**Base commit:** bb7333d (C5N5)
**Status:** PASS — preflight plan generated (would_promote=true, but real_promote=false, no side effects)

---

## 1. STATUS

PASS — preflight plan generated with all 15 evidence items met. 17/17 validations PASS. 30/30 new validator checks PASS. Smoke test PASS (GET + POST). Protected paths md5-verified unchanged.

## 2. WHAT_CHANGED

**Added:**
- `dashboard/daily-digest-approved-promote-preflight-policy.json` — policy (required_current_state=approved_for_future_promote; required_confirm_phrase=PREFLIGHT DAILY PROMOTE; future_promote_confirm_phrase=PROMOTE DAILY DIGEST FROM SANDBOX; real_promote_allowed=false; blocked_actions; etc.)
- `scripts/daily-digest-approved-promote-preflight.ts` — preflight planner (read-only: reads approval state, sandbox candidates, production targets, backup manifests, promote history; computes SHA-256 hash diffs; writes only preflight JSON + MD report; no env reads, no network, no production writes, no Telegram send).
- `scripts/validate-daily-digest-approved-promote-preflight.ts` — 30-check validator.
- `dashboard/daily-digest-approved-promote-preflight.json` — preflight result (would_promote=true, hash_comparison_summary=2 identical, 0 different, backup/rollback verified).
- `reports/approved-promote-preflight.md` — this report.

**Modified:**
- `scripts/control-server.ts` — added `GET /api/daily-digest/approved-promote-preflight` (read-only) and `POST /api/daily-digest/promote/preflight` (token + phrase gated, preflight-only).
- `dashboard/control.html` — added "Approved Promote Preflight / 已批准推送预检" panel + JS loader.
- `package.json` — added 2 scripts (`check:`, `validate:`).
- `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` — added C5N6-A section.
- `README.md` — added C5N6-A row.
- `ROADMAP.md` — added C5N6-A row.

## 3. CURRENT_STATE

`approved_for_future_promote` (set by C5N5, recorded in `transition_history[1]`)

## 4. WOULD_PROMOTE

`true` — all 15 evidence items met:
- current_state_eq_approved_for_future_promote ✅
- c5n5_approved_history_record_present ✅
- promote_gate_pass ✅ (gate_status=pass)
- approval_pack_present ✅
- rollback_manifest_present ✅ (rollback_supported=true)
- promote_history_present ✅ (total=1, latest_run_id=sandbox-2026-06-14-06-50-12)
- sandbox_latest_run_present ✅ (run_id=sandbox-2026-06-14-06-50-12)
- sandbox_candidates_exist ✅ (all 2 candidates readable)
- production_targets_exist ✅ (all 2 targets readable)
- backup_manifest_present ✅ (2/2 backup files)
- sandbox_production_hash_diff_computed ✅ (2 identical, 0 different)
- real_promote_disabled ✅ (real_promote_allowed=false)
- production_write_disabled ✅ (production_write_allowed=false)
- telegram_send_disabled ✅ (telegram_send_allowed=false)
- timer_disabled ✅ (timer_allowed=false)

However, **hash comparison shows 2 identical, 0 different** — the sandbox candidates have the same SHA-256 hashes as the production targets (because the one-shot controlled promote C5M-1 already promoted them). A future promote would be a no-op.

## 5. REAL_PROMOTE_STATUS

- `real_promote`: `false` (always; this is a preflight/dry-run)
- `real_promote_allowed`: `false` (always; enforced in policy and planner)
- `production_write_allowed`: `false` (always)
- `telegram_send_allowed`: `false` (always)
- No promote was triggered. No production paths were written. No Telegram was sent. No timer was added.

## 6. HASH_COMPARISON

| File | Sandbox Hash | Production Hash | Backup Hash | Match | Diff | Would Overwrite |
|---|---|---|---|---|---|---|
| daily-digest.md | c43bc22fe5e75e26 | c43bc22fe5e75e26 | 40aeed2d1905e6cf | ✅ | ❌ | ❌ |
| telegram-digest.txt | de89425d568ecb8d | de89425d568ecb8d | cd5e5d3d1005ac36 | ✅ | ❌ | ❌ |

- Total: 2 files
- Identical: 2
- Different: 0
- Would promote anything: **false**

## 7. BACKUP_STATUS

- Backup manifest: `reports/promote-backups/daily-digest/sandbox-2026-06-14-06-50-12-20260614-223423/backup-manifest.json`
- Backup manifest present: **true**
- Backup files: 2/2
- Rollback supported: **true**
- Rollback command preview: `cp "/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester/reports/promote-backups/daily-digest/sandbox-2026-06-14-06-50-12-20260614-223423/daily-digest.md" "/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester/reports/daily-digest.md" && cp "...`

## 8. ROLLBACK_STATUS

- Rollback manifest present: **true**
- Restore command available: **true**
- Manual rollback supported: **true**

## 9. PROMOTE_HISTORY_STATUS

- History present: **true**
- History total: 1
- History latest path: `reports/promote-history/daily-digest-promote-sandbox-2026-06-14-06-50-12-20260614-223423.json`
- Latest promote run_id: `sandbox-2026-06-14-06-50-12`

## 10. BLOCKED_ACTIONS

- production_write
- telegram_send
- timer
- collect
- generate
- git
- unattended_promote
- model_call
- media_generation

## 11. API_ENDPOINTS

### `GET /api/daily-digest/approved-promote-preflight`

Read-only. Returns preflight result (would_promote, hash comparison, backup/rollback status, recommendation).
- Tested during smoke test (port 8795): returned `would_promote=true`, `current_state=approved_for_future_promote`, `real_promote=false`, `real_promote_allowed=false`, `production_write_allowed=false`, `telegram_send_allowed=false`, `hash_diffs=0`, `recommendation=Preflight PASS...`.

### `POST /api/daily-digest/promote/preflight`

Token-gated + confirm-phrase-gated. Runs the preflight planner and regenerates the preflight JSON.
- Token check: wrong token → `Forbidden: Invalid or missing control token` (expected behavior).
- Wrong phrase: `WRONG PHRASE` → `blocked_reason=confirm_phrase_mismatch` (expected behavior).
- Correct token + correct phrase: `PREFLIGHT DAILY PROMOTE` → `result=success`, `would_promote=true`, `real_promote=false` (expected behavior).
- Audit log: `action_id=daily_digest_approved_promote_preflight`, `risk_level=low`, `real_execution=false`. No token recorded. ✅

## 12. VALIDATION_RESULTS (17/17 PASS)

| # | Suite | Status |
|---|---|---|
| 1 | `validate:daily-digest-approved-promote-preflight` | ✅ PASS (30/30) |
| 2 | `validate:daily-digest-approved-for-future-promote` | ✅ PASS (32/32) |
| 3 | `validate:daily-digest-approval-dry-run` | ✅ PASS (29/29) |
| 4 | `validate:daily-digest-human-review-pending` | ✅ PASS (26/26) |
| 5 | `validate:daily-digest-human-approval-transition-dry-run` | ✅ PASS (28/28) |
| 6 | `validate:daily-digest-human-approval-scaffold` | ✅ PASS (26/26) |
| 7 | `validate:daily-digest-continuous-promote-workflow` | ✅ PASS (27/27) |
| 8 | `validate:dashboard-control-safety` | ✅ PASS (12/12) |
| 9 | `dashboard:control:validate` | ✅ PASS |
| 10 | `validate:daily-digest-promote-approval-pack` | ✅ PASS |
| 11 | `validate:daily-digest-promote-executor-disabled` | ✅ PASS |
| 12 | `validate:daily-digest-promote-execution-review` | ✅ PASS |
| 13 | `validate:daily-digest-promote-gate` | ✅ PASS |
| 14 | `validate:sanitizer-secret-completeness` | ✅ PASS |
| 15 | `validate:sanitizer-false-positives` | ✅ PASS |
| 16 | `validate:telegram-sanitizer` | ✅ PASS |
| 17 | `validate:project-report-send` | ✅ PASS |

## 13. SMOKE_TEST_RESULT

| Step | Action | Expected | Actual | Status |
|---|---|---|---|---|
| 1 | Start control server on port 8795 | bind 127.0.0.1:8795, routes printed | routes printed, /health → 200 | ✅ PASS |
| 2 | GET /api/daily-digest/approved-promote-preflight | would_promote=true, current_state=approved_for_future_promote | would_promote=true, current_state=approved_for_future_promote, real_promote=false, hash_diffs=0 | ✅ PASS |
| 3 | POST /api/daily-digest/promote/preflight with wrong phrase | blocked, confirm_phrase_mismatch | blocked, confirm_phrase_mismatch | ✅ PASS |
| 4 | POST /api/daily-digest/promote/preflight with wrong token | 403 forbidden | "Forbidden: Invalid or missing control token" | ✅ PASS |
| 5 | POST /api/daily-digest/promote/preflight with correct token+phrase | result=success, real_promote=false | result=success, would_promote=true, real_promote=false | ✅ PASS |
| 6 | Verify audit log has no token | no token patterns | confirmed (no sk-cp, no TELEGRAM_BOT_TOKEN, no MINIMAX_API_KEY, no CQA_CONTROL_TOKEN values) | ✅ PASS |
| 7 | Verify protected paths unchanged | md5 same as baseline | all 3 paths UNCHANGED | ✅ PASS |
| 8 | Shutdown server | port 8795 free, no process | port 8795 free, no tsx process | ✅ PASS |

## 14. PROTECTED_PATH_CHECK (md5-verified unchanged)

| Path | Hash (C5M1A baseline) | Current | Status |
|---|---|---|---|
| `reports/daily-digest.md` | `735002a3969746aefabc57c75b5220e8` | `735002a3969746aefabc57c75b5220e8` | ✅ UNCHANGED |
| `reports/telegram-digest.txt` | `53c2a73d440eb32967d1a9185763a6b3` | `53c2a73d440eb32967d1a9185763a6b3` | ✅ UNCHANGED |
| `dashboard/status.json` | `d98c500cb52c78f57edd941cdedc7b49` | `d98c500cb52c78f57edd941cdedc7b49` | ✅ UNCHANGED |

## 15. MODEL_CALL_STATUS

NONE — pure JSON + TS source edits. Planner uses `fs` + `path` + `crypto` only.

## 16. GENERATED_MEDIA_STATUS

NONE — no images / videos / music generated.

## 17. LIMITATIONS

1. The preflight is a **dry-run only** — it does NOT promote, does NOT write production, does NOT send Telegram. It only reads upstream data and writes a preflight report.
2. The planner does **not** read `process.env`, so `env_gate_evaluated` is conservatively reported as `false`. A future orchestrator (C5N-6-B) would verify the env var externally before any actual promote.
3. Even though `would_promote=true`, the hash comparison shows **2 identical, 0 different** — the sandbox candidates match the production targets exactly (because the one-shot controlled promote C5M-1 already promoted them). A future promote would be a no-op.
4. The 30-check validator uses precise regex patterns to avoid false positives from property names like `no_child_process: true` (a property flag) vs actual `child_process` module usage.
5. The smoke test ran on port 8795 (not the default 8788) to avoid conflicts. The server was cleanly shut down.
6. `.control.local` already contained `CQA_CONTROL_TOKEN=test-local-control-token` from a previous phase; it was not created or deleted by C5N6-A (it's already in `.gitignore`).

## 18. NEXT_PHASE_PROPOSAL

- **C5N-6-B (proposed only, not implemented)**: `approved_for_future_promote → promote` (real production write + Telegram send). Would require:
  - A real promote runner (CLI or web UI) that re-verifies the env gate (`CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`) AND requires the `future_promote_confirm_phrase` (`PROMOTE DAILY DIGEST FROM SANDBOX`) BEFORE any production write or Telegram send.
  - The runner would read the preflight result (from C5N6-A), verify `would_promote=true`, and then execute the actual promote (copy sandbox outputs to production targets, with backup+rollback).
  - The runner would call `digest:send:confirmed` to send the Telegram digest.
  - All transitions remain manual-initiation gated; no timer / cron / auto-trigger.
  - The runner would be invoked ONLY by explicit human action — never by a scheduled job.

## 19. Files Added / Modified

**Added:**
- `dashboard/daily-digest-approved-promote-preflight-policy.json`
- `scripts/daily-digest-approved-promote-preflight.ts`
- `scripts/validate-daily-digest-approved-promote-preflight.ts`
- `dashboard/daily-digest-approved-promote-preflight.json`
- `reports/approved-promote-preflight.md`

**Modified:**
- `scripts/control-server.ts` (+2 endpoints: GET preflight + POST preflight)
- `dashboard/control.html` (+1 panel + JS loader)
- `package.json` (+2 scripts)
- `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` (+1 phase section)
- `README.md` (+1 row)
- `ROADMAP.md` (+1 row)

## 20. Commit

- Branch: `master`
- Base commit: `bb7333d` (C5N5)
- New commit (this phase): `git commit -m "Phase 5C-2C-C5N6A: Add approved promote preflight"`
- Push: `origin/master`

---

*辛 🔮 — 实操优先，落地为王。Phase 5C-2C-C5N6-A 完成。*