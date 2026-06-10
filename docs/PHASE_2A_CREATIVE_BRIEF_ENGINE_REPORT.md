# Phase 2A — Creative Brief Engine Report

**Run ID:** `brief-mq8c6xyg-*`
**Generated:** 2026-06-10T17:22:22+08:00
**Scope:** Signal-to-Brief-to-Content-Pack pipeline (no MiniMax call)

---

## STATUS

| Metric | Value |
|--------|-------|
| Input Signals | 127 (from `run-mq8bi6od`) |
| Signals Selected | 8 (deduplicated) |
| Creative Briefs Generated | **5** |
| Asset Plans Generated | **5** |
| Content Packs Exported | **5** |
| Files Written | 45 |
| Gallery Updated | ✅ |
| conanxin/* Contamination | **0 ✅** |
| MiniMax Called | ❌ No |
| TypeScript Errors | 0 ✅ |

**Verdict: PASS** — All acceptance criteria met.

---

## WHAT_CHANGED

### New Files
| File | Purpose |
|------|---------|
| `src/types/creative-brief.ts` | `CreativeBrief` + `FactualBasis` interfaces |
| `src/types/asset-plan.ts` | `AssetPlan` + `AssetOutput` interfaces |
| `src/pipeline/select-top-signals.ts` | Signal selection + Jaccard dedup + URL dedup |
| `src/pipeline/create-briefs.ts` | Template-based brief generation (Phase 2A core) |
| `src/pipeline/create-asset-plans.ts` | Template-based asset plan generation |
| `src/pipeline/export-content-packs.ts` | Content pack file writer |
| `scripts/generate-briefs.ts` | Main `npm run briefs` entry point |
| `scripts/update-gallery.ts` | Gallery + metadata index updater |

### Modified Files
| File | Change |
|------|--------|
| `scripts/run-once.ts` | Updated to use Phase 2A pipeline (Phase 0A mock retired) |
| `package.json` | Added `briefs` script |

---

## DESIGN_RATIONALE

### Template-Based Generation (No LLM)
Phase 2A uses **structured templates** instead of LLM calls:
- `why_it_matters`: Source-type-aware descriptions
- `content_angle`: Template with source-type-specific questions
- `target_audience`: Pre-mapped per source type
- `recommended_assets`: Rule-based from source type coverage

**Why no MiniMax?** Phase 2A proves the pipeline works end-to-end without API dependency. MiniMax integration is Phase 2B.

### Signal Selection Strategy
1. **Per-type capping**: max 3 signals per source_type to ensure diversity
2. **URL dedup**: hostname-level dedup (keep first seen)
3. **Title dedup**: Jaccard similarity ≥ 0.6 → drop duplicate
4. **Score sort**: top signals by `final_score` after dedup

### Content Pack Structure
Each pack is a **self-contained directory** with:
- `manifest.json` — pack metadata
- `source.json` — signal source references
- `signal.json` — original signal data
- `brief.md` — full creative brief (human readable)
- `facts.md` — factual basis with source links
- `x-post.zh.md` — Chinese X post draft
- `image-prompt.md` — image generation prompt
- `video-prompt.md` — video generation prompt
- `music-prompt.md` — music generation prompt
- `webpage-outline.md` — webpage outline
- `asset-plan.json` — complete asset plan

---

## INPUT_SIGNALS

| Run ID | Total Signals | Source Types |
|--------|--------------|--------------|
| `run-mq8bi6od` | 127 | code(55), ai-ecosystem(33), academic(20), dev-community(9), culture-art(7), context(3) |

**Coverage areas available:**
- research: arXiv AI (20)
- open_source: GitHub Radar (55)
- dev_community: Hacker News (9)
- ai_ecosystem: Hugging Face Hub (33)
- culture_art: The Met Collection (7)
- context: Open-Meteo + Date + Solar Terms (3)

---

## SELECTION_METHOD

**Pipeline:** SQLite → Jaccard dedup → URL dedup → Per-type cap(3) → Score sort → Top 8

**Deduplication:**
- Title similarity ≥ 0.6 (Jaccard on3+ char tokens) → dropped
- Same URL hostname → dropped (keep first)

**Coverage target:** At least 1 signal per distinct `source_type`

---

## BRIEFS_CREATED

| # | Brief ID | Title | Score | Source Type | Assets |
|---|---------|-------|-------|-------------|--------|
| 1 | `brief-mq8c6xyg-bqh3n` | SamurAIGPT/Generative-Media-Skills | 0.703 | code | x-post, image, webpage |
| 2 | `brief-mq8c6xyg-voua2` | Flaws in the LLM Automation Narrative | 0.662 | academic | x-post, image, webpage |
| 3 | `brief-mq8c6xyg-5u8ow` | stabilityai/stable-video-diffusion-img2vid-xt | 0.476 | ai-ecosystem | x-post, image, webpage |
| 4 | `brief-mq8c6xyg-op6l2` | River AI | 0.525 | dev-community | x-post, image |
| 5 | `brief-mq8c6xyg-ral6w` | The Penitence of Saint Jerome | 0.600 | culture-art | x-post, image, video, music |

---

## CONTENT_PACKS_EXPORTED

**Location:** `~/.openclaw/workspace/projects/creative-quota-assets/content-packs/2026/06/2026-06-10/`

| Pack Directory | Brief Title |
|----------------|-------------|
| `brief-brief-mq8c6xyg-b-samuraigpt-generative-media-skills/` | SamurAIGPT/Generative-Media-Skills |
| `brief-brief-mq8c6xyg-v-flaws-in-the-llm-automation-narrative/` | Flaws in the LLM Automation Narrative |
| `brief-brief-mq8c6xyg-j-stabilityai-stable-video-diffusion-img2vid-xt/` | stabilityai/stable-video-diffusion-img2vid-xt |
| `brief-brief-mq8c6xyg-o-river-ai/` | River AI |
| `brief-brief-mq8c6xyg-5-the-penitence-of-saint-jerome/` | The Penitence of Saint Jerome |

**Files per pack:** 9 (manifest.json, source.json, signal.json, brief.md, facts.md, x-post.zh.md, image-prompt.md, video-prompt.md, music-prompt.md, webpage-outline.md, asset-plan.json)
**Total files written:** 45

---

## ASSET_REPO_PATH

```
~/.openclaw/workspace/projects/creative-quota-assets/
├── content-packs/
│   └── 2026/06/2026-06-10/
│       ├── index.json (batch manifest)
│       ├── brief-brief-mq8c6xyg-b-samuraigpt-generative-media-skills/
│       │   ├── manifest.json
│       │   ├── source.json
│       │   ├── signal.json
│       │   ├── brief.md
│       │   ├── facts.md
│       │   ├── x-post.zh.md
│       │   ├── image-prompt.md
│       │   ├── video-prompt.md
│       │   ├── music-prompt.md
│       │   ├── webpage-outline.md
│       │   └── asset-plan.json
│       └── ... (4 more packs)
├── gallery/
│   └── assets.json (updated, 13 assets)
└── metadata/
    ├── asset-index.json (updated)
    ├── source-index.json (updated)
    └── daily-index.json (updated)
```

---

## VALIDATION

### npm run briefs
```
✅ Select signals: 8/127 selected
✅ Generate briefs: 5 briefs
✅ Generate asset plans: 5 plans
✅ Export content packs: 5 packs, 45 files
✅ Update gallery: assets.json (13 assets)
```

### Content Pack Files
```
ls content-packs/2026/06/2026-06-10/brief-brief-mq8c6xyg-b-samuraigpt-generative-media-skills/
asset-plan.json  brief.md  facts.md  image-prompt.md  manifest.json
music-prompt.md   signal.json  source.json  video-prompt.md  webpage-outline.md  x-post.zh.md
```

### conanxin Exclusion
```bash
grep -r "conanxin" content-packs/2026/06/2026-06-10/ # 0 results ✅
```

### TypeScript
```
npx tsc --noEmit → 0 errors ✅
```

---

## LIMITATIONS

1. **Brief content is template-generated, not LLM-generated** — content_angle and why_it_matters use static templates per source type. Phase 2B will replace with MiniMax calls.
2. **Signal selection is capped at 8** — some high-quality signals may be dropped to maintain source diversity.
3. **No image/video/music generation** — only prompts are written, actual generation is Phase 2B.
4. **No quota tracking** — Phase 2A doesn't call MiniMax so no quota consumed.

---

## NEXT_PHASE_PROPOSAL

**Phase 2B: MiniMax Generation Integration**
- Add `MINIMAX_API_KEY` to `.env`
- Call MiniMax for each `image_prompt` in asset plans
- Store generated images in `creative-quota-assets/images/`
- Update `asset-plan.json` with actual file paths
- Generate video/music assets
- Add Telegram digest with generated asset previews

**Prerequisite:** `MINIMAX_API_KEY` in `.env`, Phase 2A pipeline stable.