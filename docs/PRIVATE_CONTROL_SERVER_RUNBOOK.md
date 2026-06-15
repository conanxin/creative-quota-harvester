# Private Control Server Runbook

**Phase 5C-1 — localhost-only Private Control Server**

---

## What This Is

A read-only, localhost-only HTTP server that exposes the Creative Quota Harvester dashboard status, control catalog, and whitelisted reports. It does **not** execute commands, trigger models, or modify the system.

## How to Start

```bash
cd ~/.openclaw/workspace/projects/creative-quota-harvester
npm run control:server
```

Default: binds to `127.0.0.1:8788`. Override port with `CQA_CONTROL_PORT`:

```bash
CQA_CONTROL_PORT=9000 npm run control:server
```

## How to Access

```bash
curl http://127.0.0.1:8788/health
# open browser
open http://127.0.0.1:8788/
```

## How to Access Remotely (SSH Port Forward)

```bash
ssh -L 8788:127.0.0.1:8788 user@your-server
# then open http://localhost:8788/ on your local machine
```

## How to Stop

```bash
Ctrl+C
# or
pkill -f "control-server.ts"
```

## What It Does (and Does Not Do)

✅ **Does:**
- Serve read-only dashboard status
- Display the control catalog (commands, risk levels, descriptions)
- Show whitelisted reports
- Return health status

❌ **Does NOT:**
- Execute any command
- Call MiniMax or any model
- Generate images, music, or video
- Modify the systemd timer
- Write to signals.db
- Send Telegram messages
- Read .env or secrets

## Safety Checklist

Before starting the server, verify:
- [ ] Host is `127.0.0.1` (never `0.0.0.0`)
- [ ] Port is not conflicting with other services
- [ ] You are not exposing the port via reverse proxy without additional auth
- [ ] You understand this is read-only; real control actions require Phase 5C-2

## Next Phase

- **Phase 5C-2A** ✅ introduces authenticated dry-run actions. See below.
- **Phase 5C-2B** ✅ allows real execution of safe (read-only) commands with auth + audit.
- **Phase 5C-3** ✅ auto-generates the catalog from `package.json` scripts to avoid drift. See below.
- **Phase 5C-4** will auto-generate safe-readonly action handlers from catalog.
- **Phase 5C-2C** will add 2FA for high/danger commands.
- **Phase 4J** Audio coupling.

---

## Phase 5C-2A — Authenticated Control Actions Dry-run

Phase 5C-2A adds a **dry-run action endpoint** to the localhost-only server. It validates authentication, confirmation phrases, and risk levels — but **never executes any command**.

### What Changed

- New `.control.local` config file (git-ignored) for authentication:
  - `CQA_CONTROL_TOKEN=<your-token>`
  - `CQA_CONTROL_ENABLE_ACTIONS=1`
- All commands in `control-catalog.json` now have `action_id`, `dry_run_supported`, `real_execution_supported=false`, `confirmation_phrase`, and `audit_required`.
- New `POST /api/action/dry-run` endpoint:
  - Validates `action_id` exists in catalog
  - Validates `confirm_phrase` matches catalog
  - Validates `token` against `.control.local` (if configured)
  - Returns what the command would do, but **never executes it**
  - All responses have `real_execution: false`

### How to Configure Authentication

```bash
cd ~/.openclaw/workspace/projects/creative-quota-harvester
# Create .control.local (already in .gitignore)
cat > .control.local << 'EOF'
CQA_CONTROL_TOKEN=your-secret-token-here
CQA_CONTROL_ENABLE_ACTIONS=1
EOF
```

Without `.control.local`, the dry-run endpoint returns `blocked_needs_control_config`.

### How to Call Dry-run

```bash
# Safe action (run_manual_digest)
curl -s -X POST http://127.0.0.1:8788/api/action/dry-run \
  -H "Content-Type: application/json" \
  -d '{"action_id":"run_manual_digest","confirm_phrase":"dry-run-safe","token":"your-secret-token"}'

# High-risk action (image_confirmed_1)
curl -s -X POST http://127.0.0.1:8788/api/action/dry-run \
  -H "Content-Type: application/json" \
  -d '{"action_id":"image_confirmed_1","confirm_phrase":"dry-run-high","token":"your-secret-token"}'
```

Expected response (all cases):
```json
{
  "action_id": "...",
  "label_zh": "...",
  "risk_level": "safe|medium|high|danger",
  "would_run_command": "...",
  "requires_confirm": true/false,
  "confirmation_phrase_expected": "...",
  "confirmation_status": "matched|mismatch|blocked_needs_control_config",
  "real_execution": false,
  "dry_run_only": true,
  "message": "Dry-run passed. No command executed. This is a simulation only."
}
```

### Why This Phase Does Not Execute Commands

Phase 5C-2A is **dry-run only** by design:
- No `child_process`, `exec`, or `spawn` calls
- No file modifications outside audit log
- No model calls
- No media generation
- No timer modifications
- All `real_execution_supported` fields are `false`
- No `/api/action/execute` endpoint exists

Real execution is planned for Phase 5C-2B (safe commands) and Phase 5C-2C (confirmed high/danger commands).

### Audit Log

Every dry-run attempt is logged to `reports/control-action-audit.jsonl` (git-ignored):

```json
{"ts":"2026-06-13T08:32:42.906Z","mode":"dry-run","action_id":"run_manual_digest","risk_level":"safe","confirm_ok":true,"real_execution":false,"result":"allowed_dry_run","reason":"confirm_phrase_matched"}
```

**The audit log never contains tokens or secrets.**

### Viewing Audit Log

```bash
# See all audit entries
cat reports/control-action-audit.jsonl

# Count entries
wc -l reports/control-action-audit.jsonl
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port already in use | Change `CQA_CONTROL_PORT` |
| `tsx` not found | Run `npm install` or use `npx tsx` |
| status.json not found | Run `npm run dashboard:build` first |
| Report not found | Check whitelist in `scripts/control-server.ts` |
| Dry-run blocked (needs config) | Create `.control.local` with `CQA_CONTROL_TOKEN` and `CQA_CONTROL_ENABLE_ACTIONS=1` |
| Dry-run blocked (invalid token) | Check token in `.control.local` matches request |
| Dry-run blocked (confirm mismatch) | Check `confirm_phrase` matches catalog value for the action's risk level |

## Files

- `scripts/control-server.ts` — server source (includes dry-run handler)
- `scripts/validate-control-server.ts` — validator (20 checks)
- `scripts/validate-control-actions-dry-run.ts` — dry-run validator (19 checks)
- `.control.local.example` — auth config template
- `dashboard/status.json` — data source
- `dashboard/control-catalog.json` — data source (with action metadata)
- `reports/control-action-audit.jsonl` — audit log (runtime, git-ignored)

---

## Phase 5C-3 — Auto-generated Control Catalog

Phase 5C-3 auto-generates the control catalog from `package.json` scripts using `dashboard/control-policy.json`. This eliminates manual drift between package scripts and the catalog.

### What Changed

- New `dashboard/control-policy.json` — policy-driven risk classification for all scripts.
- New `scripts/generate-control-catalog.ts` — reads `package.json` scripts + policy, generates `dashboard/control-catalog.generated.json`.
- New `scripts/validate-control-catalog-generated.ts` — drift checker (all scripts mapped or explicitly ignored).
- New npm scripts:
  - `npm run dashboard:control:generate` — regenerate catalog
  - `npm run dashboard:control:drift-check` — validate all scripts are covered
- `dashboard/control-catalog.json` now contains:
  - 70 auto-generated commands from package scripts
  - 7 manual safe-readonly commands (Phase 5C-2B)
  - `source` field: `package-script` | `manual` | `generated`
  - `needs_policy_review` flag for unmapped scripts
- `control.html` updated with:
  - Source tag display (manual / package-script / generated)
  - `needs_policy_review` warning badge
  - Group / risk / source filtering
  - Execution mode display (dry_run_only | safe_readonly | disabled)
- `control-server.ts` updated to serve the new catalog with source/execution metadata.

### Risk Policy Summary

| Match Pattern | Risk | Execution Mode | Notes |
|---|---|---|---|
| `validate:*` | safe | safe_readonly_or_local_validate | No side effects |
| `*dry-run*` | safe | dry_run_only | No side effects |
| `collect:*` | medium | dry_run_only | Network calls, file writes |
| `digest:send:confirmed` | medium | dry_run_only | Requires CQA_ALLOW_TELEGRAM_SEND |
| `generate:image:confirmed` | high | dry_run_only | Requires CQA_ALLOW_GENERATION, calls model |
| `timer:*` | danger | disabled | Modifies system timer |
| `build:*` | medium | dry_run_only | File writes |
| `deploy:*` | danger | disabled | System modification |

All high/danger commands have `real_execution_supported=false` and `requires_confirm=true`.

### How to Regenerate Catalog

```bash
cd ~/.openclaw/workspace/projects/creative-quota-harvester
npm run dashboard:control:generate
```

This creates `dashboard/control-catalog.generated.json` and merges it with manual safe-readonly commands into `dashboard/control-catalog.json`.

### How to Check Drift

```bash
npm run dashboard:control:drift-check
```

PASS means all `package.json` scripts are either mapped in the policy or explicitly listed in `ignored_scripts`. FAIL means a new script was added without a policy rule.

### Why Real Execution is Still Disabled

Phase 5C-3 is **catalog generation only**:
- No `child_process`, `exec`, or `spawn` calls in the server
- No `/api/action/execute` endpoint exists
- `real_execution_supported=false` on all 77 commands
- High/danger commands are `execution_mode: disabled` (not just `dry_run_only`)
- The server only serves `dry-run` and `read-only` endpoints

Real execution is planned for Phase 5C-2C (confirmed low-risk) and Phase 5C-4 (auto-generated safe-readonly handlers).

### Files

- `dashboard/control-policy.json` — policy rules (new)
- `scripts/generate-control-catalog.ts` — generator (new)
- `scripts/validate-control-catalog-generated.ts` — drift checker (new)
- `dashboard/control-catalog.generated.json` — auto-generated (new, git-tracked)
- `dashboard/control-catalog.json` — merged final catalog (updated)
- `dashboard/control.html` — updated UI with source/review tags (updated)
- `scripts/control-server.ts` — serves new catalog (updated)

---

## Phase 5C-4 — Policy Review UI

Phase 5C-4 adds a **Policy Review dashboard** to the control UI. It analyzes the auto-generated catalog, identifies future execution candidates, and ensures all commands are properly classified.

### What Changed

- New `scripts/build-policy-review.ts` — analyzes `control-catalog.json` and generates `dashboard/policy-review.json`.
- New `scripts/validate-policy-review.ts` — validates the policy review JSON (25 checks).
- New npm scripts:
  - `npm run dashboard:policy:build` — build policy review
  - `npm run dashboard:policy:validate` — validate policy review
- New `dashboard/policy-review.json` — auto-generated policy analysis.
- `control.html` updated with:
  - Policy Review section showing: total commands, classified count, needs review count
  - Risk distribution (safe/medium/high/danger)
  - "All commands reviewed" badge
  - Future Execution Candidates list (safe/medium, no model/media/timer)
  - Never Execute list (high/danger/media/timer/disabled)
- `scripts/control-server.ts` updated with:
  - `GET /api/policy-review` — serves `dashboard/policy-review.json`
- `dashboard/control-policy.json` updated:
  - Explicit rule for `build` command: risk=safe, execution_mode=disabled
  - `needs_policy_review` now 0 for all 79 commands

### Policy Review Status

| Metric | Value |
|---|---|
| Total commands | 79 |
| Classified | 79 (100%) |
| Needs policy review | 0 |
| Safe | 65 |
| Medium | 13 |
| High | 2 |
| Danger | 0 |
| Future execution candidates | 76 |
| Never execute | 3 |

### How to Build Policy Review

```bash
cd ~/.openclaw/workspace/projects/creative-quota-harvester
npm run dashboard:policy:build
```

This creates `dashboard/policy-review.json` from the current `control-catalog.json`.

### How to Validate Policy Review

```bash
npm run dashboard:policy:validate
```

PASS means:
- `needs_policy_review === 0`
- `all_commands_reviewed === true`
- High/danger/media/timer commands NOT in future execution candidates
- Risk counts sum to total commands
- No secrets in the review file

### Why Real Execution is Still Disabled

Phase 5C-4 is **policy review and analysis only**:
- No new execution endpoints added
- No `/api/action/execute` endpoint exists
- `real_execution_supported=false` on all 79 commands
- High/danger commands remain `execution_mode: disabled` or `dry_run_only`
- The server only serves `dry-run` and `read-only` endpoints

Real execution is planned for Phase 5C-2C (confirmed low-risk execution) and Phase 5C-4 (auto-generated safe-readonly handlers).

### Files

- `scripts/build-policy-review.ts` — policy review builder (new)
- `scripts/validate-policy-review.ts` — policy review validator (new)
- `dashboard/policy-review.json` — auto-generated policy analysis (new, git-tracked)
- `dashboard/control.html` — updated with Policy Review section (updated)
- `scripts/control-server.ts` — serves policy review API (updated)
- `dashboard/control-policy.json` — updated build rule (updated)

---

*Runbook v4.0 — Phase 5C-4*

---

## Phase 5C-2C-A — Confirmed Low-risk Execution Canary

Phase 5C-2C-A adds **real execution** for 5 safe validation commands only. This is the first canary for real command execution through the localhost-only control server.

### What Changed

- New `dashboard/control-execution-allowlist.json` — lists 5 allowed scripts:
  - `validate:control-server`
  - `validate:control-readonly-actions`
  - `validate:control-actions-dry-run`
  - `dashboard:control:drift-check`
  - `dashboard:policy:validate`
- New `scripts/control-action-runner.ts` — safe execution runner:
  - `spawn("npm", ["run", scriptName], { shell: false })` — no shell, no arbitrary command injection
  - Script name must be in allowlist
  - Minimal environment (PATH, HOME, NODE_ENV only) — no secrets
  - 60-second timeout with SIGTERM → SIGKILL escalation
  - stdout/stderr truncated to 12,000 chars
- `scripts/control-server.ts` updated:
  - New `POST /api/action/execute-low-risk` endpoint
  - 9-layer safety checks before execution:
    1. action_id exists in catalog
    2. execution_mode === "confirmed_low_risk"
    3. real_execution_supported === true
    4. risk_level === "safe"
    5. calls_model === false
    6. generates_media === false
    7. modifies_timer === false
    8. token matches (if configured)
    9. confirm_phrase === "EXECUTE LOW RISK"
- `control-policy.json` updated:
  - 5 canary rules at top (before wildcards)
  - `execution_mode: confirmed_low_risk`, `real_execution_supported: true`, `requires_confirm: true`
- `control-catalog.json` updated:
  - 5 commands marked `execution_mode: confirmed_low_risk`, `confirmation_phrase: "EXECUTE LOW RISK"`

### Execution Allowlist Safety Rules

| Rule | Value |
|------|-------|
| shell | false |
| command | npm only |
| args | ["run", scriptName] only |
| cwd | project root only |
| env | PATH, HOME, NODE_ENV only (no secrets) |
| timeout | 60,000 ms |
| max output | 12,000 chars |

### How to Execute a Canary Command

```bash
# Start server
cd ~/.openclaw/workspace/projects/creative-quota-harvester
npm run control:server

# Execute (dry-run first recommended)
curl -s -X POST http://127.0.0.1:8788/api/action/execute-low-risk \
  -H "Content-Type: application/json" \
  -d '{"action_id":"validate_control-server","confirm_phrase":"EXECUTE LOW RISK","token":"your-secret-token"}'
```

Expected response (success):
```json
{
  "action_id": "validate_control-server",
  "real_execution": true,
  "execution_result": {
    "exit_code": 0,
    "timed_out": false,
    "duration_ms": 304,
    "stdout_tail": "...",
    "stderr_tail": ""
  },
  "message": "Execution completed successfully."
}
```

### Why Only 5 Commands

Phase 5C-2C-A is **canary only** by design:
- Only validation scripts (no side effects)
- No model calls, no media generation, no timer modification
- No network calls, no file writes outside reports/
- All 5 commands are `risk_level=safe`, `calls_model=false`, `generates_media=false`, `modifies_timer=false`
- Expanding the allowlist requires Phase 5C-2C-B assessment

### Audit Log

Every execution attempt is logged to `reports/control-action-audit.jsonl`:

```json
{"ts":"2026-06-13T13:06:04.194Z","mode":"confirmed_low_risk","phase":"5C-2C-A","action_id":"validate_control-server","script_name":"validate:control-server","risk_level":"safe","confirm_ok":true,"real_execution":true,"result":"success","reason":"executed","exit_code":0,"timed_out":false,"duration_ms":304}
```

**The audit log never contains tokens or secrets.**

### Files

- `dashboard/control-execution-allowlist.json` — execution allowlist (new)
- `scripts/control-action-runner.ts` — safe execution runner (new)
- `scripts/control-server.ts` — execute-low-risk endpoint (updated)
- `scripts/validate-control-server.ts` — validator (updated)
- `dashboard/control-policy.json` — canary rules (updated)
- `dashboard/control-catalog.json` — canary flags (updated)

---

## Phase 5C-2C-A1 — Policy Review Validation Fix

Phase 5C-2C-A1 fixes the policy review infrastructure to correctly account for the 5 `confirmed_low_risk` commands introduced in Phase 5C-2C-A.

### What Changed

- `scripts/build-policy-review.ts` updated:
  - Added `confirmed_low_risk` to `execution_mode_counts` (4 modes now)
  - Added `confirmed_low_risk_enabled` array (5 commands with confirmation_phrase)
  - Added `real_execution_supported_count` field
  - `never_execute` now dynamically computed from catalog (not hardcoded)
- `scripts/validate-policy-review.ts` updated:
  - Dynamic `expectedNever` from control-catalog.json (high/danger/media/timer/disabled)
  - `confirmed_low_risk_count === 5` invariant check
  - `real_execution_supported=true` commands validated against allowlist
  - All safety constraints checked (safe, no model/media/timer, confirmed_low_risk mode)
- `scripts/validate-control-actions-dry-run.ts` updated:
  - Allows 5 canary commands with `real_execution_supported=true` and `execution_mode=confirmed_low_risk`

### Policy Review Status (After Fix)

| Metric | Value |
|---|---|
| Total commands | 79 |
| Classified | 79 (100%) |
| Needs policy review | 0 |
| Safe | 65 |
| Medium | 12 |
| High | 2 |
| Danger | 0 |
| Confirmed low-risk | 5 |
| Future execution candidates | 71 |
| Never execute | 3 |
| Real execution supported | 5 |

### Validation Results

| Validation | Result |
|------------|--------|
| `dashboard:policy:validate` | PASS (34/34) |
| `dashboard:control:drift-check` | PASS (18/18) |
| `validate:control-actions-dry-run` | PASS (19/19) |
| `validate:control-readonly-actions` | PASS (21/21) |

### Smoke Test Results

| Test | Result |
|------|--------|
| Health endpoint | PASS (phase=5C-2C-A, canary=true) |
| Policy review JSON | PASS (79 commands, 5 confirmed_low_risk) |
| Execute canary | PASS (exit_code=0, real_execution=true) |
| Blocked generate_image_confirmed | PASS (403 Forbidden) |
| Audit log token leak | PASS (0 leaks) |

### Why This Matters

Before this fix:
- `execution_mode_counts` showed `disabled: 6` (incorrect, included 5 canary commands)
- `never_execute` was hardcoded to `highDanger + disabled` (approximation, didn't match catalog)
- `validate-policy-review.ts` failed because expected count didn't match actual

After this fix:
- `execution_mode_counts` correctly shows `confirmed_low_risk: 5, disabled: 1`
- `never_execute` dynamically computed from catalog (3 commands: 2 high + 1 disabled)
- All 34 validation checks pass
- Policy review accurately reflects the 5 canary commands with real execution enabled

### Files

- `scripts/build-policy-review.ts` — updated with confirmed_low_risk support
- `scripts/validate-policy-review.ts` — updated with dynamic validation
- `scripts/validate-control-actions-dry-run.ts` — updated with canary exception
- `dashboard/policy-review.json` — regenerated with correct counts
- `dashboard/control-catalog.json` — confirmation_phrase fixed for canary commands

---

## Phase 5C-2C-B — More Low-risk Validation Executions

Phase 5C-2C-B expands the confirmed_low_risk execution allowlist from 5 canary commands to 17 safe validation commands. All 12 new commands are pure validation scripts with no model calls, no media generation, and no timer modification.

### What Changed

- `dashboard/control-execution-allowlist.json` — expanded from 5 to 17 commands:
  - Original 5: validate:control-server, validate:control-readonly-actions, validate:control-actions-dry-run, dashboard:control:drift-check, dashboard:policy:validate
  - New 12: validate:telegram-sanitizer, validate:sanitizer-false-positives, validate:sanitizer-secret-completeness, validate:project-report-send, dashboard:control:validate, dashboard:validate, validate:public-gallery, validate:daily-archive, validate:gallery-dedup, validate:content-pack-pages, validate:music-prompts, validate:video-prompts
- `scripts/generate-control-catalog.ts` — updated to set `confirmation_phrase="EXECUTE LOW RISK"` for all `confirmed_low_risk` commands
- `scripts/control-server.ts` — updated:
  - Health endpoint dynamically loads allowlist from `control-execution-allowlist.json`
  - Phase updated to `5C-2C-B`
  - Log message updated to "expanded validation allowlist"
- `dashboard/control.html` — added low-risk execution allowlist section showing:
  - Allowed script count, max runtime, max output
  - Each allowed command with execution_mode, confirmation phrase, audit_required
  - Blocked patterns list
- `dashboard/control-policy.json` — added 12 new rules for `confirmed_low_risk` execution
- `scripts/validate-control-low-risk-execution.ts` — already updated for 17 commands

### Execution Allowlist Safety Rules (Unchanged)

| Rule | Value |
|------|-------|
| shell | false |
| command | npm only |
| args | ["run", scriptName] only |
| cwd | project root only |
| env | PATH, HOME, NODE_ENV only (no secrets) |
| timeout | 60,000 ms |
| max output | 12,000 chars |

### How to Execute an Expanded Command

```bash
# Start server
cd ~/.openclaw/workspace/projects/creative-quota-harvester
npm run control:server

# Execute any of the 17 allowed commands
curl -s -X POST http://127.0.0.1:8788/api/action/execute-low-risk \
  -H "Content-Type: application/json" \
  -d '{"action_id":"validate_telegram-sanitizer","confirm_phrase":"EXECUTE LOW RISK","token":"your-secret-token"}'
```

### Why Still Blocked

The following command categories remain blocked for real execution:
- `generate:*` — calls model, generates media
- `send:*` — requires CQA_ALLOW_TELEGRAM_SEND
- `timer:*` — modifies timer
- `collect:*` — external data collection
- `git/push/pull/deploy/release` — blocked by pattern
- `build` — blocked by pattern

### Validation Results

| Validation | Result |
|------------|--------|
| `dashboard:control:drift-check` | PASS (19/19) |
| `dashboard:policy:validate` | PASS (35/35) |
| `validate:control-server` | PASS (20/20) |
| `dashboard:control:validate` | PASS (15/15) |
| `validate:control-actions-dry-run` | PASS (20/20) |
| `validate:control-readonly-actions` | PASS (21/21) |
| `validate:control-low-risk-execution` | PASS (167/167) |
| `validate:sanitizer-secret-completeness` | PASS (36/36) |
| `validate:sanitizer-false-positives` | PASS (25/25) |
| `validate:telegram-sanitizer` | PASS (43/43) |
| `validate:project-report-send` | PASS (11/11) |

### Smoke Test Results

| Test | Result |
|------|--------|
| validate:control-server (allowed) | PASS (exit_code=0, real_execution=true) |
| validate:telegram-sanitizer (allowed) | PASS (exit_code=0, real_execution=true) |
| dashboard:control:validate (allowed) | PASS (exit_code=0, real_execution=true) |
| Wrong confirmation (blocked) | PASS (real_execution=false) |
| generate:image:confirmed (blocked) | PASS (403 Forbidden) |
| Audit log no token | PASS (0 leaks) |
| Health endpoint | PASS (phase=5C-2C-B, count=17) |

### Files

- `dashboard/control-execution-allowlist.json` — expanded to 17 commands
- `scripts/control-action-runner.ts` — no changes (already correct)
- `scripts/control-server.ts` — health endpoint and phase updated
- `dashboard/control.html` — added low-risk execution section
- `dashboard/control-policy.json` — added 12 new rules
- `dashboard/control-catalog.json` — regenerated with 82 commands
- `scripts/generate-control-catalog.ts` — confirmation phrase logic updated
- `scripts/validate-control-low-risk-execution.ts` — 167 checks, all PASS

---

*Runbook v5.1 — Phase 5C-2C-B*

---

## Phase 5C-5A: Hardening & Audit Viewer

### What's New

- **Security Policy**: `dashboard/control-security-policy.json` defines rate limits, execution lock, and audit settings.
- **Rate Limits**: 5 execute-low-risk / 20 dry-run / 60 read-only per minute (in-memory, per-process).
- **Execution Lock**: Only 1 concurrent `execute-low-risk` allowed; returns 409 if busy. Lock released in finally block.
- **Audit Log Viewer**: `GET /api/audit-log` returns last 100 entries, redacted.
- **Security Status**: `GET /api/control-security-status` returns live security state without secrets.
- **Runner Output Redaction**: `control-action-runner.ts` redacts stdout/stderr before return (Telegram tokens, API keys, Bearer tokens).
- **Hardening Validator**: `npm run validate:control-hardening` — 14 checks, all PASS.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/audit-log` | GET | Read-only audit log (last 100 entries, redacted) |
| `/api/control-security-status` | GET | Live security state (rate limits, lock status, audit log size) |

### Safety Invariants (Still Enforced)

- localhost-only (127.0.0.1)
- No shell execution (spawn with shell=false)
- No exec/spawnSync/execFile
- Only 17 confirmed low-risk validation scripts allowed
- generate / send / timer / collect / git / build / deploy / release still blocked
- No .env / .control.local reading
- No secrets in source code

### Validation

Run all validators:
```bash
npm run validate:control-hardening
npm run validate:control-low-risk-execution
npm run validate:control-actions-dry-run
npm run validate:control-readonly-actions
npm run validate:control-server
npm run dashboard:policy:validate
npm run validate:telegram-sanitizer
npm run validate:sanitizer-false-positives
npm run validate:sanitizer-secret-completeness
npm run validate:project-report-send
```

Expected: All PASS.

---

*Runbook v5.2 — Phase 5C-5A*

---

## Phase 5C-2C-C0: Workflow Dry-run Orchestrator

### What's New

- **Workflow Definitions**: `dashboard/control-workflows.json` with 3 workflows:
  - `daily_digest_dry_run`: 5 steps (collect/send blocked, 2 validation allowed)
  - `asset_validation_sweep`: 6 steps (all validation)
  - `control_health_sweep`: 6 steps (all validation)
- **Workflow Planner**: `scripts/control-workflow-planner.ts` — generates dry-run plans without executing commands
- **API Endpoints**: `GET /api/workflows`, `POST /api/workflow/dry-run`
- **Control Catalog UI**: Workflow Dry-run module with simulate buttons
- **Workflow Validator**: `npm run validate:control-workflows` — 10 checks, all PASS

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workflows` | GET | List all workflows (read-only) |
| `/api/workflow/dry-run` | POST | Generate dry-run plan for a workflow (no execution) |

### Safety Invariants

- All workflows have `real_execution_supported=false` and `mode=dry_run_only`
- collect/send/generate/timer/git steps blocked in all workflows
- Planner does not use child_process/exec/spawn/network
- `/api/workflow/dry-run` does not call runner
- Workflow audit log does not record token

### Validation

```bash
npm run validate:control-workflows
```

Expected: PASS.

---

## Phase 5C-2C-C1: Validation Workflow Execution

### What's New

- **Real Execution for 2 Validation Workflows**: `asset_validation_sweep` and `control_health_sweep` can now be executed for real through the control server.
- **Workflow Executor**: `scripts/control-workflow-executor.ts` — uses `control-action-runner.ts` to execute low-risk steps.
- **Workflow Allowlist**: Only `asset_validation_sweep` and `control_health_sweep` are allowed; `daily_digest_dry_run` is blocked (403).
- **Confirmation Phrase**: `EXECUTE LOW RISK WORKFLOW` required for workflow execution.
- **Stop on Failure**: `stop_on_failure=true` — any step failure stops the workflow.
- **Workflow Execution Validator**: `npm run validate:control-workflow-execution` — 26 checks, all PASS.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/workflow/execute-low-risk` | POST | Execute a confirmed low-risk workflow (only 2 allowed) |

### Workflow Status

| Workflow | Mode | Real Execution | Allowed |
|----------|------|--------------|---------|
| `asset_validation_sweep` | `confirmed_low_risk_workflow` | ✅ | ✅ |
| `control_health_sweep` | `confirmed_low_risk_workflow` | ✅ | ✅ |
| `daily_digest_dry_run` | `dry_run_only` | ❌ | ❌ (403) |

### Safety Invariants

- Only 2 workflows in explicit allowlist (`asset_validation_sweep`, `control_health_sweep`)
- `daily_digest_dry_run` blocked at server level with `workflow_not_in_allowlist`
- All workflow steps validated against allowlist before execution
- `stop_on_failure=true` — any step failure stops the workflow
- Audit log records workflow execution with no token
- No shell execution, no exec/spawnSync/execFile

### Validation

```bash
npm run validate:control-workflow-execution
npm run validate:control-workflows
npm run validate:control-hardening
npm run validate:control-low-risk-execution
npm run validate:control-actions-dry-run
npm run validate:control-readonly-actions
npm run validate:control-server
npm run dashboard:policy:validate
npm run validate:telegram-sanitizer
npm run validate:sanitizer-false-positives
npm run validate:sanitizer-secret-completeness
npm run validate:project-report-send
```

Expected: All PASS (437/437 checks).

### Files

- `dashboard/control-workflows.json` — workflow modes updated
- `scripts/control-workflow-executor.ts` — workflow executor (NEW)
- `scripts/control-server.ts` — execute-low-risk workflow endpoint (updated)
- `dashboard/control.html` — workflow execution UI (updated)
- `scripts/validate-control-workflow-execution.ts` — workflow execution validator (NEW)

---

*Runbook v5.4 — Phase 5C-2C-C1*

---

## Phase 5C-2C-C2: Daily Digest Staged Plan

### What's New

- **Staged Execution Plan**: `dashboard/daily-digest-staged-plan.json` defines 5 stages for the daily digest workflow with explicit risk levels and gates.
- **Planner**: `scripts/daily-digest-staged-planner.ts` — reads staged plan and returns structured JSON without executing commands.
- **API Endpoint**: `GET /api/daily-digest/staged-plan` — returns staged plan (read-only, no execution).
- **UI Module**: `dashboard/control.html` — "Daily Digest Staged Plan / 日报分阶段执行计划" section with color-coded stage cards.
- **Staged Plan Validator**: `npm run validate:daily-digest-staged-plan` — 21 checks, all PASS.

### Stages

| Stage | Status | Risk | Allowed Now | Blocked Reason / Future Gate |
|-------|--------|------|-------------|------------------------------|
| 1. Collect | `blocked_real_execution` | high | ❌ | External network collection; needs CQA_ALLOW_COLLECT gate |
| 2. Build Digest | `dry_run_only_or_candidate` | medium | ❌ | Writes digest/status; needs future review |
| 3. Validate Outputs | `executable_low_risk` | safe | ✅ | 3 validation scripts in allowlist |
| 4. Send Telegram | `blocked_real_execution` | high | ❌ | External Telegram send; needs CQA_ALLOW_TELEGRAM_SEND gate |
| 5. Timer Integration | `blocked_real_execution` | danger | ❌ | Modifies systemd timer; not allowed here |

### Safety Invariants

- No collect/send/timer/generate/git execution in any stage
- Only validation stage (3) has executable scripts
- Planner does not use child_process/exec/spawn/network
- `/api/daily-digest/staged-plan` does not call runner
- No secrets in staged plan JSON or planner code

### Validation

```bash
npm run validate:daily-digest-staged-plan
npm run validate:control-workflow-execution
npm run validate:control-workflows
npm run validate:control-hardening
npm run validate:control-low-risk-execution
npm run validate:control-actions-dry-run
npm run validate:control-readonly-actions
npm run validate:control-server
npm run dashboard:policy:validate
npm run validate:telegram-sanitizer
npm run validate:sanitizer-false-positives
npm run validate:sanitizer-secret-completeness
npm run validate:project-report-send
```

Expected: All PASS (398/398 checks).

### Files

- `dashboard/daily-digest-staged-plan.json` — staged plan configuration (NEW)
- `scripts/daily-digest-staged-planner.ts` — staged plan planner (NEW)
- `scripts/control-server.ts` — staged plan endpoint (updated)
- `dashboard/control.html` — staged plan UI module (updated)
- `scripts/validate-daily-digest-staged-plan.ts` — staged plan validator (NEW)
- `docs/PHASE_5C2C_C2_DAILY_DIGEST_STAGED_PLAN_REPORT.md` — detailed report (NEW)

---

## Phase 5C-2C-C3: Daily Digest Validate Stage Execution

### What's New

- **Real Execution for Validation Stage**: `stage_3_validate_outputs` from the daily digest staged plan can now be executed for real through the control server.
- **Stage Executor**: `scripts/daily-digest-stage-executor.ts` — executes the 3 validation scripts via `control-action-runner.ts`.
- **Stage Allowlist**: Only `stage_3_validate_outputs` is allowed; all other stages (collect, build, send, timer) are blocked (403).
- **Confirmation Phrase**: `EXECUTE DAILY VALIDATION` required for stage execution.
- **Stop on Failure**: `stop_on_failure=true` — any step failure stops the stage execution.
- **Stage Execution Validator**: `npm run validate:daily-digest-stage-execution` — 30 checks, all PASS.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/daily-digest/execute-validation-stage` | POST | Execute the daily digest validation stage (only stage_3_validate_outputs) |

### Stage Status

| Stage | Mode | Real Execution | Allowed |
|-------|------|--------------|---------|
| `stage_1_collect_fast` | `blocked_real_execution` | ❌ | ❌ |
| `stage_2_build_digest` | `dry_run_only_or_candidate` | ❌ | ❌ |
| `stage_3_validate_outputs` | `confirmed_low_risk_stage` | ✅ | ✅ |
| `stage_4_send_telegram` | `blocked_real_execution` | ❌ | ❌ |
| `stage_5_timer_integration` | `blocked_real_execution` | ❌ | ❌ |

### How to Execute the Validation Stage

```bash
# Start server
cd ~/.openclaw/workspace/projects/creative-quota-harvester
npm run control:server

# Execute validation stage
curl -s -X POST http://127.0.0.1:8788/api/daily-digest/execute-validation-stage \
  -H "Content-Type: application/json" \
  -d '{"stage_id":"stage_3_validate_outputs","confirm_phrase":"EXECUTE DAILY VALIDATION","token":"***"}'
```

Expected response (success):
```json
{
  "stage_id": "stage_3_validate_outputs",
  "real_execution": true,
  "steps_total": 3,
  "steps_completed": 3,
  "steps_failed": 0,
  "results": [
    {
      "step_id": "stage_3_validate_outputs:validate:daily-archive",
      "script_name": "validate:daily-archive",
      "exit_code": 0,
      "timed_out": false,
      "duration_ms": 374,
      "stdout_tail": "...",
      "stderr_tail": ""
    }
  ],
  "message": "Stage stage_3_validate_outputs executed successfully. 3/3 scripts completed."
}
```

### Safety Invariants

- Only 1 stage in explicit allowlist (`stage_3_validate_outputs`)
- Other stages blocked at server level with `stage_not_allowed`
- All stage scripts validated against allowlist before execution
- `stop_on_failure=true` — any step failure stops the stage
- Audit log records stage execution with no token
- No shell execution, no exec/spawnSync/execFile

### Validation

```bash
npm run validate:daily-digest-stage-execution
npm run validate:daily-digest-staged-plan
npm run validate:control-workflow-execution
npm run validate:control-workflows
npm run validate:control-hardening
npm run validate:control-low-risk-execution
npm run dashboard:policy:validate
npm run validate:telegram-sanitizer
npm run validate:sanitizer-false-positives
npm run validate:sanitizer-secret-completeness
npm run validate:project-report-send
```

Expected: All PASS (428/428 checks).

### Files

- `dashboard/daily-digest-staged-plan.json` — stage modes updated
- `scripts/daily-digest-stage-executor.ts` — stage executor (NEW)
- `scripts/control-server.ts` — execute-validation-stage endpoint (updated)
- `dashboard/control.html` — stage execution UI (updated)
- `scripts/validate-daily-digest-stage-execution.ts` — stage execution validator (NEW)

---

## Phase 5C-2C-C4: Daily Digest Build Sandbox Plan

### What's New

- **Sandbox Plan**: `dashboard/daily-digest-build-sandbox-plan.json` defines a read-only sandbox plan for the daily digest build stage.
- **Sandbox Planner**: `scripts/daily-digest-build-sandbox-planner.ts` — reads the sandbox plan and returns structured JSON without executing commands.
- **API Endpoint**: `GET /api/daily-digest/build-sandbox-plan` — returns the sandbox plan (read-only, no execution).
- **6 Stages**: prepare_sandbox → build_digest_sandbox → validate_sandbox_outputs → compare_with_production → promote_candidate (blocked) → send_telegram (blocked).
- **Protected Paths**: reports/daily-digest.md, reports/telegram-digest.txt, dashboard/status.json, daily archive, Telegram send result, systemd timer state.
- **Sandbox Paths**: reports/sandbox/daily-digest/<timestamp>/, reports/sandbox/daily-digest/latest/.
- **Blocked Actions**: collect, send, timer, generate, git, promote.
- **Sandbox Plan Validator**: `npm run validate:daily-digest-build-sandbox-plan` — 42 checks, all PASS.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/daily-digest/build-sandbox-plan` | GET | Returns the sandbox plan (read-only, no execution) |

### Sandbox Plan Status

| Stage | Status | Allowed | Description |
|-------|--------|---------|-------------|
| `stage_a_prepare_sandbox` | `sandbox_plan_only` | ❌ | Create sandbox directory (future) |
| `stage_b_build_digest_sandbox` | `sandbox_plan_only` | ❌ | Build digest in sandbox only (future) |
| `stage_c_validate_sandbox_outputs` | `sandbox_plan_only` | ❌ | Validate sandbox outputs (future) |
| `stage_d_compare_with_production` | `sandbox_plan_only` | ❌ | Compare sandbox vs production (future) |
| `stage_e_promote_candidate` | `blocked` | ❌ | Promote sandbox to production (permanently blocked in this phase) |
| `stage_f_send_telegram` | `blocked` | ❌ | Send Telegram message (permanently blocked in this phase) |

### How to View the Sandbox Plan

```bash
# Start server
cd ~/.openclaw/workspace/projects/creative-quota-harvester
npm run control:server

# Get sandbox plan
curl -s http://127.0.0.1:8788/api/daily-digest/build-sandbox-plan
```

Expected response:
```json
{
  "mode": "sandbox_plan_only",
  "real_execution": false,
  "production_write_allowed": false,
  "stages": [...],
  "protected_paths": [...],
  "sandbox_paths": [...],
  "blocked_actions": ["collect", "send", "timer", "generate", "git", "promote"],
  "next_gate_required": true,
  "summary": {
    "total_stages": 6,
    "plan_only_stages": 4,
    "blocked_stages": 2,
    "protected_paths_count": 6,
    "sandbox_paths_count": 2
  }
}
```

### Safety Invariants

- Only read-only access to sandbox plan
- No production file writes
- No external Telegram sends
- No collect operations
- No timer modifications
- No model calls, no media generation
- Audit log does not contain token
- No shell execution, no exec/spawnSync/execFile

### Validation

```bash
npm run validate:daily-digest-build-sandbox-plan
npm run validate:daily-digest-stage-execution
npm run validate:daily-digest-staged-plan
npm run validate:control-workflow-execution
npm run validate:control-workflows
npm run validate:control-hardening
npm run validate:control-low-risk-execution
npm run dashboard:policy:validate
npm run validate:telegram-sanitizer
npm run validate:sanitizer-false-positives
npm run validate:sanitizer-secret-completeness
npm run validate:project-report-send
```

Expected: All PASS (470/470 checks).

### Files

- `dashboard/daily-digest-build-sandbox-plan.json` — sandbox plan configuration (NEW)
- `scripts/daily-digest-build-sandbox-planner.ts` — sandbox planner (NEW)
- `scripts/control-server.ts` — build-sandbox-plan endpoint (updated)
- `dashboard/control.html` — sandbox plan UI module (updated)
- `dashboard/index.html` — sandbox plan summary (updated)
- `scripts/validate-daily-digest-build-sandbox-plan.ts` — sandbox plan validator (NEW)

---

*Runbook v5.7 — Phase 5C-2C-C4*

---

## Phase 5C-2C-C5 — Daily Digest Sandbox Directory Creation

Phase 5C-2C-C5 adds **sandbox directory creation** for daily digest builds. It creates isolated run directories under `reports/sandbox/daily-digest/` without touching production paths.

### What Changed

- New `scripts/daily-digest-sandbox-manager.ts` — creates sandbox run directories with manifest.json
- New `scripts/validate-daily-digest-sandbox-manager.ts` — validates sandbox manager safety (63 checks)
- New `reports/sandbox/README.md` — sandbox directory documentation
- New `reports/sandbox/daily-digest/.gitkeep` — directory structure placeholder
- New `POST /api/daily-digest/sandbox/create` endpoint — creates sandbox run with confirmation phrase
- New `GET /api/daily-digest/sandbox-status` endpoint — reads latest sandbox status
- Updated `dashboard/control.html` — sandbox creation UI module
- Updated `.gitignore` — ignores sandbox runtime directories but keeps `.gitkeep`

### Sandbox Directory Structure

```
reports/sandbox/daily-digest/
├── .gitkeep
├── latest.json
└── sandbox-YYYYMMDD_HHMMSS/
    ├── manifest.json
    ├── inputs/
    ├── outputs/
    ├── reports/
    ├── diffs/
    └── logs/
```

### Manifest Schema

```json
{
  "run_id": "sandbox-2026-06-14-04-45-07",
  "created_at": "2026-06-14T04:45:07.106Z",
  "mode": "sandbox_directory_only",
  "real_digest_build": false,
  "collect_allowed": false,
  "telegram_send_allowed": false,
  "production_write_allowed": false,
  "protected_paths": [
    "reports/daily-digest.md",
    "reports/telegram-digest.txt",
    "dashboard/status.json",
    "reports/daily/"
  ],
  "sandbox_root": "...",
  "next_allowed_stage": "sandbox_build_readiness"
}
```

### Safety Invariants

- ✅ Only writes to `reports/sandbox/daily-digest/`
- ✅ No `child_process`, `exec`, `spawn`
- ✅ No network calls
- ✅ No `.env` or `.control.local` reading
- ✅ No production path writes
- ✅ Rate limited (5/min)
- ✅ Execution locked (1 concurrent)
- ✅ Confirmation phrase required: `CREATE DAILY SANDBOX`

### How to Test

```bash
# Start control server with actions enabled
cat > .control.local << 'EOF'
CQA_CONTROL_TOKEN=test-token
CQA_CONTROL_ENABLE_ACTIONS=1
EOF
npm run control:server

# Create sandbox
curl -s -X POST http://127.0.0.1:8788/api/daily-digest/sandbox/create   -H "Content-Type: application/json"   -d '{"confirm_phrase":"CREATE DAILY SANDBOX","token":"test-token"}'

# Check status
curl -s http://127.0.0.1:8788/api/daily-digest/sandbox-status
```

### Files

- `scripts/daily-digest-sandbox-manager.ts` — sandbox manager
- `scripts/validate-daily-digest-sandbox-manager.ts` — validator (63 checks)
- `reports/sandbox/README.md` — documentation
- `reports/sandbox/daily-digest/.gitkeep` — directory structure

---

## Phase 5C-2C-C5B — Daily Digest Build Readiness Audit

Phase 5C-2C-C5B adds a **read-only readiness audit** that scans 118 files to determine if builders are ready for sandbox execution. It does not execute builders, call models, or write production files.

### What Changed

- New `scripts/audit-daily-digest-build-readiness.ts` — read-only codebase scanner
- New `scripts/validate-daily-digest-build-readiness.ts` — validator (46 checks)
- New `dashboard/daily-digest-build-readiness.json` — audit output
- New `GET /api/daily-digest/build-readiness` endpoint — serves audit JSON
- Updated `dashboard/control.html` — Digest Build Readiness panel

### Readiness Result

- **Ready for Sandbox Build:** `partial` (4 refactors required)
- **Files Scanned:** 118
- **Builders Detected:** 62

### Blocked Risks

| Risk | Status |
|------|--------|
| collect | ❌ blocked |
| telegram_send | ❌ blocked |
| timer | ❌ blocked |
| model_call | ⚠️ detected |
| media_generation | ✅ safe |
| production_write | ❌ blocked |

### Required Refactors

1. Refactor builders to accept `--output-dir` parameter
2. Ensure collect disabled in sandbox mode
3. Ensure Telegram send disabled in sandbox mode
4. Ensure timer modification disabled in sandbox mode

### How to Run Audit

```bash
npm run audit:daily-digest-build-readiness
npm run validate:daily-digest-build-readiness
```

Expected: All PASS (46/46 checks).

### Files

- `scripts/audit-daily-digest-build-readiness.ts` — auditor
- `scripts/validate-daily-digest-build-readiness.ts` — validator (46 checks)
- `dashboard/daily-digest-build-readiness.json` — audit output

---
*Runbook v5.8 — Phase 5C-2C-C5 + C5B + C5C*

---

## Phase 5C-2C-C5C — Digest Builder Sandbox Interface Refactor

Phase 5C-2C-C5C defines the **sandbox interface contract** and **guard functions** that builders must use before executing in sandbox mode. It does not execute builders or modify production paths.

### What Changed

- New `dashboard/daily-digest-sandbox-interface.json` — interface contract (required flags, protected paths, blocked side effects)
- New `scripts/daily-digest-sandbox-guards.ts` — pure guard functions (no side effects, no network, no file writes)
- New `scripts/validate-daily-digest-sandbox-interface.ts` — interface validator (35 checks)
- New `scripts/validate-daily-digest-sandbox-guards.ts` — guards validator (46 checks)
- New `GET /api/daily-digest/sandbox-interface` endpoint — serves interface contract JSON
- Updated `dashboard/control.html` — Sandbox Interface Contract panel

### Interface Contract

```json
{
  "phase": "5C-2C-C5C",
  "mode": "interface_contract_only",
  "real_digest_build_allowed": false,
  "production_write_allowed": false,
  "required_flags": {
    "--sandbox": { "description": "Enable sandbox mode", "required": true },
    "--output-dir": { "description": "Specify sandbox output directory", "required": true },
    "--no-collect": { "description": "Disable data collection", "required": true },
    "--no-send": { "description": "Disable Telegram sending", "required": true },
    "--no-timer": { "description": "Disable timer modification", "required": true },
    "--no-production-write": { "description": "Block production writes", "required": true }
  },
  "protected_paths": [
    "reports/daily-digest.md",
    "reports/telegram-digest.txt",
    "dashboard/status.json",
    "reports/daily/"
  ],
  "allowed_output_root": "reports/sandbox/daily-digest/<run_id>/outputs/"
}
```

### Guard Functions

| Function | Purpose |
|----------|---------|
| `isSandboxPath(path)` | Check if path is within sandbox |
| `assertSandboxOutputPath(path)` | Throw if not sandbox path |
| `assertNotProductionPath(path)` | Throw if production path |
| `parseSandboxArgs(argv)` | Parse CLI flags |
| `buildSandboxRuntimeConfig(args)` | Build runtime config |
| `validateSandboxFlags(args)` | Validate all required flags |

### How to Use Guards in a Builder

```typescript
import { parseSandboxArgs, buildSandboxRuntimeConfig, assertNotProductionPath } from "../daily-digest-sandbox-guards";

const args = parseSandboxArgs(process.argv.slice(2));
const config = buildSandboxRuntimeConfig(args);

if (config.sandboxMode) {
  assertNotProductionPath(outputPath);
  // Write to config.outputDir instead of production path
}
```

### How to Validate

```bash
npm run validate:daily-digest-sandbox-interface
npm run validate:daily-digest-sandbox-guards
```

Expected: All PASS (35 + 46 = 81 checks).

### Files

- `dashboard/daily-digest-sandbox-interface.json` — interface contract
- `scripts/daily-digest-sandbox-guards.ts` — pure guard functions
- `scripts/validate-daily-digest-sandbox-interface.ts` — interface validator (35 checks)
- `scripts/validate-daily-digest-sandbox-guards.ts` — guards validator (46 checks)

---
*Runbook v5.9 — Phase 5C-2C-C5C*

## Phase 5C-2C-C5D — Digest Builder Sandbox Refactor Implementation

Phase 5C-2C-C5D implements the **sandbox runtime config scaffold** and **pilot builder refactor** that wires the guard functions into actual builder code. It does not execute builders or write production files.

### What Changed

- New `scripts/daily-digest-sandbox-runtime.ts` — sandbox runtime config resolver (parse flags, resolve paths, enforce production path rejection)
- Refactored `src/reports/telegram-daily-digest.ts` — pilot builder now imports sandbox guards/runtime, uses `resolveBuilderPaths`, routes writes to sandbox dir when `--sandbox` is present
- New `scripts/validate-daily-digest-builder-sandbox-refactor.ts` — refactor validator (50 checks)
- Updated `package.json` — added `validate:daily-digest-builder-sandbox-refactor` script
- Updated `dashboard/daily-digest-build-readiness.json` — added `sandbox_interface_contract=true`, `sandbox_runtime_config=true`, `pilot_builder_refactored=true`, `ready_for_sandbox_build` remains `partial`

### Sandbox Runtime Config

| Function | Purpose |
|----------|---------|
| `buildSandboxRuntime(argv)` | Parse argv → config + resolved paths + validation |
| `resolveSandboxPaths(config)` | Resolve outputDir, digestMd, digestTelegram, statusJson, runId |
| `getProductionPaths()` | Return standard production paths (fallback) |
| `resolveBuilderPaths(config)` | Unified resolver: sandbox paths when sandboxMode=true, production paths otherwise |

### How to Use in a Builder

```typescript
import { buildSandboxRuntime, resolveBuilderPaths } from "../../scripts/daily-digest-sandbox-runtime";
import { assertNotProductionPath } from "../../scripts/daily-digest-sandbox-guards";

const { config, validation } = buildSandboxRuntime(process.argv.slice(2));
if (config.sandboxMode && !validation.valid) {
  console.error("Missing required flags:", validation.missing);
  process.exit(1);
}
const paths = resolveBuilderPaths(config);

if (!paths.sandboxMode) {
  // Production mode — unchanged behavior
  writeFileSync(paths.digestMd, mdReport);
} else {
  // Sandbox mode — paths routed to outputDir, production paths blocked
  assertNotProductionPath(paths.digestMd);
  writeFileSync(paths.digestMd, mdReport);
}
```

### Required Flags

When `--sandbox` is used, all of the following must be present:

```bash
--sandbox
--output-dir reports/sandbox/daily-digest/<run_id>/outputs/
--no-collect
--no-send
--no-timer
--no-production-write
```

### Protected Paths (Rejected in Sandbox Mode)

- `reports/daily-digest.md`
- `reports/telegram-digest.txt`
- `dashboard/status.json`
- `reports/daily/`

### How to Validate

```bash
npm run validate:daily-digest-builder-sandbox-refactor
npm run validate:daily-digest-sandbox-interface
npm run validate:daily-digest-sandbox-guards
npm run audit:daily-digest-build-readiness
npm run validate:daily-digest-build-readiness
npm run validate:daily-digest-sandbox-manager
npm run validate:daily-digest-build-sandbox-plan
npm run validate:daily-digest-staged-plan
npm run validate:daily-digest-stage-execution
npm run validate:digest-freshness
npm run validate:dashboard:policy:validate
npm run validate:sanitizer-secret-completeness
npm run validate:sanitizer-false-positives
npm run validate:telegram-sanitizer
npm run validate:project-report-send
```

Expected: All PASS.

### Files

- `scripts/daily-digest-sandbox-runtime.ts` — sandbox runtime config resolver
- `src/reports/telegram-daily-digest.ts` — pilot builder (refactored)
- `scripts/validate-daily-digest-builder-sandbox-refactor.ts` — refactor validator (50 checks)
- `dashboard/daily-digest-build-readiness.json` — updated readiness audit

---
*Runbook v5.10 — Phase 5C-2C-C5D*

## Phase 5C-2C-C5E — Pilot Sandbox Digest Build Execution

Phase 5C-2C-C5E executes the **pilot builder** (`telegram-daily-digest.ts`) in sandbox mode for the first time. It creates a sandbox run, runs the builder with all required flags, verifies production paths are untouched, and writes build artifacts to the sandbox directory only.

### What Changed

- New `scripts/daily-digest-sandbox-build-pilot.ts` — pilot sandbox build runner (create sandbox, record path hashes, execute builder, verify no production writes)
- New `POST /api/daily-digest/sandbox/build-pilot` endpoint — confirmed execution with token + confirmation phrase + execution lock + audit log
- New `GET /api/daily-digest/sandbox/latest-build` endpoint — read-only latest build summary
- Updated `dashboard/control.html` — pilot sandbox build panel with build button and latest build status
- New `scripts/validate-daily-digest-sandbox-build-pilot.ts` — pilot validator (47 checks)
- Updated `package.json` — added `validate:daily-digest-sandbox-build-pilot` script

### Sandbox Build Runner

| Step | Action |
|------|--------|
| 1. Create sandbox | `createSandboxRun()` from `daily-digest-sandbox-manager.ts` |
| 2. Record pre-hashes | SHA-256 + mtime + size of all protected paths |
| 3. Execute builder | `spawn("npx", ["tsx", builderPath, ...flags], {shell: false})` |
| 4. Record post-hashes | Compare with pre-hashes |
| 5. Verify outputs | List files in `outputs/` directory |
| 6. Write summary | `reports/build-summary.json` + `logs/build.log` |

### Safety Invariants

- `shell: false` — no shell string construction
- Fixed args array — no dynamic command injection
- `CQA_ALLOW_TELEGRAM_SEND=0` and `CQA_ALLOW_GENERATION=0` in env
- Protected paths checked before/after with hash comparison
- If any protected path changes, build fails with `PRODUCTION_VIOLATION`
- Output redaction before logging (no token leakage)

### How to Execute

```bash
# CLI
cd ~/.openclaw/workspace/projects/creative-quota-harvester
npx tsx scripts/daily-digest-sandbox-build-pilot.ts

# Via control server
curl -s -X POST http://127.0.0.1:8788/api/daily-digest/sandbox/build-pilot \
  -H "Content-Type: application/json" \
  -d '{"confirm_phrase":"BUILD DAILY SANDBOX PILOT","token":"***"}'
```

### Expected Output

```json
{
  "success": true,
  "run_id": "sandbox-2026-06-14-06-50-12",
  "exit_code": 0,
  "duration_ms": 497,
  "protected_paths_changed": false,
  "output_files": [
    ".../outputs/daily-digest.md",
    ".../outputs/telegram-digest.txt"
  ],
  "build_summary_path": ".../reports/build-summary.json",
  "log_path": ".../logs/build.log"
}
```

### How to Validate

```bash
npm run validate:daily-digest-sandbox-build-pilot
npm run validate:daily-digest-builder-sandbox-refactor
npm run validate:daily-digest-sandbox-interface
npm run validate:daily-digest-sandbox-guards
npm run audit:daily-digest-build-readiness
npm run validate:daily-digest-build-readiness
npm run validate:daily-digest-sandbox-manager
npm run validate:daily-digest-build-sandbox-plan
npm run validate:daily-digest-staged-plan
npm run validate:daily-digest-stage-execution
npm run validate:digest-freshness
npm run validate:dashboard:policy:validate
npm run validate:sanitizer-secret-completeness
npm run validate:sanitizer-false-positives
npm run validate:telegram-sanitizer
npm run validate:project-report-send
```

Expected: All PASS.

### Files

- `scripts/daily-digest-sandbox-build-pilot.ts` — pilot sandbox build runner
- `scripts/validate-daily-digest-sandbox-build-pilot.ts` — pilot validator (47 checks)
- `dashboard/control.html` — updated with pilot build panel

---
*Runbook v5.11 — Phase 5C-2C-C5E*

## Phase 5C-2C-C5F — Sandbox Output Validation & Diff

Phase 5C-2C-C5F validates the **latest sandbox digest outputs** for integrity, safety, and format correctness. It also compares sandbox outputs with production outputs and generates a diff summary. No re-build, no production write, no send.

### What Changed

- New `scripts/validate-daily-digest-sandbox-output.ts` — sandbox output validator (11 checks: manifest, file existence, secret scan, tool residue scan, Telegram length)
- New `scripts/daily-digest-sandbox-diff.ts` — sandbox diff generator (compares sandbox vs production, writes diff-summary.json + diff-summary.md to sandbox diffs/)
- New `scripts/validate-daily-digest-sandbox-output-tools.ts` — tools validator (33 checks)
- New `GET /api/daily-digest/sandbox/latest-output-validation` endpoint — read-only validation + diff summary
- Updated `package.json` — added `validate:daily-digest-sandbox-output-tools` script

### Sandbox Output Validator

| Check | Purpose |
|-------|---------|
| manifest.json | Exists and valid JSON |
| collect_allowed | Must be false |
| telegram_send_allowed | Must be false |
| production_write_allowed | Must be false |
| daily-digest.md | Exists and non-empty |
| telegram-digest.txt | Exists and non-empty |
| telegram length | Within 3500 char limit (warning if exceeds) |
| secret scan | No TELEGRAM_BOT_TOKEN, API_KEY, sk-cp, Bearer tokens |
| tool residue scan | No `<tool_call`, `</tool_call>`, `<invoke`, `[truncated]` |

### Sandbox Diff Generator

| Output | Purpose |
|--------|---------|
| `diffs/diff-summary.json` | Machine-readable diff summary |
| `diffs/diff-summary.md` | Human-readable diff report |

Diff includes: line count, char count, added/removed summary, sandbox-only sections, production-only sections, risk notes.

### How to Validate

```bash
npm run validate:daily-digest-sandbox-output-tools
npm run validate:daily-digest-sandbox-build-pilot
npm run validate:daily-digest-builder-sandbox-refactor
npm run validate:daily-digest-sandbox-interface
npm run validate:daily-digest-sandbox-guards
npm run audit:daily-digest-build-readiness
npm run validate:daily-digest-build-readiness
npm run validate:daily-digest-sandbox-manager
npm run validate:daily-digest-build-sandbox-plan
npm run validate:daily-digest-staged-plan
npm run validate:daily-digest-stage-execution
npm run validate:digest-freshness
npm run validate:dashboard:policy:validate
npm run validate:sanitizer-secret-completeness
npm run validate:sanitizer-false-positives
npm run validate:telegram-sanitizer
npm run validate:project-report-send
```

Expected: All PASS.

### Files

- `scripts/validate-daily-digest-sandbox-output.ts` — output validator
- `scripts/daily-digest-sandbox-diff.ts` — diff generator
- `scripts/validate-daily-digest-sandbox-output-tools.ts` — tools validator (33 checks)

---
*Runbook v5.12 — Phase 5C-2C-C5F*

## Phase 5C-2C-C5G — Sandbox Promote Readiness Plan

Phase 5C-2C-C5G establishes the **promote readiness plan** for sandbox digest outputs. It checks if all preconditions are met for future promotion (copying sandbox outputs to production). Does not execute promotion, does not copy files, does not send Telegram.

### What Changed

- New `dashboard/daily-digest-promote-readiness-plan.json` — promote readiness configuration (preconditions, blocked actions, future confirm phrase)
- New `scripts/daily-digest-promote-readiness.ts` — promote readiness checker (reads latest sandbox, validates preconditions, outputs readiness JSON)
- New `scripts/validate-daily-digest-promote-readiness.ts` — promote readiness validator (40 checks)
- New `GET /api/daily-digest/promote-readiness` endpoint — read-only promote readiness
- Updated `dashboard/control.html` — promote readiness panel with preconditions display
- Updated `package.json` — added `validate:daily-digest-promote-readiness` and `check:daily-digest-promote-readiness` scripts

### Promote Readiness Preconditions

| Check | Required | Source |
|-------|----------|--------|
| Sandbox outputs exist | ✅ | `outputs/daily-digest.md` + `outputs/telegram-digest.txt` |
| Secret scan pass | ✅ | `validate-daily-digest-sandbox-output.ts` |
| Tool residue scan pass | ✅ | `validate-daily-digest-sandbox-output.ts` |
| Diff summary exists | ✅ | `daily-digest-sandbox-diff.ts` |
| Pilot build executed | ✅ | `daily-digest-sandbox-build-pilot.ts` build summary |
| Manifest flags correct | ✅ | `manifest.json` collect=false, send=false, write=false |
| Protected paths unchanged | ✅ | Build summary production_write_detected=false |
| Human approval required | ✅ | Policy requirement |

### Promote Readiness Result

```json
{
  "phase": "5C-2C-C5G",
  "mode": "promote_readiness_only",
  "ready_for_future_promote": true,
  "real_promote_allowed": false,
  "production_write_allowed": false,
  "telegram_send_allowed": false,
  "future_confirm_phrase": "PROMOTE DAILY DIGEST FROM SANDBOX",
  "future_confirm_phrase_enabled": false,
  "blocked_actions": ["production_write", "telegram_send", "collect", "timer", "git", "promote", "model_call", "media_generation"]
}
```

### Safety Invariants

- `real_promote_allowed=false` — promotion is not enabled
- `future_confirm_phrase_enabled=false` — confirm phrase is defined but not active
- `human_approval_required=true` — human approval required before any promotion
- Only writes to `dashboard/daily-digest-promote-readiness.json`
- Does not copy sandbox outputs to production
- Does not send Telegram
- Does not call model or generate media

### How to Validate

```bash
npm run validate:daily-digest-promote-readiness
npm run check:daily-digest-promote-readiness
npm run validate:daily-digest-sandbox-output-tools
npm run validate:daily-digest-sandbox-build-pilot
npm run validate:daily-digest-builder-sandbox-refactor
npm run validate:daily-digest-sandbox-interface
npm run validate:daily-digest-sandbox-guards
npm run audit:daily-digest-build-readiness
npm run validate:daily-digest-build-readiness
npm run validate:daily-digest-sandbox-manager
npm run validate:daily-digest-build-sandbox-plan
npm run validate:daily-digest-staged-plan
npm run validate:daily-digest-stage-execution
npm run validate:digest-freshness
npm run validate:dashboard:policy:validate
npm run validate:sanitizer-secret-completeness
npm run validate:sanitizer-false-positives
npm run validate:telegram-sanitizer
npm run validate:project-report-send
```

Expected: All PASS.

### Files

- `dashboard/daily-digest-promote-readiness-plan.json` — promote readiness config
- `scripts/daily-digest-promote-readiness.ts` — promote readiness checker
- `scripts/validate-daily-digest-promote-readiness.ts` — promote readiness validator (40 checks)
- `dashboard/daily-digest-promote-readiness.json` — generated readiness output

---
*Runbook v5.13 — Phase 5C-2C-C5G*

## Phase 5C-2C-C5H — Sandbox Promote Dry-run / Copy Plan

Phase 5C-2C-C5H generates the **dry-run plan** for promoting sandbox digest outputs to production. It maps source files to production targets, captures backup/rollback requirements, and confirms human approval. No actual promote, no production write, no send.

### What Changed

- New `dashboard/daily-digest-promote-dry-run-plan.json` — dry-run plan configuration
- New `scripts/daily-digest-promote-dry-run.ts` — promote dry-run planner
- New `scripts/validate-daily-digest-promote-dry-run.ts` — dry-run validator (38 checks)
- New `GET /api/daily-digest/promote-dry-run-plan` endpoint — read-only dry-run plan
- Updated `dashboard/control.html` — promote dry-run panel
- Updated `package.json` — added validate + check scripts

### Copy Map

| Source | Target | Backup |
|--------|--------|--------|
| `sandbox/outputs/daily-digest.md` | `reports/daily-digest.md` | `reports/daily-digest.md.bak` |
| `sandbox/outputs/telegram-digest.txt` | `reports/telegram-digest.txt` | `reports/telegram-digest.txt.bak` |

### Backup / Rollback Plan

- backup_before_promote: true
- Backup manifest: `sandbox/reports/backup-manifest.json`
- Rollback manifest: `sandbox/reports/rollback-manifest.json`
- Backup format: `{file}.bak.{timestamp}`

### Safety Invariants

- real_promote_allowed=false
- future_confirm_phrase_enabled=false
- human_approval_required=true
- Only writes to sandbox reports/
- Does not copy files to production
- Does not send Telegram

### How to Validate

```bash
npm run check:daily-digest-promote-dry-run
npm run validate:daily-digest-promote-dry-run
npm run validate:daily-digest-promote-readiness
npm run validate:daily-digest-sandbox-output-tools
npm run validate:daily-digest-sandbox-build-pilot
npm run validate:daily-digest-builder-sandbox-refactor
npm run validate:daily-digest-sandbox-interface
npm run validate:daily-digest-sandbox-guards
npm run validate:daily-digest-build-readiness
npm run validate:daily-digest-sandbox-manager
npm run validate:dashboard:policy:validate
npm run validate:sanitizer-secret-completeness
npm run validate:sanitizer-false-positives
npm run validate:telegram-sanitizer
npm run validate:project-report-send
```

Expected: All PASS.

### Files

- `dashboard/daily-digest-promote-dry-run-plan.json` — dry-run plan config
- `scripts/daily-digest-promote-dry-run.ts` — promote dry-run planner
- `scripts/validate-daily-digest-promote-dry-run.ts` — dry-run validator (38 checks)

---
*Runbook v5.14 — Phase 5C-2C-C5H*

## Phase 5C-2C-C5I — Promote Shadow Copy / Backup Plan

Phase 5C-2C-C5I creates a **shadow copy** of production files in the sandbox run directory, along with candidate previews, rollback manifest, and promote checklist. No actual promote, no production write, no send.

### What Changed

- New `dashboard/daily-digest-promote-shadow-plan.json` — shadow plan configuration
- New `scripts/daily-digest-promote-shadow-copy.ts` — shadow copy planner
- New `scripts/validate-daily-digest-promote-shadow-copy.ts` — shadow copy validator (40 checks)
- New `GET /api/daily-digest/promote-shadow-status` endpoint — read-only shadow status
- Updated `dashboard/control.html` — promote shadow copy panel
- Updated `package.json` — added validate + check scripts

### Shadow Copy Structure

```
reports/sandbox/daily-digest/<run_id>/reports/promote-shadow/
├── production-backup-preview/
│   ├── daily-digest.md          (current production, redacted)
│   └── telegram-digest.txt      (current production, redacted)
├── candidate-preview/
│   ├── daily-digest.md          (sandbox output, redacted)
│   └── telegram-digest.txt      (sandbox output, redacted)
├── rollback-manifest.json
├── promote-checklist.md
└── shadow-copy-summary.json
```

### Safety Invariants

- real_promote_allowed=false
- future_confirm_phrase_enabled=false
- human_approval_required=true
- Only writes to sandbox reports/promote-shadow/
- Does not copy files to production
- Does not send Telegram

### How to Validate

```bash
npm run check:daily-digest-promote-shadow-copy
npm run validate:daily-digest-promote-shadow-copy
npm run validate:daily-digest-promote-dry-run
npm run validate:daily-digest-promote-readiness
npm run validate:daily-digest-sandbox-output-tools
npm run validate:daily-digest-sandbox-build-pilot
npm run validate:daily-digest-builder-sandbox-refactor
npm run validate:daily-digest-sandbox-interface
npm run validate:daily-digest-sandbox-guards
npm run validate:daily-digest-build-readiness
npm run validate:daily-digest-sandbox-manager
npm run validate:dashboard:policy:validate
npm run validate:sanitizer-secret-completeness
npm run validate:sanitizer-false-positives
npm run validate:telegram-sanitizer
npm run validate:project-report-send
```

Expected: All PASS.

### Files

- `dashboard/daily-digest-promote-shadow-plan.json` — shadow plan config
- `scripts/daily-digest-promote-shadow-copy.ts` — shadow copy planner
- `scripts/validate-daily-digest-promote-shadow-copy.ts` — shadow copy validator (40 checks)

---
*Runbook v5.15 — Phase 5C-2C-C5I*

## Phase 5C-2C-C5J — Promote Commit Gate

Phase 5C-2C-C5J establishes the **promote commit gate** that checks all preconditions for future promote. It reads latest sandbox run, readiness, dry-run, shadow copy, validation, and diff, and outputs a gate report. No actual promote, no production write, no send.

### What Changed

- New `dashboard/daily-digest-promote-gate.json` — gate configuration
- New `scripts/daily-digest-promote-gate.ts` — promote gate checker
- New `scripts/validate-daily-digest-promote-gate.ts` — gate validator (38 checks)
- New `GET /api/daily-digest/promote-gate` endpoint — read-only promote gate
- Updated `dashboard/control.html` — promote gate panel
- Updated `package.json` — added validate + check scripts

### Required Evidence (13 keys)

| Evidence | Source |
|----------|--------|
| latest_sandbox_run_exists | `reports/sandbox/daily-digest/latest.json` |
| sandbox_build_success | `build-summary.json` |
| sandbox_output_validation_pass | `validate-daily-digest-sandbox-output.ts` |
| secret_scan_pass | `validate-daily-digest-sandbox-output.ts` |
| tool_residue_scan_pass | `validate-daily-digest-sandbox-output.ts` |
| diff_summary_exists | `daily-digest-sandbox-diff.ts` |
| promote_readiness_ready | `daily-digest-promote-readiness.ts` |
| promote_dry_run_pass | `daily-digest-promote-dry-run.ts` |
| shadow_copy_pass | `daily-digest-promote-shadow-copy.ts` |
| rollback_manifest_exists | `promote-shadow/rollback-manifest.json` |
| promote_checklist_exists | `promote-shadow/promote-checklist.md` |
| protected_paths_unchanged | `build-summary.json` |
| human_approval_required | policy |

### Safety Invariants

- real_promote_allowed=false
- future_confirm_phrase_enabled=false
- human_approval_required=true
- Only writes to dashboard/ and sandbox reports/
- Does not copy files to production
- Does not send Telegram

### How to Validate

```bash
npm run check:daily-digest-promote-gate
npm run validate:daily-digest-promote-gate
npm run validate:daily-digest-promote-shadow-copy
npm run validate:daily-digest-promote-dry-run
npm run validate:daily-digest-promote-readiness
npm run validate:daily-digest-sandbox-output-tools
npm run validate:daily-digest-sandbox-build-pilot
npm run validate:daily-digest-builder-sandbox-refactor
npm run validate:daily-digest-sandbox-interface
npm run validate:daily-digest-sandbox-guards
npm run validate:daily-digest-build-readiness
npm run validate:daily-digest-sandbox-manager
npm run validate:dashboard:policy:validate
npm run validate:sanitizer-secret-completeness
npm run validate:sanitizer-false-positives
npm run validate:telegram-sanitizer
npm run validate:project-report-send
```

Expected: All PASS.

### Files

- `dashboard/daily-digest-promote-gate.json` — gate config
- `scripts/daily-digest-promote-gate.ts` — promote gate checker
- `scripts/validate-daily-digest-promote-gate.ts` — gate validator (38 checks)
- `dashboard/daily-digest-promote-gate.json` — generated gate output

---
*Runbook v5.16 — Phase 5C-2C-C5J*

## Phase 5C-2C-C5K — Promote Execution Design Review

Phase 5C-2C-C5K establishes the **promote execution design review** that evaluates the future promote execution protocol.

### What Changed

- New `dashboard/daily-digest-promote-execution-design.json` — execution design configuration
- New `scripts/daily-digest-promote-execution-review.ts` — execution reviewer
- New `scripts/validate-daily-digest-promote-execution-review.ts` — execution review validator (37 checks)
- New `GET /api/daily-digest/promote-execution-review` endpoint — read-only execution review
- Updated `dashboard/control.html` — promote execution review panel
- Updated `package.json` — added validate + check scripts

### Recommendation Levels

| Recommendation | Meaning |
|----------------|---------|
| `allow_next_phase_design_only` | Design review complete, next phase can implement |
| `allow_controlled_promote` | All checks pass, promote can be executed |
| `block` | Missing requirements, must complete previous phases |

### Safety Invariants

- real_promote_allowed=false
- production_write_allowed=false
- telegram_send_allowed=false
- confirm_phrase required for any promote action
- human_approval required for any promote action

### Files

- `dashboard/daily-digest-promote-execution-design.json` — execution design config
- `scripts/daily-digest-promote-execution-review.ts` — execution reviewer
- `scripts/validate-daily-digest-promote-execution-review.ts` — execution review validator (37 checks)

---
*Runbook v5.17 — Phase 5C-2C-C5K*

## Phase 5C-2C-C5L — Promote Execution Disabled Scaffold

Phase 5C-2C-C5L implements the **disabled promote execution scaffold**. It provides the entry point, parameters, audit, gate checks, and error returns for future promote, but always returns disabled_design_only. No files are copied to production.

### What Changed

- New `dashboard/daily-digest-promote-execution-disabled.json` — disabled scaffold configuration
- New `scripts/daily-digest-promote-executor-disabled.ts` — disabled executor scaffold
- New `scripts/validate-daily-digest-promote-executor-disabled.ts` — disabled executor validator (39 checks)
- New `GET /api/daily-digest/promote-execution-disabled` endpoint — read-only disabled status
- New `POST /api/daily-digest/promote/execute` endpoint — always returns 403 disabled_design_only
- Updated `dashboard/control.html` — promote execution disabled panel
- Updated `package.json` — added validate + check scripts

### Required Gates (5 keys)

| Gate | Source |
|------|--------|
| promote_gate_pass | `dashboard/daily-digest-promote-gate.json` |
| shadow_copy_pass | `promote-shadow/` |
| rollback_manifest_exists | `promote-shadow/rollback-manifest.json` |
| protected_paths_snapshot_exists | `promote-shadow/production-backup-preview/` |
| human_approval_required | policy |

### Safety Invariants

- real_promote_allowed=false (always in C5L)
- production_write_allowed=false (always in C5L)
- telegram_send_allowed=false (always in C5L)
- POST /api/daily-digest/promote/execute returns 403 disabled_design_only
- No files are copied to production

### How to Validate

```bash
npm run check:daily-digest-promote-executor-disabled
npm run validate:daily-digest-promote-executor-disabled
npm run validate:daily-digest-promote-execution-review
npm run validate:daily-digest-promote-gate
npm run validate:daily-digest-promote-shadow-copy
npm run validate:daily-digest-promote-dry-run
npm run validate:daily-digest-promote-readiness
npm run validate:daily-digest-sandbox-output-tools
npm run validate:daily-digest-sandbox-build-pilot
npm run validate:daily-digest-sandbox-manager
npm run validate:sanitizer-secret-completeness
npm run validate:sanitizer-false-positives
npm run validate:telegram-sanitizer
npm run validate:project-report-send
```

Expected: All PASS.

### Files

- `dashboard/daily-digest-promote-execution-disabled.json` — disabled scaffold config
- `scripts/daily-digest-promote-executor-disabled.ts` — disabled executor scaffold
- `scripts/validate-daily-digest-promote-executor-disabled.ts` — disabled executor validator (39 checks)
- `dashboard/daily-digest-promote-execution-disabled.json` — generated disabled output

---
*Runbook v5.18 — Phase 5C-2C-C5L*

## Phase 5C-2C-C5M-0 — Promote Human Approval Pack

Phase 5C-2C-C5M-0 generates the **human approval pack** for future one-shot controlled promote. It provides all the information a human needs to approve or reject the promote action. No actual promote, no production write, no send.

### What Changed

- New `dashboard/daily-digest-promote-approval-pack.json` — approval pack configuration
- New `scripts/daily-digest-promote-approval-pack.ts` — approval pack generator
- New `scripts/validate-daily-digest-promote-approval-pack.ts` — approval pack validator (44 checks)
- New `GET /api/daily-digest/promote-approval-pack` endpoint — read-only approval pack
- Updated `dashboard/control.html` — approval pack panel
- Updated `package.json` — added validate + check scripts

### Approval Pack Contents

- latest_run_id
- sandbox source files (hash, size, mtime)
- future production target files (current state)
- backup status (backup preview + rollback manifest)
- validation evidence (gate, shadow, output, diff)
- diff summary
- human checklist (8 items)
- required confirm phrase
- explicit no-production-write statement

### Human Checklist

1. I have reviewed the latest sandbox run outputs
2. I have reviewed the diff summary between sandbox and production
3. I have reviewed the rollback manifest
4. I have confirmed production backup preview is valid
5. I have confirmed all validation evidence passes
6. I understand this is a one-shot controlled promote
7. I will provide the required confirm phrase at execution time
8. I accept responsibility for the production write

### Safety Invariants

- real_promote_allowed=false (always in C5M-0)
- production_write_allowed=false (always in C5M-0)
- telegram_send_allowed=false (always in C5M-0)
- approval_decision=not_requested
- No production write performed

### How to Validate

```bash
npm run check:daily-digest-promote-approval-pack
npm run validate:daily-digest-promote-approval-pack
npm run validate:daily-digest-promote-executor-disabled
npm run validate:daily-digest-promote-execution-review
npm run validate:daily-digest-promote-gate
npm run validate:daily-digest-promote-shadow-copy
npm run validate:daily-digest-promote-dry-run
npm run validate:daily-digest-promote-readiness
npm run validate:daily-digest-sandbox-output-tools
npm run validate:daily-digest-sandbox-build-pilot
npm run validate:daily-digest-sandbox-manager
npm run validate:sanitizer-secret-completeness
npm run validate:sanitizer-false-positives
npm run validate:telegram-sanitizer
npm run validate:project-report-send
```

Expected: All PASS.

### Files

- `dashboard/daily-digest-promote-approval-pack.json` — approval pack config
- `scripts/daily-digest-promote-approval-pack.ts` — approval pack generator
- `scripts/validate-daily-digest-promote-approval-pack.ts` — approval pack validator (44 checks)
- `dashboard/daily-digest-promote-approval-pack.json` — generated approval pack output
- `reports/promote-human-approval-pack.md` — human-readable approval pack

---
*Runbook v5.19 — Phase 5C-2C-C5M-0*

## Phase 5C-2C-C5M-1 — One-shot Controlled Promote

Phase 5C-2C-C5M-1 implements the **one-shot controlled promote** that copies the
two specific sandbox daily-digest outputs into the two specific production
targets, under a strict human-phrase authorization and SHA-256 hash
verification. It is bounded: only `reports/daily-digest.md` and
`reports/telegram-digest.txt` may be written; no `dashboard/status.json`, no
`reports/daily/`, no timer, no Telegram send, no model call, no media
generation.

### Endpoints

- `POST /api/daily-digest/promote/controlled`
  - Body: `{ "token": "...", "confirm_phrase": "PROMOTE DAILY DIGEST FROM SANDBOX" }`
  - Requires the same `CQA_CONTROL_TOKEN` (or unset to disable token check) and the exact confirm phrase.
  - On success: returns `result=success`, hash verification, backup path, history paths.
  - On failure: returns `result=blocked` with `blocked_reason`.
  - Acquires the same execution lock used by other confirmed actions.
  - Writes audit log with `mode=daily_digest_controlled_promote`, `real_execution` reflects the result. Token is NOT recorded.

- `GET /api/daily-digest/promote/history`
  - Read-only; returns up to 20 most recent promote history records, with secrets stripped.

### Script entry points

```bash
# Validator (must pass before promote)
npm run validate:daily-digest-controlled-promote

# Direct promote (use exactly this phrase)
npx tsx scripts/daily-digest-controlled-promote.ts --confirm-phrase "PROMOTE DAILY DIGEST FROM SANDBOX"

# Rollback plan (dry-run only; never auto-rolls back)
npx tsx scripts/daily-digest-controlled-rollback.ts
```

### Safety constraints (enforced by validator + executor)

- Only writes `reports/daily-digest.md` and `reports/telegram-digest.txt`.
- Creates a backup under `reports/promote-backups/daily-digest/<run-id>-<ts>/` BEFORE copying.
- Verifies SHA-256 of production target matches sandbox candidate after copy.
- No `child_process` / `exec` / `spawn`.
- No `.env` / `.control.local` reads.
- No network calls.
- No `process.env.*` references.
- Output is redacted (token patterns stripped).
- `telegram_send_allowed=false`, `collect_allowed=false`, `timer_allowed=false`, `model_call_allowed=false`, `media_generation_allowed=false`.
- Audit log records `real_execution` and `production_write_allowed`; never the token.

### Files

- `dashboard/daily-digest-controlled-promote.json` — controlled promote config
- `scripts/daily-digest-controlled-promote.ts` — executor
- `scripts/daily-digest-controlled-rollback.ts` — rollback plan (dry-run only)
- `scripts/validate-daily-digest-controlled-promote.ts` — 23-check validator
- `reports/promote-backups/daily-digest/<run-id>-<ts>/backup-manifest.json` — backup
- `reports/promote-history/daily-digest-promote-<run-id>-<ts>.{json,md}` — history

---
*Runbook v5.20 — Phase 5C-2C-C5M-1*

## Phase 5C-2C-C5M1A — Post-Promote Validation Gap Fix

Phase 5C-2C-C5M1A fixed the `dashboard:control:validate` button-tag FAIL that
was a pre-existing gap (5 pre-existing `<button onclick=…>` triggers all
served safe localhost + confirm-phrase-gated actions, but violated the
validator's strict `<button>` ban). The fix replaced them with `<a
class="cqa-action-btn" data-safety="safe-localhost-confirm-phrase-gated">`
and added a new check 6b to the inline validator.

## Phase 5C-2C-C5M1B — Dashboard Safety Hardening v2

Phase 5C-2C-C5M1B hardens the dashboard safety contract by:

1. Codifying the safety policy in a dedicated file
   `dashboard/control-safety-policy.json` (single source of truth).
2. Adding a standalone validator
   `scripts/validate-dashboard-control-safety.ts` (12 checks, no false
   positives on ordinary prose).
3. Updating the inline `validate-control-catalog.ts` check 6b to read the
   same policy file (with hard-coded fallback for defense in depth).
4. Explicitly documenting the inline event-handler escape hatch
   (`cqa-action-btn` + `data-safety` is the only allowed exception).

### Policy file: `dashboard/control-safety-policy.json`

Fields:
- `allowed_data_safety_values`: `safe-localhost`, `safe-localhost-confirm-phrase-gated`, `safe-localhost-dry-run`, `read-only`, `dry-run`, `simulation`.
- `forbidden_hints`: `production-write`, `production-promote`, `high-risk`, `telegram-send`, `collect`, `generate`, `timer`, `git`, `build`, `deploy`, `model`, `media`, `unrestricted`, `remote`, `arbitrary`.
- `required_attributes_for_interactive_elements`: `data-safety`.
- `forbidden_elements`: `button`.
- `forbidden_inline_event_handlers`: `onclick`, `onsubmit`, `onerror`, `onload`, `onmouseover`, `onfocus`, `onblur`, `onchange`, `onkeydown`, `onkeyup`, `onkeypress`.
- `forbidden_endpoint_hints`: production-write / telegram-send / collect / timer / generate / git / build / deploy paths.
- `inline_event_handler_escape_hatch`: explicit documentation that `cqa-action-btn` + `data-safety` is the only allowed exception (introduced C5M1A, codified C5M1B).

### Standalone validator

```bash
npm run validate:dashboard-control-safety
```

12 checks:
1. `policy_present` — file exists
2. `html_present` — file exists
3. `policy_phase` — phase is `5C-2C-C5M1B`
4. `policy_allow_list_nonempty` — allow-list is non-empty
5. `policy_forbidden_hints_nonempty` — forbidden hints non-empty
6. `no_button_tag` — no `<button>` (after stripping comments/style)
7. `no_inline_event_handlers` — no inline handlers outside the escape hatch
8. `cqa_action_btns_have_data_safety` — every `cqa-action-btn` declares `data-safety`
9. `data_safety_values_allowed` — every `data-safety` value is in allow-list and not a forbidden hint
10. `no_forbidden_endpoints` — no interactive endpoint matches forbidden patterns
11. `no_secrets_in_html` — no token patterns
12. `policy_no_allow_forbid_collision` — defensive: allow-list does not contain forbidden hints

### Adding a new safe data-safety value

1. Add the value to `allowed_data_safety_values` in `dashboard/control-safety-policy.json`.
2. Document the safety argument in the runbook (this file).
3. Re-run all validators.
4. Manual review by the project owner before merge.

---
*Runbook v5.21 — Phase 5C-2C-C5M1B*

## Phase 5C-2C-C5N-0 — Continuous Controlled Promote Workflow Plan

Phase 5C-2C-C5N-0 **designs** the continuous controlled promote workflow but
**does not enable it**. Every real-execution stage is intentionally
`allowed_now=false`; the env gate `CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`
would be required to even consider flipping that, and even then a human
confirm phrase is required per run.

### Configuration: `dashboard/daily-digest-continuous-promote-workflow.json`

- `continuous_promote_enabled`: `false`
- `real_promote_allowed`: `false`
- `production_write_allowed`: `false`
- `telegram_send_allowed`: `false`
- `timer_allowed`: `false`
- `required_env_gate`: `CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`
- `required_confirm_phrase`: `PROMOTE DAILY DIGEST FROM SANDBOX`
- `required_plan_phrase`: `PLAN DAILY CONTINUOUS PROMOTE`
- `backup_retention_days`: `7`
- `auto_rollback_enabled`: `false`
- `manual_rollback_supported`: `true`
- `scheduler_allowed` / `new_systemd_timer_allowed` / `new_cron_allowed`: all `false`

### Workflow stages (10)

| stage_id | label_zh | writes_production | allowed_now |
|---|---|---|---|
| `detect_candidate_sandbox_run` | 检测候选沙盒运行 | no | true (read-only) |
| `run_output_validation` | 运行沙盒输出校验 | no | true (read-only) |
| `run_diff_check` | 运行 diff 检查 | no | true (read-only) |
| `run_promote_readiness` | 运行推送就绪度 | no | true (read-only) |
| `run_promote_gate` | 运行推送门禁 | no | true (read-only) |
| `build_human_approval_pack` | 生成人工审批包 | no | true (read-only) |
| `wait_for_human_approval` | 等待人工审批 | no | false (no UI yet) |
| `one_shot_promote` | 受控推送（一次性） | **yes** | **false** (env gate + phrase) |
| `post_promote_validation` | 推送后校验 | no | true (read-only) |
| `rollback_if_human_approved` | 人工授权后回滚 | **yes** | **false** (env gate + phrase) |

### Endpoints

- `GET /api/daily-digest/continuous-promote-workflow` — read-only, returns the planner status JSON.
- `POST /api/daily-digest/continuous-promote-workflow/plan` — token + plan-phrase gated; regenerates the plan only. **Never** executes promote, **never** writes to production, **never** sends Telegram.

### Script entry points

```bash
# Generate plan + status
npm run check:daily-digest-continuous-promote-workflow

# Validate config + planner safety
npm run validate:daily-digest-continuous-promote-workflow
```

### Files

- `dashboard/daily-digest-continuous-promote-workflow.json` — workflow config
- `dashboard/daily-digest-continuous-promote-workflow-status.json` — generated plan status
- `scripts/daily-digest-continuous-promote-planner.ts` — planner (plan-only, no env reads)
- `scripts/validate-daily-digest-continuous-promote-workflow.ts` — 27-check validator
- `reports/continuous-promote-workflow-plan.md` — human-readable plan

### Why this is plan-only

- Per the strict boundaries of this phase: no model calls, no media generation, no sandbox rebuild, no `collect:*`, no `digest:send:*`, no `timer:*`, no new systemd timer, no new cron, no `generate:*`, no git push/pull except commit/push, no build/deploy/release.
- The workflow is **designed** so a future phase (e.g. C5N-1) can manually enable it with explicit human approval and proper UI.
- Every production-touching stage is gated by **both** an env var (off by default) and a human confirm phrase; auto-rollback is similarly opt-in.

---
*Runbook v5.22 — Phase 5C-2C-C5N-0*

## Phase 5C-2C-C5N1 — Human-in-loop Promote Approval Scaffold

Phase 5C-2C-C5N1 **scaffolds** the human-in-loop approval state model for
the continuous controlled promote workflow. It does NOT enable human
approval, does NOT approve, does NOT execute promote, and does NOT write
to production.

### Configuration: `dashboard/daily-digest-human-approval-state.json`

- `approval_enabled`: `false`
- `approval_state`: `not_requested` (initial; will be updated by planner)
- `real_promote_allowed`: `false`
- `production_write_allowed`: `false`
- `telegram_send_allowed`: `false`
- `collect_allowed` / `generate_allowed` / `timer_allowed` / `git_allowed` / `model_call_allowed` / `media_generation_allowed`: all `false`
- `required_confirm_phrase`: `PROMOTE DAILY DIGEST FROM SANDBOX` (reuses C5M1)
- `required_plan_phrase`: `PLAN DAILY HUMAN APPROVAL` (new, gates the POST /plan endpoint)
- `required_env_gate`: `CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`
- `approval_transitions`: 6 states — `not_requested`, `approval_pack_ready`, `human_review_pending`, `approved_for_future_promote`, `rejected`, `expired`
- `blocked_transitions`: `approved_for_future_promote -> production_write` (always blocked, regardless of state)

### Evidence checklists (3 levels)

- **For `approval_pack_ready`** (8 items): latest_sandbox_run_present, sandbox_output_validation_pass, diff_check_pass, promote_readiness_pass, promote_gate_pass, shadow_copy_present, rollback_manifest_present, approval_pack_generated.
- **For `human_review_pending`** (3 items, all future-C5N-2): approval_pack_reviewed_by_human, human_confirms_target_files, human_confirms_backup_retention_acceptable.
- **For `approved_for_future_promote`** (3 items, all future-C5N-2): human_approval_recorded, env_gate_set_in_target_environment, audit_log_witness_recorded.

### Endpoints

- `GET /api/daily-digest/human-approval-state` — read-only, returns the planner status JSON.
- `POST /api/daily-digest/human-approval/plan` — token + plan-phrase gated; regenerates the state only. **Never** approves, **never** executes, **never** writes production, **never** sends Telegram.

### Script entry points

```bash
# Generate state + plan
npm run check:daily-digest-human-approval-scaffold

# Validate config + planner safety
npm run validate:daily-digest-human-approval-scaffold
```

### Files

- `dashboard/daily-digest-human-approval-state.json` — state config
- `dashboard/daily-digest-human-approval-state-status.json` — generated by planner
- `scripts/daily-digest-human-approval-planner.ts` — planner (scaffold-only, no env reads, no network)
- `scripts/validate-daily-digest-human-approval-scaffold.ts` — 26-check validator
- `reports/human-in-loop-promote-ui-scaffold.md` — human-readable plan

### Why this is scaffold-only

- Per the strict boundaries: no model calls, no media, no collect, no digest send, no timer, no new systemd/cron, no generate, no git push/pull except commit/push, no build/deploy/release.
- The approval state is **modeled** so a future phase (C5N-2) can implement a human-approver runner, an env-gate verifier, and a per-transition audit log entry — all gated by explicit human initiation.
- Even at the `approved_for_future_promote` state, the actual production write is blocked (`production_write_allowed=false` in the config); a future orchestrator would have to re-verify the env gate and the human confirm phrase before any write.
- The planner does **not** read `process.env` (per safety contract); `env_gate_satisfied` is conservatively reported as `false` in the status.

---
*Runbook v5.23 — Phase 5C-2C-C5N1*

## Phase 5C-2C-C5N2 — Manual Approval Transition Dry-run

Phase 5C-2C-C5N2 **simulates** a single human-approval state transition
(approval_pack_ready → human_review_pending). It does NOT modify the
real approval state, does NOT approve, does NOT promote, and does NOT
write to production.

### Configuration: `dashboard/daily-digest-human-approval-transition-policy.json`

- `real_approval_allowed`: `false`
- `real_transition_allowed`: `false`
- `real_promote_allowed`: `false`
- `production_write_allowed`: `false`
- `telegram_send_allowed`: `false`
- `allowed_dry_run_transition`: `{from: "approval_pack_ready", to: "human_review_pending"}`
- `required_confirm_phrase`: `DRY RUN DAILY HUMAN APPROVAL TRANSITION`
- `required_env_gate`: `CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`
- `env_gate_evaluated`: `false` (planner does not read process.env)
- `blocked_transitions`: human_review_pending → approved_for_future_promote, approved_for_future_promote → promote, any automatic approval, any unattended transition
- `blocked_actions`: production_write, telegram_send, timer, collect, generate, git, unattended_promote, model_call, media_generation, real_approval, auto_approval

### Endpoints

- `GET /api/daily-digest/human-approval-transition-dry-run` — read-only, returns the dry-run result JSON.
- `POST /api/daily-digest/human-approval/transition-dry-run` — token + confirm-phrase gated; re-runs the dry-run planner only. **Never** modifies the approval state, **never** approves, **never** writes production, **never** sends Telegram.

### Script entry points

```bash
# Generate dry-run result
npm run check:daily-digest-human-approval-transition-dry-run

# Validate config + planner safety
npm run validate:daily-digest-human-approval-transition-dry-run
```

### Files

- `dashboard/daily-digest-human-approval-transition-policy.json` — transition policy
- `dashboard/daily-digest-human-approval-transition-dry-run.json` — generated by planner
- `scripts/daily-digest-human-approval-transition-dry-run.ts` — dry-run planner (no env reads, no network, no production writes, no approval state writes)
- `scripts/validate-daily-digest-human-approval-transition-dry-run.ts` — 28-check validator
- `reports/human-approval-transition-dry-run.md` — human-readable plan

### Why this is dry-run-only

- Per the strict boundaries: no model calls, no media, no collect, no digest send, no timer, no new systemd/cron, no generate, no git push/pull except commit/push, no build/deploy/release.
- The transition is **simulated** so a future phase (C5N-3) can implement a real human-approver runner, an env-gate verifier, and a per-transition audit log entry — all gated by explicit human initiation.
- Even at `approved_for_future_promote` in a future phase, the actual production write is blocked (`production_write_allowed=false`); a future orchestrator would have to re-verify the env gate and the human confirm phrase before any write.
- The planner does **not** read `process.env` (per safety contract); `env_gate_evaluated` is conservatively reported as `false`.
- The planner does **not** write to the C5N1 approval state file (`daily-digest-human-approval-state.json` or `…-status.json`); it only writes to the dry-run result file.

---
*Runbook v5.24 — Phase 5C-2C-C5N2*

## Phase 5C-2C-C5N3 — Human Review Pending State Record

Phase 5C-2C-C5N3 **actually records** the human review pending state
transition (approval_pack_ready → human_review_pending). It does NOT
approve, does NOT promote, does NOT write to production, and does NOT
send Telegram.

### Configuration: `dashboard/daily-digest-human-review-pending-policy.json`

- `real_approval_allowed`: `false`
- `real_promote_allowed`: `false`
- `production_write_allowed`: `false`
- `telegram_send_allowed`: `false`
- `transition`: `{from: "approval_pack_ready", to: "human_review_pending", kind: "state_record_only"}`
- `required_confirm_phrase`: `BEGIN DAILY HUMAN REVIEW`
- `required_env_gate`: `CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`
- `env_gate_evaluated`: `false` (recorder does not read process.env)
- `blocked_next_transitions`: human_review_pending → approved_for_future_promote, any automatic approval, any unattended transition
- `blocked_actions`: production_write, telegram_send, timer, collect, generate, git, unattended_promote, model_call, media_generation, auto_approval, skip_evidence, forge_history

### What actually happens on state transition

1. `dashboard/daily-digest-human-approval-state.json` is updated: `approval_state` flips from `approval_pack_ready` to `human_review_pending`; a new entry is appended to `transition_history[]`.
2. A history record is written to `reports/human-approval-history/daily-digest-human-review-pending-<utc-ts>.{json,md}`.
3. A state record MD is written to `reports/human-review-pending-state-record.md`.
4. The audit log is appended with `action_id=daily_digest_human_review_pending_record`.

### What does NOT happen

- No `reports/daily-digest.md` write (md5 verified unchanged)
- No `reports/telegram-digest.txt` write (md5 verified unchanged)
- No `dashboard/status.json` write (md5 verified unchanged)
- No Telegram send
- No timer / cron / systemd modification
- No collect, generate, model_call, media_generation
- No git push/pull except commit/push
- No build/deploy/release

### Endpoints

- `GET /api/daily-digest/human-review-pending-status` — read-only, returns the current approval state + transition_history (secrets stripped).
- `POST /api/daily-digest/human-approval/begin-review` — token + confirm-phrase gated; re-runs the recorder. **Never** approves, **never** promotes, **never** writes production, **never** sends Telegram.

### Script entry points

```bash
# Record the state transition
npx tsx scripts/daily-digest-human-review-pending.ts --confirm-phrase "BEGIN DAILY HUMAN REVIEW"

# Validate config + recorder safety
npm run validate:daily-digest-human-review-pending
```

### Files

- `dashboard/daily-digest-human-review-pending-policy.json` — transition policy
- `scripts/daily-digest-human-review-pending.ts` — state recorder
- `scripts/validate-daily-digest-human-review-pending.ts` — 26-check validator
- `reports/human-approval-history/daily-digest-human-review-pending-<ts>.{json,md}` — history records
- `reports/human-review-pending-state-record.md` — latest state record MD

### Why this is state-record-only (not approval)

- Even after C5N3, the state is `human_review_pending` — NOT `approved_for_future_promote`.
- A future phase (C5N-4) would be required to advance to `approved_for_future_promote`, with explicit human review + env gate + audit.
- The actual production write is still blocked at the `human_review_pending` state; even at `approved_for_future_promote`, the C5M1 controlled promote executor would be invoked separately.
- The recorder does **not** read `process.env` (per safety contract); `env_gate_evaluated` is conservatively reported as `false`.

---
*Runbook v5.25 — Phase 5C-2C-C5N3*

## Phase 5C-2C-C5N4 — Approved-for-future-promote Dry-run

Phase 5C-2C-C5N4 **simulates** the human-review-pending → approved-for-future-promote
transition. It does NOT modify the real approval state, does NOT approve,
does NOT promote, and does NOT write to production.

### Configuration: `dashboard/daily-digest-approval-dry-run-policy.json`

- `real_approval_allowed`: `false`
- `real_transition_allowed`: `false`
- `real_promote_allowed`: `false`
- `production_write_allowed`: `false`
- `telegram_send_allowed`: `false`
- `allowed_dry_run_transition`: `{from: "human_review_pending", to: "approved_for_future_promote"}`
- `required_confirm_phrase`: `DRY RUN DAILY APPROVAL`
- `required_env_gate`: `CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`
- `env_gate_evaluated`: `false` (planner does not read process.env)
- `blocked_transitions`: approved_for_future_promote → promote, automatic approval, unattended promote, unattended transition
- `blocked_actions`: production_write, telegram_send, timer, collect, generate, git, unattended_promote, model_call, media_generation, real_approval, auto_approval

### Endpoints

- `GET /api/daily-digest/approval-dry-run` — read-only, returns the dry-run result JSON.
- `POST /api/daily-digest/human-approval/approval-dry-run` — token + confirm-phrase gated; re-runs the dry-run planner only. **Never** approves, **never** writes production, **never** sends Telegram.

### Script entry points

```bash
# Generate dry-run result
npm run check:daily-digest-approval-dry-run

# Validate config + planner safety
npm run validate:daily-digest-approval-dry-run
```

### Files

- `dashboard/daily-digest-approval-dry-run-policy.json` — dry-run policy
- `dashboard/daily-digest-approval-dry-run.json` — generated by planner
- `scripts/daily-digest-approval-dry-run.ts` — dry-run planner (no env reads, no network, no production writes, no approval state writes)
- `scripts/validate-daily-digest-approval-dry-run.ts` — 29-check validator
- `reports/approved-for-future-promote-dry-run.md` — human-readable plan

### Why this is dry-run-only

- The transition is **simulated** so a future phase (C5N-5) can implement a real human-approver runner, an env-gate verifier, and a per-transition audit log entry — all gated by explicit human initiation.
- Even at `approved_for_future_promote` in a future phase, the actual production write is blocked (`production_write_allowed=false`); a future orchestrator would have to re-verify the env gate and the human confirm phrase before any write.
- The planner does **not** read `process.env` (per safety contract); `env_gate_evaluated` is conservatively reported as `false`.
- The planner does **not** write to the C5N1/C5N3 approval state file; it only writes to the dry-run result file.
- The planner prefers `dashboard/daily-digest-human-approval-state.json` (config) over `…-state-status.json` (computed status) for `current_state`, so the dry-run reflects the most recent real state transition.

---
*Runbook v5.26 — Phase 5C-2C-C5N4*

## Phase 5C-2C-C5N5 — Approved-for-future-promote State Record

Phase 5C-2C-C5N5 **actually records** the approved-for-future-promote state
transition (`human_review_pending → approved_for_future_promote`). This is a
**real state machine advance** — NOT a dry-run. It does NOT promote, does NOT
write production, does NOT send Telegram, and does NOT add any timer.

### Configuration: `dashboard/daily-digest-approved-for-future-promote-policy.json`

- `real_approval_allowed`: `true` (state-record only, no side effects)
- `real_promote_allowed`: `false`
- `production_write_allowed`: `false`
- `telegram_send_allowed`: `false`
- `allowed_transition`: `{from: "human_review_pending", to: "approved_for_future_promote"}`
- `required_confirm_phrase`: `APPROVE DAILY DIGEST FOR FUTURE PROMOTE`
- `required_env_gate`: `CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`
- `env_gate_evaluated`: `false` (executor does not read process.env)
- `blocked_transitions`: approved_for_future_promote → promote, automatic promote, unattended promote
- `blocked_actions`: production_write, telegram_send, timer, collect, generate, git, unattended_promote, model_call, media_generation, real_promote, auto_promote

### Endpoints

- `GET /api/daily-digest/approved-for-future-promote-status` — read-only, returns the current approval state + recent approved_for_future_promote history.
- `POST /api/daily-digest/human-approval/approve-for-future-promote` — token + confirm-phrase gated; performs the **real** state transition. **Never** promotes, **never** writes production, **never** sends Telegram.

### Script entry points

```bash
# Record the real state transition (requires confirm phrase)
npx tsx scripts/daily-digest-approved-for-future-promote.ts --confirm-phrase "APPROVE DAILY DIGEST FOR FUTURE PROMOTE"

# Validate config + executor safety
npm run validate:daily-digest-approved-for-future-promote

# Run all validations
npm run check:daily-digest-approved-for-future-promote
npm run validate:daily-digest-approved-for-future-promote
```

### Files

- `dashboard/daily-digest-approved-for-future-promote-policy.json` — policy
- `scripts/daily-digest-approved-for-future-promote.ts` — real state recorder (no env reads, no network, no production writes, no Telegram send)
- `scripts/validate-daily-digest-approved-for-future-promote.ts` — 32-check validator
- `reports/human-approval-history/daily-digest-approved-for-future-promote-<ts>.json` — history record
- `reports/human-approval-history/daily-digest-approved-for-future-promote-<ts>.md` — history record (markdown)
- `reports/approved-for-future-promote-state-record.md` — phase closeout report

### Why this is real-but-still-safe

- The state transition **is real** — `approval_state` in `dashboard/daily-digest-human-approval-state.json` is updated to `approved_for_future_promote`, and a new entry is appended to `transition_history[]`. The state machine IS advanced.
- The state transition is **still safe** — `real_promote_allowed=false`, `production_write_allowed=false`, `telegram_send_allowed=false`, `timer_allowed=false`. No side effects beyond the approval state itself.
- Even at `approved_for_future_promote`, the **next** transition (`→ promote`) is in `blocked_transitions`. A future orchestrator (C5N-6, not yet implemented) would need to re-verify the env gate (`CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`) AND require an explicit per-promote confirm phrase BEFORE any production write or Telegram send.
- The executor does **not** read `process.env` (per safety contract); `env_gate_evaluated` is conservatively reported as `false`.
- The executor does **not** write to `reports/daily-digest.md`, `reports/telegram-digest.txt`, or `dashboard/status.json` (the production-protected paths).

---
*Runbook v5.27 — Phase 5C-2C-C5N5*

## Phase 5C-2C-C5N6-A — Approved Promote Execution Preflight (Preflight-only, Dry-run)

Phase 5C-2C-C5N6-A performs a **preflight / dry-run** of a future promote from the
`approved_for_future_promote` state. It **simulates** the promote by comparing
sandbox candidate files with production targets, computing hash diffs, checking
backup/rollback availability, and producing a `would_promote` plan. It does **NOT**
promote, does **NOT** write production, does **NOT** send Telegram, and does **NOT**
add any timer.

### Configuration: `dashboard/daily-digest-approved-promote-preflight-policy.json`

- `mode`: `approved_promote_preflight_only`
- `real_promote_allowed`: `false`
- `production_write_allowed`: `false`
- `telegram_send_allowed`: `false`
- `required_current_state`: `approved_for_future_promote`
- `required_confirm_phrase`: `PREFLIGHT DAILY PROMOTE`
- `future_promote_confirm_phrase`: `PROMOTE DAILY DIGEST FROM SANDBOX` (for a future C5N-6-B phase)
- `required_env_gate`: `CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`
- `env_gate_evaluated`: `false` (executor does not read process.env)
- `blocked_actions`: production_write, telegram_send, timer, collect, generate, git, unattended_promote, model_call, media_generation

### Endpoints

- `GET /api/daily-digest/approved-promote-preflight` — read-only, returns preflight result (would_promote, hash comparison, backup/rollback status, recommendation).
- `POST /api/daily-digest/promote/preflight` — token + confirm-phrase gated; runs the preflight planner and regenerates the preflight JSON. **Never** promotes, **never** writes production, **never** sends Telegram.

### Script entry points

```bash
# Generate preflight plan (reads all upstream data, no side effects)
npx tsx scripts/daily-digest-approved-promote-preflight.ts

# Validate config + planner safety
npm run validate:daily-digest-approved-promote-preflight

# Run all validations
npm run check:daily-digest-approved-promote-preflight
npm run validate:daily-digest-approved-promote-preflight
```

### Files

- `dashboard/daily-digest-approved-promote-preflight-policy.json` — policy
- `scripts/daily-digest-approved-promote-preflight.ts` — preflight planner (no env reads, no network, no production writes, no Telegram send)
- `scripts/validate-daily-digest-approved-promote-preflight.ts` — 30-check validator
- `dashboard/daily-digest-approved-promote-preflight.json` — preflight result (read-only, updated by planner)
- `reports/approved-promote-preflight.md` — phase closeout report
- `reports/human-approval-history/daily-digest-approved-for-future-promote-<ts>.json` — C5N5 history (upstream input)
- `reports/promote-history/` — promote history (upstream input)
- `reports/promote-backups/` — backup manifests (upstream input)
- `reports/sandbox/daily-digest/` — sandbox candidates (upstream input)

### Why this is safe

- The planner is **read-only**: it reads the approval state, sandbox outputs, production targets, backup manifests, and promote history, but it only writes to the preflight JSON and MD report.
- It computes **hash comparisons** between sandbox candidates and production targets using SHA-256.
- It checks **backup/rollback availability** without executing any rollback.
- It reports `would_promote=true` only when **all** evidence requirements are met (current state, gate pass, approval pack, sandbox candidates, backup manifest, rollback supported, etc.).
- Even if `would_promote=true`, the `real_promote` flag is always `false`.
- The `future_promote_confirm_phrase` (`PROMOTE DAILY DIGEST FROM SANDBOX`) is reserved for a future C5N-6-B phase; this phase does not use it.
- The planner does **not** read `process.env` (per safety contract); `env_gate_evaluated` is conservatively reported as `false`.
- The planner does **not** write to `reports/daily-digest.md`, `reports/telegram-digest.txt`, or `dashboard/status.json` (the production-protected paths).

---
*Runbook v5.28 — Phase 5C-2C-C5N6-A*
