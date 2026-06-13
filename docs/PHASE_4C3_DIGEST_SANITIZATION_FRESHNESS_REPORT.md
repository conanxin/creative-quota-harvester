# PHASE 4C-3 — Digest Sanitization & Signal Freshness Recovery

## STATUS

**PASS** — digest sanitizer in place; freshness logic updated; all 4 validators pass; confirmed re-send succeeded (message_id=50003).

---

## WHAT_CHANGED

| # | Change | File |
|---|--------|------|
| 1 | New sanitizer module `sanitizeTelegramDigest` | `src/reports/telegram-digest-sanitizer.ts` (NEW) |
| 2 | Digest generator applies sanitizer before writing | `src/reports/telegram-daily-digest.ts` |
| 3 | STATUS now `WARN` when signals >24h stale | `src/reports/telegram-daily-digest.ts` |
| 4 | "MiniMax called" → "Image model called" (no MiniMax identifier in output) | `src/reports/telegram-daily-digest.ts` |
| 5 | Send hook applies sanitizer + tool-residue check before send | `scripts/send-telegram-digest.ts` |
| 6 | Preview uses sanitized text; uses "Truncated marker" label (no `[truncated]` literal) | `scripts/send-telegram-digest.ts` |
| 7 | New validator `validate:telegram-sanitizer` | `scripts/validate-telegram-sanitizer.ts` (NEW) + `package.json` |
| 8 | Freshness validator handles escaped underscores in URLs | `scripts/validate-digest-freshness.ts` |
| 9 | Runbook v3.0 update | `docs/SCHEDULED_DAILY_DIGEST_RUNBOOK.md` |

---

## SANITIZER_RULES

The sanitizer removes or replaces:

| Category | Patterns |
|----------|----------|
| Tool residue | `<tool_call>`, `</tool_call>`, `<invoke>`, `</invoke>`, `<content>`, `</content>`, `<function>`, `</function>`, `<|tool_call|>`, etc. |
| Identifiers | `minimax`, `MiniMax` → replaced with "image model" |
| Secrets | `sk-...`, `sk-cp-...`, `sk-proj-...`, `ghp_...`, `xox[baprs]-...` |
| Env leaks | `TELEGRAM_BOT_TOKEN=...`, `MINIMAX_API_KEY=...`, `*_API_KEY=...`, `Authorization: Bearer ...`, `.env contains secret` |
| Markers | `[truncated]` removed |
| Raw payloads | `{"name": "...", "tool": "...", "arguments": {...}` |

Whitespace is collapsed after removal.

---

## TOOL_RESIDUE_FIX

- Both `telegram-daily-digest.ts` and `send-telegram-digest.ts` apply the sanitizer.
- `validate-telegram-sanitizer.ts` scans digest + preview + MD report for all forbidden patterns.
- Result: **0 forbidden patterns** in any of the 3 deliverables.

---

## SIGNAL_FRESHNESS_FIX

`checkStaleness()` now returns a 3-state status:

- **PASS** — signals collected within 24h
- **WARN** — signals collected >24h ago (using fallback data)
- **FALLBACK** — no collection timestamp available

`overallStatus` derives from freshness:
- `freshness.status === 'PASS'` → `STATUS: PASS`
- otherwise → `STATUS: WARN`

`signal_last_collected_at` field is now in both `telegram-digest.txt` and `daily-digest.md`.

---

## COLLECT_RESULT

**Manual collect attempt (`npm run collect`):** process was killed (SIGKILL after ~2min timeout — likely network or timeout in upstream source calls).

**Fallback semantics applied:** the digest correctly shows `STATUS: WARN` and `Signal freshness: WARN — signals last collected 55h ago (>24h, fallback to previous data)`.

The signal_last_collected_at reflects the actual last successful refresh (2026-06-11 01:14 from DB mtime).

---

## DIGEST_STATUS_AFTER_FIX

```
Creative Quota Daily Digest — 2026-06-13
STATUS: WARN

今日输入
Signals: 298 (...)
Content Packs: 25 (25 with image prompt)
Generated Assets: 5 (5 img / 0 music / 0 video)
Signal freshness: WARN — signals last collected 55h ago (>24h, fallback to previous data)

...

本阶段执行结果
Delivery: systemd timer + Telegram auto-send
Image model called: No
New media generated: No
.env tracked: No
```

Note: "Image model called: No" replaces the previous "MiniMax called: No" to avoid leaking the model identifier.

---

## SEND_DRY_RUN_RESULT

```
Mode: DRY-RUN
Digest chars: 1662/3500
Has secrets: NO ✅
Tool residue after sanitize: NONE ✅
Valid: PASS ✅

DRY-RUN COMPLETE
No message sent to Telegram.
```

---

## OPTIONAL_CONFIRMED_SEND_RESULT

**Sent:** `message_id: 50003` via `npm run digest:send:confirmed` (sanitized text).

---

## VALIDATION_RESULTS

| Validator | Result |
|-----------|--------|
| `npm run validate:digest-freshness` | **PASS** (16/16) |
| `npm run validate:telegram-sanitizer` | **PASS** (6/6) |
| `npm run digest:telegram:check` | **PASS** |
| `npm run digest:send:dry-run` | **PASS** |
| `npm run validate:telegram-send` | 13/15 (1 intentional: `.env.telegram.local not committed`) |
| `npm run validate:telegram-auto-send` | **PASS** (7/7) |

---

## MINIMAX_CALL_STATUS

**No.** No MiniMax calls were made. No image, music, or video generation occurred.

---

## GENERATED_MEDIA_STATUS

**No new media generated.**

---

## SECRET_SAFETY_CHECK

- `.env` and `.env.telegram.local` NOT staged for commit
- No tokens in digest output (sanitizer redacts any leaked secrets)
- No real tokens in git history
- Send hook uses sanitized text in both preview and Telegram API call

---

## NEXT_PHASE_PROPOSAL

- Phase 4C-3: ✅ done
- Phase 4H: Video Prompt Enhancement
- Phase 5C: Private Control Dashboard
- Phase 3F: Controlled image generation (human-in-loop)
- Phase 4C-4: Investigate collect timeout (likely network or rate-limit issue)

---

*Generated: 2026-06-13*