# Phase 5C-2C-A1: Policy Review Validation Fix

**Status:** PASS (34/34 policy validation, 19/19 dry-run, 21/21 readonly, 18/18 drift-check)
**Commit:** TBD  
**Push:** origin/master

## Root Cause

Phase 5C-2C-A introduced 5 `confirmed_low_risk` commands with `real_execution_supported=true`. This broke existing policy review infrastructure:

1. **build-policy-review.ts**: `execution_mode_counts` only tracked 3 modes (safe_readonly, dry_run_only, disabled). The 5 `confirmed_low_risk` commands were miscounted as `disabled`.
2. **validate-policy-review.ts**: Hardcoded `expectedNever = highDanger + disabled` was an approximation that didn't match catalog after introducing `confirmed_low_risk`. No validation for `confirmed_low_risk_enabled` commands.
3. **validate-control-actions-dry-run.ts**: Checked `all real_execution_supported=false` with no exception for canary.

## What Changed

### build-policy-review.ts
- Added `confirmed_low_risk` to `execution_mode_counts` (4 modes)
- Added `confirmed_low_risk_enabled` array with id/label/risk/confirmation_phrase
- Added `real_execution_supported_count` field
- Updated `future_execution_candidates` to exclude `confirmed_low_risk`
- Updated `never_execute` to NOT include `confirmed_low_risk`

### validate-policy-review.ts
- Added `real_execution_supported_count`, `confirmed_low_risk_count`, `confirmed_low_risk_enabled` to required fields
- Dynamic `expectedNever` calculation from control-catalog.json
- `confirmed_low_risk_count === 5` invariant check
- `confirmed_low_risk_enabled` validation (all safe, all have confirmation_phrase)
- `real_execution_supported=true` commands validation:
  - Must be in `control-execution-allowlist.json`
  - Must be `risk=safe`, `execution_mode=confirmed_low_risk`
  - Must have `calls_model=false`, `generates_media=false`, `modifies_timer=false`
- Updated `execution_mode_counts` sum to include `confirmed_low_risk`

### validate-control-actions-dry-run.ts
- Updated `real_execution_supported` check to allow 5 canary commands with `execution_mode=confirmed_low_risk`

### control-catalog.json + .generated.json
- Fixed `confirmation_phrase` for 5 canary commands from `"dry-run-safe"` to `"EXECUTE LOW RISK"`

## Policy Review Fix (Before → After)

```
Before: execution_mode_counts = { safe_readonly: 7, dry_run_only: 66, disabled: 6 }
After:  execution_mode_counts = { safe_readonly: 7, dry_run_only: 66, confirmed_low_risk: 5, disabled: 1 }

Before: never_execute = 8 commands (incorrect)
After:  never_execute = 3 commands (correct: 2 high + 1 disabled)

Before: future_execution_candidates = 71 (included 5 that were actually canary-enabled)
After:  future_execution_candidates = 71 (correct, excludes confirmed_low_risk)

Before: real_execution_supported_count = 0 (missing field)
After:  real_execution_supported_count = 5
```

## Confirmed Low-risk Count

| Field | Value |
|-------|-------|
| confirmed_low_risk_count | 5 |
| real_execution_supported_count | 5 |
| All safe risk level | ✅ |
| All have confirmation_phrase | ✅ |
| No model calls | ✅ |
| No media generation | ✅ |
| No timer modification | ✅ |

## Validation Results

| Validation | Result |
|------------|--------|
| `dashboard:control:generate` | PASS (79 commands, 72 scripts, 9 groups) |
| `dashboard:control:drift-check` | PASS (18/18) |
| `dashboard:policy:build` | PASS (79 cmds, 0 review, 71 future, 3 never) |
| `dashboard:policy:validate` | PASS (34/34) |
| `validate:control-server` | PASS (20/20) |
| `dashboard:control:validate` | PASS (15/15) |
| `validate:control-actions-dry-run` | PASS (19/19) |
| `validate:control-readonly-actions` | PASS (21/21) |

## Smoke Test

| Test | Result |
|------|--------|
| Health endpoint | PASS (phase=5C-2C-A, canary=true) |
| Policy review JSON | PASS (79 commands, 5 confirmed_low_risk) |
| Execute canary | PASS (exit_code=0, real_execution=true) |
| Execute blocked (generate_image_confirmed) | PASS (403 Forbidden) |
| Audit log token leak | PASS (0 leaks) |

## Blocked Action Tests

| Action | Status | Reason |
|--------|--------|--------|
| `generate_image_confirmed` | BLOCKED | execution_mode=dry_run_only |
| `collect_fresh` | BLOCKED | execution_mode=dry_run_only |
| `digest:send:confirmed` | BLOCKED | execution_mode=dry_run_only |
| `timer:*` | BLOCKED | modifies_timer=true |
| `deploy:*` | BLOCKED | execution_mode=disabled |

## Model Call / Media Generation

No model calls. No media generated during this phase.

## Limitations

1. `confirmation_phrase` for canary commands is reset to `"dry-run-safe"` when `dashboard:control:generate` runs. Manual fix applied after generation. Future: update generator to read policy rules.
2. `build` command has `execution_mode=disabled` but is not high/danger. Intentional (static generation, not for control UI execution).

## Next Phase Proposal

- **Phase 5C-2C-B**: Expand canary to `briefs`, `digest:telegram`, `daily:manual` (safe, no model/media/timer)
- **Phase 5C-5**: End-to-end execution test (`collect:fresh:fast` → `digest:telegram` → `digest:send:confirmed`) — requires separate risk assessment

**Phase 5C-2C-A1 COMPLETE**
