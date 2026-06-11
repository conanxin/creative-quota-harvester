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
| 0.9.4 | 2026-06-11 | Phase 4B-1 | ✅ COMPLETE — Timer enabled, daily 07:30 CST |
| 0.9.5 | 2026-06-11 | Phase 4B-1a | ✅ COMPLETE — Timer persistence and safety check (Linger=yes, PASS) |
| 0.10.0 | 2026-06-11 | Phase 4C | ✅ COMPLETE — Public gallery Chinese UI refresh (light theme, Chinese-first) |
| 0.11.0 | 2026-06-11 | Phase 4D | ✅ COMPLETE — Content pack detail enrichment (detail.json + content-summary.zh.md, 25 packs) |
| 0.12.0 | 2026-06-11 | Phase 4E | ✅ COMPLETE — Daily calendar archive (calendar-index.json + daily pages, 2 days) |
| 0.12.1 | 2026-06-11 | Phase 4E-1 | ✅ COMPLETE — Daily archive date attribution fix (images归到 generated_at date) |

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

## Phase 4B — Scheduled Automation ✅

> Phase 4B-0: Dry run — PASS
> Phase 4B-1: Timer enabled — PASS
> Phase 4B-1a: Persistence and safety check — PASS

**Timer status:** `active (waiting)`, next run `Fri 2026-06-12 07:30:00 CST`
**Schedule:** `07:30 CST daily` via systemd user timer (`creative-quota-digest.timer`)
**Linger:** `yes` — survives logout/reboot

**Validation after tomorrow 07:30:**
```bash
systemctl --user status creative-quota-digest.service
journalctl --user -u creative-quota-digest.service -n 120 --no-pager
tail -n 120 logs/daily-scheduled.log
```

**How to disable:** `systemctl --user disable --now creative-quota-digest.timer`

---

## Phase 4C — Public Gallery Chinese UI Refresh ✅


**Status:** Complete (2026-06-11)
**Assets repo:** `creative-quota-assets`

**Scope:**
- [x] `gallery/index.html` complete UI refresh (684 lines)
- [x] Light theme (#f7f4ef beige + white cards)
- [x] Chinese-first UI ("AI 创意素材库")
- [x] Stats bar (Content Packs / 已生成图片 / 信号来源 / 最后更新)
- [x] Generated images section with thumbnails (dynamic from assets.json)
- [x] Chinese filter labels
- [x] New status badges: ✅ 已接入真实信号源 · 已生成 Content Packs · 已包含 MiniMax 图片素材
- [x] Chinese error/empty states
- [x] `README.md` Chinese refresh (3 MiniMax images documented)
- [x] GitHub push: `a035f4b`

**Public URL:** https://conanxin.github.io/creative-quota-assets/gallery/

**Gallery stats:** Content Packs: 25 | Total assets: 26 | Generated images: 3


---

## Phase 4D — Content Pack Detail Enrichment ✅

**Status:** Complete (2026-06-11)

**Scope:**
- [x] `scripts/enrich-content-packs.ts` — rule-based enrichment (no LLM)
- [x]25/25 content packs: `detail.json` + `content-summary.zh.md`
- [x] `scripts/validate-content-enrichment.ts` — 8/8 checks PASS
- [x] `metadata/content-pack-index.json` — pack index
- [x] `metadata/generated-image-descriptions.json` — 3 images with Chinese descriptions
- [x] `gallery/index.html` — enhanced cards (一句话介绍 + 推荐用途 + 详情链接)
- [x] `gallery/assets.json` — enriched with one_sentence_summary + recommended_uses

**Gallery stats:**
- Content Packs: 25
- detail.json: 25/25
- content-summary.zh.md: 25/25
- assets.json enriched: 10/16 content packs

---

## Phase 4E — Daily Calendar Archive ✅

**Status:** Complete (2026-06-11)

**Scope:**
- [x] `scripts/build-daily-archive.ts` — calendar builder (2 days archived)
- [x] `scripts/validate-daily-archive.ts` — 12/12 checks PASS
- [x] `daily/calendar-index.json` — calendar index
- [x] `daily/index.html` — calendar view (中文)
- [x] `daily/YYYY/MM/YYYY-MM-DD/index.html` — 2 day detail pages
- [x] `daily/YYYY/MM/YYYY-MM-DD/daily-summary.json` — 2 day summaries
- [x] `gallery/index.html` — added daily archive link
- [x] `README.md` — updated with daily archive section

**Archived days:** 2
- 2026-06-11: 10 Content Packs + 3 generated images (correct attribution)
- 2026-06-10: 15 Content Packs

**Phase 4E-1 Date Attribution Fix:**
- Images now correctly归到 `generated_at` date (2026-06-11)
- Content Packs grouped by pack creation date
- daily/index.html has date attribution legend
- Daily detail pages show two sections with clear labels

---

## Future Considerations (Backlog)


### Short-term (Next Phases)

| Phase | Description | Trigger |
|-------|-------------|--------|
| **Phase 4B-2** | First Scheduled Run Validation | After tomorrow 07:30 |
| **Phase 3D** | Controlled Image Batch with Guard | Dad confirms |
| **Phase 5A** | Harvester Read-only Dashboard | Optional |

### Long-term
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