# Auto-generated Control Catalog Report

**Status:** ✅ COMPLETE
**Phase:** 5C-3
**Date:** 2026-06-13

---

## What Changed

Phase 5C-3 auto-generates the control catalog from `package.json` scripts using `dashboard/control-policy.json`. This eliminates manual drift between package scripts and the catalog.

### New Files
- `dashboard/control-policy.json` — policy-driven risk classification (68 rules)
- `scripts/generate-control-catalog.ts` — catalog generator
- `scripts/validate-control-catalog-generated.ts` — drift checker
- `dashboard/control-catalog.generated.json` — auto-generated catalog (70 commands)

### Updated Files
- `dashboard/control-catalog.json` — merged final catalog (77 commands: 70 auto + 7 manual)
- `dashboard/control.html` — source tags, needs_policy_review badge, filtering
- `scripts/control-server.ts` — serves new catalog with metadata
- `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` — Phase 5C-3 section
- `README.md` / `ROADMAP.md` — Phase 5C-3 marked COMPLETE

### New npm Scripts
- `npm run dashboard:control:generate` — regenerate catalog
- `npm run dashboard:control:drift-check` — validate all scripts covered

---

## Generated Catalog Status

- **Total commands:** 77
- **Auto-generated:** 70 (from package.json scripts)
- **Manual safe-readonly:** 7 (from Phase 5C-2B)
- **Source tags:** `package-script` (70) + `manual` (7)
- **Needs review:** 1 (build command, matched default policy)

## Risk Classification

| Risk | Count | Mode | Examples |
|------|-------|------|----------|
| safe | 62 | dry_run_only / safe_readonly | validate, diagnose, check |
| medium | 13 | dry_run_only | collect, build, archive |
| high | 2 | dry_run_only | generate:image:confirmed |
| danger | 0 | disabled | N/A |

All commands have `real_execution_supported=false`. High commands require `requires_confirm=true`.

## Drift Check Result

```
PASS: 18  FAIL: 0
```

All 70 package.json scripts are mapped by policy rules. No drift.

## Validation Results

| Validator | Result |
|-----------|--------|
| dashboard:control:generate | PASS |
| dashboard:control:drift-check | PASS |
| validate:control-server | PASS |
| dashboard:control:validate | PASS |
| validate:control-actions-dry-run | PASS |
| validate:control-readonly-actions | PASS |

**6/6 PASS**

## Smoke Test Result

- Server started on 127.0.0.1:8788
- Catalog API readable
- UI shows package-script tags and needs_policy_review badges
- Dry-run with wrong confirm phrase → blocked (real_execution=false)
- **Smoke test: PASS**

## Model Call Status

❌ No model calls made. No image/video/music generation.

## Limitations

1. 1 command (build) needs policy review — matched default policy, no specific rule.
2. Timer commands are execution_mode=disabled (safer than danger).
3. No real execution yet — catalog generation only.

## Next Phases

- **Phase 5C-2C** — Confirmed low-risk command execution
- **Phase 5C-4** — Policy review UI
- **Phase 4J** — Audio coupling

---

*Report: reports/auto-generated-control-catalog.md*
