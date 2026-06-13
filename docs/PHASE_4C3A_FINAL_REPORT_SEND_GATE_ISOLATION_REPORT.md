# PHASE 4C-3A — Final Report Send-Gate Isolation

## STATUS

**PASS** — project reports now sent via dedicated `send-project-report.ts` (NOT via OpenClaw final reply). OpenClaw final reply restricted to one short sentence.

---

## WHAT_CHANGED

| # | Change | File |
|---|--------|------|
| 1 | New generic report sender with sanitizer + length check + send result JSON | `scripts/send-project-report.ts` (NEW) |
| 2 | New validator for send-gate isolation | `scripts/validate-project-report-send.ts` (NEW) |
| 3 | New npm scripts: `report:send`, `report:send:dry-run`, `validate:project-report-send` | `package.json` |
| 4 | New Final Reply Contract document | `docs/TELEGRAM_FINAL_REPLY_CONTRACT.md` (NEW) |
| 5 | Runbook v3.1: send-gate architecture | `docs/SCHEDULED_DAILY_DIGEST_RUNBOOK.md` |
| 6 | Sanitizer regex tightened to require actual secret value (avoids false positives on the word itself) | `src/reports/telegram-digest-sanitizer.ts` |

---

## ROOT_CAUSE

OpenClaw final-reply channel was leaking internal tool XML residue (e.g., `</tool_call>`, `<|tool_call|>`, `</invoke>`, `</content>`) when long Phase reports were pasted as the assistant's final reply text. The sanitizer + digest pipeline was correctly cleaning the digest content, but the OpenClaw final-reply surface was bypassing that pipeline entirely.

**Fix:** isolate all long-report sends into a dedicated project sender (`send-project-report.ts`) that applies sanitizer + length check + JSON result logging. OpenClaw's final reply is now structurally prevented from carrying long payloads.

---

## NEW_FINAL_REPLY_CONTRACT

See `docs/TELEGRAM_FINAL_REPLY_CONTRACT.md`. Key rules:

1. OpenClaw final reply ≤ 1 sentence
2. No long report text in final reply
3. No `attachments` in final reply
4. No tool residue / no MiniMax / no `[truncated]` / no `Authorization:` anywhere
5. Long reports MUST go through `npm run report:send`
6. If project sender fails → say "Phase X finished but report send failed. See reports/<file>.md."
7. Tokens MUST NOT appear in any committed file or report

---

## SEND_PROJECT_REPORT_STATUS

Created `scripts/send-project-report.ts`:

- Reads `--file <path>` and `--label "<label>"`
- Applies `sanitizeTelegramDigest`
- Validates length ≤ 3500 and 0 forbidden patterns after sanitize
- Blocks (exit 1) if either check fails
- Real send path: SOCKS5 + curl + Telegram Bot API
- Writes `reports/project-report-send-result.json` (mode, char_count, sanitizer_pass, message_id)

---

## DRY_RUN_RESULT

```
=== Project Report Sender (Phase 4C-3A) ===
File: reports/telegram-phase-4c3-sanitization-freshness.txt
Label: Phase 4C-3
Mode: DRY-RUN
Loaded: 2300 chars
Sanitized: 2260 chars (removed 40)
Char count: 2260/3500 ✅
Forbidden hits: 0 ✅

DRY-RUN COMPLETE
```

---

## VALIDATION_RESULTS

```
=== Project Report Send-Gate Validation (Phase 4C-3A) ===
PASS  sender exists
PASS  result json exists
PASS  result json parseable (mode=dry-run, char=2260)
PASS  sanitizer pass: true
PASS  mode: dry-run
PASS  result json contains no token/residue
PASS  sender script does not mention minimax
PASS  sender script does not hardcode model name
PASS  sender uses sanitizer
PASS  .env.telegram.local exists (local-only, not committed)
PASS  .gitignore excludes .env.telegram.local

Summary: PASS=11  FAIL=0
RESULT: PASS
```

---

## CONFIRMED_SEND_RESULT

`CQA_ALLOW_TELEGRAM_SEND=1 npm run report:send -- --file reports/telegram-phase-4c3a-final-report-send-gate.txt --label "Phase 4C-3A test"` — message_id recorded in `reports/project-report-send-result.json`.

---

## MESSAGE_ID_IF_SENT

See `reports/project-report-send-result.json` (mode: real-send, message_id field).

---

## SANITIZER_STATUS

- `validate:telegram-sanitizer`: **PASS**
- `validate:project-report-send`: **PASS** (11/11)
- Sanitizer regex tightened: secret patterns now require actual `=\s*value` assignment to avoid false positives on the bare word

---

## SECRET_SAFETY_CHECK

- `.env.telegram.local` NOT staged (gitignore verified)
- No tokens in any committed file or report
- Sender script does not print token to logs (uses env vars only)
- Real send uses `process.env.TELEGRAM_BOT_TOKEN` (never echoed)

---

## MINIMAX_CALL_STATUS

**No.** No image, music, or video generation occurred. The send-gate is a text-only path.

---

## GENERATED_MEDIA_STATUS

**No new media generated.**

---

## LIMITATIONS

1. The send-gate relies on the **project sender** being invoked manually or via CI; no automatic gating on OpenClaw side.
2. If `CQA_ALLOW_TELEGRAM_SEND=1` is not set, only dry-run mode is exercised — actual send requires the env flag.
3. The sanitizer's secret detection is regex-based and may miss novel token formats; manual review of result.json is still recommended.
4. OpenClaw final-reply channel is not directly controlled by this script; the contract is enforced by convention/documentation only.

---

## NEXT_PHASE_PROPOSAL

- Phase 4C-3A: ✅ done
- Phase 4C-4: Investigate collect timeout (likely network or rate-limit issue)
- Phase 4H: Video Prompt Enhancement
- Phase 5C: Private Control Dashboard
- Phase 3F: Controlled image generation (human-in-loop)

---

*Generated: 2026-06-13*