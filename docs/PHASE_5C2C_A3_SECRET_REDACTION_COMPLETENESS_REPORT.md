# Phase 5C-2C-A3 Report: Secret Redaction Completeness Check

**Status:** PASS (36/36 secret-completeness tests, 25/25 false-positive tests, 43/43 telegram sanitizer, 11/11 project-report-send, 20/20 control-server, 34/34 policy validation, 40/40 low-risk execution, 19/19 dry-run, 21/21 readonly)
**Commit:** TBD  
**Push:** origin/master  
**Timestamp:** 2026-06-13T21:35:00+08:00

---

## 1. Root Cause

The sanitizer's regex for `TELEGRAM_BOT_TOKEN` used `\w-` which does NOT include the colon (`:`):

```javascript
/TELEGRAM_BOT_TOKEN\s*=\s*[\w-]{8,}/g
```

Telegram Bot Token format is: `123456789:ABCdef_GHIjkl` (numeric part, colon, alphanumeric part).

When this regex was applied to `TELEGRAM_BOT_TOKEN=123456789:ABCdef_GHIjkl-MnopQRST`:
- `[\w-]{8,}` matched only the numeric part `123456789` (9 characters)
- The colon `:` terminated the match
- The result was: `TELEGRAM_BOT_TOKEN=[REDACTED]:ABCdef_GHIjkl-MnopQRST`

The token value AFTER the colon was left in the output, which is a secret leak.

Same issue affected:
- `MINIMAX_API_KEY` regex (`[\w-]{8,}` — if value ever contained a colon, it would be truncated)
- `Authorization: Bearer` regex (`[\w-]{10,}` — if Bearer token contained a colon, it would be truncated)
- `Generic API_KEY` regex (`[\w-]{8,}` — same risk)

Additionally, `CQA_CONTROL_TOKEN` (from `.control.local`) was not in the sanitizer at all, so it would never be redacted.

Standalone Telegram bot tokens (e.g., `123456789:ABCdef_GHIjkl-MnopQRST` without `TELEGRAM_BOT_TOKEN=` prefix) were also not detected.

---

## 2. What Changed

### 2.1 telegram-digest-sanitizer.ts

**Fixed regexes to include colons (`:`) in the value matcher:**

```javascript
// Before (partial redaction, colon leaked)
/TELEGRAM_BOT_TOKEN\s*=\s*[\w-]{8,}/g

// After (complete redaction, colon included)
/TELEGRAM_BOT_TOKEN\s*=\s*[\w-:]+/g
```

Same fix applied to:
- `MINIMAX_API_KEY` → `MINIMAX_API_KEY\s*=\s*[\w-:]+/g`
- Generic `[A-Z_]+_API_KEY` → `[A-Z_]+_API_KEY\s*=\s*[\w-:]+/g`
- `Authorization: Bearer` → `Authorization:\s*Bearer\s+[\w-:]+/gi`

**Added new rules:**
- `CQA_CONTROL_TOKEN\s*=\s*[\w-:]+` → `CQA_CONTROL_TOKEN=[REDACTED]`
- Standalone Telegram bot token: `\b\d+:[A-Za-z0-9_-]{35,}\b` → `[REDACTED-TELEGRAM-BOT-TOKEN]`

The standalone rule requires:
- At least one digit before the colon
- At least 35 alphanumeric/underscore/hyphen characters after the colon
- This prevents false positives on short patterns like `1:2` or `ratio: 1:2:3:4:5`

**`FORBIDDEN_PATTERNS` updated** to match the same regexes so `findForbiddenPatterns()` also detects:
- Standalone Telegram tokens
- `CQA_CONTROL_TOKEN`
- Complete values including colons

### 2.2 validate-sanitizer-secret-completeness.ts (NEW)

Dedicated validation script with 36 tests:

**A. Complete redaction (12 tests):**
- `TELEGRAM_BOT_TOKEN=123456789:ABCdef_GHIjkl-MnopQRST` → `TELEGRAM_BOT_TOKEN=[REDACTED]`
- `TELEGRAM_BOT_TOKEN` long format → fully redacted
- Standalone Telegram token → `[REDACTED-TELEGRAM-BOT-TOKEN]`
- `CQA_CONTROL_TOKEN` → `CQA_CONTROL_TOKEN=[REDACTED]`
- `Authorization: Bearer` → `Authorization: Bearer [REDACTED]`
- `OPENAI_API_KEY`, `MINIMAX_API_KEY`, generic API_KEY → fully redacted
- `sk-cp`, `sk`, `sk-proj` real secrets → `[REDACTED-API-KEY]`

**B. False positive regression (15 tests):**
- All 15 Phase 5C-2C-A2 false positives still pass unchanged

**C. Mixed tests (4 tests):**
- False positives + real secrets in the same text
- Verifies both are handled correctly simultaneously

**D. Edge cases (5 tests):**
- `1:2` (too short) → NOT redacted
- `ratio: 1:2:3:4:5` → NOT redacted
- `CQA_CONTROL_TOKEN` with dashes and underscores → fully redacted

### 2.3 package.json

Added script:
```json
"validate:sanitizer-secret-completeness": "tsx scripts/validate-sanitizer-secret-completeness.ts"
```

---

## 3. TELEGRAM_TOKEN_REDACTION_RESULT

| Input | Expected Output | Status |
|-------|-----------------|--------|
| `TELEGRAM_BOT_TOKEN=123456789:ABCdef_GHIjkl-MnopQRST` | `TELEGRAM_BOT_TOKEN=[REDACTED]` | ✅ PASS |
| `TELEGRAM_BOT_TOKEN=123456789:ABCdef_GHIjkl-MnopQRSTuvwxyz1234567890` | `TELEGRAM_BOT_TOKEN=[REDACTED]` | ✅ PASS |
| `123456789:ABCdef_GHIjkl-MnopQRSTuvwxyz1234567890` (standalone) | `[REDACTED-TELEGRAM-BOT-TOKEN]` | ✅ PASS |
| `1:2` (too short) | `1:2` (unchanged) | ✅ PASS |
| `ratio: 1:2:3:4:5` (non-Telegram) | `ratio: 1:2:3:4:5` (unchanged) | ✅ PASS |

**No token residue after colon.** The entire value is replaced by `[REDACTED]`.

---

## 4. CONTROL_TOKEN_REDACTION_RESULT

| Input | Expected Output | Status |
|-------|-----------------|--------|
| `CQA_CONTROL_TOKEN=test-local-control-token-12345` | `CQA_CONTROL_TOKEN=[REDACTED]` | ✅ PASS |
| `CQA_CONTROL_TOKEN=tk-5c2b-extra-long-value` | `CQA_CONTROL_TOKEN=[REDACTED]` | ✅ PASS |

---

## 5. API_KEY_REDACTION_RESULT

| Input | Expected Output | Status |
|-------|-----------------|--------|
| `OPENAI_API_KEY=real-looking-secret-value` | `OPENAI_API_KEY=[REDACTED]` | ✅ PASS |
| `MINIMAX_API_KEY=real-looking-secret-value` | `MINIMAX_API_KEY=[REDACTED]` | ✅ PASS |
| `MY_APP_API_KEY=some-secret-value-12345` | `MY_APP_API_KEY=[REDACTED]` | ✅ PASS |
| `Authorization: Bearer real-looking-token-1234567890` | `Authorization: Bearer [REDACTED]` | ✅ PASS |
| `sk-cp-real-looking-secret-1234567890` | `[REDACTED-API-KEY]` | ✅ PASS |
| `sk-real-looking-secret-1234567890` | `[REDACTED-API-KEY]` | ✅ PASS |
| `sk-proj-real-looking-secret-1234567890` | `[REDACTED-API-KEY]` | ✅ PASS |

---

## 6. FALSE_POSITIVE_REGRESSION_RESULT

| Input | Status |
|-------|--------|
| `reports/low-risk-execution-policy-validation-fix.md` | ✅ PASS (unchanged) |
| `low-risk-execution` | ✅ PASS (unchanged) |
| `risk-execution` | ✅ PASS (unchanged) |
| `task-execution` | ✅ PASS (unchanged) |
| `markdown-sketch-note` | ✅ PASS (unchanged) |
| `desk-report` | ✅ PASS (unchanged) |
| `flask-app` | ✅ PASS (unchanged) |
| `risk-management` | ✅ PASS (unchanged) |
| `disk-space` | ✅ PASS (unchanged) |
| `mask-policy` | ✅ PASS (unchanged) |
| `task-list` | ✅ PASS (unchanged) |
| `sk-cp` (too short) | ✅ PASS (unchanged) |
| `sk-test` (too short) | ✅ PASS (unchanged) |
| `MiniMax Music Prompt` | ✅ PASS (unchanged) |
| `minimax-music` | ✅ PASS (unchanged) |

---

## 7. Validation Results

| Validation | Result |
|------------|--------|
| `npm run validate:sanitizer-secret-completeness` | PASS (36/36) |
| `npm run validate:sanitizer-false-positives` | PASS (25/25) |
| `npm run validate:telegram-sanitizer` | PASS (43/43) |
| `npm run validate:project-report-send` | PASS (11/11) |
| `npm run validate:control-server` | PASS (20/20) |
| `npm run dashboard:policy:validate` | PASS (34/34) |
| `npm run validate:control-low-risk-execution` | PASS (40/40) |
| `npm run validate:control-actions-dry-run` | PASS (19/19) |
| `npm run validate:control-readonly-actions` | PASS (21/21) |

---

## 8. Model Call Status

None. No MiniMax, OpenAI, image, video, or music model calls.

## 9. Generated Media Status

None. No images, videos, music, or other media generated.

## 10. Boundaries Respected

| Boundary | Status |
|----------|--------|
| No MiniMax / image / video / music model calls | ✅ |
| No new media generated | ✅ |
| No execution allowlist expanded | ✅ |
| No real execution range expanded | ✅ |
| No `generate:*` executed | ✅ |
| No `digest:send:*` / `report:send:*` executed (except final project sender) | ✅ |
| No `collect:*` executed | ✅ |
| No `timer:*` executed | ✅ |
| No systemd timer modified | ✅ |
| No OpenClaw / Hermes / gateway config changed | ✅ |
| No `.env` / `.env.telegram.local` / `.control.local` committed | ✅ |
| No secrets in committed files | ✅ |
| Report sent by project sender | ✅ |

---

## 11. Limitations

1. The `[\w-:]+` regex matches colons, dashes, underscores, and alphanumeric characters. It does NOT match other punctuation (e.g., `!@#$%^&*`). If a secret value contains these characters, the regex would stop at the first unsupported character. For most API keys, this is acceptable because they are alphanumeric.
2. The standalone Telegram token regex `\b\d+:[A-Za-z0-9_-]{35,}\b` requires at least 35 characters after the colon. If a real Telegram bot token is shorter than 35 characters after the colon, it would not be detected. However, Telegram bot tokens are typically 35+ characters.
3. The `CQA_CONTROL_TOKEN` regex uses `[\w-:]+`. If the token value contains characters outside this set, it would be truncated. Control tokens are typically alphanumeric with dashes, so this is safe.
4. The `findForbiddenPatterns` function now has 10 patterns (was 8). The `testReport` function iterates over all of them, which is still fast.

---

## 12. Next Phase Proposal

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

**Phase 5C-2C-A3 COMPLETE**