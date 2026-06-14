# PHASE_5C2C_C0_WORKFLOW_DRY_RUN_ORCHESTRATOR_REPORT.md

## STATUS

PASS ✅

Phase 5C-2C-C0: End-to-end Workflow Dry-run Orchestrator complete.
All validation scripts PASS. Smoke test PASS. No secrets leaked. No model calls. No media generated.
No real collect/send/timer/generate/git executed.

## WHAT_CHANGED

1. **Workflow Definitions**: Added `dashboard/control-workflows.json` with 3 workflows:
   - `daily_digest_dry_run`: 5 steps (2 safe, 3 blocked collect/send)
   - `asset_validation_sweep`: 6 steps (all safe validation)
   - `control_health_sweep`: 6 steps (all safe validation)

2. **Workflow Planner**: Added `scripts/control-workflow-planner.ts`:
   - Reads workflow definitions, catalog, and allowlist
   - Generates dry-run plans without executing commands
   - No child_process, no exec, no spawn, no network calls
   - Returns per-step risk assessment and blocked/allowed status

3. **API Endpoints**: Added to `control-server.ts`:
   - `GET /api/workflows`: List all workflows (read-only)
   - `POST /api/workflow/dry-run`: Generate dry-run plan for a workflow

4. **Control Catalog UI**: Updated `dashboard/control.html`:
   - Added Workflow Dry-run module with 3 workflow cards
   - Each workflow shows step count and simulate button
   - Simulation results show step-by-step status (✅ allowed, ❌ blocked)
   - Warning banner: "此阶段只模拟工作流，不执行 collect/send/generate/timer/git"

5. **Workflow Validator**: Added `scripts/validate-control-workflows.ts`:
   - 10 checks covering workflow safety, planner isolation, server routes, audit integrity

## WORKFLOWS

### daily_digest_dry_run (日常摘要干跑)
- 5 steps: collect_fast (blocked), run_manual_digest (blocked), validate_daily_archive (allowed), validate_dashboard (allowed), send_digest_confirmed (blocked)
- Risk: 3 danger, 2 safe
- Blocked categories: collect, send

### asset_validation_sweep (资产验证扫描)
- 6 steps: all validation commands (public-gallery, daily-archive, gallery-dedup, content-pack-pages, music-prompts, video-prompts)
- Risk: all safe
- Blocked categories: none (all validation)

### control_health_sweep (控制台健康扫描)
- 6 steps: all control validation commands (control-server, control-readonly-actions, control-actions-dry-run, control:drift-check, policy:validate, control-hardening)
- Risk: all safe
- Blocked categories: none (all validation)

## DRY_RUN_PLANNER

The planner (`scripts/control-workflow-planner.ts`):
- Reads `dashboard/control-workflows.json`, `dashboard/control-catalog.json`, `dashboard/control-execution-allowlist.json`
- For each step, checks if it's allowed for low-risk execution by:
  - Checking `risk_level === "safe"` and `would_execute === true`
  - Checking if `script_name` is in `allowed_scripts`
  - Checking if `script_name` or `action_id` matches any `blocked_patterns`
- Returns a plan with `real_execution: false` and per-step `allowed_for_low_risk_execution`

## API_ENDPOINTS

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workflows` | GET | List all workflows (read-only) |
| `/api/workflow/dry-run` | POST | Generate dry-run plan for a workflow (no execution) |

## BLOCKED_STEPS

In `daily_digest_dry_run`:
- `collect_fast` → blocked (collect category)
- `run_manual_digest` → blocked (send category)
- `send_digest_confirmed` → blocked (send category)

All workflows block `collect`, `send`, `generate`, `timer`, `git` categories by design.

## ALLOWED_LOW_RISK_STEPS

- `daily_digest_dry_run`: 2 steps (validate_daily_archive, validate_dashboard)
- `asset_validation_sweep`: 6 steps (all validation)
- `control_health_sweep`: 6 steps (all validation)

## AUDIT_LOG_STATUS

Audit log captures workflow dry-run attempts:
- `action_id: "workflow_dry_run"`
- `real_execution: false`
- `workflow_id`, `blocked_steps`, `allowed_low_risk_steps`
- No token recorded in audit log

## VALIDATION_RESULTS

| Script | Result |
|--------|--------|
| validate:control-workflows | PASS ✅ |
| validate:control-hardening | PASS ✅ |
| validate:control-low-risk-execution | PASS ✅ |
| validate:sanitizer-secret-completeness | PASS ✅ |
| validate:sanitizer-false-positives | PASS ✅ |
| validate:telegram-sanitizer | PASS ✅ |
| validate:project-report-send | PASS ✅ |
| validate:control-server | PASS ✅ |
| dashboard:policy:validate | PASS ✅ |
| validate:control-actions-dry-run | PASS ✅ |
| validate:control-readonly-actions | PASS ✅ |

## SMOKE_TEST_RESULT

- `/api/workflows` → 3 workflows listed
- `/api/workflow/dry-run` (daily_digest) → plan with 2 allowed, 3 blocked
- `/api/workflow/dry-run` (asset_validation) → plan with 6 allowed, 0 blocked
- `/api/workflow/dry-run` (control_health) → plan with 6 allowed, 0 blocked
- Audit log updated with workflow entries
- All responses have `real_execution: false`

## BLOCKED_ACTION_TESTS

- `collect_fast` → blocked (would_execute=false)
- `send_digest_confirmed` → blocked (would_execute=false)
- `generate_image_confirmed` → still blocked via allowlist
- All generate/send/timer/collect/git/build/deploy/release still blocked

## SANITIZER_REGRESSION_RESULTS

All 25 false-positive tests PASS. All 43 sanitizer tests PASS. No new false positives introduced.

## MODEL_CALL_STATUS

No model calls during this phase. Workflow planner does not call models.

## GENERATED_MEDIA_STATUS

No images, music, or videos generated during this phase.

## LIMITATIONS

1. Workflow planner is synchronous (no async operations).
2. Rate limits apply to workflow endpoints (5 per minute for POST).
3. Workflow definitions are static JSON (no dynamic workflow creation).
4. No real execution of workflow steps (only planning).

## NEXT_PHASE_PROPOSAL

Phase 5C-2C-C1: Selective Low-risk Workflow Execution
- Evaluate which validation workflows can be executed in sequence
- Maintain execution lock and rate limits across workflow steps
- Consider adding workflow execution confirmation (per-workflow confirmation phrase)
- Keep collect/send/generate/timer/git blocked until further evaluation

---
Report generated: 2026-06-14
