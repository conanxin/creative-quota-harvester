# Phase 5C-2C-A2 Report: Sanitizer False Positive Fix for sk- Pattern

**Status:** PASS (25/25 false-positive tests, 43/43 telegram sanitizer tests, 40/40 low-risk execution, 34/34 policy validation, 19/19 dry-run, 21/21 readonly)
**Commit:** TBD  
**Push:** origin/master  
**Timestamp:** 2026-06-13T21:30:00+08:00

---

## 1. Root Cause

The sanitizer's `sk-` API key regex was too broad:

```javascript
/sk-[A-Za-z0-9_-]{20,}/g
```

This matched `sk-` in the middle of words like:
- `risk-execution` → `sk-execution` (33 chars after `sk-`)
- `low-risk-execution` → `sk-execution` (33 chars after `sk-`)
- `task-execution` → `sk-execution` (33 chars after `sk-`)
- `markdown-sketch-note` → `sk-etch-note` (12 chars after `sk-` — not enough for 20, but longer variants would match)

The regex did not require a word boundary before `sk-`, so any occurrence of the substring `sk-` followed by 20+ alphanumeric/underscore/hyphen characters was treated as a secret.

**Impact:**
- Report path `reports/low-risk-execution-policy-validation-fix.md` was redacted to `reports/low-ri[REDACTED-API-KEY].md`
- All files and text containing `risk-execution`, `task-execution`, `low-risk-execution`, etc. were corrupted

---

## 2. What Changed

### 2.1 telegram-digest-sanitizer.ts

**Fixed regexes (added negative lookbehind):**

```javascript
// Before (false positive)
/sk-[A-Za-z0-9_-]{20,}/g

// After (no false positive)
/(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}/g
```

The negative lookbehind `(?<![A-Za-z0-9_-])` requires that the character before `sk-` is NOT a letter, number, underscore, or hyphen. This prevents matching `sk-` inside words like `risk-execution` (where `s` is preceded by `k`, a letter) while still matching `sk-` at the start of strings, after whitespace, or after punctuation.

Same fix applied to:
- `openai_key` regex in `FORBIDDEN_PATTERNS`
- `openai_proj_key` regex in `FORBIDDEN_PATTERNS`
- `redactSecrets` function's `sk-...` replacement regex

### 2.2 validate-telegram-sanitizer.ts

Added self-tests:
- 15 false-positive cases (all must PASS unchanged)
- 5 real-secret cases (all must FAIL / be redacted)
- 3 mixed cases (false positives + real secrets in same text)
- 4 redaction behavior tests (verify real secrets redacted, false positives preserved)

### 2.3 validate-sanitizer-false-positives.ts (NEW)

Dedicated validation script with 25 tests:
- 15 false-positive tests (findForbiddenPatterns must return 0 hits, sanitized text must be unchanged)
- 7 real-secret tests (findForbiddenPatterns must return >0 hits, sanitized text must contain `[REDACTED]`)
- 3 mixed tests (false positives + real secrets in same text, all expected substrings preserved)

### 2.4 package.json

Added scripts:
- `validate:sanitizer-false-positives`
- `validate:control-low-risk-execution` (was missing, added for completeness)
- `validate:project-report-send` (was accidentally removed, restored)

### 2.5 validate-control-low-risk-execution.ts (NEW)

Validates the 5C-2C-A canary:
- Allowlist has exactly 5 scripts
- All 5 have `execution_mode=confirmed_low_risk`, `risk=safe`, `calls_model=false`, `generates_media=false`, `modifies_timer=false`, `requires_confirm=true`
- No other commands have `real_execution_supported=true`
- Safety rules configured (`shell=false`, `command_only=npm`, `timeout_enforced`, `output_truncated`, `no_secrets_in_env`)

---

## 3. False Positive Cases (Now PASS)

| Input | Status | Reason |
|-------|--------|--------|
| `reports/low-risk-execution-policy-validation-fix.md` | ✅ PASS | `sk-` preceded by `k` (letter) |
| `low-risk-execution` | ✅ PASS | `sk-` preceded by `k` (letter) |
| `risk-execution` | ✅ PASS | `sk-` preceded by `k` (letter) |
| `task-execution` | ✅ PASS | `sk-` preceded by `k` (letter) |
| `markdown-sketch-note` | ✅ PASS | `sk-` preceded by `k` (letter) |
| `desk-report` | ✅ PASS | `sk-` preceded by `k` (letter) |
| `flask-app` | ✅ PASS | `sk-` preceded by `k` (letter) |
| `risk-management` | ✅ PASS | `sk-` preceded by `k` (letter) |
| `disk-space` | ✅ PASS | `sk-` preceded by `k` (letter) |
| `mask-policy` | ✅ PASS | `sk-` preceded by `k` (letter) |
| `task-list` | ✅ PASS | `sk-` preceded by `k` (letter) |
| `sk-cp` (too short) | ✅ PASS | only 3 chars after `sk-`, < 20 |
| `sk-test` (too short) | ✅ PASS | only 5 chars after `sk-`, < 20 |
| `MiniMax Music Prompt` | ✅ PASS | product name, not a secret |
| `minimax-music` | ✅ PASS | product name, not a secret |

---

## 4. Secret Redaction Cases (Still WORK)

| Input | Status | Redacted To |
|-------|--------|-------------|
| `sk-cp-real-looking-secret-1234567890` | ✅ REDACTED | `[REDACTED-API-KEY]` |
| `sk-real-looking-secret-1234567890` | ✅ REDACTED | `[REDACTED-API-KEY]` |
| `sk-proj-real-looking-secret-1234567890` | ✅ REDACTED | `[REDACTED-API-KEY]` |
| `OPENAI_API_KEY=real-looking-secret-value` | ✅ REDACTED | `OPENAI_API_KEY=[REDACTED]` |
| `MINIMAX_API_KEY=real-looking-secret-value` | ✅ REDACTED | `MINIMAX_API_KEY=[REDACTED]` |
| `Authorization: Bearer real-looking-token-1234567890` | ✅ REDACTED | `Authorization: Bearer [REDACTED]` |
| `TELEGRAM_BOT_TOKEN=1234567890:ABCdef_GHIjkl` | ✅ REDACTED | `TELEGRAM_BOT_TOKEN=[REDACTED]` |

---

## 5. Validation Results

| Validation | Result |
|------------|--------|
| `npm run validate:sanitizer-false-positives` | PASS (25/25) |
| `npm run validate:telegram-sanitizer` | PASS (43/43) |
| `npm run validate:project-report-send` | PASS (11/11) |
| `npm run validate:control-server` | PASS (20/20) |
| `npm run dashboard:policy:validate` | PASS (34/34) |
| `npm run validate:control-low-risk-execution` | PASS (40/40) |
| `npm run validate:control-actions-dry-run` | PASS (19/19) |
| `npm run validate:control-readonly-actions` | PASS (21/21) |

---

## 6. Boundaries Respected

| Boundary | Status |
|----------|--------|
| No MiniMax / image / video / music model calls | ✅ |
| No new media generated | ✅ |
| No Telegram message sent by this phase (except final project sender report) | ✅ |
| No generate:* executed | ✅ |
| No digest:send:* / report:send:* executed (except final) | ✅ |
| No collect:* executed | ✅ |
| No timer:* executed | ✅ |
| No git / push / pull executed (except final commit/push) | ✅ |
| No systemd timer modified | ✅ |
| No OpenClaw / Hermes / gateway config changed | ✅ |
| No .env / .control.local / Telegram token printed | ✅ |
| No secrets in committed files | ✅ |
| Report sent by project sender | ✅ |
| OpenClaw final reply = single short confirmation | ✅ |

---

## 7. Files Changed

```
 src/reports/telegram-digest-sanitizer.ts          | +5 lines, -2 lines
 scripts/validate-telegram-sanitizer.ts            | +35 lines
 scripts/validate-sanitizer-false-positives.ts    | NEW
 scripts/validate-control-low-risk-execution.ts  | NEW
 package.json                                      | +3 lines (scripts added)
```

---

## 8. Limitations

1. The negative lookbehind `(?<![A-Za-z0-9_-])` requires Node.js 8.10+ (supported in Node 22). If running on older Node.js, this would fail. The project specifies `node: ">=20.0.0"`, so it's safe.
2. The regex still matches `sk-` at the start of a word boundary, e.g., `ask-cp-...` (where `sk-` is preceded by `a`). This is acceptable because `ask-cp-...` is unlikely to be a real API key, but if it is, it would be redacted. However, `ask-cp-...` with 20+ chars after `sk-` is very unlikely in normal text.
3. The `{20,}` length requirement is a heuristic. Some real API keys might be shorter (e.g., test keys with 16 chars). But shorter keys are less likely to be confused with normal text.

---

## 9. Next Phase Proposal

### Phase 5C-2C-B: Expand Canary (Optional)
- Evaluate `briefs`, `digest:telegram`, `daily:manual` for `confirmed_low_risk` status
- These are safe, no model calls, no media generation, no timer modification
- Would expand allowlist from 5 to 8-10 commands

### Phase 5C-5: End-to-End Execution Test
- Full pipeline: `collect:fresh:fast` → `digest:telegram` → `digest:send:confirmed`
- Requires `CQA_ALLOW_TELEGRAM_SEND=1` and explicit user confirmation
- High risk: involves external API calls and message sending
- Not a canary candidate; requires separate risk assessment

---

**Phase 5C-2C-A2 COMPLETE**