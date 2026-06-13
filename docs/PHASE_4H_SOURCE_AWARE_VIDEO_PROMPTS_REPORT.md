# Phase 4H — Source-aware Video Prompt Enhancement

**Date:** 2026-06-13
**Phase:** 4H
**STATUS:** PASS

---

## WHAT_CHANGED

Phase 4H added a complete source-aware video-prompt enhancement pipeline:

- **3 new output files per pack** (25 × 3 = 75 new files): `video-prompt.enriched.md`, `video-prompt.zh.md`, `video-prompt.meta.json`
- **Original `video-prompt.md` preserved** (never overwritten) — idempotent re-runs safe
- **Detail page** (`build-content-pack-pages.ts`) now shows enhanced video prompt card with: strategy, 3 shots, English prompt, Negative/Avoid, recommended params, recommended uses, status note
- **Gallery card** (`build-gallery-from-dedup.ts`) shows "🎥 增强视频 Prompt 已就绪" badge + adds "短视频" / "动态图形" use chips
- **Gallery still 5 unique topics** (dedup unchanged)
- **Validator** (`validate-video-prompt-enhancement.ts`) extended to 1109 checks; alias `npm run validate:video-prompts` added

---

## PROMPTS_ENHANCED

| Metric | Count |
|--------|-------|
| Total Content Packs | 25 |
| `video-prompt.enriched.md` generated | **25 / 25** |
| `video-prompt.zh.md` generated | **25 / 25** |
| `video-prompt.meta.json` generated | **25 / 25** |
| Original `video-prompt.md` preserved (not overwritten) | 5 / 5 (the 5 packs that had originals) |
| Source-type distribution | code=5, academic=5, culture-art=5, dev-community=5, ai-ecosystem=5 |

---

## SOURCE_TYPE_STRATEGIES

| source_type | 视频方向 | Recommended use |
|-------------|----------|-----------------|
| **code** | Agent pipeline / launch clip / data flow | short-video, x-post, project-demo, launch-clip |
| **academic** | 论文概念动画 / 数据曲线 / 概念网络 | short-video, paper-summary, concept-animation |
| **ai-ecosystem** | pipeline flow (input → model → output) | short-video, model-demo, pipeline-flow, capability-card |
| **dev-community** | developer pain point / discussion map | short-video, x-post, discussion-clip |
| **culture-art** | museum lighting / 古典重绎 / cinematic pan | short-video, museum-clip, cinematic-pan, motion-graphic |
| **context** | daily mood clip / 时间氛围 | short-video, mood-clip, ambient, social |

Each strategy produces 3 shots (3s + 3s + 2s = 8s) with deterministic, rule-based logic — no LLM, no model call.

---

## SAMPLE_VIDEO_PROMPTS

### Code (SamurAIGPT/Generative-Media-Skills)
- Strategy: Agent pipeline 节点动画
- Shot 1 (3s): a clean dark navy workspace, a single node labeled with the project name lights up
- Shot 2 (3s): thin lines connect the central node to 4-5 smaller capability icons orbiting
- Shot 3 (2s): cluster of stars/forks counter tiles, calm orbit
- Priority: high

### Academic (Flaws in the LLM Automation Narrative)
- Strategy: 论文概念动画 / 基准曲线
- Shot 1 (3s): a curve climbs on a dark grid, with two reference lines (human baseline, prior SOTA)
- Shot 2 (3s): a small bar chart of category scores, leading bar in warm gold
- Shot 3 (2s): elegant serif title + arXiv-style id badge
- Priority: medium

### Culture-Art (The Penitence of Saint Jerome, Joachim Patinir, ca. 1515)
- Strategy: 博物馆灯光 / 古典重绎 / contemplative figure slow pan
- Shot 1 (3s): a single contemplative figure in a wilderness scene, soft warm key light
- Shot 2 (3s): slow push-in on the figure, background darkens
- Shot 3 (2s): final close composition with strong chiaroscuro
- Priority: medium

---

## VALIDATION_RESULTS

| Validation | Result |
|------------|--------|
| `npm run validate:video-prompts` | **PASS — 1109/1109 checks** |
| `npm run validate:content-pack-pages` | PASS — 260/260 checks |
| `npm run validate:gallery-dedup` | PASS — 19/19 checks |
| `npm run validate:public-gallery` | PASS — 30/30 checks |
| `npm run validate:daily-archive` | PASS — 12/12 checks |
| TypeScript compile | Clean for new files (no new errors) |

Per-pack checks include spec-required top-level fields:
- `model_family: "hailuo"` ✓
- `duration: "8s"` (or "6s") ✓
- `aspect_ratio: "16:9"` ✓
- `priority: high|medium|low` ✓
- `generation_mode: "prompt-only"` ✓
- `prompt_strategy` non-empty ✓
- `recommended_use` array (≥1) ✓
- `original_prompt_path: "video-prompt.md"` ✓
- `enriched_prompt_path: "video-prompt.enriched.md"` ✓
- `zh_prompt_path: "video-prompt.zh.md"` ✓
- `uncertainty_notes` array ✓
- `llm_used: false` ✓
- `video_model_called: false` ✓
- `image_model_called: false` ✓
- No LLM markers (MiniMax, gpt-4, claude) ✓
- No API keys / secrets / `[truncated]` markers ✓

---

## LOCAL_PREVIEW_RESULT

`python3 -m http.server 8766` started, three checks:

**Gallery (`/gallery/`):**
- 增强视频 Prompt ✓
- 增强图片 Prompt ✓
- SamurAIGPT ✓
- Flaws in the LLM ✓
- The Penitence ✓
- 动态图形 ✓
- 短视频 ✓
- 5 occurrences of "增强视频 Prompt" (one per unique topic card)

**Code pack detail page** (`/content-packs/2026/06/2026-06-11/brief-brief-mq8swsla-f-samuraigpt-generative-media-skills/`):
- 增强视频 Prompt ✓
- 镜头设计 ✓
- Hailuo Video Prompt ✓
- Negative / Avoid ✓
- 推荐参数 ✓
- 未调用视频模型 ✓

**Academic pack detail page** (`/content-packs/2026/06/2026-06-11/brief-brief-mq8tbqf4-j-flaws-in-the-llm-automation-narrative/`):
- 增强视频 Prompt ✓
- 镜头设计 ✓
- Hailuo Video Prompt ✓
- prompt-only ✓
- 未调用视频模型 ✓

**Culture-Art pack detail page** (`/content-packs/2026/06/2026-06-11/brief-brief-mq8tbqf4-8-the-penitence-of-saint-jerome/`):
- 增强视频 Prompt ✓
- 镜头设计 ✓
- museum lighting ✓
- slow pan ✓
- prompt-only ✓
- 未调用视频模型 ✓

Server stopped after checks. No `truncated` / API keys / secrets in any HTML.

---

## PUBLIC_URL_CHECK

| URL | Pre-push | Post-push (expected) |
|-----|----------|---------------------|
| `https://conanxin.github.io/creative-quota-assets/gallery/` | shows only Phase 4G badge | will show Phase 4G + Phase 4H badges after push |
| Detail pages | 5 unique topics × 25 packs | same; new "增强视频 Prompt" card section added |

Pre-push GitHub Pages still serves the old version (cached / not yet rebuilt). After `git push` to creative-quota-assets, the GitHub Pages build will pick up the new gallery + 25 detail pages.

---

## GITHUB_PUSH_STATUS

| Repo | Branch | Status |
|------|--------|--------|
| creative-quota-harvester | master | pending commit + push (this phase) |
| creative-quota-assets | master | pending commit + push (this phase) |

Both repos updated; commits and pushes follow in the same phase.

---

## VIDEO_MODEL_CALL_STATUS

- Video model called: **No**
- Image model called: **No**
- Music generated: **No**
- LLM called: **No**
- New media generated: **No**
- External API calls: **No**
- `generation_mode: "prompt-only"` — explicitly noted in every meta.json

---

## GENERATED_MEDIA_STATUS

- No new media files generated
- Only text artifacts (`*.md`, `*.json`) and HTML rebuilds

---

## LIMITATIONS

1. **Static prompts only** — the enriched files are deterministic text; no actual video model invocation.
2. **No first-frame image coupling** — the prompt doesn't currently anchor on a `image-prompt.enriched.md` first frame, though cross-references exist in `zh_prompt_path`.
3. **Hailuo-specific phrasing** — the English prompt is tuned for Hailuo / MiniMax; may need minor tweaking for Runway / Sora / Pika.
4. **No scoring** — no automated ranking of which packs should get real video generation first.
5. **Gallery still static HTML** — no actual video playback; the badge is metadata-only.
6. **5 packs had original `video-prompt.md`** — the other 20 packs only have the enriched versions. The validator passes for both cases (preserved if exists, otherwise no-op).
7. **Duration is 8s in current output** — spec allows 6s or 8s; the shot design is currently 3s+3s+2s=8s. A 6s variant would need a 2s+2s+2s shot redesign.

---

## NEXT_PHASE_PROPOSAL

**Phase 4I (proposed): Gallery Video Card**
- Render `video-prompt.enriched.md` as HTML embed in `content-packs/.../index.html`
- Add static "▶ 8s video" badge (no real playback)
- Surface shots timeline in detail page

**Phase 4J (proposed): Video Prompt Scoring**
- Add scoring layer (visual density, fact grounding, negative-prompt coverage, shot design)
- Rank packs by video-readiness
- Output: `metadata/video-prompt-scores.json`

**Phase 5C (longer-term): Per-Source Budget Extension**
- Apply Phase 4C-5 budget pattern to video prompts
- e.g. max 30s total per run, max 3 packs per day for real video gen
- Cooldown for video gen on rate limit

Phase 4H: PASS
