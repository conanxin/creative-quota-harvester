# Music Metadata Sanitizer Scope Fix — Phase 4I-1 Detail Report

**Date:** 2026-06-13
**Phase:** 4I-1
**Status:** PASS

Full report: `docs/PHASE_4I1_MUSIC_METADATA_SANITIZER_SCOPE_FIX_REPORT.md`

## Root Cause

The Telegram sanitizer at `src/reports/telegram-digest-sanitizer.ts` had:
```js
text.replace(/\bMiniMax\b/g, 'image model')
text.replace(/\bminimax\b/g, 'image model')
```
This caught the **legitimate product name** "MiniMax" / "minimax" used in project reports (e.g. "model_family: minimax-music", "MiniMax Music Prompt") and substituted it with "image model".

## Asset Files Status

- **NOT contaminated** — `grep -R "image model-music"` and `grep -R "image model Music"` both returned 0 hits in both repos
- All 25 music-prompt.meta.json files correctly contain `"model_family": "minimax-music"`
- All 25 music-prompt.enriched.md files correctly contain `## MiniMax Music Prompt` heading
- Only sanitized Telegram output was affected

## Sanitizer Fix

**File:** `src/reports/telegram-digest-sanitizer.ts`

1. Removed `minimax_word` and `MiniMax_word` from `FORBIDDEN_PATTERNS`
2. `neutralizeMinimaxMentions()` is now a no-op (explicitly documented)
3. Tool residue patterns still forbidden: `</tool_call>`, `</invoke>`, `</content>`, `<tool_call`, `<invoke`
4. Secret patterns still redacted: `sk-...`, `ghp_...`, `xox[baprs]-...`, `TELEGRAM_BOT_TOKEN=...`, `MINIMAX_API_KEY=...`, `Authorization: Bearer ...`
5. `[truncated]` marker still removed

## Validator Self-Tests (12 cases)

```
PASS  self-test: allow: MiniMax Music Prompt
PASS  self-test: allow: model_family: minimax-music
PASS  self-test: allow: MiniMax called: No
PASS  self-test: allow: MiniMax Music
PASS  self-test: flag: </tool_call>
PASS  self-test: flag: </invoke>
PASS  self-test: flag: <tool_call>
PASS  self-test: flag: [truncated]
PASS  self-test: flag: sk-cp-real-key-here
PASS  self-test: flag: TELEGRAM_BOT_TOKEN=realvalue12345
PASS  self-test: flag: MINIMAX_API_KEY=realvalue
PASS  self-test: flag: Authorization: Bearer realtoken
PASS  sanitizer preserves public product names
PASS  sanitizer still strips tool_call residue
```

## Validation Results

- `validate:telegram-sanitizer`: **20/20 PASS** (was failing on 1 self-test case before length fix)
- `validate:music-prompts`: PASS (regression — 25/25 unchanged)
- `validate:project-report-send`: PASS — 11/11
- `validate:content-pack-pages`: PASS — 260/260
- `validate:gallery-dedup`: PASS — 19/19
- `validate:public-gallery`: PASS — 30/30
- `validate:daily-archive`: PASS — 12/12

## Local Preview

- Gallery: 0 occurrences of "image model-music" or "image model Music" ✓
- Detail page (code): contains "minimax-music" + "MiniMax Music Prompt", 0 occurrences of "image model" pollution ✓

## Boundaries

- No model call (any kind)
- No new media
- No new audio
- No LLM call
- No gateway/timer/.env change
- No secrets committed
- Pure sanitizer scope fix

## GitHub Push

- creative-quota-harvester: pending (this phase)
- creative-quota-assets: pending (this phase) — files unchanged, no-op

## Next Phase

- Phase 4I-2: Persistent sanitizer test suite
- Phase 4I-3: Asset-side naming sanity check
- Phase 4J: Audio coupling (video + music)
