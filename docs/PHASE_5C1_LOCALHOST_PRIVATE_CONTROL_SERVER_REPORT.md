# Phase 5C-1 — localhost-only Private Control Server

**Date:** 2026-06-13
**Phase:** 5C-1
**STATUS:** PASS

---

## WHAT_CHANGED

Phase 5C-1 introduces a **localhost-only, read-only HTTP server** for the Creative Quota Harvester. It serves dashboard status, control catalog, and whitelisted reports over HTTP, but **does not execute any command**.

New files (4):
- `scripts/control-server.ts` (~500 lines, Node.js built-in http module)
- `scripts/validate-control-server.ts` (20 checks)
- `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` (operator runbook)
- `docs/PHASE_5C1_LOCALHOST_PRIVATE_CONTROL_SERVER_REPORT.md` (this report)

Modified:
- `package.json` — 4 new scripts

## SERVER_ROUTES

| Route | Method | Content-Type | Purpose |
|-------|--------|------------|---------|
| `GET /` | HTML | text/html | Private control console (Chinese UI, status, catalog, links) |
| `GET /health` | JSON | application/json | Health check: `{ status, mode, host, port, timestamp }` |
| `GET /api/status` | JSON | application/json | Returns `dashboard/status.json` |
| `GET /api/control-catalog` | JSON | application/json | Returns `dashboard/control-catalog.json` |
| `GET /api/reports` | JSON | application/json | Report whitelist + availability index |
| `GET /api/report?name=...` | text/plain | text/plain | Whitelisted report text (auto-appends .txt if missing) |
| `GET /static/dashboard` | HTML | text/html | Serves `dashboard/index.html` |

All other routes → 404. All non-GET methods → 405.

## SECURITY_MODEL

- **Host binding:** Only `127.0.0.1` (hardcoded). Any other host → `process.exit(1)`.
- **Method restriction:** Only GET. All others → 405 Method Not Allowed.
- **No POST handler:** No command execution surface.
- **No WebSocket:** No real-time push surface.
- **No child_process:** No `require('child_process')`, no `exec()`, no `spawn()`.
- **No .env reading:** No `readFileSync` for `.env`, no `.env.telegram.local` reference.
- **No token exposure:** No `sk-...`, `ghp_...`, `TELEGRAM_BOT_TOKEN=...`, `MINIMAX_API_KEY=...` in source.
- **Path traversal blocked:** `..` and `\0` in URL → 400 Bad Request.
- **Report whitelist:** Only 24 named reports allowed. Unknown names → 403 Forbidden.
- **Error handling:** `server.on('error', ...)` prevents unhandled error events.
- **CORS:** None (localhost-only, no cross-origin needed).

## SMOKE_TEST_RESULT

```
GET /health
→ {"status":"ok","mode":"localhost-only-read-only","host":"127.0.0.1","port":8788}

GET /
→ Contains: "Creative Quota 私有控制台", "localhost-only", "read-only", "不执行命令", "不触发模型"

GET /api/status
→ Valid JSON (dashboard/status.json)

GET /api/control-catalog
→ Valid JSON (dashboard/control-catalog.json)

GET /api/report?name=telegram-digest
→ Report text (after auto-appending .txt)

POST /api/control-catalog
→ HTTP/1.1 405 Method Not Allowed
```

All checks PASS.

## VALIDATION_RESULTS

`npm run validate:control-server`:

```
PASS  control-server.ts exists
PASS  control-server.ts binds to 127.0.0.1
PASS  control-server.ts does NOT bind to 0.0.0.0
PASS  control-server.ts does NOT require child_process
PASS  control-server.ts: no exec()/spawn()/execSync()/spawnSync()/execFile() calls
PASS  control-server.ts blocks non-GET methods
PASS  control-server.ts: no new WebSocket()
PASS  control-server.ts: no .env file read
PASS  control-server.ts: no .env.telegram.local reference
PASS  control-server.ts: no token assignment patterns
PASS  control-server.ts: no API key patterns
PASS  control-server.ts: no eval()
PASS  control-server.ts has path traversal guard
PASS  control-server.ts: REPORTS_WHITELIST defined
PASS  package.json has script: control:server
PASS  package.json has script: control:server:check
PASS  package.json has script: control:server:smoke
PASS  package.json has script: validate:control-server
PASS  dashboard/status.json: valid JSON
PASS  dashboard/control-catalog.json: valid JSON
```

20/20 PASS. Regression checks:
- `dashboard:control:validate` 15/15 PASS
- `dashboard:build` PASS
- `dashboard:validate` 22/22 PASS

## PUBLIC_EXPOSURE_STATUS

- **Public GitHub Pages:** No server exposed. Only static HTML/JSON files.
- **Server binding:** `127.0.0.1:8788` only. Not accessible from outside the machine.
- **Remote access:** Requires SSH port forward (`ssh -L 8788:127.0.0.1:8788`).
- **No reverse proxy:** No nginx/Apache config created. No public endpoint.

## MODEL_CALL_STATUS

- MiniMax called: **No**
- Image model called: **No**
- Video model called: **No**
- Music model called: **No**
- LLM called: **No**
- Any model call from the server: **No** (server is read-only data only)

## GENERATED_MEDIA_STATUS

- No new media files generated
- No images, music, or video
- Only text files (server source, validator, runbook, reports)

## LIMITATIONS

1. **No command execution yet** — Phase 5C-1 is read-only. Real control requires Phase 5C-2 (authenticated actions).
2. **No request logging** — Access logs are not persisted. Future phase could add structured logging.
3. **No rate limiting** — localhost-only makes this less critical, but a brute-force local script could DOS the server.
4. **No HTTPS** — localhost-only means TLS is not needed, but SSH tunnel is recommended for remote access.
5. **No graceful shutdown** — SIGTERM/SIGINT handlers exist but no active-connection drain.
6. **Report whitelist is manual** — 24 hardcoded names. Drift possible if new reports are added.
7. **No CORS headers** — Not needed for localhost, but could be added for dev convenience.
8. **Server stops on any error** — Unhandled errors kill the process. The error handler logs but doesn't recover.

## NEXT_PHASE_PROPOSAL

**Phase 5C-2 (proposed): Authenticated Control Actions**
- Add `POST /api/execute/:id` endpoint (behind auth)
- 2FA/OTP for `high` and `danger` commands
- Per-user audit log (`logs/control-actions.jsonl`)
- Telegram confirmation before execution
- JWT or session-based auth (not in this phase)

**Phase 5C-3 (proposed): Auto-Generated Catalog**
- Walk `package.json` scripts to derive command metadata
- Compare with existing catalog; flag drift
- Add `npm run dashboard:control:sync` to regenerate

**Phase 4J (longer-term): Audio Coupling**
- Auto-stitch video (8s looped) + music (60-90s) for unified pack audio

Phase 5C-1: PASS
