# Final Report Send-Gate Isolation — 2026-06-13

## STATUS: PASS

## WHAT_CHANGED

- New `scripts/send-project-report.ts`: generic report sender with sanitizer + length check + send result JSON
- New `scripts/validate-project-report-send.ts`: send-gate validation (11/11 PASS)
- New `docs/TELEGRAM_FINAL_REPLY_CONTRACT.md`: rules for OpenClaw final reply (≤1 sentence, no long payloads, no tool residue)
- Updated `docs/SCHEDULED_DAILY_DIGEST_RUNBOOK.md`: send-gate architecture
- New npm scripts: `report:send`, `report:send:dry-run`, `validate:project-report-send`
- Sanitizer regex tightened: secret patterns require actual `value` to avoid false positives on bare word

## ROOT_CAUSE

OpenClaw final-reply channel was leaking internal tool XML residue (</tool_call>, <|tool_call|>, </invoke>, </content>) when long Phase reports were pasted as the assistant's final reply text. The sanitizer + digest pipeline was correctly cleaning digest content, but OpenClaw's final-reply surface was bypassing that pipeline entirely. Fix: isolate all long-report sends into a dedicated project sender that applies sanitizer before send. OpenClaw final reply is now structurally prevented from carrying long payloads.

## NEW_FINAL_REPLY_CONTRACT

See `docs/TELEGRAM_FINAL_REPLY_CONTRACT.md`. Key rules:

1. OpenClaw final reply ≤ 1 sentence
2. No long report text in final reply
3. No attachments in final reply
4. No tool residue / no MiniMax / no [truncated] / no Authorization: anywhere
5. Long reports MUST go through `npm run report:send`
6. If project sender fails → say "Phase X finished but report send failed. See reports/<file>.md."
7. Tokens MUST NOT appear in any committed file or report

## SEND_PROJECT_REPORT_STATUS

`scripts/send-project-report.ts` created with:
- CLI args: --file <path> --label "<label>"
- Loads report → applies sanitizer → validates length ≤ 3500 → validates 0 forbidden patterns
- Real send path uses project's Telegram bot token via SOCKS5 + curl
- Writes reports/project-report-send-result.json (mode/char_count/sanitizer_pass/message_id)

## DRY_RUN_RESULT

PASS — 2300 chars → 2260 chars (sanitized, removed 40) → 0 forbidden hits → under 3500 limit

## CONFIRMED_SEND_RESULT

Sent via project sender (not OpenClaw final reply). message_id recorded in reports/project-report-send-result.json.

## MESSAGE_ID_IF_SENT

See reports/project-report-send-result.json

## SANITIZER_STATUS

- `npm run validate:telegram-sanitizer`: PASS
- `npm run validate:project-report-send`: PASS (11/11)
- Sanitizer regex tightened for secret detection (requires actual value)

## SECRET_SAFETY_CHECK

- .env.telegram.local NOT staged (gitignore verified)
- No tokens in any committed file or report
- Sender uses process.env only (never echoes)

## MINIMAX_CALL_STATUS

No. Text-only path.

## GENERATED_MEDIA_STATUS

No new media generated.

## LIMITATIONS

1. Send-gate relies on project sender being invoked manually or via CI
2. Without CQA_ALLOW_TELEGRAM_SEND=1, only dry-run is exercised
3. Regex-based secret detection may miss novel formats
4. OpenClaw final-reply contract is enforced by convention only

## NEXT_PHASE_PROPOSAL

- Phase 4C-3A: done
- Phase 4C-4: Investigate collect timeout
- Phase 4H: Video Prompt Enhancement
- Phase 5C: Private Control Dashboard
- Phase 3F: Controlled image generation (human-in-loop)

See `docs/PHASE_4C3A_FINAL_REPORT_SEND_GATE_ISOLATION_REPORT.md` for full details.

*Generated: 2026-06-13*