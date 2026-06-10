# Creative Quota Harvester — Roadmap

## Version History

| Version | Date | Phase | Status |
|---------|------|-------|--------|
| 0.1.0 | 2026-06-10 | Phase 0A | ✅ COMPLETE — Project init, mock pipeline |
| 0.2.0 | 2026-06-10 | Phase 1 | ✅ COMPLETE — Real signal collection, SQLite |
| 0.3.0 | 2026-06-10 | Phase 1R | ✅ COMPLETE — Source reliability, fallback chains |
| 0.4.0 | 2026-06-10 | Phase 2A | ✅ COMPLETE — Creative Brief Engine, Content Packs |
| 0.5.0 | 2026-06-11 | Phase 2B | ✅ COMPLETE — Asset gallery polish, validation, open source prep |
| 0.6.0 | TBD | Phase 2C | ⬜ NEXT — GitHub open source publish prep |
| 0.7.0 | TBD | Phase 3A | ⬜ Planned — MiniMax quota-aware generation |
| 0.8.0 | TBD | Phase 3B | ⬜ Planned — Telegram daily report |
| 0.9.0 | TBD | Phase 4 | ⬜ Planned — Scheduled automation |

---

## Phase 0A — Project Initialization ✅

**Status:** Complete (2026-06-10)
**Command:** `npm run run-once`

**Scope:**
- [x] Project directory structure (two-repo architecture)
- [x] 13 source adapters designed
- [x] Core data model (SourceRecord → AssetRecord → ContentPackManifest)
- [x] Mock pipeline dry-run
- [x] Phase 0A report

---

## Phase 1 — Signal Collection Engine ✅

**Status:** Complete (2026-06-10)
**Command:** `npm run collect`

**Working sources:**
- arXiv AI (20 signals) ✅
- GitHub Open Source Radar (55 signals) ✅
- Hacker News (9 signals) ✅
- Hugging Face Hub (33 signals, curl fallback) ✅
- The Met Collection (7 signals) ✅
- Open-Meteo + Date Context + Solar Terms (3 signals) ✅

**Partially working:**
- GDELT (HTTP 429 rate-limit, graceful degradation) ⚠️

**Scope:**
- [x] 9 real source adapters implemented
- [x] SQLite signal store with better-sqlite3
- [x]5-dimension scoring (freshness, relevance, visual, x-post, creative)
- [x] `collect-signals.ts` orchestrator
- [x] Signal report at `reports/latest-signals.md`

---

## Phase 1R — Source Reliability Patch ✅

**Status:** Complete (2026-06-10)
**Command:** `npm run diagnose:sources`

**Scope:**
- [x] `src/utils/fetch-with-retry.ts` — retry + exponential backoff + curl fallback
- [x] arXiv AI triple fallback (HTTPS → HTTP → RSS)
- [x] GitHub Radar client-side conanxin exclusion (API doesn't support `NOT user:` syntax)
- [x] GDELT v2 DOC API correction (old endpoint was 404)
- [x] HF Hub curl fallback for blocked native fetch
- [x] `diagnose:sources` command

---

## Phase 2A — Creative Brief Engine ✅

**Status:** Complete (2026-06-10)
**Command:** `npm run briefs`

**Scope:**
- [x] Signal selection pipeline (dedup, URL dedup, Jaccard similarity)
- [x] Template-based CreativeBrief generation (no LLM call)
- [x] AssetPlan generation (x-post, image, video, music, webpage prompts)
- [x] Content Pack export (45 files, 5 packs)
- [x] Gallery + metadata index update
- [x] `reports/latest-briefs.md` + `reports/latest-content-packs.md`

---

## Phase 2B — Asset Repository Gallery Polish ✅

**Status:** Complete (2026-06-11)
**Command:** `npm run validate:assets`

**Scope:**
- [x] `creative-quota-assets/README.md` rewritten with full structure + license
- [x] `creative-quota-assets/gallery/index.html` — static gallery (no build, reads assets.json)
- [x] `scripts/validate-assets.ts` — full repo validation (204 checks, all pass)
- [x] `docs/OPEN_SOURCE_REPO_PLAN.md` — two-repo publish plan
- [x] `docs/TELEGRAM_FINAL_REPLY_CONTRACT.md` — Telegram output rules
- [x] `docs/PHASE_2B_ASSET_GALLERY_REPORT.md` — this phase report

---

## Phase 2C — GitHub Open Source Publish Prep ⬜

**Goal:** Prepare both repos for public GitHub release.

**Scope:**
- [ ] Add `.gitignore` to both repos (exclude `node_modules/`, `data/`, `.env`)
- [ ] Review `data/` signals before publishing
- [ ] Review `reports/` for any internal content
- [ ] Manually confirm `gh repo create` commands (manual execution only, no auto)
- [ ] Configure GitHub Pages for `creative-quota-assets` gallery
- [ ] First public commit to both repos

**Constraints:**
- ❌ No `gh repo create` auto-execution
- ❌ No API key exposure
- ❌ No conanxin/* data in public commits

**Exit Criteria:** Both repos are public on GitHub with correct license files.

---

## Phase 3A — MiniMax Quota-Aware Generation ⬜

**Goal:** Generate real images from `image-prompt.md` in content packs.

**Scope:**
- [ ] Add `MINIMAX_API_KEY` to `.env`
- [ ] MiniMax image generation integration
- [ ] Generate images for each content pack
- [ ] Store in `creative-quota-assets/images/`
- [ ] Update `asset-plan.json` with actual file paths
- [ ] Quota tracking (MiniMax token budget)
- [ ] Generation retry with exponential backoff

**Constraints:**
- ⚠️ Requires MiniMax API key in `.env`
- ❌ No auto-publish to GitHub
- ❌ No cron/systemd

**Exit Criteria:** Content packs contain real generated `.jpg` files.

---

## Phase 3B — Telegram Daily Report ⬜

**Goal:** Daily Telegram digest with new signals and generated assets.

**Scope:**
- [ ] Telegram message builder (signal summary + asset previews)
- [ ] Daily run trigger (user-initiated or scheduled via external tool)
- [ ] Top signals digest (top 5 by score)
- [ ] Generated asset thumbnails in Telegram

**Constraints:**
- ❌ No cron/systemd (Phase 4 only)
- ❌ No auto-publish to GitHub

**Exit Criteria:** Telegram message shows top signals + new asset previews.

---

## Phase 4 — Scheduled Automation ⬜

**Goal:** Production-ready scheduled pipeline.

**Scope:**
- [ ] systemd timer or external cron (not auto-installed by this repo)
- [ ] GitHub Actions CI/CD (lint, type-check, integration tests)
- [ ] GitHub Actions: auto-publish `creative-quota-assets` on new content pack
- [ ] Health check per source adapter
- [ ] Alerting (Telegram alert on source failure)
- [ ] Retention policy (prune old assets)

**Constraints:**
- ⚠️ systemd/cron setup is external
- ❌ No auto-publish without user confirmation

**Exit Criteria:** Daily automated run producing new content packs.

---

## Future Considerations (Backlog)

- [ ] Multi-provider support (OpenAI, Google, Stability AI as fallbacks)
- [ ] Collaborative filtering (which briefs → high-engagement assets)
- [ ] A/B brief testing (multiple brief variants per signal)
- [ ] API server mode (REST endpoints for external consumers)
- [ ] Embedding-based signal deduplication (vector similarity)
- [ ] Multi-language briefs (English, Chinese, Japanese)

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Two separate repos | Asset library independently cloneable, stargazable, reusable |
| better-sqlite3 | Synchronous API, simpler for scripts, single-file DB |
| Template briefs (Phase 2A) | End-to-end pipeline without API dependency — validates architecture first |
| curl fallback for HF | VM blocks Node.js HTTPS to huggingface.co but not system curl |
| conanxin/* exclusion | GitHub Radar hardcoded client-side — survives fork removal attempts |
| Static gallery (no build) | GitHub Pages requires zero build pipeline |
| Telegram Final Reply Contract | Respect cognitive load; Telegram is notification layer, not document surface |