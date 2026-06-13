# Phase 5C-2C-B: More Low-risk Validation Executions

**STATUS:** PASS

**Date:** 2026-06-13

**Phase:** 5C-2C-B

**Purpose:** Expand the confirmed_low_risk execution allowlist from 5 canary commands to 17 safe validation commands.

---

## WHAT_CHANGED

### Before (5C-2C-A)
- 5 canary commands allowed for real execution
- `confirmation_phrase` generated from risk level (e.g., `dry-run-safe`)
- Health endpoint hardcoded 5 scripts
- control.html only showed policy review

### After (5C-2C-B)
- 17 commands allowed for real execution (5 original + 12 new)
- `confirmation_phrase` set to `EXECUTE LOW RISK` for all `confirmed_low_risk` commands
- Health endpoint dynamically loads allowlist
- control.html shows low-risk execution allowlist section
- All 17 commands are validation scripts that do not call models, generate media, or modify timers

---

## PREVIOUS_ALLOWLIST (5 canary)

1. `validate:control-server`
2. `validate:control-readonly-actions`
3. `validate:control-actions-dry-run`
4. `dashboard:control:drift-check`
5. `dashboard:policy:validate`

---

## NEW_ALLOWLIST (17 total)

### Original 5 (retained)
1. `validate:control-server`
2. `validate:control-readonly-actions`
3. `validate:control-actions-dry-run`
4. `dashboard:control:drift-check`
5. `dashboard:policy:validate`

### Added 12 (5C-2C-B)
6. `validate:telegram-sanitizer`
7. `validate:sanitizer-false-positives`
8. `validate:sanitizer-secret-completeness`
9. `validate:project-report-send`
10. `dashboard:control:validate`
11. `dashboard:validate`
12. `validate:public-gallery`
13. `validate:daily-archive`
14. `validate:gallery-dedup`
15. `validate:content-pack-pages`
16. `validate:music-prompts`
17. `validate:video-prompts`

---

## ADDED_VALIDATION_COMMANDS

| # | Command | Purpose | Risk Level |
|---|---------|---------|------------|
| 6 | validate:telegram-sanitizer | Validate Telegram digest sanitizer | safe |
| 7 | validate:sanitizer-false-positives | Validate sanitizer false positive handling | safe |
| 8 | validate:sanitizer-secret-completeness | Validate secret redaction completeness | safe |
| 9 | validate:project-report-send | Validate project report send-gate | safe |
| 10 | dashboard:control:validate | Validate control catalog | safe |
| 11 | dashboard:validate | Validate dashboard | safe |
| 12 | validate:public-gallery | Validate public gallery | safe |
| 13 | validate:daily-archive | Validate daily archive | safe |
| 14 | validate:gallery-dedup | Validate gallery dedup | safe |
| 15 | validate:content-pack-pages | Validate content pack pages | safe |
| 16 | validate:music-prompts | Validate music prompts | safe |
| 17 | validate:video-prompts | Validate video prompts | safe |

All 12 added commands are pure validation scripts that:
- Do NOT call models (`calls_model=false`)
- Do NOT generate media (`generates_media=false`)
- Do NOT modify timers (`modifies_timer=false`)
- Do NOT send Telegram messages
- Do NOT collect data from external sources
- Do NOT execute git operations

---

## STILL_BLOCKED_COMMANDS

The following remain blocked for real execution:

| Category | Examples | Blocked By |
|----------|----------|------------|
| Model generation | `generate:image:confirmed`, `generate:controlled:images` | `calls_model=true`, `generates_media=true` |
| Telegram sending | `digest:send:confirmed`, `report:send` | `requires_env: CQA_ALLOW_TELEGRAM_SEND` |
| Data collection | `collect:fresh:fast`, `collect:fresh:full` | `modifies_files=true`, external network |
| Timer modification | `daily:scheduled`, `timer:*` | `modifies_timer=true` |
| Git operations | `git push`, `git pull` | `blocked_patterns: git` |
| Build/deploy | `build`, `deploy`, `release` | `blocked_patterns: build, deploy, release` |

---

## RUNNER_SECURITY_MODEL

```typescript
// scripts/control-action-runner.ts
export async function executeLowRiskAction(scriptName: string, action_id: string): Promise<ExecutionResult> {
  const allowlist = loadAllowlist();
  
  // 1. Must be in explicit allowlist
  if (!isAllowed(scriptName, allowlist)) { return blockedResult; }
  
  // 2. Fixed command: npm
  if (allowlist.safety_rules.command_only !== "npm") { return errorResult; }
  const args = ["run", scriptName];
  
  // 3. spawn with shell=false
  const child = spawn("npm", args, {
    cwd: PROJECT_ROOT,
    shell: false,        // CRITICAL: no shell
    env: {               // Minimal env, no secrets
      PATH: process.env.PATH || "/usr/bin:/bin",
      HOME: process.env.HOME || "",
      NODE_ENV: "production",
    },
  });
  
  // 4. Timeout enforced
  const timeout = setTimeout(() => { child.kill("SIGTERM"); }, allowlist.max_runtime_ms);
  
  // 5. Output truncated
  // stdout/stderr limited to max_output_chars
}
```

Key properties:
- `shell=false` — no shell injection
- `command_only="npm"` — only npm scripts
- `args_only=["run", "SCRIPT_NAME"]` — fixed args
- `no_secrets_in_env=true` — minimal environment
- `timeout_enforced=true` — 60s max
- `output_truncated=true` — 12,000 chars max

---

## AUTH_CONFIRM_MODEL

```
POST /api/action/execute-low-risk
Body: {
  "action_id": "validate_control-server",
  "confirm_phrase": "EXECUTE LOW RISK",
  "token": "<CQA_CONTROL_TOKEN>"
}
```

Validation layers:
1. `action_id` must exist in `control-catalog.json`
2. `execution_mode` must be `confirmed_low_risk`
3. `real_execution_supported` must be `true`
4. `risk_level` must be `safe`
5. `calls_model` must be `false`
6. `generates_media` must be `false`
7. `modifies_timer` must be `false`
8. `token` must match `CQA_CONTROL_TOKEN` (if configured)
9. `confirm_phrase` must be exactly `EXECUTE LOW RISK`

All 9 layers must pass before execution.

---

## AUDIT_LOG_STATUS

- Location: `reports/control-action-audit.jsonl` (gitignored)
- Format: JSON lines, one entry per action
- Fields: `ts`, `mode`, `phase`, `action_id`, `script_name`, `risk_level`, `confirm_ok`, `real_execution`, `result`, `reason`, `exit_code`, `timed_out`, `duration_ms`
- Token redaction: ✅ Audit log NEVER contains the control token
- Example entry:
  ```json
  {"ts":"2026-06-13T...","mode":"confirmed_low_risk","phase":"5C-2C-B","action_id":"validate_control-server","script_name":"validate:control-server","risk_level":"safe","confirm_ok":true,"real_execution":true,"result":"success","reason":"executed","exit_code":0,"timed_out":false,"duration_ms":310}
  ```

---

## VALIDATION_RESULTS

All 9 validation suites PASS:

| Suite | Pass | Fail | Status |
|-------|------|------|--------|
| dashboard:control:generate | - | - | ✅ Generated 75 commands, 82 total |
| dashboard:control:drift-check | 19 | 0 | ✅ PASS |
| dashboard:policy:build | - | - | ✅ 82 commands, 0 need review |
| dashboard:policy:validate | 35 | 0 | ✅ PASS |
| validate:control-server | 20 | 0 | ✅ PASS |
| dashboard:control:validate | 15 | 0 | ✅ PASS |
| validate:control-actions-dry-run | 20 | 0 | ✅ PASS |
| validate:control-readonly-actions | 21 | 0 | ✅ PASS |
| validate:control-low-risk-execution | 167 | 0 | ✅ PASS |
| validate:sanitizer-secret-completeness | 36 | 0 | ✅ PASS |
| validate:sanitizer-false-positives | 25 | 0 | ✅ PASS |
| validate:telegram-sanitizer | 43 | 0 | ✅ PASS |
| validate:project-report-send | 11 | 0 | ✅ PASS |

Total: 412 checks, 0 failures.

---

## SMOKE_TEST_RESULT

| Test | Action | Expected | Result |
|------|--------|----------|--------|
| 1 | validate:control-server | real_execution=true, exit_code=0 | ✅ PASS |
| 2 | validate:telegram-sanitizer | real_execution=true, exit_code=0 | ✅ PASS |
| 3 | dashboard:control:validate | real_execution=true, exit_code=0 | ✅ PASS |
| 4 | Wrong confirmation | real_execution=false | ✅ PASS |
| 5 | generate:image:confirmed | Blocked (Forbidden) | ✅ PASS |
| 6 | Audit log | No token | ✅ PASS |
| 7 | Health endpoint | phase=5C-2C-B, count=17 | ✅ PASS |

---

## BLOCKED_ACTION_TESTS

| Action | Block Reason | Test Result |
|--------|-------------|-------------|
| `generate:image:confirmed` | `execution_mode=dry_run_only` (not `confirmed_low_risk`) | ✅ Blocked |
| `digest:send:confirmed` | `execution_mode=dry_run_only` | ✅ Blocked |
| `collect:fresh:fast` | `execution_mode=dry_run_only` | ✅ Blocked |
| `timer:*` | Not in allowlist, blocked by pattern | ✅ Blocked |
| `git push` | Not in allowlist, blocked by pattern | ✅ Blocked |

---

## SANITIZER_REGRESSION_RESULTS

- False positive tests (15): ✅ All PASS
  - `low-risk-execution`, `risk-execution`, `task-execution` preserved
  - `markdown-sketch-note`, `desk-report`, `flask-app` preserved
  - `MiniMax Music Prompt`, `minimax-music` preserved
- Real secret tests (7): ✅ All PASS
  - `sk-cp`, `sk`, `sk-proj` secrets redacted
  - `OPENAI_API_KEY`, `MINIMAX_API_KEY` redacted
  - `Authorization Bearer` redacted
  - `TELEGRAM_BOT_TOKEN` redacted (full value including after colon)
  - `CQA_CONTROL_TOKEN` redacted
- Mixed tests (4): ✅ All PASS
- Telegram token edge cases (5): ✅ All PASS
  - Short token `1:2` NOT redacted (too short)
  - Non-Telegram colon pattern NOT redacted

---

## MODEL_CALL_STATUS

- Model calls: **0**
- `validate:control-server`: No model calls
- `validate:telegram-sanitizer`: No model calls
- `dashboard:control:validate`: No model calls
- All 17 allowlist commands: `calls_model=false`

---

## GENERATED_MEDIA_STATUS

- Media generated: **0**
- All 17 allowlist commands: `generates_media=false`

---

## LIMITATIONS

1. `generate:image:confirmed` remains blocked — requires `CQA_ALLOW_GENERATION=1` and `MINIMAX_API_KEY`
2. `digest:send:confirmed` remains blocked — requires `CQA_ALLOW_TELEGRAM_SEND=1`
3. `collect:*` remains blocked — modifies external data sources
4. `timer:*` remains blocked — modifies systemd timer
5. `git push` remains blocked — requires manual execution
6. Control server still localhost-only (`127.0.0.1:8788`)
7. All real execution still requires `CQA_CONTROL_TOKEN` and `EXECUTE LOW RISK` confirmation phrase
8. Audit log is local-only (`reports/control-action-audit.jsonl`) and gitignored

---

## NEXT_PHASE_PROPOSAL

### Phase 5C-2C-C: End-to-end Execution Test
- Test: `collect:fresh:fast` → `digest:telegram` → `digest:send:confirmed` (with `CQA_ALLOW_TELEGRAM_SEND=1`)
- This would be the first full pipeline execution test
- Requires: external data collection, model calls, Telegram sending
- Risk: High — only execute with explicit approval and monitoring

### Phase 5C-5: Control Server Production Hardening
- Add rate limiting
- Add IP-based access control
- Add session management
- Consider HTTPS/TLS termination

### Phase 5C-6: Audit Log Analysis
- Parse audit log to find execution patterns
- Detect anomalies
- Generate compliance reports

---

## FILES_CHANGED

- `dashboard/control-execution-allowlist.json` — Expanded from 5 to 17 commands
- `dashboard/control-policy.json` — Added 12 new rules for confirmed_low_risk
- `scripts/generate-control-catalog.ts` — Updated confirmation phrase for confirmed_low_risk
- `dashboard/control-catalog.json` — Regenerated with 82 commands
- `dashboard/control-catalog.generated.json` — Regenerated
- `dashboard/policy-review.json` — Rebuilt
- `dashboard/control.html` — Added low-risk execution allowlist section
- `scripts/control-server.ts` — Updated health endpoint, phase, log message
- `scripts/control-action-runner.ts` — No changes (already correct)
- `scripts/validate-control-low-risk-execution.ts` — Already updated for 5C-2C-B
- `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` — Updated
- `README.md` — Updated
- `ROADMAP.md` — Updated
- `docs/PHASE_5C2C_B_MORE_LOW_RISK_VALIDATIONS_REPORT.md` — This report
- `reports/more-low-risk-validations.md` — This report (copy)
- `reports/telegram-phase-5c2c-b-more-low-risk-validations.txt` — Sanitized Telegram report

---

## COMMIT

```
Phase 5C-2C-B: Expand low-risk validation execution allowlist
```

---

*Generated by Phase 5C-2C-B validation pipeline. No model calls. No media generated.*
