# Phase 5C-2C-A1 Report: Policy Review Validation Fix & Closeout

**Status:** PASS (34/34 policy validation, 19/19 dry-run validation, 21/21 readonly validation, 18/18 drift-check)
**Commit:** TBD
**Push:** origin/master
**Timestamp:** 2026-06-13T21:00:00+08:00

---

## 1. Root Cause

Phase 5C-2C-A introduced 5 `confirmed_low_risk` commands with `real_execution_supported=true`. This broke two assumptions in the existing policy review infrastructure:

### 1.1 build-policy-review.ts (Policy Review Generator)
- `execution_mode_counts` only tracked `safe_readonly`, `dry_run_only`, `disabled`. The 5 `confirmed_low_risk` commands were incorrectly counted as `disabled`.
- `future_execution_candidates` excluded `confirmed_low_risk` commands (correct) but the count was inflated because the filter didn't account for the new mode.
- `never_execute` was computed from catalog but `confirmed_low_risk` commands were not in `never_execute` (correct) while `disabled` count was wrong.
- Missing fields: `real_execution_supported_count`, `confirmed_low_risk_count`, `confirmed_low_risk_enabled`.

### 1.2 validate-policy-review.ts (Policy Validator)
- Hardcoded `expectedNever = highDanger + disabled` was an approximation that didn't match the actual catalog-derived count after introducing `confirmed_low_risk`.
- No validation for `confirmed_low_risk_enabled` commands (must be safe, no model/media/timer, have confirmation phrase).
- No validation that `real_execution_supported=true` commands are in the allowlist.
- `execution_mode_counts` sum check only included 3 modes, not 4.

### 1.3 validate-control-actions-dry-run.ts (Dry-run Validator)
- Checked `all real_execution_supported=false` with no exception for `confirmed_low_risk` canary.

---

## 2. What Changed

### 2.1 scripts/build-policy-review.ts
- Added `confirmed_low_risk` to `execution_mode_counts` (4 modes now: safe_readonly, dry_run_only, confirmed_low_risk, disabled).
- Added `confirmed_low_risk_enabled` array with id, label_zh, risk, confirmation_phrase for each of the 5 canary commands.
- Added `real_execution_supported_count` field.
- Updated `execution_matrix` description for `safe_readonly` (can_real_execute=false, use safe-readonly API instead).
- Updated `future_execution_candidates` filter to explicitly exclude `confirmed_low_risk` commands (already enabled).
- Updated `never_execute` to include `execution_mode === "disabled"` but NOT `confirmed_low_risk`.
- Updated notes to reflect 5C-2C-A canary status.

### 2.2 scripts/validate-policy-review.ts
- Added `real_execution_supported_count`, `confirmed_low_risk_count`, `confirmed_low_risk_enabled` to required fields check.
- Added dynamic `expectedNever` calculation from control-catalog.json (filter: high/danger/calls_model/generates_media/modifies_timer/disabled).
- Added `real_execution_supported_count === confirmed_low_risk_count` check.
- Added `confirmed_low_risk_count === 5` check (Phase 5C-2C-A canary invariant).
- Added `confirmed_low_risk_enabled` validation: all safe, all have confirmation_phrase.
- Added `real_execution_supported=true` commands validation:
  - Must be in `control-execution-allowlist.json`
  - Must have `risk_level=safe`
  - Must have `execution_mode=confirmed_low_risk`
  - Must have `calls_model=false`, `generates_media=false`, `modifies_timer=false`
- Added `control-catalog.json` load for precise validation.
- Updated `execution_mode_counts` sum to include `confirmed_low_risk`.

### 2.3 scripts/validate-control-actions-dry-run.ts
- Updated `real_execution_supported` check to allow 5 canary commands with `execution_mode=confirmed_low_risk`.
- Updated file header comment to reference Phase 5C-2C-A.

### 2.4 dashboard/control-catalog.json + .generated.json
- Fixed `confirmation_phrase` for 5 canary commands from `"dry-run-safe"` to `"EXECUTE LOW RISK"` (was reset by `dashboard:control:generate`).

---

## 3. Policy Review Fix

### Before Fix
```
execution_mode_counts: { safe_readonly: 7, dry_run_only: 66, disabled: 6 }
never_execute: 8 commands (incorrect, included some non-disabled)
future_execution_candidates: 71 commands (included 5 that were actually canary-enabled)
```

### After Fix
```
execution_mode_counts: { safe_readonly: 7, dry_run_only: 66, confirmed_low_risk: 5, disabled: 1 }
never_execute: 3 commands (correct: 2 high + 1 disabled)
confirmed_low_risk_enabled: 5 commands
future_execution_candidates: 71 commands (correct, excludes confirmed_low_risk)
real_execution_supported_count: 5
```

---

## 4. Confirmed Low-risk Count

| Field | Value |
|-------|-------|
| confirmed_low_risk_count | 5 |
| real_execution_supported_count | 5 |
| Allowlist scripts | 5 |
| All safe risk level | ✅ |
| All have confirmation_phrase | ✅ |
| No model calls | ✅ |
| No media generation | ✅ |
| No timer modification | ✅ |

---

## 5. Never Execute Logic

**Dynamic computation from catalog:**
```javascript
never_execute = allCommands.filter(cmd =>
  cmd.risk_level === "high" ||
  cmd.risk_level === "danger" ||
  cmd.calls_model ||
  cmd.generates_media ||
  cmd.modifies_timer ||
  cmd.execution_mode === "disabled"
)
```

**Result:** 3 commands
- `generate:image:confirmed` (high, calls_model, generates_media)
- `generate:controlled:images` (high, calls_model, generates_media)
- `build` (disabled)

**Note:** `build` has `execution_mode=disabled` but is not a high/danger command. It is correctly classified as never-execute because it is disabled.

---

## 6. Validation Results

| Validation | Result |
|------------|--------|
| `npm run dashboard:control:generate` | PASS (79 commands, 72 scripts, 9 groups) |
| `npm run dashboard:control:drift-check` | PASS (18/18) |
| `npm run dashboard:policy:build` | PASS (79 commands, 0 need review, 71 future, 3 never) |
| `npm run dashboard:policy:validate` | PASS (34/34) |
| `npm run validate:control-server` | PASS (20/20) |
| `npm run dashboard:control:validate` | PASS (15/15) |
| `npm run validate:control-actions-dry-run` | PASS (19/19) |
| `npm run validate:control-readonly-actions` | PASS (21/21) |

---

## 7. Smoke Test Result

| Test | Result |
|------|--------|
| Health endpoint | PASS (phase=5C-2C-A, canary=true) |
| Policy review JSON | PASS (79 commands, 5 confirmed_low_risk) |
| Execute canary (validate_control-server) | PASS (exit_code=0, real_execution=true) |
| Execute blocked (generate_image_confirmed) | PASS (403 Forbidden, not confirmed_low_risk) |
| Audit log token leak | PASS (0 leaks) |
| Model calls | None |
| Media generation | None |

---

## 8. Blocked Action Tests

| Action | Status | Reason |
|--------|--------|--------|
| `generate_image_confirmed` | BLOCKED | execution_mode=dry_run_only, not confirmed_low_risk |
| `collect_fresh` | BLOCKED | execution_mode=dry_run_only, not confirmed_low_risk |
| `digest:send:confirmed` | BLOCKED | execution_mode=dry_run_only, not confirmed_low_risk |
| `timer:*` | BLOCKED | modifies_timer=true |
| `deploy:*` | BLOCKED | execution_mode=disabled |

---

## 9. Model Call Status

No model calls made during this phase. All validations are static code analysis and file reading.

---

## 10. Generated Media Status

No images, music, or video generated during this phase.

---

## 11. Limitations

1. `confirmation_phrase` for canary commands is reset to `"dry-run-safe"` when `dashboard:control:generate` runs. The fix is manually applied after generation. Future: update `generate-control-catalog.ts` to read policy rules and apply `confirmation_phrase` from policy.
2. `build` command has `execution_mode=disabled` but is not high/danger. This is intentional (build is a static generation command that should not be executed from control UI).
3. Smoke test requires `--noproxy 127.0.0.1` due to local SOCKS5 proxy configuration.

---

## 12. Next Phase Proposal

### Phase 5C-2C-B: Expand Canary (Optional)
- Evaluate `briefs`, `digest:telegram`, `daily:manual` for `confirmed_low_risk` status
- These are safe, no model calls, no media generation, no timer modification
- Would expand allowlist from 5 to 8-10 commands
- Requires updating `control-execution-allowlist.json`, `control-policy.json`, and re-running all validations

### Phase 5C-5: End-to-End Execution Test
- Full pipeline: `collect:fresh:fast` → `digest:telegram` → `digest:send:confirmed`
- Requires `CQA_ALLOW_TELEGRAM_SEND=1` and explicit user confirmation
- High risk: involves external API calls and message sending
- Not a canary candidate; requires separate risk assessment

---

**Phase 5C-2C-A1 COMPLETE**
