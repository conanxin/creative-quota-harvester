# X Human Review Pack — Phase 6D

**Phase:** 6D (X Shortlist Human Review Pack)  
**Generated:** 2026-06-15T21:15:00+08:00  
**Based on:** Phase 6C X ready shortlist (Harvester commit=44a0af8, Assets commit=9c153aa)  
**Mode:** READ-ONLY review artefacts for human review

---

## TL;DR

- Phase 6C produced a 5-item X ready shortlist. Phase 6D turns it into a **copy-ready human review pack**.
- All 5 items are in `publishing/review/x/phase-6d/posts/` (assets repo).
- Each post has a 6-section manual review checklist (factual / tone / image / link / sensitive leak / final approval).
- **No item has been auto-posted.** `published_externally: 0`, `reviewed: 0`, `approved_for_manual_publish: 0`.
- **No X API called. No baoyu-post-to-x called. No model call. No media generated. No timer.**

---

## Review Items (5/5 unique topics, 5/5 unique source types)

| # | Topic | source_type | id | quality | risk | review_md |
|---|-------|-------------|-----|---------|------|-----------|
| 1 | Flaws in the LLM Automation Narrative | academic | `Q-6B-X-...-mq8c6kp5-u-flaws-i` | 96 | low | [flaws](../assets/publishing/review/x/phase-6d/posts/flaws-in-the-llm-automation-narrative.md) |
| 2 | stabilityai/stable-video-diffusion-img2vid-xt | ai-ecosystem | `Q-6B-X-...-mq8c663q-4-stabili` | 94 | low | [stability](../assets/publishing/review/x/phase-6d/posts/stabilityai-stable-video-diffusion-img2vid-xt.md) |
| 3 | SamurAIGPT/Generative-Media-Skills | code | `Q-6B-X-...-mq8c6kp4-7-samurai` | 97 | low | [samurai](../assets/publishing/review/x/phase-6d/posts/samuraigpt-generative-media-skills.md) |
| 4 | River AI | dev-community | `Q-6B-X-...-mq8c663q-v-river-a` | 97 | **medium** | [river](../assets/publishing/review/x/phase-6d/posts/river-ai.md) |
| 5 | The Penitence of Saint Jerome | culture-art | `Q-6B-X-...-mq8c6kp5-r-the-pen` | 96 | **medium** | [penitence](../assets/publishing/review/x/phase-6d/posts/the-penitence-of-saint-jerome.md) |

Risk notes:
- **River AI**: founder-attributed content (Igor Babuschkin, River AI CEO). Confirm attribution and tone.
- **The Penitence of Saint Jerome**: public-domain painting (Patinir ca. 1515). Confirm copyright status and crop composition for X timeline.

All 5:
- `review_status: ready_for_human_review`
- `publish_status: not_published`
- `no_platform_publish: true`
- Have `image_url`, `gallery_url`, `review_url`, `linked_content_pack_url`

---

## Human Review Workflow

For each of the 5 items:

### Step 1: Open the post's review markdown
Open `assets/publishing/review/x/phase-6d/posts/<topic-slug>.md` in a markdown viewer.

### Step 2: Read the post text (copy-ready)
Each post markdown has a `X Post Text` block — verbatim from Phase 6C's `x-ready-shortlist.json`. Do NOT edit.

### Step 3: Walk through the 6-section manual review checklist
1. **Factual check** — verify the topic, attribution, hashtags.
2. **Tone check** — confirm the Chinese + English mix is acceptable.
3. **Image relevance check** — confirm the image is appropriate.
4. **Link check** — verify the linked_content_pack URL.
5. **No sensitive leak check** — verify no PII, no proprietary data.
6. **Final human approval** — sign off with name, date, decision (APPROVE / EDIT / REJECT).

### Step 4: For approved posts — manual posting
1. Open X (twitter.com) in browser.
2. Click "Post" to open the new post composer.
3. Paste the X Post Text block (exactly as shown).
4. Upload the image from `image_url` (download first if needed).
5. Review the preview, then click "Post".
6. **Do NOT call baoyu-post-to-x. Do NOT call X API.**

### Step 5: For edited posts
- Save a NEW file with `-edited.md` suffix.
- Note the change in the human review log.
- Do NOT overwrite the original.

### Step 6: For rejected posts
- Mark in a future review JSON (Phase 6E or later).
- Do NOT auto-substitute.

---

## Suggested Posting Order (no automation — human decides)

1. **SamurAIGPT/Generative-Media-Skills** (quality 97, code, broad appeal)
2. **River AI** (quality 97, founder-attributed, time-sensitive)
3. **Flaws in the LLM Automation Narrative** (quality 96, academic)
4. **The Penitence of Saint Jerome** (quality 96, culture-art)
5. **stabilityai/stable-video-diffusion** (quality 94, ai-ecosystem)

---

## Output Files

### Harvester repo
| File | Purpose |
|------|---------|
| `dashboard/x-human-review-pack.json` | Full review pack state (5 items, checklists pending) |
| `dashboard/x-manual-publish-checklist.json` | Pre-publish safety checklist |
| `scripts/validate-x-human-review-pack.ts` | Validator (added by this phase) |
| `reports/x-human-review-pack.md` | This file |
| `reports/x-manual-publish-checklist.md` | Manual publish checklist report |
| `dashboard/mainline-publishing-status.json` | Updated with 6D section |

### Assets repo
| File | Purpose |
|------|---------|
| `publishing/review/x/phase-6d/index.json` | Review pack index (5 items) |
| `publishing/review/x/phase-6d/README.md` | Review pack README |
| `publishing/review/x/phase-6d/posts/<topic-slug>.md` | Per-post review markdown (5 files) |

---

## Status Counters

| Counter | Value | Will change when |
|---------|-------|------------------|
| `total_review_items` | 5 | constant |
| `reviewed` | 0 | human ticks any checklist item |
| `approved_for_manual_publish` | 0 | human approves an item |
| `published_externally` | 0 | human posts to X (and updates in a future review JSON) |
| `no_platform_publish` | true | constant (Phase 6D guarantee) |

---

## Boundaries (enforced by Phase 6D)

- ❌ No X API call
- ❌ No baoyu-post-to-x call
- ❌ No model call (LLM, image, video, music)
- ❌ No media generation
- ❌ No collect:* / generate:* / digest:send:* / report:send:*
- ❌ No timer / cron
- ❌ No systemd / gateway modification
- ❌ No commit of .env / .env.telegram.local / .control.local / control-action-audit.jsonl
- ❌ No token print
- ✅ Human review required before any post
- ✅ OpenClaw final reply = 1 sentence

---

## Next Phase Proposal

**Phase 6D output**: this review pack is ready for human review.

**Phase 6E (suggested, gated on human review completion)**: After humans review and post some/all of the 5 items, update the status counters (`reviewed`, `approved_for_manual_publish`, `published_externally`) in a future review JSON. If human rejects an item, route to image-generation-candidates for re-evaluation (Phase 6F or later).

Phase 6D does NOT trigger Phase 6E. It produces the artefacts only.

---

_辛 🔮 — Phase 6D complete. Review pack ready for human. No publish, no model call, no media generation, no timer._
