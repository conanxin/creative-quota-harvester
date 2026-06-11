# Creative Quota Harvester — Roadmap

## Version History

| Version | Date | Phase | Status |
|---------|------|-------|--------|
| 0.1.0 | 2026-06-10 | Phase 0A | ✅ COMPLETE — Project init, mock pipeline |
| 0.2.0 | 2026-06-10 | Phase 1 | ✅ COMPLETE — Real signal collection, SQLite |
| 0.3.0 | 2026-06-10 | Phase 1R | ✅ COMPLETE — Source reliability, fallback chains |
| 0.4.0 | 2026-06-10 | Phase 2A | ✅ COMPLETE — Creative Brief Engine, Content Packs |
| 0.5.0 | 2026-06-11 | Phase 2B | ✅ COMPLETE — Asset gallery polish, validation, open source prep |
| 0.6.0 | 2026-06-11 | Phase 2C | ✅ COMPLETE — GitHub publish, Pages, README polish |
| 0.7.0 | 2026-06-11 | Phase 3A | ✅ COMPLETE — First MiniMax image canary, 1 real image generated |
| 0.8.0 | 2026-06-11 | Phase 3B | ✅ COMPLETE — Telegram daily digest pipeline |
| 0.8.1 | 2026-06-11 | Phase 3B-1 | ✅ COMPLETE — Daily digest quality patch (dedup + structured counting) |
| 0.8.2 | 2026-06-11 | Phase 3B-2 | ✅ COMPLETE — Telegram digest delivery contract patch |
| 0.9.1 | 2026-06-11 | Phase 3A Full | ✅ COMPLETE — Batch image generation, 2 new images (184KB + 353KB) |
| 0.9.2 | 2026-06-11 | Phase 3C | ✅ COMPLETE — MiniMax quota guard + explicit generation command |
| 0.9.3 | 2026-06-11 | Phase 4A | ✅ COMPLETE — Manual daily digest runbook |
| 0.9.4 | 2026-06-11 | Phase 4B-0 | ✅ COMPLETE — Scheduled automation dry-run templates |

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

## Phase 2C — GitHub Open Source Publish Prep ✅

**Status:** Complete (2026-06-11)

**Sub-phases:**
- [x] Phase 2C-0: Asset Repo Path Recovery
- [x] Phase 2C-1: Open Source Safety Check + Local Git Readiness
- [x] Phase 2C-2: Create GitHub Repos and Push
- [x] Phase 2C-3: Public Repo Polish

**Scope:**
- [x] Safety check: no secrets, no conanxin/* data
- [x] `.gitignore` for both repos
- [x] Independent `git init` for both repos
- [x] Local commits (Phase 2C-1)
- [x] `gh repo create` for both repos (Phase 2C-2)
- [x] GitHub Pages enabled for `creative-quota-assets`
- [x] Root `index.html` → redirects to `gallery/`
- [x] README and ROADMAP updated and pushed

**GitHub URLs:**
- Harvester: `https://github.com/conanxin/creative-quota-harvester`
- Assets: `https://github.com/conanxin/creative-quota-assets`
- Assets Gallery: `https://conanxin.github.io/creative-quota-assets/gallery/`

---

## Phase 3A — MiniMax Quota-Aware Generation ✅

**Status:** Complete (2026-06-11) — Canary passed, 1 image generated
**Batch Closeout:** 2026-06-11 — 2 additional images generated (total 3 assets)
**Command:** `npm run generate:image:canary`

**Scope:**
- [x] MiniMax Token Plan CLI setup (Phase 3A-0)
- [x] mmx CLI configured with Token Plan key (region: cn)
- [x] First real image generated via `mmx image generate`
- [x] Image saved to `creative-quota-assets/images/2026/06/`
- [x] `metadata/generated-assets.json` created
- [x] `metadata/asset-index.json` updated
- [x] `gallery/assets.json` updated
- [x] GitHub Pages gallery verified (HTTP 200)
- [x] Generator script: `src/generators/minimax-image-canary.ts`

**Generated:**
- `cqa-2026-06-11-canary-001_001.jpg` (325KB) — "Flaws in the LLM Automation Narrative"
- Gallery: `https://conanxin.github.io/creative-quota-assets/gallery/`

**Next (Phase 3A Full):**
- Batch generate images for all content packs with `image-prompt.md`
- Update all `asset-plan.json` with generated file paths
- Quota guard (check before each batch)

**Or skip to Phase 3B:** Telegram daily digest (no MiniMax needed)

---

## Phase 3B — Telegram Daily Report ✅

**Status:** Complete (2026-06-11)
**Command:** `npm run digest:telegram`

**Scope:**
- [x] Digest script: `src/reports/telegram-daily-digest.ts`
- [x] `npm run digest:telegram` command
- [x] `reports/telegram-daily-digest.txt` — one-message Telegram digest (≤3500 chars)
- [x] `reports/daily-digest.md` — full markdown report
- [x] Signal data from SQLite DB (298 signals)
- [x] Top 5 signals by score
- [x] Content pack count + generated asset count
- [x] Recommendation engine (image/music/video)

**Note:** No auto-send to Telegram — digest is generated to file, OpenClaw sends via final reply.

**GitHub URLs:**
- Harvester: `https://github.com/conanxin/creative-quota-harvester`
- Assets: `https://github.com/conanxin/creative-quota-assets`
- Assets Gallery: `https://conanxin.github.io/creative-quota-assets/gallery/`

---

## Phase 3B-1 — Daily Digest Quality Patch ✅

**Status:** Complete (2026-06-11)
**Command:** `npm run digest:telegram`

**Problem solved:** Top 5 Signals had duplicates (SamurAIGPT ×2, EvoLinkAI ×2).

**Improvements:**
- [x] Signal deduplication by URL + normalized title (no more duplicates)
- [x] Structured content pack counting from manifest.json (not markdown regex)
- [x] Recommended Generation Queue (packs without generated images, max 3)
- [x] Generated assets breakdown by type (image/music/video)
- [x] Inline quality validation (char count, dup check)

**GitHub URLs:**
- Harvester: `https://github.com/conanxin/creative-quota-harvester`
- Assets: `https://github.com/conanxin/creative-quota-assets`
- Assets Gallery: `https://conanxin.github.io/creative-quota-assets/gallery/`

---

## Phase 3B-2 — Telegram Digest Delivery Contract Patch ✅

**Status:** Complete (2026-06-11)
**Command:** `npm run digest:telegram && npm run digest:telegram:check`

**Problem solved:** Final Telegram message was being truncated because OpenClaw was sending additional phase report text alongside the digest.

**Improvements:**
- [x] `scripts/check-telegram-digest.ts` — 8-contract validation checks
- [x] `npm run digest:telegram:check` — automated contract validation
- [x] `reports/telegram-delivery-contract.md` — delivery contract documentation
- [x] Fixed date (Asia/Shanghai timezone)
- [x] Fixed source_types (array) and final_score reading from manifest.json
- [x] Canonical file: `reports/telegram-digest.txt` (no rename needed)

**Telegram delivery rule:** Only send `reports/telegram-digest.txt` content as the Telegram message body.


---

## Phase 4A — Manual Daily Digest Runbook ✅


**Status:** Complete (2026-06-11)
**Command:** `npm run daily:manual`

**Scope:**
- [x] `scripts/daily-manual.ts` — one-command daily run (collect → briefs → digest → check)
- [x] `npm run daily:manual` — manual daily digest command
- [x] `docs/MANUAL_DAILY_DIGEST_RUNBOOK.md` — full runbook with step-by-step, troubleshooting, quick reference
- [x] `reports/telegram-digest.txt` — single-message Telegram digest
- [x] `reports/manual-daily-run.md` — manual run execution report

**Note:** Phase 4B will add systemd timer / cron for automatic daily execution.

---

## Phase 4B — Scheduled Automation ⬜

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