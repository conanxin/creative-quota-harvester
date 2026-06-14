# PHASE_5C5A_CONTROL_HARDENING_AUDIT_VIEWER_REPORT.md

## STATUS

PASS ✅

Phase 5C-5A: Control Server Hardening & Audit Viewer complete.
All validation scripts PASS. Smoke test PASS. No secrets leaked. No model calls. No media generated.

## WHAT_CHANGED

1. **Security Policy**: Added `dashboard/control-security-policy.json` with rate limits, execution lock, audit settings, and output redaction policy.
2. **Rate Limits**: In-memory rate limiting (5/20/60 per minute) for execute-low-risk/dry-run/read-only.
3. **Execution Lock**: Single-concurrent execution lock for execute-low-risk; returns 409 busy if already running.
4. **Audit Log Viewer**: New `GET /api/audit-log` endpoint returns last 100 redacted entries.
5. **Security Status Endpoint**: New `GET /api/control-security-status` returns live security state without secrets.
6. **Runner Output Redaction**: `control-action-runner.ts` redacts stdout/stderr before return using regex patterns (Telegram tokens, API keys, Bearer tokens).
7. **Hardening Validator**: New `scripts/validate-control-hardening.ts` with `npm run validate:control-hardening`.
8. **Control Catalog UI**: Updated `dashboard/control.html` with Security/Audit panel.
9. **Allowlist Priority**: `allowed_scripts` now takes precedence over `blocked_patterns` to prevent false positives on validation script names.

## SECURITY_POLICY

```json
{
  "version": "0.1.0",
  "phase": "5C-5A",
  "host": "127.0.0.1",
  "rate_limits": {
    "execute_low_risk_per_minute": 5,
    "dry_run_per_minute": 20,
    "read_only_per_minute": 60
  },
  "execution_lock": {
    "enabled": true,
    "max_concurrent_execute_low_risk": 1
  },
  "audit": {
    "enabled": true,
    "max_lines_returned": 100,
    "redact_before_return": true
  },
  "output": {
    "max_output_chars": 12000,
    "redact_before_return": true
  }
}
```

## RATE_LIMITS

- `execute_low_risk_per_minute`: 5
- `dry_run_per_minute`: 20
- `read_only_per_minute`: 60

Implementation: In-memory per-minute buckets with automatic cleanup. Returns 429 with retry_after_seconds.

## EXECUTION_LOCK

- Max concurrent execute-low-risk: 1
- Returns 409 if already busy
- Lock released in finally block (guaranteed even on error)

## AUDIT_LOG_VIEWER

- Endpoint: `GET /api/audit-log`
- Returns last 100 entries
- Redacted before return (no tokens, no secrets)
- No path parameters allowed
- Read-only, does not read arbitrary files

## RUNNER_OUTPUT_REDACTION

Redaction patterns in `control-action-runner.ts`:
- Telegram tokens: `[0-9]{8,12}:[A-Za-z0-9_-]{25,}` → `<REDACTED_TELEGRAM_TOKEN>`
- API keys: `sk-[A-Za-z0-9_-]{20,}` → `<REDACTED_API_KEY>`
- Bearer tokens: `authorization: bearer <token>` → `<REDACTED>`
- Generic token values: `token=<value>` → `<REDACTED>`

## VALIDATION_RESULTS

| Script | Result |
|--------|--------|
| validate:control-hardening | PASS ✅ |
| validate:control-low-risk-execution | PASS ✅ |
| validate:sanitizer-secret-completeness | PASS ✅ |
| validate:sanitizer-false-positives | PASS ✅ |
| validate:telegram-sanitizer | PASS ✅ |
| validate:project-report-send | PASS ✅ |
| validate:control-server | PASS ✅ |
| dashboard:policy:validate | PASS ✅ |
| validate:control-actions-dry-run | PASS ✅ |
| validate:control-readonly-actions | PASS ✅ |

## SMOKE_TEST_RESULT

- `/api/control-security-status` → returns JSON with mode, rate limits, lock status
- `/api/audit-log` → returns 49 entries, redacted
- Allowed action (`validate_control-server`) → exit_code=0, real_execution=true
- Blocked action (`generate_image_confirmed`) → 403 Forbidden
- Audit log contains no token residue
- No model calls
- No media generated

## BLOCKED_ACTION_TESTS

- `generate_image_confirmed` → blocked (not confirmed_low_risk)
- `generate:*` → blocked by allowlist
- `send:*` → blocked by allowlist (digest:send, report:send)
- `timer:*` → blocked by allowlist
- `collect:*` → blocked by allowlist
- `git` → blocked by allowlist
- `build` → blocked by allowlist
- `deploy` → blocked by allowlist
- `release` → blocked by allowlist

## SANITIZER_REGRESSION_RESULTS

- Telegram token fully redacted (no residue after colon)
- Standalone Telegram token fully redacted
- Short token (1:2) NOT redacted (too short)
- Non-Telegram colon pattern NOT redacted
- CQA_CONTROL_TOKEN fully redacted
- Mixed tests PASS
- False positives preserved, real secrets redacted

## MODEL_CALL_STATUS

No model calls during this phase. Control server does not call models.

## GENERATED_MEDIA_STATUS

No images, music, or videos generated during this phase.

## LIMITATIONS

1. Rate limits are in-memory only (per-process). Restarting server resets counters.
2. Audit log is local file only. No remote aggregation.
3. Execution lock is in-memory only. No distributed locking.
4. Control server still localhost-only. No HTTPS or external auth.
5. No real-time audit log streaming (polling only).

## NEXT_PHASE_PROPOSAL

Phase 5C-5B: Digest / Send / Timer / Collect 动作准备
- 在 hardened control server 基础上，逐步评估哪些收集/发送动作可以进入 dry-run / safe-readonly 范围
- 保持 execution lock 和 rate limit
- 不开放 generate / build / deploy / git

---
Report generated: 2026-06-14
