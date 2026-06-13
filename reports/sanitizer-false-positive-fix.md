# Phase 5C-2C-A2: Sanitizer False Positive Fix for sk- Pattern

**Status:** PASS (25/25 false-positive tests, 43/43 telegram sanitizer, 40/40 low-risk execution, 34/34 policy validation, 19/19 dry-run, 21/21 readonly)
**Commit:** TBD  
**Push:** origin/master

## Root Cause

Sanitizer regex `sk-[A-Za-z0-9_-]{20,}` matched `sk-` in the middle of words:
- `risk-execution` → `sk-execution` (33 chars)
- `low-risk-execution` → `sk-execution` (33 chars)
- `task-execution` → `sk-execution` (33 chars)

No word boundary check before `sk-`, so any substring `sk-` + 20+ chars was treated as a secret.

## What Changed

- **telegram-digest-sanitizer.ts**: Added negative lookbehind `(?!<[A-Za-z0-9_-])` to `sk-` regexes in both `FORBIDDEN_PATTERNS` and `redactSecrets()`
- **validate-telegram-sanitizer.ts**: Added 15 false-positive self-tests, 5 real-secret tests, 3 mixed tests, 4 redaction behavior tests
- **validate-sanitizer-false-positives.ts**: NEW dedicated validation script with 25 tests (15 false-positive, 7 real-secret, 3 mixed)
- **validate-control-low-risk-execution.ts**: NEW script validating the 5 canary commands (40 checks)
- **package.json**: Added `validate:sanitizer-false-positives`, `validate:control-low-risk-execution`, restored `validate:project-report-send`

## False Positive Cases (Now PASS)

| Input | Status |
|-------|--------|
| `reports/low-risk-execution-policy-validation-fix.md` | ✅ PASS |
| `low-risk-execution` | ✅ PASS |
| `risk-execution` | ✅ PASS |
| `task-execution` | ✅ PASS |
| `markdown-sketch-note` | ✅ PASS |
| `desk-report` | ✅ PASS |
| `flask-app` | ✅ PASS |
| `risk-management` | ✅ PASS |
| `disk-space` | ✅ PASS |
| `mask-policy` | ✅ PASS |
| `task-list` | ✅ PASS |
| `sk-cp` (too short) | ✅ PASS |
| `sk-test` (too short) | ✅ PASS |
| `MiniMax Music Prompt` | ✅ PASS |
| `minimax-music` | ✅ PASS |

## Secret Redaction Cases (Still WORK)

| Input | Status |
|-------|--------|
| `sk-cp-real-looking-secret-1234567890` | ✅ REDACTED |
| `sk-real-looking-secret-1234567890` | ✅ REDACTED |
| `sk-proj-real-looking-secret-1234567890` | ✅ REDACTED |
| `OPENAI_API_KEY=real-looking-secret-value` | ✅ REDACTED |
| `MINIMAX_API_KEY=real-looking-secret-value` | ✅ REDACTED |
| `Authorization: Bearer real-looking-token-1234567890` | ✅ REDACTED |
| `TELEGRAM_BOT_TOKEN=1234567890:ABCdef_GHIjkl` | ✅ REDACTED |

## Validation Results

| Validation | Result |
|------------|--------|
| `validate:sanitizer-false-positives` | PASS (25/25) |
| `validate:telegram-sanitizer` | PASS (43/43) |
| `validate:project-report-send` | PASS (11/11) |
| `validate:control-server` | PASS (20/20) |
| `dashboard:policy:validate` | PASS (34/34) |
| `validate:control-low-risk-execution` | PASS (40/40) |
| `validate:control-actions-dry-run` | PASS (19/19) |
| `validate:control-readonly-actions` | PASS (21/21) |

## Model Calls / Media Generation

None. No model calls, no images/music/video generated.

## Limitations

1. Negative lookbehind requires Node.js 8.10+ (project requires >=20, safe)
2. Regex still matches `ask-cp-...` (preceded by `a`), but unlikely to be a real key
3. `{20,}` length heuristic may miss short test keys (<20 chars)

## Next Phase

- Phase 5C-2C-B: Expand canary to `briefs`, `digest:telegram`, `daily:manual`
- Phase 5C-5: End-to-end execution test (`collect:fresh:fast` → `digest:telegram` → `digest:send:confirmed`)

**Phase 5C-2C-A2 COMPLETE**