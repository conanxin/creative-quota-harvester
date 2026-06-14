# Phase 5C-2C-C5C Digest Builder Sandbox Interface Report

**Status:** COMPLETE ✅  
**Phase:** 5C-2C-C5C  
**Date:** 2026-06-14  
**Task:** Digest Builder Sandbox Interface Refactor Plan

---

## STATUS

COMPLETE. Sandbox interface contract defined, guard functions implemented, validators passing, smoke test verified. No digest build executed. No production paths modified.

---

## WHAT_CHANGED

### Files Created (C5C)

| File | Status | Description |
|------|--------|-------------|
| `dashboard/daily-digest-sandbox-interface.json` | ✅ Present | Interface contract JSON |
| `scripts/daily-digest-sandbox-guards.ts` | ✅ Present | Pure guard functions (no side effects) |
| `scripts/validate-daily-digest-sandbox-interface.ts` | ✅ Present | Interface validator (35 checks) |
| `scripts/validate-daily-digest-sandbox-guards.ts` | ✅ Present | Guards validator (46 checks) |
| `docs/PHASE_5C2C_C5C_DIGEST_BUILDER_SANDBOX_INTERFACE_REPORT.md` | ✅ Present | This report |
| `reports/digest-builder-sandbox-interface.md` | ✅ Present | Summary report |
| `reports/telegram-phase-5c2c-c5c-digest-builder-sandbox-interface.txt` | ✅ Present | Telegram report |

### Files Modified (C5C)

| File | Change | Description |
|------|--------|-------------|
| `package.json` | ✅ Added scripts | `validate:daily-digest-sandbox-interface`, `validate:daily-digest-sandbox-guards` |
| `scripts/control-server.ts` | ✅ Added endpoint | GET `/api/daily-digest/sandbox-interface` |
| `dashboard/control.html` | ✅ Added UI | Sandbox Interface Contract panel |
| `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` | ✅ Added section | C5C documentation |
| `README.md` | ✅ Updated | Phase C5C status |
| `ROADMAP.md` | ✅ Updated | Version v0.25.3 entry |

---

## BUILDERS_DETECTED

**From C5B readiness audit:** 62 builders detected in 118 files scanned.  
**Key builders requiring refactors:**
- `scripts/telegram-daily-digest.ts` — writes `reports/daily-digest.md`, `reports/telegram-digest.txt`
- `scripts/daily-manual.ts` — writes `reports/telegram-digest.txt`
- `scripts/build-dashboard-status.ts` — writes `dashboard/status.json`
- `scripts/send-telegram-digest.ts` — writes `reports/telegram-digest.txt`
- `scripts/check-telegram-digest.ts` — reads `reports/telegram-digest.txt`

---

## PRODUCTION_WRITE_RISKS

| Path | Risk | Status |
|------|------|--------|
| `reports/daily-digest.md` | ❌ blocked | `production_write_allowed=false` |
| `reports/telegram-digest.txt` | ❌ blocked | `production_write_allowed=false` |
| `dashboard/status.json` | ❌ blocked | `production_write_allowed=false` |
| `reports/daily/` | ❌ blocked | `production_write_allowed=false` |

---

## SANDBOX_SUPPORT

| Capability | Status |
|------------|--------|
| `--sandbox` flag | ✅ defined in interface |
| `--output-dir` parameter | ✅ defined in interface |
| `--no-collect` | ✅ defined in interface |
| `--no-send` | ✅ defined in interface |
| `--no-timer` | ✅ defined in interface |
| `--no-production-write` | ✅ defined in interface |
| `isSandboxPath()` | ✅ implemented in guards |
| `assertSandboxOutputPath()` | ✅ implemented in guards |
| `assertNotProductionPath()` | ✅ implemented in guards |
| `parseSandboxArgs()` | ✅ implemented in guards |
| `buildSandboxRuntimeConfig()` | ✅ implemented in guards |
| `validateSandboxFlags()` | ✅ implemented in guards |

---

## READY_FOR_SANDBOX_BUILD

**Status:** `partial` (unchanged from C5B)

The interface contract and guard functions are ready, but **builder implementations still need to be refactored** to:
1. Accept `--output-dir` parameter
2. Check `--sandbox` flag before writing
3. Disable collect/send/timer when sandbox mode is active
4. Use `assertNotProductionPath()` before any write operation

---

## REQUIRED_REFACTORS

### Phase 1: Interface Adoption (Next)
- Add `import { parseSandboxArgs, buildSandboxRuntimeConfig, assertNotProductionPath } from "../daily-digest-sandbox-guards"` to digest builders
- Add CLI arg parsing: `const args = parseSandboxArgs(process.argv.slice(2))`
- Add early guard check: `if (args.sandbox) assertNotProductionPath(outputPath)`
- Redirect output to `args.outputDir` when sandbox mode is active

### Phase 2: Collect/Send/Timer Disable
- Wrap collect logic with `if (!config.collectAllowed)`
- Wrap send logic with `if (!config.sendAllowed)`
- Wrap timer logic with `if (!config.timerAllowed)`

### Phase 3: Validation
- Run `npm run validate:daily-digest-sandbox-guards` after each refactor
- Re-run `npm run audit:daily-digest-build-readiness` to verify readiness improves

---

## API_ENDPOINTS

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/daily-digest/sandbox-interface` | GET | None | Read-only sandbox interface contract JSON |
| `/api/daily-digest/build-readiness` | GET | None | Read-only readiness audit JSON |
| `/api/daily-digest/sandbox-status` | GET | None | Read-only sandbox status |
| `/api/daily-digest/sandbox/create` | POST | Token + Confirmation | Creates sandbox run directory |

---

## VALIDATION_RESULTS

All 14 validation scripts PASS:

| Validation Script | Status | Details |
|-------------------|--------|---------|
| `validate:daily-digest-sandbox-interface` | ✅ PASS | 35/35 checks |
| `validate:daily-digest-sandbox-guards` | ✅ PASS | 46/46 checks |
| `validate:daily-digest-build-readiness` | ✅ PASS | 46/46 checks |
| `validate:daily-digest-sandbox-manager` | ✅ PASS | 63/63 checks |
| `validate:daily-digest-build-sandbox-plan` | ✅ PASS | 40/40 checks |
| `validate:daily-digest-staged-plan` | ✅ PASS | 21/21 checks |
| `validate:daily-digest-stage-execution` | ✅ PASS | 30/30 checks |
| `validate:control-hardening` | ✅ PASS | All hardening checks |
| `validate:control-low-risk-execution` | ✅ PASS | 176/176 checks |
| `dashboard:policy:validate` | ✅ PASS | 35/35 checks |
| `validate:sanitizer-secret-completeness` | ✅ PASS | 36/36 checks |
| `validate:sanitizer-false-positives` | ✅ PASS | 25/25 checks |
| `validate:telegram-sanitizer` | ✅ PASS | 43/43 checks |
| `validate:project-report-send` | ✅ PASS | 11/11 checks |

**Total: 14/14 PASS** (621+ checks)

---

## SMOKE_TEST_RESULT

| Test | Result | Detail |
|------|--------|--------|
| GET `/api/daily-digest/sandbox-interface` | ✅ PASS | Returns JSON with all required flags, protected paths, blocked side effects |
| Dashboard shows sandbox-interface panel | ✅ PASS | UI renders required flags, protected paths, allowed output, blocked effects |
| `production_write_allowed=false` | ✅ PASS | Contract explicitly blocks production writes |
| No builder executed | ✅ PASS | Only read-only endpoint called |
| No model call | ✅ PASS | No minimax/openai references in guards |
| No media generation | ✅ PASS | No generate-image/video/music in guards |

---

## MODEL_CALL_STATUS

**Status:** No model calls executed in this phase.
- Guards: pure functions, no API calls
- Interface: static JSON, no execution
- Validators: static analysis, no runtime execution

---

## GENERATED_MEDIA_STATUS

**Status:** No media generated.
- No images
- No videos
- No music

---

## LIMITATIONS

1. **Interface only** — Guard functions are ready but not yet integrated into actual builders
2. **Builder refactors pending** — 4+ builders need manual updates to adopt the sandbox contract
3. **No runtime enforcement** — Guards throw errors but rely on builders to call them
4. **Static analysis** — Readiness audit is keyword-based; dynamic behavior may differ

---

## NEXT_PHASE_PROPOSAL

**Phase 5C-2C-C5D: Sandbox Digest Build (Scaffolded Execution)**

- Select one builder (e.g., `telegram-daily-digest.ts`) to pilot the sandbox interface
- Add `parseSandboxArgs` + `buildSandboxRuntimeConfig` to the builder
- Add `--sandbox` and `--output-dir` CLI support
- Run builder in sandbox mode with output to `reports/sandbox/daily-digest/<run_id>/outputs/`
- Verify output is isolated, no production paths touched
- Compare sandbox output with production output via diff

---

*Report generated: 2026-06-14*  
*Phase: 5C-2C-C5C*  
*All validations: 14/14 PASS*  
*Smoke test: 6/6 PASS*
