# Phase 5C-2A — Authenticated Control Actions Dry-run

**Date:** 2026-06-13
**Phase:** 5C-2A
**STATUS:** PASS

---

## WHAT_CHANGED

Phase 5C-2A introduces an **authenticated dry-run action framework** to the localhost-only control server. It adds token-based authentication, confirmation phrase validation, risk level checking, and audit logging — but **never executes any command**.

### New Files (4)
- `.control.local.example` — auth config template (`CQA_CONTROL_TOKEN`, `CQA_CONTROL_ENABLE_ACTIONS`)
- `scripts/validate-control-actions-dry-run.ts` — 19 validation checks
- `docs/PHASE_5C2A_AUTH_CONTROL_DRY_RUN_REPORT.md` — this report
- `reports/auth-control-dry-run.md` — detail report

### Modified Files (5)
- `scripts/control-server.ts` — added `POST /api/action/dry-run` endpoint
- `dashboard/control-catalog.json` — all 25 commands get action metadata
- `.gitignore` — added `.control.local` and `reports/control-action-audit.jsonl`
- `README.md` — Phase 5C-2A section added
- `ROADMAP.md` — Phase 5C-2A added to version history

## AUTH_MODEL

| Component | Value |
|-----------|-------|
| Host binding | `127.0.0.1` only (hardcoded, any other host → exit) |
| Auth config file | `.control.local` (git-ignored, per-machine) |
| Token env var | `CQA_CONTROL_TOKEN` |
| Actions toggle | `CQA_CONTROL_ENABLE_ACTIONS=1` |
| Without config | Dry-run returns `blocked_needs_control_config` |
| With wrong token | Returns `Forbidden: Invalid or missing control token` |
| Token in audit log | **Never** — audit log only records `action_id`, `risk_level`, `result`, `reason` |

## DRY_RUN_ENDPOINT

### POST /api/action/dry-run

**Request body:**
```json
{
  "action_id": "run_manual_digest",
  "confirm_phrase": "dry-run-safe",
  "token": "your-secret-token"
}
```

**Response (success):**
```json
{
  "action_id": "run_manual_digest",
  "label_zh": "手动跑一次完整 Digest 链路",
  "risk_level": "safe",
  "would_run_command": "npm run daily:manual",
  "requires_confirm": false,
  "confirmation_phrase_expected": "dry-run-safe",
  "confirmation_status": "matched",
  "real_execution": false,
  "dry_run_only": true,
  "message": "Dry-run passed. No command executed. This is a simulation only.",
  "audit_required": true
}
```

**Response (mismatch):**
```json
{
  "action_id": "run_manual_digest",
  "label_zh": "手动跑一次完整 Digest 链路",
  "risk_level": "safe",
  "would_run_command": "npm run daily:manual",
  "requires_confirm": false,
  "confirmation_phrase_expected": "dry-run-safe",
  "confirmation_status": "mismatch",
  "real_execution": false,
  "message": "Dry-run failed: confirmation phrase mismatch. Expected: \"dry-run-safe\""
}
```

**Response (no config):**
```json
{
  "action_id": "run_manual_digest",
  "label_zh": "手动跑一次完整 Digest 链路",
  "risk_level": "safe",
  "would_run_command": "npm run daily:manual",
  "requires_confirm": false,
  "confirmation_phrase_expected": "dry-run-safe",
  "confirmation_status": "blocked_needs_control_config",
  "real_execution": false,
  "message": "Blocked: .control.local not configured. Add CQA_CONTROL_TOKEN to .control.local to enable dry-run mode."
}
```

## ACTION_POLICY

All 25 commands in `control-catalog.json` have these action metadata fields:

| Field | Value | Rule |
|-------|-------|------|
| `action_id` | Same as `id` | Unique identifier |
| `dry_run_supported` | `true` | All commands support dry-run |
| `real_execution_supported` | `false` | **All commands disabled in 5C-2A** |
| `allowed_in_phase` | `"5C-2A-dry-run-only"` | Phase gate |
| `confirmation_phrase` | `"dry-run-safe"` / `"dry-run-medium"` / `"dry-run-high"` / `"dry-run-danger"` | Risk-based |
| `audit_required` | `true` | All commands audited |

### Risk-based confirmation phrases

| Risk | Phrase | Examples |
|------|--------|----------|
| safe | `dry-run-safe` | `run_manual_digest`, `check_digest_freshness` |
| medium | `dry-run-medium` | `send_digest_confirmed`, `collect_full` |
| high | `dry-run-high` | `image_confirmed_1`, `image_confirmed_2` |
| danger | `dry-run-danger` | `timer_disable_command` |

## AUDIT_LOG_STATUS

**Location:** `reports/control-action-audit.jsonl` (git-ignored)

**Format:** One JSON line per dry-run attempt:
```json
{"ts":"2026-06-13T08:32:42.906Z","mode":"dry-run","action_id":"run_manual_digest","risk_level":"safe","confirm_ok":true,"real_execution":false,"result":"allowed_dry_run","reason":"confirm_phrase_matched"}
```

**Fields:**
- `ts` — ISO timestamp
- `mode` — always `"dry-run"`
- `action_id` — command identifier
- `risk_level` — safe/medium/high/danger
- `confirm_ok` — boolean
- `real_execution` — always `false`
- `result` — `allowed_dry_run` / `blocked`
- `reason` — `confirm_phrase_matched` / `confirm_phrase_mismatch` / `invalid_token` / `control_config_missing` / `action_id_not_found`

**Security:** No `token`, no `CQA_CONTROL_TOKEN`, no secrets, no `TELEGRAM_BOT_TOKEN`, no `MINIMAX_API_KEY`.

## SMOKE_TEST_RESULT

| Test | Request | Expected | Result |
|------|---------|----------|--------|
| No config | `POST /api/action/dry-run` without `.control.local` | `blocked_needs_control_config` | ✅ PASS |
| Invalid token | `POST /api/action/dry-run` with wrong token | `Forbidden: Invalid token` | ✅ PASS |
| Valid token + good confirm (safe) | `POST /api/action/dry-run` with correct token and phrase | `allowed_dry_run`, `real_execution=false` | ✅ PASS |
| Valid token + bad confirm (safe) | `POST /api/action/dry-run` with correct token, wrong phrase | `mismatch`, `real_execution=false` | ✅ PASS |
| Valid token + good confirm (high) | `POST /api/action/dry-run` for `image_confirmed_1` | `allowed_dry_run`, `real_execution=false` | ✅ PASS |
| Valid token + good confirm (danger) | `POST /api/action/dry-run` for `timer_disable_command` | `allowed_dry_run`, `real_execution=false` | ✅ PASS |
| Unknown action | `POST /api/action/dry-run` with nonexistent `action_id` | `Not Found`, `blocked` | ✅ PASS |

All tests verified `real_execution: false` in every response.

## VALIDATION_RESULTS

`npm run validate:control-server`: **20/20 PASS** (regression)

`npm run dashboard:control:validate`: **15/15 PASS** (regression)

`npm run validate:control-actions-dry-run`: **19/19 PASS** (new)

Key validations:
- control-server.ts binds to `127.0.0.1` only
- No `child_process` require, no `exec()`/`spawn()` calls
- No `eval()`
- `/api/action/dry-run` endpoint exists (POST only)
- No `/api/action/execute` endpoint
- All `real_execution_supported=false` in control-catalog.json
- All high/danger actions require confirmation
- Audit log does not contain token patterns
- `.control.local` is git-ignored
- `.env` is git-ignored
- No `.env.telegram.local` or `TELEGRAM_BOT_TOKEN` reference in server code
- No file modification outside audit log
- `.control.local.example` exists
- `handleDryRun` returns `would_run_command` but never executes

## MODEL_CALL_STATUS

- MiniMax called: **No**
- Image model called: **No**
- Video model called: **No**
- Music model called: **No**
- LLM called: **No**
- Any model call from the server: **No**

## GENERATED_MEDIA_STATUS

- No new media files generated
- No images, music, or video
- Only text files (server source, validator, runbook, reports, audit log)

## LIMITATIONS

1. **Dry-run only** — No real command execution. All `real_execution_supported=false`.
2. **No /api/action/execute** — Real execution requires Phase 5C-2B/2C.
3. **Single token** — No per-user or rotating tokens. Phase 5C-2C could add JWT or session-based auth.
4. **No rate limiting** — localhost-only makes brute-force less likely, but a local script could spam the endpoint.
5. **No HTTPS** — localhost-only means TLS is not needed. SSH tunnel recommended for remote access.
6. **Audit log is plain JSONL** — No structured log rotation or retention policy. Phase 5C-2C could add log management.
7. **No CORS headers** — Not needed for localhost, but could be added for dev convenience.
8. **Confirmation phrases are static** — Risk-based but not per-action unique. Phase 5C-2C could add per-action OTP or time-based codes.
9. **No rollback mechanism** — If a command is accidentally executed in a future phase, there's no undo.
10. **Audit log is local-only** — No remote aggregation or alerting. Compromised machine = compromised audit log.

## NEXT_PHASE_PROPOSAL

**Phase 5C-2B (proposed): Safe Read-only Action Execution**
- Add `POST /api/action/execute` for `safe` risk-level commands only
- Require auth token + confirmation
- Audit log marks `mode: "execute"` vs `mode: "dry-run"`
- Still no `child_process`/`exec`/`spawn` — only safe file reads and API calls

**Phase 5C-2C (proposed): Confirmed Low-risk Command Execution**
- Extend `POST /api/action/execute` to `medium` risk commands
- Add 2FA/OTP for `high` and `danger` commands
- Telegram confirmation before execution for danger commands
- Per-user audit log with session IDs
- Rate limiting and brute-force protection

**Phase 5C-3 (proposed): Auto-Generated Catalog**
- Walk `package.json` scripts to derive command metadata
- Compare with existing catalog; flag drift
- Add `npm run dashboard:control:sync` to regenerate

**Phase 4J (longer-term): Audio Coupling**
- Auto-stitch video (8s looped) + music (60-90s) for unified pack audio

Phase 5C-2A: PASS
