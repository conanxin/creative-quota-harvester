# Private Control Command Catalog — Phase 5C-0 Detail Report

**Date:** 2026-06-13
**Phase:** 5C-0
**Status:** PASS

Full report: `docs/PHASE_5C0_PRIVATE_CONTROL_COMMAND_CATALOG_REPORT.md`

## What Changed

- 3 new files: `dashboard/control-catalog.json` (25 commands × 6 groups), `dashboard/control.html` (read-only UI), `scripts/validate-control-catalog.ts` (15 checks)
- `dashboard/index.html` updated: added "🔒 私有控制目录（只读）" link
- `package.json` updated: new `npm run dashboard:control:validate` script
- `docs/PHASE_5C0_PRIVATE_CONTROL_COMMAND_CATALOG_REPORT.md` (full report)

## Command Groups (6)

| Group | Count |
|-------|------:|
| 📅 Daily Digest | 5 |
| 🌐 Source Collection | 4 |
| 🎨 Asset Generation | 5 |
| ✅ Validation | 5 |
| ⏰ Timer | 4 |
| 📨 Reports | 2 |
| **Total** | **25** |

## Risk Distribution

- safe=18 (collect_diagnose, validate_*, dry-runs, prompt-only)
- medium=4 (send_digest_confirmed, send_project_report_confirmed, collect_full, timer_enable)
- high=2 (image_confirmed_1, image_confirmed_2)
- danger=1 (timer_disable_command)

## Public Safety Model

- control.html is read-only by construction:
  - No `<button>` elements
  - No `fetch POST` (only GET for control-catalog.json)
  - No `new WebSocket`
  - No `exec()`, no `child_process`, no `document.write`
  - All command text is in `<div class="cmd-code">` with `user-select: all` (manual copy only)
- control-catalog.json has no secrets / tokens / .env contents
- 3 high/danger commands have `requires_confirm=true` (validator enforced)
- CQA_ALLOW_GENERATION=1 + --confirm-spend enforced for image_confirmed
- CQA_ALLOW_TELEGRAM_SEND=1 enforced for telegram confirmed sends
- modifies_timer=true for timer commands

## Validation

`npm run dashboard:control:validate`: **15/15 PASS**

- control-catalog.json: valid JSON, no secret, 6 groups, 25 commands structurally valid
- control.html: required copy present (4 checks), no POST/WebSocket/exec/child_process in code, no `<button>`, no secrets, references control-catalog.json via fetch

Other validators (regression):
- `dashboard:build` PASS
- `dashboard:validate` PASS (22/22)

## Local Preview (http://127.0.0.1:8767/)

- `curl -I /dashboard/control.html` → 200, 12177 bytes
- Contains: 私有控制目录, 只读命令目录, 风险等级 ✓
- `curl /dashboard/control-catalog.json` → 200, valid JSON ✓

## Boundaries

- MiniMax called: No
- Image model called: No
- Video model called: No
- Music model called: No
- LLM called: No
- New media generated: No
- New audio generated: No
- Systemd timer: untouched
- Gateway config: untouched
- .env / .env.telegram.local: not committed
- Telegram token: not printed
- Real execution buttons: not present
- Public Pages executable control: not possible

## GitHub Push

- creative-quota-harvester: pending
- creative-quota-assets: not affected (no asset changes in this phase)

## Next Phase

- Phase 5C-1: localhost-only control server (127.0.0.1 bind, CORS locked, signed receipts)
- Phase 5C-2: authenticated control actions (2FA for high/danger, per-user audit)
- Phase 5C-3: auto-generated catalog from package.json scripts
- Phase 4J: audio coupling (video + music)
