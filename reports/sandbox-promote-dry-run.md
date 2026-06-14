Phase 5C-2C-C5H complete.

STATUS: ✅ COMPLETE

WHAT_CHANGED:
• dashboard/daily-digest-promote-dry-run-plan.json — dry-run plan config
• scripts/daily-digest-promote-dry-run.ts — promote dry-run planner
• scripts/validate-daily-digest-promote-dry-run.ts — 38-check validator
• scripts/control-server.ts — GET /api/daily-digest/promote-dry-run-plan
• dashboard/control.html — promote dry-run panel
• package.json — added validate + check scripts
• docs: README, ROADMAP, PRIVATE_CONTROL_SERVER_RUNBOOK

LATEST_RUN_ID: sandbox-2026-06-14-06-50-12

PROMOTE_DRY_RUN_PLAN: preconditions all met ✅
• readiness: true
• outputs_exist: true
• diff_exists: true

COPY_MAP:
• sandbox/outputs/daily-digest.md → reports/daily-digest.md
• sandbox/outputs/telegram-digest.txt → reports/telegram-digest.txt

BACKUP_PLAN:
• backup_before_promote: true
• backup format: {file}.bak.{timestamp}
• rollback_manifest: sandbox/reports/rollback-manifest.json

ROLLBACK_PLAN:
• rollback_manifest: sandbox/reports/rollback-manifest.json

PROTECTED_PATH_CHECK: ALL UNCHANGED ✅
• reports/daily-digest.md
• reports/telegram-digest.txt
• dashboard/status.json
• reports/daily/

API_ENDPOINTS:
• GET /api/daily-digest/promote-dry-run-plan — read-only dry-run plan

VALIDATION: 14 suites / 650+ checks — ALL PASS ✅

MODEL_CALL: NONE | MEDIA_GEN: NONE | COLLECT: NONE | SEND: NONE | PRODUCTION_WRITE: NONE | PROMOTE: NONE

LIMITATION: Only dry-run plan generation. No actual promote. future_confirm_phrase_enabled=false.

NEXT_PHASE: 5C-2C-C5I — Promote Enablement (set future_confirm_phrase_enabled=true, implement copy-to-production logic)

Report: reports/sandbox-promote-dry-run.md
