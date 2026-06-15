# Publishing Readiness Review — Phase 6C

**Phase:** 6C (Publishing Readiness Review & Deduped Shortlist)  
**Generated:** 2026-06-15T20:55:00+08:00  
**Based on:** Phase 6B (Harvester commit=0a7c051, Assets commit=4969002)  
**Mode:** review + dedup, NO publish, NO model call, NO media generation

---

## TL;DR

- Phase 6B queue is **valid** (25 X posts, 25 blog drafts, 5 ready, 20 needs_asset).
- Phase 6B HIGH_PRIORITY_QUEUE **concentrated 5/5 on one topic** ("Flaws in the LLM Automation Narrative") — this is a topic-flooding risk.
- Phase 6C **dedups** the queue into 3 shortlists of 5 unique topics each (100% topic diversity).
- **All 3 shortlists are READ-ONLY ARTEFACTS for human review.** No platform publish, no model call, no media generation, no timer.

---

## Input Scan Results

| Check | Result |
|-------|--------|
| `publishing/x/index.json` exists | ✅ |
| X posts total | 25 |
| X posts with `post_text` | 25/25 |
| X ready posts (has image + post) | 5 |
| X ready posts with `image_url` | 5/5 |
| X ready posts with `gallery_url` | 5/5 |
| X `needs_asset` count | 20 (matches ready+needs_asset = 25) |
| `publishing/blog/index.json` exists | ✅ |
| Blog drafts total | 25 |
| Blog drafts with `title`/`source_type`/`status` | 25/25 |
| Blog drafts `draft_ready` | 15 |
| Blog drafts `outline_only` (needs body) | 10 (all `culture-art` + `dev-community` 5+5 — `needs_expansion: true`) |
| Duplicate topic concentration warning | ⚠️ 5/5 top posts share "Flaws in the LLM Automation Narrative" |

**Verification:** all 25 X post markdown files exist in `publishing/x/posts/`. All 5 unique blog draft files exist in `publishing/blog/drafts/`. (The 25 blog drafts dedup to 5 unique topics × 5 variants each.)

---

## Topic Inventory (5 unique topics)

| # | title_slug | source_type | X total | X ready | X needs_asset | Blog total |
|---|------------|-------------|---------|---------|---------------|------------|
| 1 | flaws-in-the-llm-automation-narrative | academic | 5 | 1 | 4 | 5 |
| 2 | stabilityai-stable-video-diffusion-img2vid-xt | ai-ecosystem | 5 | 1 | 4 | 5 |
| 3 | samuraigpt-generative-media-skills | code | 5 | 1 | 4 | 5 |
| 4 | river-ai | dev-community | 5 | 1 | 4 | 5 |
| 5 | the-penitence-of-saint-jerome | culture-art | 5 | 1 | 4 | 5 |

Each topic has 5 variants from 5 content-pack runs (2026-06-10, 2026-06-11). The 5 variants are nearly identical (same post text theme, same source material); only minor word-level differences in the post_text. The first variant per topic with the highest quality is selected.

---

## A. Ready X Shortlist (5/5 unique topics)

| Topic | source_type | post_id | quality | has image | has review |
|-------|-------------|---------|---------|-----------|------------|
| Flaws in the LLM Automation Narrative | academic | Q-6B-X-...-mq8c6kp5-u-flaws-i | 96 | ✅ canary-001 | ✅ |
| stabilityai/stable-video-diffusion-img2vid-xt | ai-ecosystem | Q-6B-X-...-mq8c663q-4-stabili | 94 | ✅ gen-005 | ✅ |
| SamurAIGPT/Generative-Media-Skills | code | Q-6B-X-...-mq8c6kp4-7-samurai | 97 | ✅ gen-002 | ✅ |
| River AI | dev-community | Q-6B-X-...-mq8c663q-v-river-a | 97 | ✅ gen-004 | ✅ |
| The Penitence of Saint Jerome | culture-art | Q-6B-X-...-mq8c6kp5-r-the-pen | 96 | ✅ gen-003 | ✅ |

**All 5 items:**
- `publish_status: ready_for_human_review`
- `no_platform_publish: true`
- Have `image_url`, `gallery_url`, `review_url`, `linked_content_pack_url`
- Have `post_text` verbatim from `x-post.zh.md`
- Have `suggested_manual_review_note` (per-item callouts in review JSON)

Full per-item details in `dashboard/publishing-readiness-review.json` → `ready_x_shortlist[]`.

---

## B. Blog Shortlist (5/5 unique topics)

| Topic | source_type | draft_id | quality | needs_expansion | has image |
|-------|-------------|----------|---------|------------------|-----------|
| Flaws in the LLM Automation Narrative | academic | Q-6B-BLOG-...-mq8c6kp5-u-flaws-i | 96 | false | ✅ |
| stabilityai/stable-video-diffusion-img2vid-xt | ai-ecosystem | Q-6B-BLOG-...-mq8c663q-4-stabili | 94 | false | ✅ |
| SamurAIGPT/Generative-Media-Skills | code | Q-6B-BLOG-...-mq8c6kp4-7-samurai | 97 | false | ✅ |
| River AI | dev-community | Q-6B-BLOG-...-mq8c663q-v-river-a | 97 | **true** | ✅ |
| The Penitence of Saint Jerome | culture-art | Q-6B-BLOG-...-mq8c6kp5-r-the-pen | 96 | **true** | ✅ |

All blog drafts are `draft_ready` (outlines ready). River AI and Penitence of Saint Jerome need human expansion (personal voice + art history require human writing).

**Suggested next action per item:** see `dashboard/publishing-readiness-review.json` → `blog_shortlist[].suggested_next_action`. All actions end with `then_publish`; Phase 6C does NOT execute any of them.

---

## C. Image Generation Candidate Shortlist (5/5 unique topics)

| Topic | source_type | content_pack_id | existing_prompt_path |
|-------|-------------|-----------------|----------------------|
| Flaws in the LLM Automation Narrative | academic | brief-brief-mq8c663q-r-flaws-i | content-packs/2026/06/2026-06-10/brief-brief-mq8c663q-r-flaws-in-the-llm-automation-narrative/image-prompt.md |
| stabilityai/stable-video-diffusion-img2vid-xt | ai-ecosystem | brief-brief-mq8c6kp5-5-stabili | content-packs/2026/06/2026-06-10/brief-brief-mq8c6kp5-5-stabilityai-stable-video-diffusion-img2vid-xt/image-prompt.md |
| SamurAIGPT/Generative-Media-Skills | code | brief-brief-mq8c663q-e-samurai | content-packs/2026/06/2026-06-10/brief-brief-mq8c663q-e-samuraigpt-generative-media-skills/image-prompt.md |
| The Penitence of Saint Jerome | culture-art | brief-brief-mq8c663r-2-the-pen | content-packs/2026/06/2026-06-10/brief-brief-mq8c663r-2-the-penitence-of-saint-jerome/image-prompt.md |
| River AI | dev-community | brief-brief-mq8c6kp5-1-river-a | content-packs/2026/06/2026-06-10/brief-brief-mq8c6kp5-1-river-ai/image-prompt.md |

All 5 candidates:
- `requires_model_call: true`
- `model_call_status: not_called`
- Phase 6C **does not** call any model. Image generation is a separate future phase with explicit human approval and a separate spending decision.

---

## Dedup Metrics

| Metric | Value |
|--------|-------|
| Phase 6B raw X post count | 25 |
| Phase 6C ready X shortlist count | 5 |
| Reduction | 25 → 5 (80% dedup) |
| Unique topics in shortlist | 5/5 |
| Topic diversity score | 100% |
| Duplicate topic warning resolved | ✅ |
| Phase 6B raw blog draft count | 25 |
| Phase 6C blog shortlist count | 5 |
| Phase 6B needs_asset X count | 20 |
| Phase 6C image gen candidates | 5 (one per topic) |

---

## Boundaries Enforced

| Boundary | Status |
|----------|--------|
| No MiniMax / image / video / music model call | ✅ |
| No external LLM | ✅ |
| No media generation | ✅ |
| No generate:* | ✅ |
| No collect:* | ✅ |
| No digest:send:* | ✅ |
| No report:send:* (except final project sender) | ✅ |
| No publish to X / Twitter | ✅ |
| No X API | ✅ |
| No Telegram digest | ✅ |
| No timer:* | ✅ |
| No C5N promote / approval / rollback / timer | ✅ |
| No overwrite reports/daily-digest.md | ✅ |
| No overwrite reports/telegram-digest.txt | ✅ |
| No overwrite dashboard/status.json | ✅ |
| No systemd / gateway modification | ✅ |
| No commit .env / .env.telegram.local / .control.local / control-action-audit.jsonl | ✅ |
| No commit sandbox runtime / promote-backups | ✅ |
| No token print | ✅ |
| OpenClaw final reply = 1 sentence | ✅ |

---

## Recommended Next Phase

**Phase 6D (suggested):** Human reviews the 5 ready X posts one by one. For each, decide:
- Approve as-is → post manually via baoyu-post-to-x or direct Twitter UI.
- Edit text → edit and post manually.
- Reject → mark in a future review JSON; do not auto-substitute.

**Phase 6E (suggested, gated on human approval + spending decision):** Run image generation for the 5 image-generation candidates. Each successful generation unlocks 4 more X posts in the same topic (5 ready → 1 → 5 of 5 needs_asset per topic).

Phase 6C does **not** execute either of these. They are recommendations for the next human-driven phase.

---

## Output Files

| File | Path | Purpose |
|------|------|---------|
| Policy | `dashboard/publishing-readiness-policy.json` | 7-rule dedup policy |
| Review | `dashboard/publishing-readiness-review.json` | Full per-item review (3 shortlists) |
| Shortlist | `dashboard/deduped-publishing-shortlist.json` | Consolidated shortlist (ids + metrics) |
| Report (this file) | `reports/publishing-readiness-review.md` | Human-readable review |
| Shortlist report | `reports/deduped-publishing-shortlist.md` | Human-readable shortlist |
| Validator | `scripts/validate-publishing-readiness.ts` | Auto-validate policy + review + shortlist |
| Assets shortlists | `creative-quota-assets/publishing/shortlists/*.json` + `README.md` | Mirror in assets repo |

---

_辛 🔮 — Phase 6C complete. No publish, no model call, no media generation, no timer. Review-ready._
