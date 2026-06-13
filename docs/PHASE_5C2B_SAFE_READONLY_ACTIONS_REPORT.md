# Phase 5C-2B — Safe Read-only Action Execution

**Date:** 2026-06-13
**Phase:** 5C-2B
**STATUS:** PASS

---

## WHAT_CHANGED

Phase 5C-2B adds **safe read-only queries** to the localhost-only control server. These endpoints read existing system state data without executing commands, calling models, or modifying files.

### New Files (3)
- `scripts/validate-control-readonly-actions.ts` — 21 validation checks
- `docs/PHASE_5C2B_SAFE_READONLY_ACTIONS_REPORT.md` — this report
- `reports/safe-readonly-actions.md` — detail report

### Modified Files (5)
- `scripts/control-server.ts` — added `POST /api/action/read-only` endpoint with 7 read-only handlers
- `dashboard/control-catalog.json` — added new "Safe Read-only Queries" group (7 commands), updated version to 0.3.0, phase to 5C-2B
- `package.json` — added `validate:control-readonly-actions` script
- `README.md` — Phase 5C-2B section added
- `ROADMAP.md` — Phase 5C-2B added to version history

## AUTH_MODEL

Same as Phase 5C-2A:
- Host: `127.0.0.1` only
- Auth file: `.control.local` (git-ignored)
- Token: `CQA_CONTROL_TOKEN`
- No config → some endpoints still work (read-only queries don't require actions enabled, only token if configured)

## READ_ONLY_ENDPOINT

### POST /api/action/read-only

**Request body:**
```json
{"action_id":"get_status","token":"your-secret-token"}
```

**Response (success):**
```json
{
  "action_id": "get_status",
  "label_zh": "查询系统状态",
  "mode": "safe_readonly",
  "real_execution": false,
  "side_effects": false,
  "result": { ...status.json contents... },
  "source_files": ["dashboard/status.json"],
  "status": "status_loaded",
  "timestamp": "2026-06-13T08:57:45.911Z"
}
```

**Response (blocked — not safe_readonly):**
```json
{"statusCode":403,"message":"Forbidden: Action \"run_manual_digest\" is not safe_readonly. Execution mode: dry_run_only"}
```

**Response (blocked — invalid token):**
```json
{"statusCode":403,"message":"Forbidden: Invalid or missing control token"}
```

## READ_ONLY_ACTIONS

| Action | Description | Source Files | Network | Shell |
|--------|-------------|-------------|---------|-------|
| `get_status` | Read dashboard/status.json | dashboard/status.json | No | No |
| `get_source_health` | Read reports/source-health.* | reports/source-health.json, .md | No | No |
| `get_latest_digest` | Read reports/telegram-digest.txt, daily-digest.md | reports/*.txt, *.md | No | No |
| `get_generation_queue` | Extract recommended_queue from status.json | dashboard/status.json | No | No |
| `get_asset_summary` | Read creative-quota-assets/metadata/*.json | ../creative-quota-assets/metadata/ | No | No |
| `get_timer_snapshot` | Extract timer fields from status.json | dashboard/status.json | No | No |
| `get_dashboard_links` | Return static links | None | No | No |

All 7 actions:
- `real_execution: false`
- `side_effects: false`
- No `child_process`, no `exec`, no `spawn`
- No file writes (except audit log)
- No network calls (`http.request`, `fetch`, `axios`)
- Only `safeReadJson` and `safeReadText` used

## ACTION_POLICY

### execution_mode values

| Value | Meaning | Example Actions |
|-------|---------|-----------------|
| `safe_readonly` | Read-only query, no side effects | get_status, get_source_health, get_timer_snapshot |
| `dry_run_only` | Simulates what would run, but doesn't execute | run_manual_digest, image_confirmed_1, timer_disable_command |
| `disabled` | Not implemented | (reserved for future) |

### Catalog Statistics

- Total commands: 32 (25 dry_run_only + 7 safe_readonly)
- All 32 commands: `real_execution_supported=false`
- All 7 safe_readonly: `dry_run_supported=false` (they are queries, not dry-runs)
- All 7 safe_readonly: no `calls_model`, no `generates_media`

## AUDIT_LOG_STATUS

Extended from Phase 5C-2A. Now supports two modes:

**Dry-run audit entry:**
```json
{"ts":"2026-06-13T08:32:42.906Z","mode":"dry-run","action_id":"run_manual_digest","risk_level":"safe","confirm_ok":true,"real_execution":false,"result":"allowed_dry_run","reason":"confirm_phrase_matched"}
```

**Read-only audit entry:**
```json
{"ts":"2026-06-13T08:57:45.911Z","mode":"safe_readonly","action_id":"get_status","real_execution":false,"side_effects":false,"result":"success","reason":"status_loaded"}
```

**Security:** No token, no secrets, no `TELEGRAM_BOT_TOKEN`, no `MINIMAX_API_KEY`.

## SMOKE_TEST_RESULT

| Test | Request | Expected | Result |
|------|---------|----------|--------|
| Health | `GET /health` | `mode: localhost-only-dry-run-safe-readonly` | ✅ PASS |
| get_status | `POST /api/action/read-only` with valid token | Returns status.json data, `real_execution=false`, `side_effects=false` | ✅ PASS |
| get_source_health | `POST /api/action/read-only` with valid token | Returns source health data | ✅ PASS |
| get_timer_snapshot | `POST /api/action/read-only` with valid token | Returns timer fields from status.json | ✅ PASS |
| get_dashboard_links | `POST /api/action/read-only` with valid token | Returns static links | ✅ PASS |
| Bad token | `POST /api/action/read-only` with wrong token | `Forbidden: Invalid token` | ✅ PASS |
| dry_run_only blocked | `POST /api/action/read-only` with `run_manual_digest` | `Forbidden: not safe_readonly` | ✅ PASS |
| Dry-run regression | `POST /api/action/dry-run` with valid token+confirm | Still works, `real_execution=false` | ✅ PASS |

All responses verified `real_execution: false` and `side_effects: false`.

## VALIDATION_RESULTS

`npm run validate:control-server`: **20/20 PASS** (regression)

`npm run dashboard:control:validate`: **15/15 PASS** (regression)

`npm run validate:control-actions-dry-run`: **19/19 PASS** (regression)

`npm run validate:control-readonly-actions`: **21/21 PASS** (new)

Key validations:
- control-server.ts binds to `127.0.0.1` only
- No `child_process` require, no `exec()`/`spawn()` calls
- No `eval()`
- `/api/action/read-only` endpoint exists (POST only)
- `/api/action/read-only` checks `execution_mode === "safe_readonly"`
- No `/api/action/execute` endpoint
- `handleReadOnly` has no `child_process` / `exec` / `spawn`
- `handleReadOnly` only uses `safeReadJson`/`safeReadText`, no network calls
- `handleReadOnly` always returns `real_execution=false`, `side_effects=false`
- `handleReadOnly` no file writes (except audit log)
- control-catalog.json: 7 safe_readonly commands found
- All safe_readonly commands have `real_execution_supported=false`
- All safe_readonly commands have `dry_run_supported=false`
- No safe_readonly command calls model or generates media
- `.control.local` is git-ignored
- `.env` is git-ignored
- `writeAuditLogReadOnly` exists with `mode: "safe_readonly"`

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
- Only text files (server source, validator, reports, audit log)

## LIMITATIONS

1. **Read-only only** — No real command execution. All `real_execution_supported=false`.
2. **No /api/action/execute** — Real execution requires Phase 5C-2C.
3. **Single token** — No per-user or rotating tokens. Phase 5C-2C could add JWT.
4. **No rate limiting** — localhost-only makes brute-force less likely.
5. **No HTTPS** — localhost-only, SSH tunnel recommended for remote access.
6. **Audit log is plain JSONL** — No structured log rotation or retention.
7. **No CORS headers** — Not needed for localhost.
8. **Asset summary reads relative path** — `../creative-quota-assets/metadata/` may not exist if repos are in different locations.
9. **No caching** — Every read-only query re-reads files from disk.
10. **No data aggregation** — Each action reads its own files; no cross-query optimization.

## NEXT_PHASE_PROPOSAL

**Phase 5C-2C (proposed): Confirmed Low-risk Command Execution**
- Add `POST /api/action/execute` for `safe` risk-level commands
- Require auth token + confirmation
- Audit log marks `mode: "execute"` vs `mode: "dry-run"`
- Still no `child_process`/`exec`/`spawn` — only safe file reads and API calls
- 2FA/OTP for `high` and `danger` commands
- Telegram confirmation before execution for danger commands
- Per-user audit log with session IDs
- Rate limiting and brute-force protection

**Phase 5C-3 (proposed): Auto-Generated Catalog**
- Walk `package.json` scripts to derive command metadata
- Compare with existing catalog; flag drift
- Add `npm run dashboard:control:sync` to regenerate

**Phase 4J (longer-term): Audio Coupling**
- Auto-stitch video (8s looped) + music (60-90s) for unified pack audio

Phase 5C-2B: PASS
