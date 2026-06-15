# X Manual Publish Checklist — Phase 6D

**Phase:** 6D (X Shortlist Human Review Pack)  
**Generated:** 2026-06-15T21:15:00+08:00  
**Purpose:** Pre-publish safety checklist for human reviewer.

---

## Global Checklist (10 items, all must be ✅ before any post)

- [x] **GLOBAL-1**: All 5 review items have `review_status=ready_for_human_review`
- [x] **GLOBAL-2**: All 5 review items have `publish_status=not_published`
- [x] **GLOBAL-3**: All 5 review items have `no_platform_publish=true`
- [x] **GLOBAL-4**: No review item has been auto-posted (`published_externally: 0`)
- [x] **GLOBAL-5**: No X API call has been made
- [x] **GLOBAL-6**: No `baoyu-post-to-x` call has been made
- [x] **GLOBAL-7**: No model call has been made
- [x] **GLOBAL-8**: No media has been generated
- [x] **GLOBAL-9**: No timer has been started
- [x] **GLOBAL-10**: No Telegram digest has been sent (except final Phase 6D report)

---

## Per-Item Checklist (6 sections, applied to each of 5 posts)

For each post in `assets/publishing/review/x/phase-6d/posts/`:

### Section 1: Factual check
- [ ] Verify the topic / title / hashtag in the linked content pack
- [ ] Confirm the post's framing matches the content pack
- [ ] Verify all hashtags are accurate

### Section 2: Tone check
- [ ] Post text is in Chinese with English topic name — confirm acceptable
- [ ] Question-style ending is intentionally engaging — confirm acceptable
- [ ] No aggressive marketing language

### Section 3: Image relevance check
- [ ] Confirm the image is visually appropriate for the topic
- [ ] Read the image review note (`review_url`)
- [ ] Confirm the image does NOT misrepresent the topic

### Section 4: Link check
- [ ] `linked_content_pack` URL is the canonical content pack page
- [ ] If adding a link in the X post reply, use `linked_content_pack` URL
- [ ] `gallery_url` points to the same image (no broken alt-text)

### Section 5: No sensitive leak check
- [ ] No personal data (PII) of the topic's authors / creators / founders
- [ ] No proprietary research / business data beyond public sources
- [ ] No internal company strategy
- [ ] No screenshots that include private dashboards

### Section 6: Final human approval
- [ ] Reviewed by: __________________ (name)
- [ ] Date: __________________
- [ ] Decision: APPROVE / EDIT / REJECT (circle one)
- [ ] Notes: _____________________________________________

---

## Manual Publish Steps (6 steps, human in browser)

1. **Open X (twitter.com) in browser**
2. **Click "Post" to open the new post composer**
3. **Paste the X Post Text block (exactly as shown in the review markdown)**
4. **Click the image icon and upload the image from `image_url`** (download first if needed)
5. **Review the preview, then click "Post"**
6. **After posting, mark `publish_status: published` in a future review JSON.** Do NOT change this file.

---

## DO NOT DO (7 hard no-ops)

- ❌ Do NOT call `baoyu-post-to-x`
- ❌ Do NOT call X API
- ❌ Do NOT call any model (LLM, image, video, music)
- ❌ Do NOT start any timer / cron / systemd unit
- ❌ Do NOT send any Telegram digest
- ❌ Do NOT modify any `.env` / `.control.local` / `control-action-audit.jsonl` file
- ❌ Do NOT overwrite any `daily-digest.md` / `telegram-digest.txt` / `status.json` file

---

## Per-Item Status (initial state)

| # | Topic | factual | tone | image | link | sensitive | approval |
|---|-------|---------|------|-------|------|-----------|----------|
| 1 | Flaws in the LLM Automation Narrative | pending | pending | pending | pending | pending | pending |
| 2 | stabilityai/stable-video-diffusion-img2vid-xt | pending | pending | pending | pending | pending | pending |
| 3 | SamurAIGPT/Generative-Media-Skills | pending | pending | pending | pending | pending | pending |
| 4 | River AI | pending | pending | pending | pending | pending | pending |
| 5 | The Penitence of Saint Jerome | pending | pending | pending | pending | pending | pending |

> All checkboxes are `pending`. Phase 6D does NOT pre-fill any of them.
> The human reviewer is responsible for ticking each box.

---

## Per-Item Decisions Log

For each approved item, log the decision here:

### Post #1: Flaws in the LLM Automation Narrative
- Decision: __________________
- Date: __________________
- Reviewer: __________________
- Notes: _____________________________________________

### Post #2: stabilityai/stable-video-diffusion-img2vid-xt
- Decision: __________________
- Date: __________________
- Reviewer: __________________
- Notes: _____________________________________________

### Post #3: SamurAIGPT/Generative-Media-Skills
- Decision: __________________
- Date: __________________
- Reviewer: __________________
- Notes: _____________________________________________

### Post #4: River AI
- Decision: __________________
- Date: __________________
- Reviewer: __________________
- Notes: _____________________________________________

### Post #5: The Penitence of Saint Jerome
- Decision: __________________
- Date: __________________
- Reviewer: __________________
- Notes: _____________________________________________

---

## Summary

- **Global checklist items**: 10
- **Global checklist met**: 10 (initial state — all preconditions confirmed)
- **Per-item checklist sections**: 6
- **Manual publish steps**: 6
- **DO NOT DO count**: 7
- **Ready for human review**: ✅

---

_辛 🔮 — Phase 6D manual publish checklist ready. All global checks met. Per-item checks pending human review._
