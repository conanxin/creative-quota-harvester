Phase 5C-2A: Authenticated Control Actions Dry-run

**Date:** 2026-06-13
**Phase:** 5C-2A
**Status:** PASS

---

## What Changed

Phase 5C-2A adds an authenticated dry-run action framework to the localhost-only control server:
- `.control.local.example` — auth config template (CQA_CONTROL_TOKEN, CQA_CONTROL_ENABLE_ACTIONS)
- `dashboard/control-catalog.json` — all 25 commands get action metadata (action_id, dry_run_supported, real_execution_supported=false, confirmation_phrase, audit_required)
- `scripts/control-server.ts` — POST /api/action/dry-run endpoint (validates token, confirm_phrase, risk level; never executes)
- `scripts/validate-control-actions-dry-run.ts` — 19 validation checks
- `reports/control-action-audit.jsonl` — runtime audit log (git-ignored, no secrets)

## Auth Model

| Component | Value |
|-----------|-------|
| Host | 127.0.0.1 only |
| Auth file | `.control.local` (git-ignored) |
| Token | `CQA_CONTROL_TOKEN` |
| Toggle | `CQA_CONTROL_ENABLE_ACTIONS=1` |
| No config | Returns `blocked_needs_control_config` |
| Wrong token | Returns `Forbidden: Invalid token` |
| Audit secrets | Never — audit log only records action_id, risk_level, result, reason |

## Dry-run Endpoint

`POST /api/action/dry-run`

Request:
```json
{"action_id":"run_manual_digest","confirm_phrase":"dry-run-safe","token":"..."}
```

Response:
```json
{"action_id":"...","label_zh":"...","risk_level":"safe","would_run_command":"...","requires_confirm":false,"confirmation_phrase_expected":"dry-run-safe","confirmation_status":"matched","real_execution":false,"dry_run_only":true,"message":"Dry-run passed. No command executed."}
```

All responses: `real_execution: false`. No `child_process`, no `exec`, no `spawn`.

## Action Policy

All 25 commands: `real_execution_supported=false`, `dry_run_supported=true`, `audit_required=true`.

| Risk | Confirmation Phrase | Examples |
|------|---------------------|----------|
| safe | `dry-run-safe` | run_manual_digest, check_digest_freshness |
| medium | `dry-run-medium` | send_digest_confirmed, collect_full |
| high | `dry-run-high` | image_confirmed_1, image_confirmed_2 |
| danger | `dry-run-danger` | timer_disable_command |

## Smoke Test Results

| Test | Result |
|------|--------|
| No config → blocked_needs_control_config | ✅ PASS |
| Invalid token → Forbidden | ✅ PASS |
| Valid token + good confirm (safe) → allowed_dry_run, real_execution=false | ✅ PASS |
| Valid token + bad confirm (safe) → mismatch, real_execution=false | ✅ PASS |
| Valid token + good confirm (high) → allowed_dry_run, real_execution=false | ✅ PASS |
| Valid token + good confirm (danger) → allowed_dry_run, real_execution=false | ✅ PASS |
| Unknown action → Not Found, blocked | ✅ PASS |

## Validation Results

- `validate:control-server`: 20/20 PASS (regression)
- `dashboard:control:validate`: 15/15 PASS (regression)
- `validate:control-actions-dry-run`: 19/19 PASS (new)

## Boundaries

- MiniMax called: No
- Image/Video/Music model called: No
- LLM called: No
- New media generated: No
- New audio generated: No
- Systemd timer: untouched
- Gateway config: untouched
- .env / .env.telegram.local: not committed
- Telegram token: not printed
- Real execution: not possible from this server
- Public Pages executable control: not possible

## GitHub Push

- creative-quota-harvester: updated (master)
- creative-quota-assets: not affected

## Next Phase

- Phase 5C-2B: Safe read-only action execution (with auth + audit)
- Phase 5C-2C: Confirmed low-risk command execution (2FA for high/danger)
- Phase 5C-3: Auto-generated catalog from package.json scripts
- Phase 4J: Audio coupling (video + music)
