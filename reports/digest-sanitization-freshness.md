# Digest Sanitization & Signal Freshness Recovery — 2026-06-13

## STATUS: PASS

## Sanitizer rules

Removed/replaced patterns: tool_call / </tool_call> / </invoke> / </content> / <function> / <tool> / <|tool_call|> / sk-... / sk-cp-... / ghp_... / xoxb-... / TELEGRAM_BOT_TOKEN= / MINIMAX_API_KEY= / *_API_KEY= / Authorization: Bearer / [truncated] / minimax / MiniMax.

Replaced with: "image model" (for minimax mentions), [REDACTED-...] (for secrets), or removed (for XML/tool fragments).

## Tool residue fix

- Both digest generator and send hook apply the sanitizer
- New validator `npm run validate:telegram-sanitizer` scans digest + preview + MD report
- Result: 0 forbidden patterns in all deliverables

## Signal freshness fix

`checkStaleness()` returns 3-state status:
- PASS — collected within 24h
- WARN — >24h ago, fallback to previous data
- FALLBACK — no timestamp available

`STATUS` now reflects freshness: PASS → "STATUS: PASS", else → "STATUS: WARN".

`signal_last_collected_at` present in both `telegram-digest.txt` and `daily-digest.md`.

## Collect result

Manual `npm run collect` was killed (SIGKILL after ~2min). Digest correctly shows WARN + FALLBACK semantics. signal_last_collected_at reflects 2026-06-11 01:14 (DB mtime, ~55h ago).

## Digest status after fix

```
STATUS: WARN
Signal freshness: WARN — signals last collected 55h ago (>24h, fallback to previous data)
Delivery: systemd timer + Telegram auto-send
Image model called: No  (was: MiniMax called: No)
New media generated: No
```

## Send dry-run result

PASS — 1662/3500 chars, no secrets, no tool residue after sanitize.

## Confirmed send result

message_id: 50003 (sent via `npm run digest:send:confirmed` with sanitized text).

## Validation results

- `npm run validate:digest-freshness`: PASS (16/16)
- `npm run validate:telegram-sanitizer`: PASS (6/6)
- `npm run digest:telegram:check`: PASS
- `npm run digest:send:dry-run`: PASS
- `npm run validate:telegram-send`: 13/15 (1 intentional FAIL: .env.telegram.local not committed)
- `npm run validate:telegram-auto-send`: PASS (7/7)

## MiniMax call status

No. No image, music, or video generation occurred.

## Generated media status

No new media generated.

## Secret safety check

- .env / .env.telegram.local NOT staged
- No tokens in any digest output
- Sanitizer aggressively redacts secrets in any text it touches

## Next phase proposal

- Phase 4C-3: done
- Phase 4H: Video Prompt Enhancement
- Phase 5C: Private Control Dashboard
- Phase 3F: Controlled image generation (human-in-loop)
- Phase 4C-4: Investigate collect timeout

See `docs/PHASE_4C3_DIGEST_SANITIZATION_FRESHNESS_REPORT.md` for full details.

*Generated: 2026-06-13*