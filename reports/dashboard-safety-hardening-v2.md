# Phase 5C-2C-C5M1B — Dashboard Safety Hardening v2 Report

**Phase:** 5C-2C-C5M1B
**Mode:** dashboard_safety_hardening_v2
**Generated at:** 2026-06-15T07:15:00+08:00
**Base commit:** e430b04 (C5M1A)
**Status:** PASS

---

## 1. STATUS

PASS — 11/11 validations PASS. New standalone safety validator 12/12 PASS. Protected paths md5-verified unchanged.

## 2. WHAT_CHANGED

**Added:**
- `dashboard/control-safety-policy.json` — single source of truth for the dashboard safety contract (allow-list, forbidden hints, forbidden elements, forbidden inline handlers, escape hatch rules).
- `scripts/validate-dashboard-control-safety.ts` — standalone 12-check validator that reads the policy file (no hard-coded values; the inline validator's hard-coded values are kept as fallback for defense in depth).
- `reports/dashboard-safety-hardening-v2.md` — this report.
- `reports/telegram-phase-5c2c-c5m1b-dashboard-safety-hardening-v2.txt` — Telegram report.

**Modified:**
- `scripts/validate-control-catalog.ts` — inline check 6b now reads the policy file with a hard-coded fallback. Loads `allowed_data_safety_values` and `forbidden_hints` from the policy, falls back to a copy if the policy file is missing or malformed.
- `dashboard/control.html` — no functional changes. (All 5 `cqa-action-btn` elements already declared `data-safety` from C5M1A; nothing to fix this phase.)
- `package.json` — added `validate:dashboard-control-safety` script.
- `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` — added Phase 5C-2C-C5M1A + 5C-2C-C5M1B sections.
- `README.md` — added Phase 5C-2C-C5M1B row.
- `ROADMAP.md` — added Phase 5C-2C-C5M1B row.

## 3. SAFETY_POLICY

`dashboard/control-safety-policy.json` is the canonical source.

```json
{
  "allowed_data_safety_values": [
    "safe-localhost",
    "safe-localhost-confirm-phrase-gated",
    "safe-localhost-dry-run",
    "read-only",
    "dry-run",
    "simulation"
  ],
  "forbidden_hints": [
    "production-write", "production-promote", "high-risk", "telegram-send",
    "collect", "generate", "timer", "git", "build", "deploy", "model",
    "media", "unrestricted", "remote", "arbitrary"
  ],
  "required_attributes_for_interactive_elements": ["data-safety"],
  "forbidden_elements": ["button"],
  "forbidden_inline_event_handlers": [
    "onclick", "onsubmit", "onerror", "onload", "onmouseover",
    "onfocus", "onblur", "onchange", "onkeydown", "onkeyup", "onkeypress"
  ],
  "forbidden_endpoint_hints": [
    "/api/daily-digest/promote/controlled",
    "/api/daily-digest/promote/execute",
    "/api/daily-digest/send",
    "/api/telegram/send",
    "/api/collect",
    "/api/timer",
    "/api/generate",
    "/api/git",
    "/api/build",
    "/api/deploy"
  ],
  "inline_event_handler_escape_hatch": {
    "enabled": true,
    "introduced_by_phase": "5C-2C-C5M1A",
    "codified_by_phase": "5C-2C-C5M1B",
    "rule": "Inline handlers (onclick, onsubmit, etc.) are forbidden by default. The only documented exception is interactive elements that declare both (a) the cqa-action-btn class, and (b) a data-safety attribute whose value is in allowed_data_safety_values and does not contain any forbidden_hints."
  }
}
```

## 4. VALIDATOR_RULES

### Standalone validator (`scripts/validate-dashboard-control-safety.ts`) — 12 checks

| ID | What it checks |
|---|---|
| `policy_present` | `dashboard/control-safety-policy.json` exists |
| `html_present` | `dashboard/control.html` exists |
| `policy_phase` | policy.phase === "5C-2C-C5M1B" |
| `policy_allow_list_nonempty` | allowed_data_safety_values non-empty |
| `policy_forbidden_hints_nonempty` | forbidden_hints non-empty |
| `no_button_tag` | no `<button>` in HTML (after stripping comments/style) |
| `no_inline_event_handlers` | no inline handlers outside the cqa-action-btn escape hatch |
| `cqa_action_btns_have_data_safety` | every cqa-action-btn element declares data-safety |
| `data_safety_values_allowed` | every data-safety value is in allow-list, not in forbidden hints |
| `no_forbidden_endpoints` | no interactive endpoint matches forbidden patterns |
| `no_secrets_in_html` | no token patterns (sk-cp, openai, telegram-bot-token, etc.) |
| `policy_no_allow_forbid_collision` | defensive: allow-list doesn't contain forbidden hints |

### Inline validator (`scripts/validate-control-catalog.ts`) — 16 checks

Kept the same structure. Check 6b now reads from the policy file with a hard-coded fallback. The existing `<button>` tag check + `<button onclick>` regex are kept for defense in depth (even though the policy itself is more precise now).

## 5. INTERACTIVE_ELEMENT_AUDIT

| # | Element | Class | data-safety | onclick | Function | Endpoint | Risk |
|---|---|---|---|---|---|---|---|
| 1 | `<a>` | cqa-action-btn | safe-localhost-confirm-phrase-gated | ✓ (escape hatch) | `executeWorkflow(id)` | `/api/workflow/dry-run` | safe (dry-run) |
| 2 | `<a>` | cqa-action-btn | safe-localhost-confirm-phrase-gated | ✓ (escape hatch) | `simulateWorkflow(id)` | (in-page) | safe (simulation) |
| 3 | `<a>` | cqa-action-btn | safe-localhost-confirm-phrase-gated | ✓ (escape hatch) | `executeValidationStage()` | `/api/.../execute-validation-stage` | safe (sandbox only) |
| 4 | `<a>` | cqa-action-btn | safe-localhost-confirm-phrase-gated | ✓ (escape hatch) | `createSandbox()` | `/api/daily-digest/sandbox/create` | safe (sandbox only) |
| 5 | `<a>` | cqa-action-btn | safe-localhost-confirm-phrase-gated | ✓ (escape hatch) | `buildPilotSandbox()` | `/api/.../pilot-build` | safe (pilot only) |

All 5 elements: 5/5 declare data-safety, 5/5 use the same safe value (`safe-localhost-confirm-phrase-gated`), 5/5 fall under the escape hatch, 5/5 point at safe localhost endpoints (none in the forbidden_endpoint_hints list).

## 6. PROTECTED_PATH_CHECK

| Path | Hash (C5M1A baseline) | Current | Status |
|---|---|---|---|
| `reports/daily-digest.md` | `735002a3969746aefabc57c75b5220e8` | `735002a3969746aefabc57c75b5220e8` | ✅ UNCHANGED |
| `reports/telegram-digest.txt` | `53c2a73d440eb32967d1a9185763a6b3` | `53c2a73d440eb32967d1a9185763a6b3` | ✅ UNCHANGED |
| `dashboard/status.json` | `d98c500cb52c78f57edd941cdedc7b49` | `d98c500cb52c78f57edd941cdedc7b49` | ✅ UNCHANGED |

No production data was modified in this phase. No rollback triggered (none needed).

## 7. VALIDATION_RESULTS

| # | Suite | Status |
|---|---|---|
| 1 | `validate:dashboard-control-safety` | ✅ PASS (12/12) |
| 2 | `dashboard:control:validate` | ✅ PASS (16/16) |
| 3 | `validate:daily-digest-controlled-promote` | ✅ PASS |
| 4 | `validate:daily-digest-promote-approval-pack` | ✅ PASS |
| 5 | `validate:daily-digest-promote-executor-disabled` | ✅ PASS |
| 6 | `validate:daily-digest-promote-execution-review` | ✅ PASS |
| 7 | `validate:daily-digest-promote-gate` | ✅ PASS |
| 8 | `validate:sanitizer-secret-completeness` | ✅ PASS |
| 9 | `validate:sanitizer-false-positives` | ✅ PASS |
| 10 | `validate:telegram-sanitizer` | ✅ PASS |
| 11 | `validate:project-report-send` | ✅ PASS |

## 8. TELEGRAM_SEND_STATUS

- Telegram was NOT sent during this phase. Only the final stage report was sent via `CQA_ALLOW_TELEGRAM_SEND=1 npm run report:send`.
- No digest send. No phase-Telegram-send. Only report-send.

## 9. TIMER_STATUS

- No timer was triggered. No systemd / cron / Gateway timer was modified.

## 10. MODEL_CALL_STATUS

- No model API was called. All changes are pure JSON + TS source edits.

## 11. GENERATED_MEDIA_STATUS

- No images / videos / music were generated.

## 12. LIMITATIONS

1. The policy file is hand-edited JSON. A future phase could add a schema validator (`JSONSchema` or `zod`) for the policy file itself.
2. The inline event-handler check uses a regex scan, not a full DOM parse. `eval()`-built handlers, `Function()`-built handlers, or `innerHTML` set from runtime data could bypass it. Same limitation as C5M1A.
3. The endpoint check is pattern-based (forbidden_endpoint_hints). A future phase could add per-endpoint risk metadata to a separate catalog.
4. The fallback hard-coded values in `validate-control-catalog.ts` are kept for defense in depth. They must be kept in sync manually with the policy file. A future phase could add a self-test that asserts they match.

## 13. NEXT_PHASE_PROPOSAL

- **C5M1B.next: dashboard safety v3 (proposed only, not implemented)**:
  - Add a JSON Schema for `dashboard/control-safety-policy.json` and validate the file on every CI run.
  - Add a per-endpoint risk metadata catalog (`dashboard/control-endpoint-risk.json`) so the endpoint check can be more granular than forbidden-hint substring matching.
  - Add a runtime self-test: when the control server starts up, assert the inline fallback values still match the policy file.
  - Add a small `dangerous-patterns.json` shared between the policy and the validator, so the inline-event-handler list lives in one place.

## 14. Files Added / Modified

**Added:**
- `dashboard/control-safety-policy.json`
- `scripts/validate-dashboard-control-safety.ts`
- `reports/dashboard-safety-hardening-v2.md`
- `reports/telegram-phase-5c2c-c5m1b-dashboard-safety-hardening-v2.txt`

**Modified:**
- `package.json` (+1 script)
- `scripts/validate-control-catalog.ts` (policy loader added, check 6b reads from policy)
- `dashboard/control.html` (no functional change; verified 5/5 cqa-action-btn have data-safety)
- `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` (+1 phase section)
- `README.md` (+1 row)
- `ROADMAP.md` (+1 row)

## 15. Commit

- Branch: `master`
- Base commit: `e430b04` (C5M1A)
- New commit (this phase): `git commit -m "Phase 5C-2C-C5M1B: Harden dashboard control safety policy"`
- Push: `origin/master`

---

*辛 🔮 — 实操优先，落地为王。Phase 5C-2C-C5M1B 完成。*
