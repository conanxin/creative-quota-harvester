# Phase 4I-1 — Music Metadata Naming & Sanitizer Scope Fix

**Date:** 2026-06-13
**Phase:** 4I-1
**STATUS:** PASS

---

## ROOT_CAUSE

A user report claimed that Phase 4I outputs contained:
- `model_family: image model-music`
- `image model Music Prompt`

The actual root cause was the **Telegram sanitizer**, not the enhancer:

```ts
// src/reports/telegram-digest-sanitizer.ts (BEFORE Phase 4I-1)
let out = text.replace(/\bMiniMax\b/g, 'image model');
out = out.replace(/\bminimax\b/g, 'image model');
```

The sanitizer had a broad word-boundary match on `MiniMax` / `minimax` (any case) and replaced every occurrence with "image model". When a report contained the legitimate product name "MiniMax Music Prompt" or "minimax-music" (e.g. `model_family: minimax-music`), the sanitizer transformed them to nonsense like "image model Music Prompt" and "model_family: image model-music".

The **asset files themselves** (`.md`, `.json`, `.html`) were never affected — only the **sanitized Telegram output** of any report that mentioned the product name.

## FILES_AUDITED

| File / Pattern | Status |
|----------------|--------|
| `grep -R "image model-music"` (both repos) | **0 hits** |
| `grep -R "image model Music"` (both repos) | **0 hits** |
| `grep -R "model_family.*image model"` (assets) | **0 hits** |
| `grep -R "minimax-music"` (assets content-packs) | 100 hits across 25 packs × 4 (enriched + zh + meta) — all correct |
| `grep -R "MiniMax Music Prompt"` (assets content-packs) | 50 hits across 25 packs × 2 (enriched + meta reference) — all correct |
| `grep "image model"` in `reports/` | Found only in 2 documentation reports that describe the **old** sanitizer behavior: `digest-sanitization-freshness.md` and `telegram-phase-4c3-sanitization-freshness.txt` — these are accurate historical records |

**Conclusion:** No asset files were contaminated. The pollution existed only in the sanitizer's output.

## WRONG_TEXT_FOUND

Only in:
- `reports/digest-sanitization-freshness.md` (line 9) — describes the OLD sanitizer behavior
- `reports/telegram-phase-4c3-sanitization-freshness.txt` (line 7) — describes the OLD sanitizer behavior

These are accurate historical records (Phase 4C3 documented the old behavior), not bugs. They are not modified.

## ASSET_FILES_FIXED

**None needed.** All 25 packs already have correct:
- `music-prompt.enriched.md` containing `## MiniMax Music Prompt` heading
- `music-prompt.meta.json` containing `"model_family": "minimax-music"`
- `music-prompt.zh.md` with correct Chinese explanations
- Detail page HTML showing the correct `minimax-music` chip
- Gallery HTML showing the correct "🎵 增强音乐 Prompt 已就绪" badge

Re-running `npm run prompts:music:enhance` confirmed the enhancer itself never produced "image model-music" — that substitution only happened inside the sanitizer.

## SANITIZER_SCOPE_CHANGE

**File:** `src/reports/telegram-digest-sanitizer.ts`

### Before
- `FORBIDDEN_PATTERNS` included `minimax_word` and `MiniMax_word` (word-boundary matches)
- `neutralizeMinimaxMentions()` replaced ALL `MiniMax` / `minimax` with "image model"
- This caught the legitimate product name in public project reports

### After (Phase 4I-1)
- Removed `minimax_word` and `MiniMax_word` from `FORBIDDEN_PATTERNS`
- `neutralizeMinimaxMentions()` is now a no-op (explicitly documented)
- Tool residue patterns (`tool_call`, `</tool_call>`, `</invoke>`, `</content>`, etc.) **still** forbidden
- Secret patterns (`sk-...`, `ghp_...`, `xox[baprs]-...`, `TELEGRAM_BOT_TOKEN=...`, `MINIMAX_API_KEY=...`, `Authorization: Bearer ...`, `*_API_KEY=...`) **still** forbidden
- `[truncated]` marker **still** removed
- Raw JSON tool payload residue **still** forbidden

### Validator change
**File:** `scripts/validate-telegram-sanitizer.ts`

Added 12 self-test cases that exercise the new behavior:

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

## VALIDATION_RESULTS

| Validation | Result |
|------------|--------|
| `npm run validate:music-prompts` | PASS (regression — 25/25 unchanged) |
| `npm run validate:telegram-sanitizer` | **PASS — 20/20 checks (4 allow + 8 flag + 2 integration + 6 file)** |
| `npm run validate:project-report-send` | PASS — 11/11 |
| `npm run validate:content-pack-pages` | PASS — 260/260 |
| `npm run validate:gallery-dedup` | PASS — 19/19 |
| `npm run validate:public-gallery` | PASS — 30/30 |
| `npm run validate:daily-archive` | PASS — 12/12 |

## LOCAL_PREVIEW_RESULT

`python3 -m http.server 8766` started, then checks:

**Gallery (`/gallery/`):**
- "image model-music" hits: **0** ✓
- "image model Music" hits: **0** ✓

**Detail page (`/content-packs/.../brief-brief-mq8swsla-f-samuraigpt-generative-media-skills/`):**
- "minimax-music" present ✓
- "MiniMax Music Prompt" present ✓
- "image model-music" hits: **0** ✓
- "image model Music" hits: **0** ✓

Server stopped after checks.

## GITHUB_PUSH_STATUS

| Repo | Status |
|------|--------|
| creative-quota-harvester | pending (this phase) |
| creative-quota-assets | pending (this phase) |

Note: assets files did not change (already correct), so the assets push is a no-op in content terms — only the harvester sanitizer + validator need to ship.

## MUSIC_MODEL_CALL_STATUS

- Music model called: **No**
- Image model called: **No**
- Video model called: **No**
- MiniMax called: **No**
- LLM called: **No**
- New media generated: **No**
- New audio generated: **No**

This is a pure sanitizer scope fix — no generation, no model calls, no media production.

## GENERATED_MEDIA_STATUS

- No new media files generated
- Only text files (sanitizer, validator, reports) modified

## LIMITATIONS

1. **Historical reports still contain "image model"** — old `reports/digest-sanitization-freshness.md` and `reports/telegram-phase-4c3-sanitization-freshness.txt` describe the previous sanitizer behavior. These are accurate historical records and should NOT be retroactively modified.
2. **One report previously sent via Telegram** (the Phase 4I report) was sanitized with the old behavior — `message_id=50210` contains the substituted text. We cannot edit Telegram history. The sender now produces correct text.
3. **No inbound recovery** — Telegram messages already sent cannot be re-sanitized. Future reports will be clean.
4. **Product name vs identifier** — the sanitizer now relies on the assumption that the bare word "MiniMax" / "minimax" is never a secret or tool residue. This is true for the public product name. If a future internal tool emits e.g. `<|minimax|>`, that would still be caught by the broader XML/angle-bracket tool residue patterns.
5. **The `MINIMAX_API_KEY=` pattern is still redacted** — only the bare product name is allowed; an actual key assignment is still flagged.

## NEXT_PHASE_PROPOSAL

**Phase 4I-2 (proposed): Sanitizer Test Suite**
- Convert the 12 self-test cases into a persistent test file
- Add CI-style run: `npm run test:sanitizer` (uses ts-node, no test framework dep)
- Cover edge cases: empty input, mixed content, real-world samples

**Phase 4I-3 (proposed): Asset-side Sanity Check**
- Add `validate:assets-naming` script that scans all `*.md` / `*.json` / `*.html` in `content-packs/` for any accidental "image model" substitution
- Run on every daily-scheduled wrapper

**Phase 4J (proposed): Audio Coupling**
- Auto-stitch video (8s looped) + music (60-90s) for unified pack audio

Phase 4I-1: PASS
