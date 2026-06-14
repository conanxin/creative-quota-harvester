# Phase 5C-2C-C5M-1 · One-shot Controlled Promote · Summary

| Field | Value |
|---|---|
| Status | **SUCCESS** |
| Latest run ID | `sandbox-2026-06-14-06-50-12` |
| Promoted files | `reports/daily-digest.md`, `reports/telegram-digest.txt` |
| Backup path | `reports/promote-backups/daily-digest/sandbox-2026-06-14-06-50-12-20260614-223423/` |
| Hash verification | ✅ both files match sandbox hashes |
| Forbidden path check | ✅ `dashboard/status.json` unchanged, `reports/daily/` not present, timer/systemd untouched |
| Telegram send | ❌ disabled (config + validator enforced) |
| Timer status | ❌ not triggered (no timer path in executor) |
| Model call | ❌ not called (executor uses `fs`+`crypto` only) |
| Generated media | ❌ none |
| Rollback | ✅ supported (manifest verified, restore command recorded; auto-rollback NOT enabled) |
| Audit | `reports/control-action-audit.jsonl` — `mode=daily_digest_controlled_promote`, `real_execution=true`, `result=success` (no token) |
| Limitations | (1) `dashboard:control:validate` pre-existing button-tag FAIL unrelated to this phase. (2) Auto-rollback not wired. (3) One-shot only. |
| Next phase proposal | C5N: continuous controlled promote workflow with explicit human confirm + 7-day retention + optional auto-rollback (gated by env var) |
