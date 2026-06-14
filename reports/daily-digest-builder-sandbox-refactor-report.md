# Phase 5C-2C-C5D Report — Digest Builder Sandbox Refactor Implementation

**Date:** 2026-06-14 14:20 CST
**Commit:** 004adcb (pushed to master)
**Previous:** 60c52e6 (C5C confirmed on master)

---

## Preflight

- ✅ C5C commit `60c52e6` confirmed on `master`
- ✅ Git status: no tracked `.env`, `.control.local`, audit logs, or sandbox runtime dirs
- ✅ `.gitignore` excludes sandbox runtime outputs

---

## 1. Pilot Builder Located

**File:** `src/reports/telegram-daily-digest.ts`
- Generates `reports/daily-digest.md` and `reports/telegram-digest.txt`
- Reads signals DB, content packs, generated assets
- Most core / most straightforward to refactor

---

## 2. Sandbox Runtime Config Scaffold

**New file:** `scripts/daily-digest-sandbox-runtime.ts`

Exports:
- `buildSandboxRuntime(argv)` — parses flags, returns `{config, resolved, validation}`
- `resolveSandboxPaths(config)` — resolves output dir + per-file paths
- `getProductionPaths()` — returns standard production paths (fallback)
- `resolveBuilderPaths(config)` — unified resolver: sandbox paths when `sandboxMode=true`, production otherwise

Safety:
- No `child_process`, no `exec`, no `spawn`, no `fetch`, no `axios`
- No `.env` or `.control.local` reads
- No file writes, no builder execution, no model calls
- Reuses `daily-digest-sandbox-guards.ts` (`parseSandboxArgs`, `assertNotProductionPath`, etc.)

---

## 3. Pilot Builder Refactor

**File:** `src/reports/telegram-daily-digest.ts`

Changes:
- Imports `buildSandboxRuntime`, `resolveBuilderPaths`, `assertNotProductionPath`
- At start of `generateDigest()`: parses argv, validates required flags, exits if missing
- Replaces hardcoded `writeFileSync` paths with sandbox-aware branch:
  - `!paths.sandboxMode` → writes to production paths (default behavior unchanged)
  - `paths.sandboxMode` → asserts `assertNotProductionPath`, writes to `outputDir`
- Production default behavior **unchanged** when no `--sandbox` flag

---

## 4. Validation Script

**New file:** `scripts/validate-daily-digest-builder-sandbox-refactor.ts`

50 checks covering:
- runtime helper exists and exports correct functions
- runtime imports from `daily-digest-sandbox-guards`
- runtime safety: no `child_process`, no `exec`, no `spawn`, no network, no env reads
- runtime enforces sandbox output dir under `reports/sandbox/daily-digest/`
- runtime rejects production paths in sandbox mode
- runtime sets `collectAllowed=false`, `sendAllowed=false`, `timerAllowed=false`, `productionWriteAllowed=false` in sandbox
- pilot builder imports sandbox guards and runtime
- pilot builder uses `buildSandboxRuntime` and `resolveBuilderPaths`
- pilot builder checks `sandboxMode` before production writes
- pilot builder skips `writeFileSync` to production paths in sandbox mode
- pilot builder still has production default paths
- no token leaks in runtime, pilot, or validator
- `package.json` has new validate script

---

## 5. Readiness Auditor Updated

**File:** `dashboard/daily-digest-build-readiness.json`

Updated fields:
- `phase`: `"5C-2C-C5D"`
- `mode`: `"sandbox_scaffold_refactored"`
- `sandbox_interface_contract`: `true`
- `sandbox_runtime_config`: `true`
- `pilot_builder_refactored`: `true`
- `ready_for_sandbox_build`: `"partial"` (not optimistic — other builders still hardcoded)
- `required_refactors_before_sandbox_execution`: updated to reflect partial progress
- `safe_next_step`: points to running new validator and refactoring remaining builders

---

## 6. Validation Results (All PASS)

| Script | Checks | Result |
|--------|--------|--------|
| `validate:daily-digest-builder-sandbox-refactor` | 50 | ✅ PASS |
| `validate:daily-digest-sandbox-interface` | 35 | ✅ PASS |
| `validate:daily-digest-sandbox-guards` | 46 | ✅ PASS |
| `audit:daily-digest-build-readiness` | 46 | ✅ PASS |
| `validate:daily-digest-build-readiness` | 46 | ✅ PASS |
| `validate:daily-digest-sandbox-manager` | 63 | ✅ PASS |
| `validate:daily-digest-build-sandbox-plan` | 37 | ✅ PASS |
| `validate:daily-digest-staged-plan` | 21 | ✅ PASS |
| `validate:daily-digest-stage-execution` | 30 | ✅ PASS |
| `validate:digest-freshness` | 16 | ✅ PASS |
| `validate:dashboard:policy:validate` | 35 | ✅ PASS |
| `validate:sanitizer-secret-completeness` | 36 | ✅ PASS |
| `validate:sanitizer-false-positives` | 25 | ✅ PASS |
| `validate:telegram-sanitizer` | 43 | ✅ PASS |
| `validate:project-report-send` | 11 | ✅ PASS |

**Total: 540+ checks, 0 failures.**

---

## 7. Smoke Test (Static Verification)

- `GET /api/daily-digest/sandbox-interface` — endpoint exists in `control-server.ts`, serves `dashboard/daily-digest-sandbox-interface.json`
- `GET /api/daily-digest/build-readiness` — endpoint exists, serves `dashboard/daily-digest-build-readiness.json`
- `dashboard/control.html` — contains `sandbox-interface-panel` and `build-readiness-panel`, both fetch respective APIs and display warning banners
- `production_write_allowed=false` in interface contract and readiness JSON
- No builder executed during smoke test
- No model call, no media generation

---

## 8. Documentation Updates

- `README.md` — added Phase 5C-2C-C5D row
- `ROADMAP.md` — added version 0.25.1 entry with C5D description
- `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` — added full C5D section with runtime API, usage example, validation commands, and file list

---

## Summary

Sandbox runtime scaffold and pilot builder refactor are complete. All 14 validation suites pass. `ready_for_sandbox_build` remains `partial` because other builders (`build-dashboard-status.ts`, `build-daily-archive.ts`, etc.) still have hardcoded production paths. Next phase (C5E) would require refactoring remaining builders or enabling sandbox execution for the pilot only.

**No production writes. No data collection. No Telegram send. No timer modification. No model call. No media generation.**

**Commit:** `004adcb` on `master` (pushed to origin).
