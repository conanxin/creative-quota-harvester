Phase 5C-2C-C5D complete.

STATUS: ✅ COMPLETE

WHAT_CHANGED:
- New scripts/daily-digest-sandbox-runtime.ts: sandbox runtime config resolver
- Refactored src/reports/telegram-daily-digest.ts: pilot builder uses sandbox guards/runtime
- New scripts/validate-daily-digest-builder-sandbox-refactor.ts: 50-check validator
- Updated package.json, dashboard/daily-digest-build-readiness.json, docs

PILOT_BUILDER: src/reports/telegram-daily-digest.ts
- Imports buildSandboxRuntime, resolveBuilderPaths, assertNotProductionPath
- Production mode unchanged; sandbox mode routes writes to outputDir
- assertNotProductionPath guards production paths

SANDBOX_RUNTIME_CONFIG: scripts/daily-digest-sandbox-runtime.ts
- buildSandboxRuntime(argv): parse → config + resolved paths + validation
- resolveSandboxPaths(config): outputDir, digestMd, digestTelegram, statusJson, runId
- resolveBuilderPaths(config): unified resolver for sandbox/production
- No child_process, no exec, no network, no env read

PROTECTED_PATHS (rejected in sandbox mode):
- reports/daily-digest.md
- reports/telegram-digest.txt
- dashboard/status.json
- reports/daily/

REQUIRED_FLAGS (all must be present with --sandbox):
--sandbox --output-dir <reports/sandbox/daily-digest/<run_id>/outputs/> --no-collect --no-send --no-timer --no-production-write

READINESS_AFTER_REFACTOR:
- sandbox_interface_contract=true
- sandbox_runtime_config=true
- pilot_builder_refactored=true
- ready_for_sandbox_build=partial (other builders still hardcoded)

VALIDATION_RESULTS (14 suites, 540+ checks, all PASS):
✅ validate:daily-digest-builder-sandbox-refactor (50)
✅ validate:daily-digest-sandbox-interface (35)
✅ validate:daily-digest-sandbox-guards (46)
✅ audit:daily-digest-build-readiness (46)
✅ validate:daily-digest-build-readiness (46)
✅ validate:daily-digest-sandbox-manager (63)
✅ validate:daily-digest-build-sandbox-plan (37)
✅ validate:daily-digest-staged-plan (21)
✅ validate:daily-digest-stage-execution (30)
✅ validate:digest-freshness (16)
✅ validate:dashboard:policy:validate (35)
✅ validate:sanitizer-secret-completeness (36)
✅ validate:sanitizer-false-positives (25)
✅ validate:telegram-sanitizer (43)
✅ validate:project-report-send (11)

SMOKE_TEST_RESULT:
- GET /api/daily-digest/sandbox-interface: PASS (endpoint exists, read-only)
- GET /api/daily-digest/build-readiness: PASS (endpoint exists, read-only)
- dashboard/control.html: displays sandbox interface + readiness panels
- production_write_allowed=false in both contracts
- No builder executed, no model call, no media generation

MODEL_CALL_STATUS: NONE
GENERATED_MEDIA_STATUS: NONE

LIMITATIONS:
- Only pilot builder refactored; remaining builders have hardcoded production paths
- ready_for_sandbox_build stays partial until all builders refactored

NEXT_PHASE_PROPOSAL: 5C-2C-C5E — Sandbox Digest Build Execution (Pilot Only)
- Create sandbox run via daily-digest-sandbox-manager.ts
- Run pilot builder with sandbox flags
- Validate outputs exist and production paths untouched
- If successful, mark ready_for_sandbox_build=partial-pilot

Commit: 004adcb (pushed to master)
