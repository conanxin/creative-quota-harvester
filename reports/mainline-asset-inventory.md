# Mainline Asset Inventory — Phase 6A

**Phase:** 6A (Mainline Recovery)  
**Generated:** 2026-06-15T08:27:00+08:00  
**Asset Repo:** `~/.openclaw/workspace/projects/creative-quota-assets/`

---

## STATUS

| Check | Result |
|-------|--------|
| Asset repo accessible | ✅ |
| Content packs indexed | ✅ 25 packs |
| Generated images catalogued | ✅ 5 images |
| Prompt assets catalogued | ✅ 25 image + 25 music + 5 video |
| Gallery indexed | ✅ 5 items |
| Daily archive indexed | ✅ 2 days |

---

## ASSET INVENTORY

### Content Packs

| Metric | Value |
|--------|-------|
| Total | 25 |
| Unique topics | 5 |
| Packs per topic | 5 |
| Source types covered | 5 (academic, code, culture-art, dev-community, ai-ecosystem) |
| Avg quality score | 0.5932 |
| Files per pack | 22 |
| All have image prompt | 25/25 |
| All have music prompt | 25/25 |
| All have X post (Chinese) | 25/25 |
| Have webpage outline | 15/25 |

**Unique topics:**
1. SamurAIGPT/Generative-Media-Skills (code)
2. Flaws in the LLM Automation Narrative (academic)
3. The Penitence of Saint Jerome (culture-art)
4. stabilityai/stable-video-diffusion-img2vid-xt (ai-ecosystem)
5. River AI (dev-community)

### Generated Images

| Metric | Value |
|--------|-------|
| Total | 5 |
| All reviewed | ✅ Yes |
| Avg quality score | 96/100 |
| Quality distribution | Excellent: 5, Good: 0, Fair: 0, Poor: 0 |
| In gallery | 5/5 |
| Watermarked | 1 (canary) |
| Non-watermarked | 4 |
| Source type coverage | 1 per source type (all 5 covered) |

### Prompt Assets

| Type | In Content Packs | Enriched | Ready |
|------|-----------------|----------|-------|
| Image prompts | 25 | 25 | ✅ |
| Music prompts | 25 (enriched) | 25 | ✅ |
| Video prompts | 5 (enriched) | 5 | ✅ |
| X posts (Chinese) | 25 | N/A | ✅ |

### Gallery

| Metric | Value |
|--------|-------|
| Total items | 5 |
| Coverage | 100% of generated images |
| index.html | ✅ |
| static.html | ✅ |

### Daily Archive

| Metric | Value |
|--------|-------|
| Total days archived | 2 |
| Dates | 2026-06-10, 2026-06-11 |
| Total packs archived | 25 |

---

## GAPS IDENTIFIED

| Gap ID | Category | Description | Impact |
|--------|----------|-------------|--------|
| G-001 | Image generation | 80% of image prompts unused (20/25 packs have no generated image) | High |
| G-002 | Video generation | Only 5 video prompts, 0 actual videos generated | Medium |
| G-003 | Music generation | 25 music prompts, 0 actual music generated | Medium |
| G-004 | Publishing | 25 X posts ready, 0 published | High |
| G-005 | Daily archive | Only 2 days archived; no new signals since 2026-06-11 | Medium |
| G-006 | Source refresh | Signal source stale since 2026-06-11; no new content packs | High |

---

## WHAT IS READY FOR NEXT

| Action | Target | Requires Model Call | Priority |
|--------|--------|---------------------|----------|
| Controlled image generation | 20 remaining packs without images | ✅ Yes | High |
| X post publishing | 25 Chinese X posts | ❌ No | High |
| Signal source refresh | New signals → new content packs | ❌ No | High |
| Video prompt publication | Blog/wiki with 5 video prompt examples | ❌ No | Medium |
| Music prompt publication | Compiled music prompt pack | ❌ No | Low |

---

*Asset inventory complete. All artifacts generated read-only. No model calls made.*
