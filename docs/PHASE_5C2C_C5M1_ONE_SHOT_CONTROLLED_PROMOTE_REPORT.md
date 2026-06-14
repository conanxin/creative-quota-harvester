# Phase 5C-2C-C5M-1 One-shot Controlled Promote Report

**Phase:** 5C-2C-C5M-1
**Mode:** one_shot_controlled_promote
**Generated at:** 2026-06-15T06:34:23+08:00
**Promoted at:** 2026-06-14T22:34:23.809Z
**Run ID:** sandbox-2026-06-14-06-50-12
**Status:** SUCCESS

---

## 1. Executive Summary

Phase 5C-2C-C5M-1 executes a **one-shot controlled promote** of the latest
sandbox daily-digest outputs to two specific production targets, under strict
human-phrase authorization. All pre-promote gates passed, the executor created
a backup, copied the two files, and verified SHA-256 hashes match between
sandbox and production. No Telegram was sent, no timer was triggered, no
model was called, and no media was generated. A rollback plan is recorded
in the backup manifest.

## 2. Promoted Files

| File | Source (sandbox) | Destination (production) | Size | SHA-256 (prefix 16) | Verified |
|---|---|---|---|---|---|
| `daily-digest.md` | `reports/sandbox/daily-digest/sandbox-2026-06-14-06-50-12/outputs/daily-digest.md` | `reports/daily-digest.md` | 2970 | `c43bc22fe5e75e26` | ✅ |
| `telegram-digest.txt` | `reports/sandbox/daily-digest/sandbox-2026-06-14-06-50-12/outputs/telegram-digest.txt` | `reports/telegram-digest.txt` | 1763 | `de89425d568ecb8d` | ✅ |

## 3. Backup

- **Backup path:** `reports/promote-backups/daily-digest/sandbox-2026-06-14-06-50-12-20260614-223423/`
- **Manifest:** `backup-manifest.json`
- **Files:** `daily-digest.md` (2970 B, hash `40aeed2d1905e6cf…`), `telegram-digest.txt` (1763 B, hash `cd5e5d3d1005ac36…`)
- **Rollback supported:** ✅ (verified by `validate-daily-digest-controlled-rollback` dry-run)

## 4. Pre-promote Gates (all PASS)

| Gate | Status | Evidence |
|---|---|---|
| `latest_sandbox_run` | ✅ | run_id=sandbox-2026-06-14-06-50-12 |
| `sandbox_output_exists:daily-digest.md` | ✅ | path verified |
| `sandbox_output_exists:telegram-digest.txt` | ✅ | path verified |
| `promote_gate_pass` | ✅ | `gate_status=pass` |
| `shadow_copy_exists` | ✅ | path verified |
| `rollback_manifest_exists` | ✅ | path verified |
| `approval_pack_decision` | ✅ | approval pack present, decision=not_requested (human-phrase-gated execution accepted) |
| `backup_created` | ✅ | backup path written |
| `confirm_phrase` | ✅ | `PROMOTE DAILY DIGEST FROM SANDBOX` matched |

## 5. Pre-promote Validation Suite (15/15 PASS)

- `validate:daily-digest-controlled-promote` ✅
- `validate:daily-digest-promote-approval-pack` ✅
- `validate:daily-digest-promote-executor-disabled` ✅
- `validate:daily-digest-promote-execution-review` ✅
- `validate:daily-digest-promote-gate` ✅
- `validate:daily-digest-promote-shadow-copy` ✅
- `validate:daily-digest-promote-dry-run` ✅
- `validate:daily-digest-promote-readiness` ✅
- `validate:daily-digest-sandbox-output-tools` ✅
- `validate:daily-digest-sandbox-build-pilot` ✅
- `validate:daily-digest-sandbox-manager` ✅
- `validate:sanitizer-secret-completeness` ✅
- `validate:sanitizer-false-positives` ✅
- `validate:telegram-sanitizer` ✅
- `validate:project-report-send` ✅

## 6. Post-promote Validation Suite (5/6 PASS, 1 pre-existing FAIL)

- `validate:daily-digest-controlled-promote` ✅
- `validate:daily-archive` ✅
- `dashboard:validate` ✅
- `dashboard:control:validate` ❌ (pre-existing — `<button>` tag pattern in control.html, NOT introduced by this phase; verified by `git stash` baseline test)
- `validate:telegram-sanitizer` ✅
- `validate:project-report-send` ✅

## 7. Forbidden Path Check

| Forbidden target | Status | Evidence |
|---|---|---|
| `dashboard/status.json` | ✅ UNCHANGED | mtime pre-existed (2026-06-13); not touched by executor |
| `reports/daily/` | ✅ UNCHANGED | directory not present; not created by executor |
| `systemd timer` | ✅ UNCHANGED | not modified (executor has no timer path) |
| `Telegram send` | ✅ DISABLED | `telegram_send_allowed=false` in config; executor has no network/telegram code |

## 8. Telegram Send Status

- Telegram was NOT sent. `telegram_send_allowed=false` enforced in config and validator.
- The phase-13 `report:send` step (next) is for **the stage report only** (`reports/telegram-phase-5c2c-c5m1-controlled-promote.txt`), NOT the daily digest.

## 9. Timer Status

- `timer_allowed=false`. No timer was triggered. `systemd` / `cron` / Gateway timers were not modified.

## 10. Model Call Status

- `model_call_allowed=false`. No model API was called. The executor uses pure `fs` + `crypto`.

## 11. Generated Media Status

- `media_generation_allowed=false`. No images, videos, or music were generated.

## 12. Audit Log

- Endpoint: `POST /api/daily-digest/promote/controlled` (or direct executor call)
- Audit log file: `reports/control-action-audit.jsonl`
- Audit fields: `mode=daily_digest_controlled_promote`, `real_execution=true`, `production_write_allowed=true`, `targets=[reports/daily-digest.md, reports/telegram-digest.txt]`, `telegram_send_allowed=false`, `result=success`. **Token NOT recorded.**

## 13. Rollback Status

- **Supported:** ✅
- **Manifest verified:** ✅ (2/2 files match hashes)
- **Restore command (not auto-executed):**
  ```bash
  cp "/…/reports/promote-backups/daily-digest/sandbox-2026-06-14-06-50-12-20260614-223423/daily-digest.md" \
     "/…/reports/daily-digest.md" && \
  cp "/…/reports/promote-backups/daily-digest/sandbox-2026-06-14-06-50-12-20260614-223423/telegram-digest.txt" \
     "/…/reports/telegram-digest.txt"
  ```
- **Auto-rollback:** ❌ (Phase 5C-2C-C5M-1 explicitly does NOT auto-rollback; a future phase would need explicit human authorization to add that step.)

## 14. History Records

- `reports/promote-history/daily-digest-promote-sandbox-2026-06-14-06-50-12-20260614-223423.json`
- `reports/promote-history/daily-digest-promote-sandbox-2026-06-14-06-50-12-20260614-223423.md`

## 15. Safety Constraints (verified by validator)

- No `child_process` / `exec` / `spawn` in executor (only `fs` + `crypto` + `path`).
- No `.env` / `.control.local` reads.
- No network calls (no `http` / `https` / `fetch`).
- No `process.env.*` references.
- Output is redacted (token patterns stripped from JSON before display).
- Only two production targets: `reports/daily-digest.md`, `reports/telegram-digest.txt`.

## 16. Files Added / Modified

**Added:**
- `dashboard/daily-digest-controlled-promote.json` — config
- `scripts/daily-digest-controlled-promote.ts` — executor
- `scripts/daily-digest-controlled-rollback.ts` — rollback plan (dry-run only)
- `scripts/validate-daily-digest-controlled-promote.ts` — validator
- `reports/promote-backups/daily-digest/sandbox-2026-06-14-06-50-12-20260614-223423/` — backup
- `reports/promote-history/daily-digest-promote-sandbox-2026-06-14-06-50-12-20260614-223423.{json,md}` — history

**Modified:**
- `package.json` — added 3 scripts
- `scripts/control-server.ts` — added `POST /api/daily-digest/promote/controlled` and `GET /api/daily-digest/promote/history`
- `dashboard/control.html` — added Controlled Promote panel + JS loader
- `reports/daily-digest.md` — production target (mtime updated, content = sandbox output)
- `reports/telegram-digest.txt` — production target (mtime updated, content = sandbox output)

## 17. Limitations

1. The dashboard `dashboard:control:validate` reports a pre-existing failure (button tag pattern) unrelated to this phase.
2. The auto-rollback path is intentionally **not implemented**; a future phase with explicit human authorization can wire `daily-digest-controlled-rollback.ts` to actually restore.
3. The controlled promote is **one-shot per phase run** — every run creates a new backup and a new history record. There is no incremental backup deduplication.
4. The executor writes only to the two fixed production targets; the loop pattern is not generalized.

## 18. Next Phase Proposal

- **C5N: Continuous Controlled Promote Workflow** (proposed only, not implemented):
  - Schedule a daily timer-bound check that, if a new sandbox run is available, automatically pre-stages a controlled promote (no copy yet) and writes a "ready" status to a dedicated dashboard.
  - Adds a manual-confirm-only promotion step (reuses Phase 5C-2C-C5M-1's executor).
  - Adds an optional auto-rollback hook (explicitly gated by `CQA_ALLOW_AUTO_ROLLBACK=1`).
  - Adds a 7-day retention policy for `reports/promote-backups/`.
  - All transitions remain human-phrase gated.

## 19. Commit

- Branch: `master`
- Commit at start: `b5f59bb` (Phase 5C-2C-C5M-0)
- New commit (this phase): to be created via `git commit -m "Phase 5C-2C-C5M1: One-shot controlled promote"`
- Push: `origin/master`

---

*辛 🔮 — 实操优先，落地为王。Phase 5C-2C-C5M-1 完成。*
