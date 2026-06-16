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
| 0.9.3 | 2026-06-11 | Phase 3D | ✅ COMPLETE — Controlled image batch (River AI + stabilityai, 2 images) |
| 0.13.0 | 2026-06-11 | Phase 3E | ✅ COMPLETE — Image quality review & asset scoring (5 dims, 20pts each, 5 images) |
| 0.13.1 | 2026-06-11 | Phase 4B-2 | ✅ COMPLETE — First scheduled run validation (07:30 auto-run, exit 0) |
| 0.14.0 | 2026-06-12 | Phase 5A | ✅ COMPLETE — Harvester Read-only Dashboard (timer + guard + assets + queue) |
| 0.15.0 | 2026-06-13 | Phase 4C-5 | ✅ COMPLETE — Adapter parallelization & query reduction (fast profile, 30→86 signals, 5/9→8/9) |
| 0.16.0 | 2026-06-13 | Phase 4H | ✅ COMPLETE — Source-aware video prompt enhancement (25 packs, 859→1109 checks) |
| 0.17.0 | 2026-06-13 | Phase 4I | ✅ COMPLETE — Source-aware music prompt enhancement (25 packs, 1009 checks) |
| 0.17.1 | 2026-06-13 | Phase 4I-1 | ✅ COMPLETE — Sanitizer scope fix (allow public product name "MiniMax") |
| 0.18.0 | 2026-06-13 | Phase 5C-0 | ✅ COMPLETE — Private Control Command Catalog (read-only, 25 commands × 6 groups) |
| 0.19.0 | 2026-06-13 | Phase 5C-1 | ✅ COMPLETE — localhost-only Private Control Server (127.0.0.1:8788, read-only, no command execution) |
| 0.20.0 | 2026-06-13 | Phase 5C-2A | ✅ COMPLETE — Authenticated Control Actions Dry-run (auth + confirm + audit, no real execution) |
| 0.21.0 | 2026-06-13 | Phase 5C-2B | ✅ COMPLETE — Safe Read-only Action Execution (read-only queries, no side effects, no model calls) |
| 0.22.0 | 2026-06-13 | Phase 5C-3 | ✅ COMPLETE — Auto-generated Control Catalog from package.json scripts (policy-driven, drift-check) |
| 0.22.1 | 2026-06-13 | Phase 5C-4 | ✅ COMPLETE — Policy Review UI (auto-generated policy analysis, future execution candidates, never-execute list) |
| 0.23.0 | 2026-06-13 | Phase 5C-2C-A | ✅ COMPLETE — Confirmed Low-risk Execution Canary (5 safe validation scripts, spawn(shell=false), 60s timeout, 12K output limit) |
| 0.23.1 | 2026-06-13 | Phase 5C-2C-A1 | ✅ COMPLETE — Policy Review Validation Fix (dynamic never_execute, confirmed_low_risk=5, allowlist validation, 34/34 PASS) |
| 0.23.2 | 2026-06-13 | Phase 5C-2C-A2 | ✅ COMPLETE — Sanitizer False Positive Fix for sk- Pattern (negative lookbehind, 25/25 false-positive tests, 43/43 sanitizer tests) |
| 0.23.3 | 2026-06-13 | Phase 5C-2C-A3 | ✅ COMPLETE — Secret Redaction Completeness Check (colon fix, CQA_CONTROL_TOKEN, standalone Telegram token, 36/36 PASS) |
| 0.23.4 | 2026-06-13 | Phase 5C-2C-B | ✅ COMPLETE — More Low-risk Validation Executions (17 commands, expanded allowlist, no model calls, no media generation) |
| 0.24.0 | 2026-06-14 | Phase 5C-5A | ✅ COMPLETE — Control Server Hardening & Audit Viewer (rate limits, execution lock, audit log viewer, security status, runner output redaction) |
| 0.24.1 | 2026-06-14 | Phase 5C-2C-C0 | ✅ COMPLETE — End-to-end Workflow Dry-run Orchestrator (3 workflows, dry-run planner, no real collect/send/generate/timer/git execution) |
| 0.24.2 | 2026-06-14 | Phase 5C-2C-C1 | ✅ COMPLETE — Validation Workflow Execution (2 workflows: asset_validation_sweep + control_health_sweep, real execution with confirm phrase, daily_digest blocked) |
| 0.24.3 | 2026-06-14 | Phase 5C-2C-C2 | ✅ COMPLETE — Daily Digest Staged Plan (5 stages: collect blocked, build candidate, validate executable, send blocked, timer blocked) |
| 0.24.4 | 2026-06-14 | Phase 5C-2C-C3 | ✅ COMPLETE — Daily Digest Validate Stage Execution (stage_3_validate_outputs real execution, 3 scripts, confirmation phrase, other stages blocked) |
| 0.24.5 | 2026-06-14 | Phase 5C-2C-C4 | ✅ COMPLETE — Daily Digest Build Sandbox Plan (6 stages, protected paths, sandbox paths, no real execution, no production write) |
| 0.24.6 | 2026-06-14 | Phase 5C-2C-C5 | ✅ COMPLETE — Daily Digest Sandbox Directory Creation (sandbox run directories, manifest.json, protected paths, no production write) |
| 0.24.7 | 2026-06-14 | Phase 5C-2C-C5B | ✅ COMPLETE — Daily Digest Build Readiness Audit (118 files scanned, 62 builders detected, partial readiness, 4 refactors required) |
| 0.25.0 | 2026-06-14 | Phase 5C-2C-C5C | ✅ COMPLETE — Digest Builder Sandbox Interface (guard functions + contract, 14 validations, 621+ checks, no execution) |
| 0.25.1 | 2026-06-14 | Phase 5C-2C-C5D | ✅ COMPLETE — Digest Builder Sandbox Refactor (sandbox runtime config, pilot builder refactor, path resolver, all validations PASS) |
| 0.25.2 | 2026-06-14 | Phase 5C-2C-C5E | ✅ COMPLETE — Pilot Sandbox Digest Build Execution (sandbox build ran, outputs verified, production paths untouched) |
| 0.25.3 | 2026-06-14 | Phase 5C-2C-C5F | ✅ COMPLETE — Sandbox Output Validation & Diff (output validator, diff generator, secret/tool scan, 570+ checks PASS) |
| 0.25.4 | 2026-06-14 | Phase 5C-2C-C5G | ✅ COMPLETE — Sandbox Promote Readiness Plan (promote readiness checker, preconditions, blocked actions, future confirm phrase) |
| 0.25.5 | 2026-06-14 | Phase 5C-2C-C5H | ✅ COMPLETE — Sandbox Promote Dry-run / Copy Plan (dry-run plan, copy map, backup/rollback, human approval) |
| 0.25.6 | 2026-06-14 | Phase 5C-2C-C5I | ✅ COMPLETE — Promote Shadow Copy / Backup Plan (shadow copy, candidate preview, rollback manifest, promote checklist) |
| 0.25.7 | 2026-06-14 | Phase 5C-2C-C5J | ✅ COMPLETE — Promote Commit Gate (13/13 evidence met, gate_status=pass) |
| 0.25.8 | 2026-06-14 | Phase 5C-2C-C5K | ✅ COMPLETE — Promote Execution Design Review (6/6 evidence met, recommendation=allow_next_phase_design_only) |
| 0.25.9 | 2026-06-14 | Phase 5C-2C-C5L | ✅ COMPLETE — Promote Execution Disabled Scaffold (5/5 gate checks, always 403 disabled) |
| 0.25.10 | 2026-06-14 | Phase 5C-2C-C5M-0 | ✅ COMPLETE — Promote Human Approval Pack (4/4 validation evidence, human checklist 8 items) |
| 0.25.11 | 2026-06-15 | Phase 5C-2C-C5M-1 | ✅ COMPLETE — One-shot Controlled Promote (15/15 pre-promote PASS, 2 files promoted & hash-verified, backup+history written; only 2 prod targets; no Telegram, no timer, no model, no media) |
| 0.25.12 | 2026-06-15 | Phase 5C-2C-C5M1A | ✅ COMPLETE — Post-Promote Validation Gap Fix (14/14 post-promote PASS; 5 `<button>`→`<a data-safety="safe-localhost-confirm-phrase-gated">`; new validator check 6b for data-safety allow-list; protected paths md5-verified unchanged) |
| 0.25.13 | 2026-06-15 | Phase 5C-2C-C5M1B | ✅ COMPLETE — Dashboard Safety Hardening v2 (new policy file `dashboard/control-safety-policy.json`; new standalone 12-check validator; inline validator now reads policy; 11/11 validations PASS; protected paths md5-verified unchanged) |
| 0.25.14 | 2026-06-15 | Phase 5C-2C-C5N-0 | ✅ COMPLETE — Continuous Controlled Promote Workflow Plan (plan-only, NOT enabled; new config + planner + 27-check validator + GET/POST endpoints; auto-rollback DISABLED; manual-rollback supported; no new timer/cron/systemd; 16/16 validations PASS; smoke-tested GET + POST; protected paths md5-verified unchanged) |
| 0.25.15 | 2026-06-15 | Phase 5C-2C-C5N1 | ✅ COMPLETE — Human-in-loop Promote Approval Scaffold (scaffold-only, NOT enabled; new state config + planner + 26-check validator + GET/POST endpoints; approval_enabled=false; 6 transitions modeled; 8/8 pack-ready evidence met; 14/14 validations PASS; smoke-tested GET + POST; protected paths md5-verified unchanged) |
| 0.25.16 | 2026-06-15 | Phase 5C-2C-C5N2 | ✅ COMPLETE — Manual Approval Transition Dry-run (dry-run-only, NOT enabled; new policy + dry-run result; new planner + 28-check validator + GET/POST endpoints; would_transition=true but real_transition=false; approval state NOT modified; 6/7 evidence met (phrase not provided in default call); 14/14 validations PASS; smoke-tested GET + POST; protected paths md5-verified unchanged) |
| 0.25.17 | 2026-06-15 | Phase 5C-2C-C5N3 | ✅ COMPLETE — Human Review Pending State Record (REAL state transition; new policy + state recorder + 26-check validator + GET/POST endpoints; state ACTUALLY transitioned approval_pack_ready → human_review_pending; history record written to reports/human-approval-history/; real_approval=false; real_promote=false; production_write DISABLED; Telegram DISABLED; 13/13 validations PASS; smoke-tested GET + recorder; protected paths md5-verified unchanged) |
| 0.25.18 | 2026-06-15 | Phase 5C-2C-C5N4 | ✅ COMPLETE — Approved-for-future-promote Dry-run (dry-run-only, NOT enabled; new policy + dry-run result; new planner + 29-check validator + GET/POST endpoints; would_approve=true (11/12 evidence met, 1 missing=confirm_phrase in default CLI call) but real_approval=false; approval state NOT modified (still human_review_pending); production_write DISABLED; Telegram DISABLED; 15/15 validations PASS; smoke-tested GET + planner; protected paths md5-verified unchanged) |
| 0.25.19 | 2026-06-15 | Phase 5C-2C-C5N5 | ✅ COMPLETE — Approved-for-future-promote State Record (REAL state transition; new policy + state recorder + 32-check validator + GET/POST endpoints; state ACTUALLY transitioned human_review_pending → approved_for_future_promote; history record written to reports/human-approval-history/; real_approval=true but real_promote=false; production_write DISABLED; Telegram DISABLED; 16/16 validations PASS; smoke-tested GET + POST; protected paths md5-verified unchanged) |
| 0.25.20 | 2026-06-15 | Phase 5C-2C-C5N6-A | ✅ COMPLETE — Approved Promote Execution Preflight (preflight-only, dry-run; new policy + preflight planner + 30-check validator + GET/POST endpoints; would_promote=true; hash comparison identical (sandbox already promoted in C5M-1); backup/rollback verified; real_promote=false; production_write DISABLED; Telegram DISABLED; 17/17 validations PASS; smoke-tested GET + POST; protected paths md5-verified unchanged) |
| 0.25.21 | 2026-06-15 | Phase 5C-2C-C5N4A | ✅ COMPLETE — Approval State Integrity Audit (read-only; verified C5N4 dry-run boundary held; b76dfd4 did NOT modify approval state; current approval_state=approved_for_future_promote correctly attributed to C5N5 commit bb7333d; production paths md5-verified unchanged; promote blocked; 18/18 validations PASS; no new endpoint) |
| 0.25.22 | 2026-06-15 | Phase 5C-2C-C5N4B | ✅ COMPLETE — Freeze & Decision Record (freeze + decision options; new freeze record + generator + 32-check validator + 1 GET endpoint; frozen=true; approval_state=approved_for_future_promote; dry_run_boundary_breach=false; 3 decision options; default_recommendation=keep_approved_for_future_promote_but_do_not_promote_yet; human_decision_required=true; production_write DISABLED; Telegram DISABLED; timer DISABLED; 18/18 validations PASS; smoke-tested GET; protected paths md5-verified unchanged) |
| 0.25.23 | 2026-06-15 | Phase 5C-2C-C5N4C | ✅ COMPLETE — Human Decision Record (keep approved, frozen; new human decision JSON + recorder + 43-check validator + 1 GET endpoint; decision=keep_approved_for_future_promote_but_do_not_promote_yet; c5n_frozen=true; rollback_requested=false; promote_requested=false; human_decision_required=false; next_allowed_phase=C5N-6-A review only; production_write DISABLED; Telegram DISABLED; timer DISABLED; 15/15 validations PASS; smoke-tested GET; protected paths md5-verified unchanged) |
| 0.25.24 | 2026-06-15 | Phase C5N-6A-Review | ✅ COMPLETE — Approved Promote Preflight Review (read-only; new review JSON + reviewer + 44-check validator + 1 GET endpoint; 11/11 evidence items met; c5n_frozen=true; recommended_next_action=continue_freeze; missing_requirements=0; unresolved_risks=3; telegram_send/timer/promote independently gated; 15/15 validations PASS; smoke-tested GET; protected paths md5-verified unchanged) |
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

| Phase 4D-1 | **Content Pack human-readable detail pages** | Content packs need human-readable HTML pages instead of raw JSON |

---

## Phase 4D-2 — Gallery Dedup & Rich Detail Content ✅

**Status:** Complete (2026-06-11)

**Scope:**
- [x] Gallery dedup: 25 packs → 5 unique topics (20 duplicates collapsed)
- [x] `metadata/gallery-dedup-index.json` — canonical keys and version tracking
- [x] Enhanced detail pages with source-specific sections (code/academic/culture-art/ai-ecosystem/dev-community)
- [x] Version history on detail pages (shows all related versions)
- [x] Reads brief.md, facts.md, x-post.zh.md for richer content
- [x] Updated `scripts/validate-public-gallery.ts` for dedup gallery (30 checks)
- [x] `scripts/validate-gallery-dedup.ts` — 19 checks PASS

---

## Phase 4D-1 — Content Pack Human Detail Pages ✅

**Status:** Complete (2026-06-11)
**Command:** `npm run pages:content-packs`

**Problem solved:** Gallery "详情" button opened raw `detail.json` (machine-readable) and `content-summary.zh.md` (Markdown raw) — not user-friendly.

**Scope:**
- [x] `scripts/build-content-pack-pages.ts` — generates `index.html` for each content pack
- [x] 25/25 content packs now have human-readable `index.html`
- [x] Page structure: navigation, title, source badge, one-sentence summary, background, why-it-matters, recommended uses, available assets, prompt previews, generated images section, uncertainty notes, developer files
- [x] `gallery/index.html` — primary button links to `index.html`, secondary to `content-summary.zh.md`, tertiary to `detail.json`
- [x] `daily/YYYY/MM/YYYY-MM-DD/index.html` — pack links point to `index.html`
- [x] `metadata/content-pack-index.json` — added `detail_page_path`, `detail_page_url`, `summary_md_path`, `detail_json_path`
- [x] `scripts/validate-content-pack-pages.ts` — 260/260 checks PASS
- [x] `npm run validate:content-pack-pages` — automated validation
- [x] Light UI consistent with Gallery style, mobile responsive
- [x] No LLM calls, no MiniMax, no new media generation

**Example detail page:**
https://conanxin.github.io/creative-quota-assets/content-packs/2026/06/2026-06-11/brief-brief-mq8swsla-f-samuraigpt-generative-media-skills/index.html

**Next phases:**
- Phase 4B-2: First scheduled run validation (Fri 07:30 CST)
- Phase 4E-2: Gallery card hotfix (if needed)
- Phase 5A: Harvester read-only dashboard

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

## Phase 3E — Image Quality Review & Asset Scoring ✅

**Status:** Complete (2026-06-11)
**Command:** `npm run review:images && npm run validate:image-reviews`

**Problem solved:** No systematic way to assess quality of generated images beyond file size checks.

**Scope:**
- [x] `scripts/review-generated-images.ts` — rule-based scoring (NO LLM, NO MiniMax, NO visual model)
- [x] 5 dimensions × 20 pts each: technical_validity, prompt_alignment, source_relevance, usability, diversity_and_coverage
- [x] `metadata/generated-assets-review.json` — review summary with quality distribution
- [x] `metadata/asset-quality-scores.json` — flat table with scores, dimensions, recommended_uses
- [x] Per-image `.review.zh.md` in image directory (same dir as image file)
- [x] `scripts/validate-image-reviews.ts` — 147/147 checks PASS
- [x] `build-content-pack-pages.ts` — shows quality badge, score, review link for generated images
- [x] `build-gallery-from-dedup.ts` — shows quality_label, score, recommended uses on image cards
- [x] `npm run review:images` + `npm run pages:content-packs` + `npm run gallery:from-dedup` + all validations PASS
- [x] README updated (harvester + assets), ROADMAP updated

**Review results:**
- Total images: 5
- Average score: 96%
- Quality distribution: ⭐ excellent: 5, ✅ good: 0, ⚠️ fair: 0, ❌ poor: 0
- Source type distribution: academic: 1, code: 1, culture-art: 1, dev-community: 1, ai-ecosystem: 1

**Image scores:**
| Image | Source Type | Score | Quality |
|-------|-------------|-------|---------|
| cqa-2026-06-11-canary-001_001.jpg | academic | 96/100 | ⭐ excellent |
| cqa-2026-06-11-gen-002_001.jpg | code | 97/100 | ⭐ excellent |
| cqa-2026-06-11-gen-003_001.jpg | culture-art | 96/100 | ⭐ excellent |
| cqa-2026-06-11-gen-004_001.jpg | dev-community | 97/100 | ⭐ excellent |
| cqa-2026-06-11-gen-005_001.jpg | ai-ecosystem | 94/100 | ⭐ excellent |

**Next phases:**
- Phase 4B-2: First scheduled run validation (Fri 07:30 CST)
- Phase 5A: Harvester read-only dashboard

---

## Phase 4C-5 — Adapter Parallelization & Query Reduction ✅

**Status:** Complete (2026-06-13)

**Scope:**
- [x] `config/source-budgets.example.json` — fast/full/diagnose profiles with concurrency, max results, cooldown specs
- [x] `src/sources/profile.ts` — budget loader, `runWithPool`, `setCooldown/getCooldown` API, baked-in defaults
- [x] GitHub Radar: 4 high-value queries (fast), concurrency 2, rate-limit awareness (stop if remaining<3)
- [x] Hugging Face: 4 filters (fast), concurrency 2, no fixed serial wait, partial returns
- [x] Hacker News: 5 concurrent item fetches, 4s per-item timeout, keyword fallback (3)
- [x] GDELT: 6h cooldown on 429, fast profile skips without HTTP call
- [x] Source health: profile, query_count, success_count, partial_count, timeout_count, failed_count, skipped_cooldown_count, next_allowed_at
- [x] New scripts: `collect:fresh:fast`, `collect:fresh:full`, `collect:diagnose:connectivity`
- [x] `daily-scheduled.sh` defaults to fast profile
- [x] `daily-manual.ts` uses fast profile
- [x] `.gitignore` updated to track `*.example.json` in config/

**Before / After (run-mqbscv61 vs run-mqbtfpdo):**
| Source | Before | After |
|--------|--------|-------|
| GitHub Radar | timeout 35s | success 2.1s (16.6x faster) |
| Hugging Face | timeout 35s | success 8.7s (4x faster) |
| Hacker News | 0 signals | 16 signals |
| GDELT | partial 0 (429) | skipped_cooldown (no HTTP) |
| **Total** | **30 / 5 of 9** | **86 / 8 of 9 + 1 cooldown** |

**Validation:**
- `collect:diagnose` 8/9 reachable
- `collect:fresh:fast` PASS, 86 signals
- `digest:telegram` PASS, 1736 chars, freshness 0h
- `digest:telegram:check` PASS (7/7)
- `validate:digest-freshness` PASS (16/16)
- `validate:telegram-sanitizer` PASS (6/6)
- TypeScript clean for new files

**Boundaries:** No MiniMax call, no new media, no gateway/.env/timer change.

**Next:** Phase 4C-6 — Cooldown generalization + 5xx handling.

---

## Future Considerations (Backlog)

### Short-term (Next Phases)

| Phase | Description | Trigger |
|-------|-------------|--------|
| **Phase 4C-6** | Cooldown generalization + 5xx handling | After 4C-5 stable in daily run |
| **Phase 4C-7** | Per-adapter result cache (Met 7d, HF filter 1h) | Optional |
| **Phase 4I-2** | Persistent sanitizer test suite (12 self-tests) | After 4I-1 merged |
| **Phase 4I-3** | Asset-side naming sanity check (`validate:assets-naming`) | After 4I-2 |
| **Phase 4J** | Audio coupling (video 8s + music 60-90s timeline alignment) | After 4H+4I stable |
| **Phase 4K** | Music prompt scoring (mood specificity, instrument coverage) | After 4J |
| **Phase 5C-1** | localhost-only private control server (127.0.0.1 bind, CORS locked) | After 5C-0 |
| **Phase 5C-2A** | ✅ **Authenticated control actions dry-run** (auth + confirm + audit, no real execution) | After 5C-1 |
| **Phase 5C-2B** | ✅ **Safe read-only action execution** (read-only queries, no side effects, no model calls) | After 5C-2A |
| **Phase 5C-2C** | Confirmed low-risk command execution (with 2FA for high/danger) | After 5C-2B |
| **Phase 5C-3** | ✅ **Auto-generated control catalog from package.json scripts** (policy-driven, drift-check, 69 scripts mapped) | After 5C-2B |
| **Phase 5C-4** | ✅ **Policy Review UI** (auto-generated policy analysis, future execution candidates, never-execute list) | After 5C-3 |
| **Phase 5C-2C-A** | ✅ **Confirmed low-risk execution canary** (5 safe validation scripts, spawn(shell=false), 60s timeout, 12K output) | After 5C-4 |
| **Phase 5C-2C-A1** | ✅ **Policy review validation fix** (dynamic never_execute, confirmed_low_risk=5, allowlist validation, 34/34 PASS) | After 5C-2C-A |
| **Phase 5C-2C-A2** | ✅ **Sanitizer false positive fix for sk- pattern** (negative lookbehind, 25/25 false-positive tests, 43/43 sanitizer tests, 8/8 validations PASS) | After 5C-2C-A1 |
| **Phase 5C-2C-A3** | ✅ **Secret redaction completeness check** (colon fix for Telegram token, CQA_CONTROL_TOKEN, standalone Telegram token, 36/36 PASS, 9/9 validations PASS) | After 5C-2C-A2 |
| **Phase 5D** | Lyrics-aware music prompt variants (when lyrics make sense) | After 4J |

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
| localhost-only control server (Phase 5C-1) | Read-only, no execution surface; authenticates by network binding (127.0.0.1) not by token |

---

## Phase 5C-1 — localhost-only Private Control Server

Status: COMPLETE.
Adds a localhost-only, read-only private control server at 127.0.0.1:8788.
No command execution, no model calls, no media generation, no timer control.

### What Changed

- New `scripts/control-server.ts` — Node.js built-in http module, binds only to 127.0.0.1:8788
- New `scripts/validate-control-server.ts` — 20 validation checks
- New `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` — operator runbook
- New `docs/PHASE_5C1_LOCALHOST_PRIVATE_CONTROL_SERVER_REPORT.md` — full report
- New `reports/localhost-private-control-server.md` — detail report
- New `reports/telegram-phase-5c1-control-server.txt` — sanitized Telegram report
- `package.json` — 4 new scripts: `control:server`, `control:server:check`, `control:server:smoke`, `validate:control-server`
- `README.md` — Phase 5C-1 section added
- `ROADMAP.md` — Phase 5C-1 added to version history and future considerations updated

### Server Routes

| Route | Method | Content-Type | Purpose |
|-------|--------|------------|---------|
| `GET /` | HTML | text/html | Private control console (Chinese UI, status, catalog, links) |
| `GET /health` | JSON | application/json | Health check: `{ status, mode, host, port, timestamp }` |
| `GET /api/status` | JSON | application/json | Returns `dashboard/status.json` |
| `GET /api/control-catalog` | JSON | application/json | Returns `dashboard/control-catalog.json` |
| `GET /api/reports` | JSON | application/json | Report whitelist + availability index |
| `GET /api/report?name=...` | text/plain | text/plain | Whitelisted report text (auto-appends .txt if missing) |
| `GET /static/dashboard` | HTML | text/html | Serves `dashboard/index.html` |

All other routes → 404. All non-GET methods → 405.

### Security Model

- Only binds to `127.0.0.1` (hardcoded). Any other host → `process.exit(1)`.
- Only accepts GET. All others → 405 Method Not Allowed.
- No POST handler, no WebSocket, no child_process, no exec, no spawn.
- No .env reading, no .env.telegram.local reference, no token exposure.
- Path traversal blocked (`..` and `\0` → 400 Bad Request).
- Report whitelist enforced (24 named reports only). Unknown names → 403 Forbidden.
- Error handler on server prevents unhandled error events.
- No CORS (localhost-only, no cross-origin needed).

### Validation Results

`npm run validate:control-server`: **20/20 PASS**
- control-server.ts: binds to 127.0.0.1, not 0.0.0.0
- No child_process require, no exec()/spawn()/execSync()/spawnSync()/execFile() calls
- Blocks non-GET methods
- No new WebSocket()
- No .env file read, no .env.telegram.local reference
- No token assignment, no API key patterns
- No eval()
- Path traversal guard present
- REPORTS_WHITELIST defined
- package.json scripts present (4/4)
- dashboard/status.json: valid JSON
- dashboard/control-catalog.json: valid JSON

Regression checks:
- `dashboard:control:validate`: 15/15 PASS
- `dashboard:build`: PASS
- `dashboard:validate`: 22/22 PASS

### Smoke Test Results

- `GET /health` → `{"status":"ok","mode":"localhost-only-read-only","host":"127.0.0.1","port":8788}`
- `GET /` → contains `Creative Quota 私有控制台`, `localhost-only`, `read-only`, `不执行命令`, `不触发模型`
- `GET /api/status` → valid JSON
- `GET /api/control-catalog` → valid JSON
- `GET /api/report?name=telegram-digest` → report text (auto-appends .txt)
- `POST /api/control-catalog` → `HTTP/1.1 405 Method Not Allowed`

### Boundaries

- MiniMax called: **No**
- Image model called: **No**
- Video model called: **No**
- Music model called: **No**
- LLM called: **No**
- New media generated: **No**
- New audio generated: **No**
- Systemd timer: untouched
- Gateway config: untouched
- .env / .env.telegram.local: not committed
- Telegram token: not printed
- Real execution: not possible from this server
- Public Pages executable control: not possible

### Next Phase

- **Phase 5C-2B**: Safe read-only action execution (with auth + audit) ✅
- **Phase 5C-3**: Auto-generated catalog from package.json scripts ✅
- **Phase 5C-2C**: Confirmed low-risk command execution (with 2FA for high/danger)
- **Phase 4J**: Audio coupling (video + music)
- **Phase 6A**: Smart profile selection

### Files Changed

- `scripts/control-server.ts` (new, ~500 lines)
- `scripts/validate-control-server.ts` (new, ~140 lines)
- `docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md` (new)
- `docs/PHASE_5C1_LOCALHOST_PRIVATE_CONTROL_SERVER_REPORT.md` (new)
- `reports/localhost-private-control-server.md` (new)
- `reports/telegram-phase-5c1-control-server.txt` (new)
- `package.json` (modified, +4 scripts)
- `README.md` (modified, Phase 5C-1 section added)
- `ROADMAP.md` (modified, Phase 5C-1 added)

### Commit

```
Phase 5C-1: Add localhost-only private control server
```

---

## Phase 6E-A — Image Generation Readiness Preflight ✅

**Mode:** read-only preflight · **No model call** · **No media generation**

### What Changed

- `dashboard/image-generation-preflight.json` (new in both repos)
- `scripts/validate-image-generation-preflight.ts` (new)
- `package.json` (added `validate:image-generation-preflight` script)
- `dashboard/index.html` (added Phase 6E-A card)

### Boundaries

- MiniMax image API called: **No**
- Image model called: **No**
- Video model called: **No**
- Music model called: **No**
- LLM called: **No**
- New media generated: **No**
- New audio generated: **No**
- Existing `generated-assets.json` modified: **No**
- 6D-5 `final_status` modified: **No**
- Telegram / timer / digest / promote triggered: **No**

### Next Phase

- **Phase 6E-B**: Controlled Image Generation Plan

---

## Phase 6E-B — Controlled Image Generation Plan ✅

**Mode:** plan-only · **No model call** · **No media generation**

### What Changed

- `dashboard/image-generation-plan.json` (new in both repos)
- `scripts/validate-image-generation-plan.ts` (new)
- `package.json` (added `validate:image-generation-plan` script)

### Plan Summary

- 5 items selected (one per source_type: code / academic / ai-ecosystem / dev-community / culture-art)
- 3 runs planned (Run 1: 2 low-risk; Run 2: 2 low-risk; Run 3: 1 medium-risk culture-art)
- 4 human gates defined (gate_1_approve_batch_1, gate_2_approve_batch_2, gate_3_approve_batch_3, gate_4_approve_model_spend)
- All gates default to `pending` — execution is blocked on human approval

### Boundaries

- MiniMax image API called: **No**
- Image model called: **No**
- Video model called: **No**
- Music model called: **No**
- LLM called: **No**
- New media generated: **No**
- Existing `generated-assets.json` modified: **No**
- 6D-5 `final_status` modified: **No**
- Telegram / timer / digest / promote triggered: **No**

### Next Phase

- **Phase 6E-C**: Run 1 Gate Approval (human decision record only)

---

## Phase 6E-C — Approve Run 1 Image Generation Gate ✅

**Mode:** gate decision only · **No model call** · **No media generation**

### What Changed

**Assets repo:**

- `dashboard/image-generation-gates.json` (new)
- `docs/PHASE_6EC_RUN1_GATE_APPROVAL.md` (new)
- `reports/image-generation-run1-gate-approval.md` (new)

**Harvester repo:**

- `dashboard/image-generation-gates.json` (new — mirror)
- `dashboard/image-generation-plan.json` (modified — `phase_6e_c_gate_status` block added)
- `dashboard/mainline-production-queue.json` (modified — `phase_6e_c` block added)
- `dashboard/index.html` (modified — Phase 6E-C card added)
- `scripts/validate-image-generation-gates.ts` (new)
- `package.json` (modified — added `validate:image-generation-gates` script)
- `reports/phase-6ec-run1-gate-approval.md` (new)
- `reports/telegram-phase-6ec-run1-gate-approval.txt` (new)
- `README.md` (modified — Phase 6E-C row added)
- `ROADMAP.md` (modified — Phase 6E-C section added)

### Human Decision

**Decision text:** `HUMAN_APPROVES_RUN_1_AND_LIMITED_SPEND_2_IMAGES`

| Gate | Decision | Scope |
|------|----------|-------|
| `gate_1_approve_batch_1` | **approved** | Run 1 only (Q-6E-B-001 + Q-6E-B-002, 2 images) |
| `gate_2_approve_batch_2` | **pending** | Run 2 NOT approved |
| `gate_3_approve_batch_3` | **pending** | Run 3 NOT approved (culture-art / medium-risk) |
| `gate_4_approve_model_spend` | **approved_limited_run1_only** | Budget cap = 2 images, Run 2/3 budgets NOT approved |

### Run 1 Approved Items

| item_id | Title | source_type | risk | aspect |
|---------|-------|-------------|------|--------|
| Q-6E-B-001 | SamurAIGPT/Generative-Media-Skills | code | low | 16:9 |
| Q-6E-B-002 | Flaws in the LLM Automation Narrative | academic | low | 16:9 |

### Boundaries

- MiniMax image API called: **No**
- Image model called: **No**
- Video model called: **No**
- Music model called: **No**
- LLM called: **No**
- New media generated: **No**
- New audio generated: **No**
- Existing `generated-assets.json` modified: **No** (still 5 baseline)
- 6D-5 `final_status` modified: **No** (still closed)
- 6D-5 `posted_manually_total` modified: **No** (still 5)
- Telegram / timer / digest / promote triggered: **No**
- baoyu-post-to-x / X API called: **No**
- Secrets printed: **No**
- Run 2 / Run 3 approved: **No** (gates stay pending)
- Run 1 generation executed: **No** (this phase records the decision only)

### Validators Executed

- `validate:image-generation-gates` (new — Phase 6E-C specific)
- `validate:image-generation-plan`
- `validate:image-generation-preflight`
- `validate:x-manual-publishing-closeout`
- `validate:mainline-recovery`
- `validate:dashboard-control-safety`
- `dashboard:control:validate`
- `validate:telegram-sanitizer`
- `validate:project-report-send`

All validators: PASS

### Next Phase

- **Phase 6E-D**: Run 1 Controlled Image Generation — requires separate explicit human command
  - Run 1 (2 images) approved; budget cap = 2 images; Run 2/3 budgets stay unapproved
  - **NOT auto-triggered** by Phase 6E-C completion

### Commits

```
Assets repo:
  Phase 6E-C: Approve Run 1 image generation gate

Harvester repo:
  Phase 6E-C: Approve Run 1 image generation gate
```
---

## Phase 6E-D — Run 1 Controlled Image Generation ✅

**Mode:** controlled image generation · **Budget:** 2 images (Run 1 only)
**Result:** 2/2 images generated within approved budget.

**Key outcomes:**
- First attempt (13:50:46) was blocked at quota check (8% < 50%)
- Second attempt (15:05:00) succeeded after interval reset (99% ≥ 50%)
- cumulative generated images: 5 → 7
- pending images: 20 → 18
- Hard Limit #15 was respected at every attempt

**Files written:**
- `assets-repo:generated/phase-6e/run1/manifest.json`
- `assets-repo:generated/phase-6e/run1/README.md`
- `assets-repo:images/2026/06/16/cqa-2026-06-16-run1-001_001.jpg` (217KB)
- `assets-repo:images/2026/06/16/cqa-2026-06-16-run1-002_001.jpg` (259KB)
- `assets-repo:metadata/generated-assets.json` (5 → 7)
- `dashboard/image-generation-run1.json` (both repos)
- `dashboard/image-generation-plan.json` (updated)
- `dashboard/image-generation-preflight.json` (updated pending 20→18)
- `scripts/validate-image-generation-run1.ts` (new)
- `package.json` (added `validate:image-generation-run1`)

**Validations:** `validate:image-generation-run1` 56/56 PASS · `validate:image-generation-gates` 161/161 · `validate:image-generation-plan` 125/125 · `validate:image-generation-preflight` 66/66 · `validate:x-manual-publishing-closeout` 89/89

### Next Phase

- **Phase 6E-E**: Run 1 Human Image Review — requires separate explicit human command
  - 2 images pending human scoring on 5 dimensions
  - **NOT auto-triggered** by Phase 6E-D completion

### Commits

```
Assets repo:
  Phase 6E-D: Generate Run 1 controlled images

Harvester repo:
  Phase 6E-D: Record Run 1 controlled image generation
```

---

## Phase 6E-E — Run 1 Human Image Review Pack ✅

**Mode:** read-only review pack creation · **No model call** · **No media generation**
**Result:** review pack created; 2 images pending human scoring.

**Key outcomes:**
- 2 review artefacts created (review-board + scoring-sheet) in assets-repo
- 1 README explains the workflow
- 1 harvester dashboard mirrors the state
- 1 validator (`validate:image-generation-run1-review`) with 98/98 PASS
- `decision=pending` · `review_status=pending_human_review` · `human_score=null`
- total_generated_images=7 (unchanged) · pending_images=18 (unchanged)
- Run 2 / Run 3 still pending — NOT approved in this phase
- 6D-5 final_status=closed preserved

**Files written:**
- `assets-repo:publishing/review/image/phase-6e/run1/README.md`
- `assets-repo:publishing/review/image/phase-6e/run1/review-board.json`
- `assets-repo:publishing/review/image/phase-6e/run1/review-board.md`
- `assets-repo:publishing/review/image/phase-6e/run1/scoring-sheet.json`
- `assets-repo:publishing/review/image/phase-6e/run1/scoring-sheet.md`
- `dashboard/image-generation-run1-review.json`
- `dashboard/mainline-production-queue.json` (added `run1_review` block)
- `dashboard/index.html` (added Phase 6E-E card)
- `scripts/validate-image-generation-run1-review.ts` (new)
- `package.json` (added `validate:image-generation-run1-review`)
- `reports/phase-6ee-run1-human-image-review-pack.md`
- `reports/telegram-phase-6ee-run1-human-image-review-pack.txt`
- `README.md` (modified — Phase 6E-E row added)
- `ROADMAP.md` (modified — Phase 6E-D + 6E-E sections added)

**Scoring dimensions (5 per image, 0-10 each):**
1. `prompt_alignment` (25%) — prompt fidelity
2. `visual_quality` (25%) — sharpness / lighting / no artifacts
3. `usefulness_as_asset` (20%) — works for gallery / blog / X
4. `factual_safety` (15%) — no fake citations / fake names / hallucinated logos
5. `brand_text_artifact_risk` (15%, reversed) — garbled text / fake brand confusion

**Overall score:** 0-100 weighted (with risk reversed)
**Decision options:** `approve` / `needs_regen` / `reject`

**Validations:** `validate:image-generation-run1-review` 98/98 PASS · `validate:image-generation-run1` 56/56 · `validate:image-generation-gates` 161/161 · `validate:image-generation-plan` 125/125 · `validate:image-generation-preflight` 66/66 · `validate:x-manual-publishing-closeout` 89/89 · `validate:dashboard-control-safety` PASS · `dashboard:control:validate` 17/17 · `validate:telegram-sanitizer` 43/43 · `validate:project-report-send` 11/11

### Next Phase

- **Human scoring**: 爸爸 provides 5-dimension scores + decision for both images (NOT auto-triggered)
- **If all approved →** Phase 6E-F: Approve Run 2 Gate Only — requires separate human command
- **If any needs_regen →** Phase 6E-G: Regenerate within Run 1 budget — requires separate human command
- **If any rejected →** Mark as terminal; no automatic re-generation
- **Idle:** leave decision=pending

### Commits

```
Assets repo:
  Phase 6E-E: Add Run 1 human image review pack

Harvester repo:
  Phase 6E-E: Add Run 1 human image review pack
```
