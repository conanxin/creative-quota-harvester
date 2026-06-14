# Phase 5C-2C-C5D — Digest Builder Sandbox Refactor Report

## STATUS: ✅ COMPLETE

| Item | Value |
|------|-------|
| Phase | 5C-2C-C5D |
| Commit | 004adcb (pushed to master) |
| Previous | 60c52e6 (C5C confirmed) |
| ready_for_sandbox_build | **partial** |

---

## WHAT_CHANGED

1. **New** `scripts/daily-digest-sandbox-runtime.ts` — sandbox runtime config resolver (parse flags, resolve paths, guard production paths)
2. **Refactored** `src/reports/telegram-daily-digest.ts` — pilot builder now imports sandbox guards/runtime, routes writes to sandbox dir when `--sandbox` present
3. **New** `scripts/validate-daily-digest-builder-sandbox-refactor.ts` — 50-check refactor validator
4. **Updated** `package.json` — added `validate:daily-digest-builder-sandbox-refactor` script
5. **Updated** `dashboard/daily-digest-build-readiness.json` — added `sandbox_interface_contract=true`, `sandbox_runtime_config=true`, `pilot_builder_refactored=true`, `ready_for_sandbox_build` remains `partial`
6. **Updated** docs: `README.md`, `ROADMAP.md`, `PRIVATE_CONTROL_SERVER_RUNBOOK.md`

---

## PILOT_BUILDER

**File:** `src/reports/telegram-daily-digest.ts`

- Imports `buildSandboxRuntime`, `resolveBuilderPaths`, `assertNotProductionPath`
- Parses argv at start of `generateDigest()`
- Validates required flags; exits with error if missing
- Production mode: unchanged behavior (writes to `reports/daily-digest.md`, `reports/telegram-digest.txt`)
- Sandbox mode: routes writes to `outputDir`, asserts `assertNotProductionPath` before each write

---

## SANDBOX_RUNTIME_CONFIG

**File:** `scripts/daily-digest-sandbox-runtime.ts`

| Function | Purpose |
|----------|---------|
| `buildSandboxRuntime(argv)` | Parse argv → `{config, resolved, validation}` |
| `resolveSandboxPaths(config)` | Resolve `outputDir`, `digestMd`, `digestTelegram`, `statusJson`, `runId` |
| `getProductionPaths()` | Return standard production paths |
| `resolveBuilderPaths(config)` | Unified resolver: sandbox paths when `sandboxMode=true`, production otherwise |

Safety:
- No `child_process`, no `exec`, no `spawn`, no `fetch`, no `axios`
- No `.env` or `.control.local` reads
- No file writes, no builder execution, no model calls
- Reuses `daily-digest-sandbox-guards.ts`

---

## PROTECTED_PATH_GUARDS

Production paths rejected in sandbox mode by `assertNotProductionPath`:
- `reports/daily-digest.md`
- `reports/telegram-digest.txt`
- `dashboard/status.json`
- `reports/daily/`

Sandbox output must be under: `reports/sandbox/daily-digest/<run_id>/outputs/`

---

## REQUIRED_FLAGS

When `--sandbox` is used, all must be present:

```bash
--sandbox
--output-dir reports/sandbox/daily-digest/<run_id>/outputs/
--no-collect
--no-send
--no-timer
--no-production-write
```

---

## READINESS_AFTER_REFACTOR

`dashboard/daily-digest-build-readiness.json`:

| Field | Value |
|-------|-------|
| `phase` | `5C-2C-C5D` |
| `mode` | `sandbox_scaffold_refactored` |
| `sandbox_interface_contract` | `true` |
| `sandbox_runtime_config` | `true` |
| `pilot_builder_refactored` | `true` |
| `ready_for_sandbox_build` | `partial` |

`partial` because other builders (`build-dashboard-status.ts`, `build-daily-archive.ts`, etc.) still have hardcoded production paths.

---

## VALIDATION_RESULTS

All 14 suites PASS (540+ checks, 0 failures):

| Suite | Checks | Status |
|-------|--------|--------|
| validate:daily-digest-builder-sandbox-refactor | 50 | ✅ |
| validate:daily-digest-sandbox-interface | 35 | ✅ |
| validate:daily-digest-sandbox-guards | 46 | ✅ |
| audit:daily-digest-build-readiness | 46 | ✅ |
| validate:daily-digest-build-readiness | 46 | ✅ |
| validate:daily-digest-sandbox-manager | 63 | ✅ |
| validate:daily-digest-build-sandbox-plan | 37 | ✅ |
| validate:daily-digest-staged-plan | 21 | ✅ |
| validate:daily-digest-stage-execution | 30 | ✅ |
| validate:digest-freshness | 16 | ✅ |
| validate:dashboard:policy:validate | 35 | ✅ |
| validate:sanitizer-secret-completeness | 36 | ✅ |
| validate:sanitizer-false-positives | 25 | ✅ |
| validate:telegram-sanitizer | 43 | ✅ |
| validate:project-report-send | 11 | ✅ |

---

## SMOKE_TEST_RESULT

- `GET /api/daily-digest/sandbox-interface` — endpoint exists, serves contract JSON, no runner call
- `GET /api/daily-digest/build-readiness` — endpoint exists, serves readiness JSON, no runner call
- `dashboard/control.html` — displays sandbox interface panel + build readiness panel with warning banners
- `production_write_allowed=false` in both JSON contracts
- No builder executed during smoke test

---

## MODEL_CALL_STATUS: NONE

No model call. No media generation. No builder execution.

---

## LIMITATIONS

- Only pilot builder (`telegram-daily-digest.ts`) refactored
- Remaining builders still have hardcoded production paths
- `ready_for_sandbox_build` cannot become `yes` until all production-path builders are refactored or proven safe

---

## NEXT_PHASE_PROPOSAL

**Phase 5C-2C-C5E** — Sandbox Digest Build Execution (Pilot Only)

1. Create a sandbox run via `daily-digest-sandbox-manager.ts`
2. Run pilot builder with `--sandbox --output-dir <run_id>/outputs/ ...`
3. Validate sandbox outputs exist and production paths untouched
4. Compare sandbox output with production output (if available)
5. If pilot-only execution succeeds, mark `ready_for_sandbox_build=partial-pilot`
6. Remaining builders require individual refactor before full `yes`

