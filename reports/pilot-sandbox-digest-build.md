Phase 5C-2C-C5E complete.

STATUS: ✅ COMPLETE

WHAT_CHANGED:
• scripts/daily-digest-sandbox-build-pilot.ts — pilot sandbox build runner
• scripts/validate-daily-digest-sandbox-build-pilot.ts — 47-check validator
• scripts/control-server.ts — POST /api/daily-digest/sandbox/build-pilot + GET /api/daily-digest/sandbox/latest-build
• dashboard/control.html — pilot build panel + latest build status
• package.json — added validate:daily-digest-sandbox-build-pilot
• dashboard/daily-digest-build-readiness.json — updated with C5E status
• docs: README, ROADMAP, PRIVATE_CONTROL_SERVER_RUNBOOK

PILOT_BUILDER: src/reports/telegram-daily-digest.ts
• Already refactored in C5D with sandbox guards/runtime
• Executed in sandbox mode for the first time

RUN_ID: sandbox-2026-06-14-06-50-12

SANDBOX_OUTPUTS:
• reports/sandbox/daily-digest/sandbox-2026-06-14-06-50-12/outputs/daily-digest.md (2970 bytes)
• reports/sandbox/daily-digest/sandbox-2026-06-14-06-50-12/outputs/telegram-digest.txt (1763 bytes)
• reports/build-summary.json + logs/build.log

PROTECTED_PATH_CHECK: ALL UNCHANGED ✅
• reports/daily-digest.md: hash=40aeed2d... → 40aeed2d... (no change)
• reports/telegram-digest.txt: hash=cd5e5d3d... → cd5e5d3d... (no change)
• dashboard/status.json: hash=c06441d1... → c06441d1... (no change)
• reports/daily/: not exists before/after

API_ENDPOINTS:
• POST /api/daily-digest/sandbox/build-pilot — execute pilot sandbox build
• GET /api/daily-digest/sandbox/latest-build — read latest build summary

VALIDATION: 14 suites / 540+ checks — ALL PASS ✅

MODEL_CALL: NONE | MEDIA_GEN: NONE | COLLECT: NONE | TELEGRAM_SEND: NONE | PRODUCTION_WRITE: NONE

LIMITATION: Only pilot builder executed in sandbox. Other builders still hardcoded. ready_for_sandbox_build=partial-pilot.

NEXT_PHASE: 5C-2C-C5F — Sandbox Build Comparison & Validation

Commit: e1474d9 (pushed to master)
