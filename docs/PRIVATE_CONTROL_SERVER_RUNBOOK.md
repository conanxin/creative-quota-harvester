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

*Runbook v3.0 — Phase 5C-3*
