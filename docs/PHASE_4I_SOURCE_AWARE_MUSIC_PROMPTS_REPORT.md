# Phase 4I — Source-aware Music Prompt Enhancement

**Date:** 2026-06-13
**Phase:** 4I
**STATUS:** PASS

---

## WHAT_CHANGED

Phase 4I introduces source-aware music-prompt enhancement for all 25 Content Packs. New file outputs per pack (3 files, never overwrites originals):

| File | Purpose |
|------|---------|
| `music-prompt.enriched.md` | Chinese intent + 事实依据 + 音乐方向 (mood/genre/tempo/instrumentation/texture/energy/loopability) + MiniMax Music Prompt + Negative + 推荐参数 + 不确定性 |
| `music-prompt.zh.md` | Human-readable Chinese explanation with 5 bullets (intent, facts, use, attributes, real-gen suitability) |
| `music-prompt.meta.json` | Machine-readable: attributes, spec-required top-level fields, llm_used=false, music_model_called=false, etc. |

`music-prompt.md` (original) is preserved — never overwritten. Idempotent: re-run produces same result.

---

## SOURCE_TYPE_STRATEGIES (6)

| source_type | 音乐方向 | Recommended use |
|-------------|----------|-----------------|
| **code** | focus coding lo-fi / agent workflow pulse | background-music, short-video, project-intro, coding-session |
| **academic** | calm analytical ambient / chamber ambient | background-music, paper-explainer, podcast-intro, conference-talk |
| **ai-ecosystem** | futuristic model flow / light electronic pulse | background-music, model-demo, short-video, product-card |
| **dev-community** | indie electronic / waiting-for-agent vibe | background-music, discussion-clip, x-post, short-video |
| **culture-art** | museum ambience / chamber texture / warm classical-inspired | background-music, museum-clip, gallery-loop, short-video |
| **context** | weather mood / seasonal lo-fi | background-music, mood-clip, morning-ambience, social |

Branch selection is **deterministic** (title/topic/task keyword match) — no LLM, no randomness.

---

## Hard Rules Enforced

- ❌ NO MiniMax / image / video / music model calls
- ❌ NO external LLM calls
- ❌ NO new audio generated
- ❌ NO new media generated
- ❌ NO overwriting of `music-prompt.md` (originals preserved)
- ❌ NO lyrics, NO vocals
- ❌ NO imitation of living artists
- ❌ NO copyrighted melodies
- ❌ NO famous song references / recognizable tune hooks
- ✅ Default instrumental (lyrics: "none")
- ✅ Default duration: "60-90s"
- ✅ Default model_family: "minimax-music"
- ✅ Default generation_mode: "prompt-only"
- ✅ Suitable for short-video / X-post / project intro / podcast intro

---

## Files Added

- `scripts/enhance-music-prompts.ts` (~700 lines, deterministic rule-based generator)
- `scripts/validate-music-prompt-enhancement.ts` (1009 checks across 25 packs)
- `package.json` — new scripts: `prompts:music:enhance`, `validate:music-prompts`, `validate:music-prompt-enhancement`

## Files Modified

- `package.json` (added 3 scripts)
- `scripts/build-content-pack-pages.ts` (added enhanced music card to detail page)
- `scripts/build-gallery-from-dedup.ts` (added 增强音乐 Prompt badge + use chips, CSS class)

## Files Generated (per pack, 25 × 3 = 75)

- `content-packs/.../music-prompt.enriched.md` (25)
- `content-packs/.../music-prompt.zh.md` (25)
- `content-packs/.../music-prompt.meta.json` (25)

---

## VALIDATION_RESULTS

`npm run validate:music-prompts`:

```
[validate-music-prompts] 1009/1009 checks passed
[validate-music-prompts] enriched.md: 25/25
[validate-music-prompts] zh.md: 25/25
[validate-music-prompts] meta.json: 25/25
[validate-music-prompts] original music-prompt.md preserved: 5/25 (others never had original)
[validate-music-prompts] by source_type: {
  code: 5,
  academic: 5,
  'culture-art': 5,
  'dev-community': 5,
  'ai-ecosystem': 5
}
```

Per-pack checks include spec-required top-level fields:
- `title, source_type, source_label_zh, prompt_strategy` (non-empty)
- `model_family: "minimax-music"`
- `duration: "60-90s"`
- `instrumental: true`
- `lyrics: "none"`
- `priority: high|medium|low`
- `recommended_use: array (≥1)`
- `facts_used: array`
- `original_prompt_path: "music-prompt.md"`
- `enriched_prompt_path: "music-prompt.enriched.md"`
- `zh_prompt_path: "music-prompt.zh.md"`
- `generation_mode: "prompt-only"`
- `uncertainty_notes: array`
- `llm_used: false`, `music_model_called: false`, `image_model_called: false`, `video_model_called: false`, `audio_generated: false`, `new_media_generated: false`

No LLM markers, no API keys, no `[truncated]` markers, no secrets.

Other validators (regression check):
- `validate:video-prompts` PASS
- `validate:content-pack-pages` PASS (260/260)
- `validate:gallery-dedup` PASS (19/19)
- `validate:public-gallery` PASS (30/30)
- `validate:daily-archive` PASS (12/12)

---

## LOCAL_PREVIEW_RESULT

`python3 -m http.server 8766` started, three checks:

**Gallery (`/gallery/`):**
- 增强音乐 Prompt ✓ (5 occurrences, one per unique topic)
- 背景音乐 ✓
- 增强视频 Prompt ✓
- 增强图片 Prompt ✓
- 短视频 ✓
- 动态图形 ✓
- SamurAIGPT / Flaws in the LLM / The Penitence (5 unique topic titles) ✓

**Code pack detail page** (`/content-packs/.../brief-brief-mq8swsla-f-samuraigpt-generative-media-skills/`):
- 增强音乐 Prompt ✓
- 音乐方向 ✓
- MiniMax Music Prompt ✓
- Negative ✓
- 推荐参数 ✓
- 未调用音乐模型 ✓
- lo-fi (genre hint) ✓

**Academic pack detail page** (`/content-packs/.../brief-brief-mq8tbqf4-j-flaws-in-the-llm-automation-narrative/`):
- 增强音乐 Prompt ✓
- ambient (chamber ambient / analytical ambient) ✓
- MiniMax Music Prompt ✓
- prompt-only ✓

**Culture-Art pack detail page** (`/content-packs/.../brief-brief-mq8tbqf4-8-the-penitence-of-saint-jerome/`):
- 增强音乐 Prompt ✓
- museum ambience ✓
- chamber ✓
- MiniMax Music Prompt ✓
- prompt-only ✓

No `truncated` / API keys / secrets in any HTML.

---

## PUBLIC_URL_CHECK

`https://conanxin.github.io/creative-quota-assets/gallery/` — pre-push shows Phase 4G + 4H badges. Will update to include Phase 4I badge after `git push` and GitHub Pages rebuild.

---

## GITHUB_PUSH_STATUS

| Repo | Status |
|------|--------|
| creative-quota-harvester | pending commit + push (this phase) |
| creative-quota-assets | pending commit + push (this phase) |

---

## MUSIC_MODEL_CALL_STATUS

- Music model called: **No**
- MiniMax called: **No**
- Image model called: **No**
- Video model called: **No**
- LLM called: **No**
- New media generated: **No**
- New audio generated: **No**
- `generation_mode: "prompt-only"` — explicitly noted in every meta.json

---

## GENERATED_MEDIA_STATUS

- No new media files generated (image, video, music, audio)
- Only text artifacts (`*.md`, `*.json`) and HTML rebuilds

---

## LIMITATIONS

1. **Static prompts only** — the enriched files are deterministic text; no actual music model invocation.
2. **60-90s instrumental default** — could support shorter (15-30s) variants for X-post clips, longer (2-3min) for podcast intros in a future variant.
3. **No lyrics support yet** — current spec defaults to "lyrics: none". A future phase could support `lyrics: "auto"` with placeholder text.
4. **No loop-seam validation** — loopability is described in the prompt but not verified by audio playback.
5. **5 packs had original `music-prompt.md`** — the other 20 packs only have the enriched versions. Validator passes for both cases.
6. **MiniMax Music model is hypothetical** — the prompt is tuned generically; actual model may need minor parameter tweaks.
7. **No coupling with video/audio timeline** — the music prompt is independent of the video-prompt.enriched.md; future phase could auto-stitch (8s video + 60-90s music = music loops 7-11×).
8. **Gallery still static HTML** — no actual audio playback; the badge is metadata-only.

---

## NEXT_PHASE_PROPOSAL

**Phase 4J (proposed): Audio Coupling**
- Auto-stitch video (8s looped) + music (60-90s) for unified pack audio
- Generate `audio-coupling-plan.json` per pack with timeline alignment

**Phase 4K (proposed): Music Prompt Scoring**
- Add scoring layer (mood specificity, instrument coverage, negative-prompt coverage)
- Rank packs by music-readiness
- Output: `metadata/music-prompt-scores.json`

**Phase 5C (longer-term): Per-Source Budget Extension to Music**
- Apply Phase 4C-5 budget pattern to music prompts
- e.g. max 3 packs per day for real music gen
- Cooldown on rate limit

**Phase 5D (longer-term): Lyrics-Aware Variants**
- Add a `lyrics: "auto"` mode for packs where lyrics make sense (e.g., hero narratives)
- Generate placeholder lyric text from source facts
- Switch between instrumental and vocal variants per pack

Phase 4I: PASS
