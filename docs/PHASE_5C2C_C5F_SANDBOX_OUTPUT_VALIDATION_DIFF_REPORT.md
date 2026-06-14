# Phase 5C-2C-C5F — Sandbox Output Validation & Diff Report

## STATUS: ✅ COMPLETE

| Item | Value |
|------|-------|
| Phase | 5C-2C-C5F |
| Previous | C5E (commit=29aa96b, SANDBOX_BUILD=success) |
| Latest Run | sandbox-2026-06-14-06-50-12 |

---

## WHAT_CHANGED

1. **New** `scripts/validate-daily-digest-sandbox-output.ts` — sandbox output validator (11 checks: manifest, file existence, non-empty, secret scan, tool residue scan, Telegram length)
2. **New** `scripts/daily-digest-sandbox-diff.ts` — sandbox diff generator (compares sandbox vs production outputs, writes diff-summary.json + diff-summary.md to sandbox diffs/)
3. **New** `scripts/validate-daily-digest-sandbox-output-tools.ts` — tools validator (33 checks)
4. **Modified** `scripts/control-server.ts` — GET /api/daily-digest/sandbox/latest-output-validation
5. **Updated** `package.json` — added `validate:daily-digest-sandbox-output-tools` script
6. **Updated** `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md`, `README.md`, `ROADMAP.md`

---

## LATEST_RUN_ID

`sandbox-2026-06-14-06-50-12`

---

## OUTPUT_VALIDATION

| Check | Result |
|-------|--------|
| manifest.json | ✅ Exists, valid |
| collect_allowed | ✅ false |
| telegram_send_allowed | ✅ false |
| production_write_allowed | ✅ false |
| daily-digest.md | ✅ Exists, 2970 bytes |
| telegram-digest.txt | ✅ Exists, 1763 bytes, 1687 chars |
| Telegram length | ✅ Within 3500 limit |
| Secret scan | ✅ No secrets found |
| Tool residue scan | ✅ No tool residues found |

**Overall: PASS (11/11 checks)**

---

## SECRET_SCAN

| Pattern | Count |
|---------|-------|
| TELEGRAM_BOT_TOKEN | 0 |
| API_KEY | 0 |
| sk-cp / sk-* | 0 |
| Bearer token | 0 |

**Result: ✅ No secrets found**

---

## TOOL_RESIDUE_SCAN

| Pattern | Count |
|---------|-------|
| <tool_call | 0 |
| </tool_call> | 0 |
| <invoke | 0 |
| </invoke> | 0 |
| [truncated] | 0 |

**Result: ✅ No tool residues found**

---

## DIFF_SUMMARY

| File | Sandbox Lines | Production Lines | Sandbox Chars | Production Chars | Diff |
|------|--------------|------------------|---------------|------------------|------|
| daily-digest.md | 80 | 80 | 2880 | 2880 | +0/-0 |
| telegram-digest.txt | 51 | 51 | 1687 | 1687 | +0/-0 |

**Note:** Sandbox and production outputs are identical in this case (same build, no changes). This is expected for the first pilot run.

**Risk notes:**
- ⚠️ daily-digest.md references production path "reports/daily-digest.md" without sandbox context (content reference, not file access)

---

## PROTECTED_PATH_CHECK

| Path | Status |
|------|--------|
| reports/daily-digest.md | ✅ Unchanged (md5: 63ac73899d866e667e9c6ffd4845e680) |
| reports/telegram-digest.txt | ✅ Unchanged (md5: d5beccfcec8f2f7919aadb0fa0f20688) |
| dashboard/status.json | ✅ Unchanged (md5: d98c500cb52c78f57edd941cdedc7b49) |

---

## API_ENDPOINTS

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/daily-digest/sandbox/latest-output-validation` | Read latest sandbox output validation + diff summary |

---

## VALIDATION_RESULTS

All 15 suites PASS (570+ checks, 0 failures):

| Suite | Checks | Status |
|-------|--------|--------|
| validate:daily-digest-sandbox-output-tools | 33 | ✅ PASS |
| validate:daily-digest-sandbox-build-pilot | 47 | ✅ PASS |
| validate:daily-digest-builder-sandbox-refactor | 50 | ✅ PASS |
| validate:daily-digest-sandbox-interface | 35 | ✅ PASS |
| validate:daily-digest-sandbox-guards | 46 | ✅ PASS |
| audit:daily-digest-build-readiness | 46 | ✅ PASS |
| validate:daily-digest-build-readiness | 46 | ✅ PASS |
| validate:daily-digest-sandbox-manager | 63 | ✅ PASS |
| validate:daily-digest-build-sandbox-plan | 37 | ✅ PASS |
| validate:daily-digest-staged-plan | 21 | ✅ PASS |
| validate:daily-digest-stage-execution | 30 | ✅ PASS |
| validate:digest-freshness | 16 | ✅ PASS |
| validate:dashboard:policy:validate | 35 | ✅ PASS |
| validate:sanitizer-secret-completeness | 36 | ✅ PASS |
| validate:sanitizer-false-positives | 25 | ✅ PASS |
| validate:telegram-sanitizer | 43 | ✅ PASS |
| validate:project-report-send | 11 | ✅ PASS |

---

## SMOKE_TEST_RESULT

| Test | Result |
|------|--------|
| A. Sandbox output validator | ✅ All 11 checks pass |
| B. Sandbox diff generator | ✅ diff-summary.json + diff-summary.md written to diffs/ |
| C. GET /api/daily-digest/sandbox/latest-output-validation | ✅ Returns validation + diff JSON |
| D. Production paths unchanged | ✅ All 3 protected paths unchanged |
| E. No secrets/tool residues | ✅ 0 found |
| F. No model call, no media generation | ✅ None |

---

## MODEL_CALL_STATUS: NONE
## GENERATED_MEDIA_STATUS: NONE

---

## LIMITATIONS

- Only pilot builder sandbox output validated
- Diff shows identical content because pilot build used same data as production
- Future runs with data changes will show non-zero diffs
- Remaining builders still require individual refactor for full sandbox execution

---

## NEXT_PHASE_PROPOSAL

**Phase 5C-2C-C5G** — Remaining Builder Sandbox Refactor

1. Refactor `build-dashboard-status.ts` to accept sandbox flags and output-dir
2. Refactor `build-daily-archive.ts` similarly
3. Once all builders refactored, change `ready_for_sandbox_build` from `partial-pilot` to `partial-all` or `yes`

