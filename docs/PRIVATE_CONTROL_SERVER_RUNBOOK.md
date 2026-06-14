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
