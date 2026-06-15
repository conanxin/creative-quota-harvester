# Deduped Publishing Shortlist — Phase 6C

**Phase:** 6C (Publishing Readiness Review & Deduped Shortlist)  
**Generated:** 2026-06-15T20:55:00+08:00  
**Round:** first_round  
**Mode:** READ-ONLY artefacts for human review  
**No platform publish. No model call. No media generation. No timer.**

---

## Round 1 — Ready X (5 items, 5 unique topics, 5 unique source types)

| # | topic | source_type | id | quality | image | review |
|---|-------|-------------|-----|---------|-------|--------|
| 1 | Flaws in the LLM Automation Narrative | academic | `Q-6B-X-brief-brief-mq8c6kp5-u-flaws-i` | 96 | canary-001 | ✅ |
| 2 | stabilityai/stable-video-diffusion-img2vid-xt | ai-ecosystem | `Q-6B-X-brief-brief-mq8c663q-4-stabili` | 94 | gen-005 | ✅ |
| 3 | SamurAIGPT/Generative-Media-Skills | code | `Q-6B-X-brief-brief-mq8c6kp4-7-samurai` | 97 | gen-002 | ✅ |
| 4 | River AI | dev-community | `Q-6B-X-brief-brief-mq8c663q-v-river-a` | 97 | gen-004 | ✅ |
| 5 | The Penitence of Saint Jerome | culture-art | `Q-6B-X-brief-brief-mq8c6kp5-r-the-pen` | 96 | gen-003 | ✅ |

**All 5 items:** `publish_status: ready_for_human_review`, `no_platform_publish: true`.

**Suggested posting order (no automation — human decides):**
1. **SamurAIGPT** (quality 97, code, broad appeal)
2. **River AI** (quality 97, founder-attributed, founder notes are time-sensitive)
3. **Flaws in the LLM** (quality 96, academic, addresses the topic-flood concern)
4. **The Penitence of Saint Jerome** (quality 96, culture-art, public domain, broadens tonal range)
5. **stabilityai/stable-video-diffusion** (quality 94, ai-ecosystem, model-name readability check first)

---

## Round 1 — Blog (5 items, 5 unique topics, 5 unique source types)

| # | topic | source_type | id | quality | needs_expansion |
|---|-------|-------------|-----|---------|------------------|
| 1 | Flaws in the LLM Automation Narrative | academic | `Q-6B-BLOG-brief-brief-mq8c6kp5-u-flaws-i` | 96 | false |
| 2 | stabilityai/stable-video-diffusion-img2vid-xt | ai-ecosystem | `Q-6B-BLOG-brief-brief-mq8c663q-4-stabili` | 94 | false |
| 3 | SamurAIGPT/Generative-Media-Skills | code | `Q-6B-BLOG-brief-brief-mq8c6kp4-7-samurai` | 97 | false |
| 4 | River AI | dev-community | `Q-6B-BLOG-brief-brief-mq8c663q-v-river-a` | 97 | **true** |
| 5 | The Penitence of Saint Jerome | culture-art | `Q-6B-BLOG-brief-brief-mq8c6kp5-r-the-pen` | 96 | **true** |

**Note:** River AI and Penitence of Saint Jerome are marked `needs_expansion: true` — they require human writing voice (founder note / art history) and must NOT be filled by automated expansion in this phase.

**Suggested first blog (no automation — human decides):** SamurAIGPT/Generative-Media-Skills (highest quality 97, no expansion needed, technical audience).

---

## Round 1 — Image Generation Candidates (5 items, 5 unique topics)

| # | topic | source_type | content_pack_id | prompt_path |
|---|-------|-------------|-----------------|-------------|
| 1 | Flaws in the LLM Automation Narrative | academic | `brief-brief-mq8c663q-r-flaws-i` | `content-packs/2026/06/2026-06-10/brief-brief-mq8c663q-r-flaws-in-the-llm-automation-narrative/image-prompt.md` |
| 2 | stabilityai/stable-video-diffusion-img2vid-xt | ai-ecosystem | `brief-brief-mq8c6kp5-5-stabili` | `content-packs/2026/06/2026-06-10/brief-brief-mq8c6kp5-5-stabilityai-stable-video-diffusion-img2vid-xt/image-prompt.md` |
| 3 | SamurAIGPT/Generative-Media-Skills | code | `brief-brief-mq8c663q-e-samurai` | `content-packs/2026/06/2026-06-10/brief-brief-mq8c663q-e-samuraigpt-generative-media-skills/image-prompt.md` |
| 4 | The Penitence of Saint Jerome | culture-art | `brief-brief-mq8c663r-2-the-pen` | `content-packs/2026/06/2026-06-10/brief-brief-mq8c663r-2-the-penitence-of-saint-jerome/image-prompt.md` |
| 5 | River AI | dev-community | `brief-brief-mq8c6kp5-1-river-a` | `content-packs/2026/06/2026-06-10/brief-brief-mq8c6kp5-1-river-ai/image-prompt.md` |

**All 5 candidates:** `requires_model_call: true`, `model_call_status: not_called`.

**Phase 6C does NOT call any model.** Image generation is a separate future phase gated on explicit human approval and a separate spending decision.

**Note for culture-art:** the source painting (Patinir, ca. 1515) is public domain. Human may decide that re-cropping the public-domain image is higher value than generating a derivative. This is a human decision, not a Phase 6C decision.

---

## Round 1 — Excluded from first round

- **20 X posts excluded** (4 needs_asset duplicates × 5 topics). These are the same topic as one of the 5 shortlist items; publishing them in round 1 would cause topic flooding.
- **20 blog drafts excluded** (4 duplicate variants × 5 topics). Same reasoning.
- These 40 items remain in the raw queue and can be re-evaluated in subsequent rounds if the first round is successful.

---

## Passthrough Disclaimers

- All `post_text` fields are **verbatim** copies of `content-packs/.../x-post.zh.md`. Phase 6C did not rewrite, summarize, or re-generate any post text.
- All `image_url` fields are **verbatim** copies of `linked_image_url` from Phase 6B's `publishing/x/index.json`. Phase 6C did not generate, modify, or re-prompt any image.
- No LLM was called. No image model was called. No media was generated.

---

## Boundaries (one more time, for the record)

- ❌ No platform publish
- ❌ No X / Twitter API
- ❌ No model call (LLM, image, video, music)
- ❌ No media generation
- ❌ No collect:* / generate:* / digest:send:* / report:send:*
- ❌ No timer / cron
- ❌ No systemd / gateway modification
- ❌ No commit of .env / .env.telegram.local / .control.local / control-action-audit.jsonl
- ❌ No commit of sandbox runtime / promote-backups
- ❌ No token print
- ✅ Human review required for any actual posting
- ✅ OpenClaw final reply = 1 sentence

---

## What Phase 6C did

1. Scanned Phase 6B publishing pack (read-only).
2. Identified topic flooding risk (5/5 same topic in top 5).
3. Wrote a 7-rule dedup policy.
4. Generated 3 shortlists (X, blog, image-gen) of 5 unique topics each.
5. Mirrored shortlists in the assets repo (`publishing/shortlists/`).
6. Added a validator (`scripts/validate-publishing-readiness.ts` + `validate:publishing-readiness` npm script).
7. Wrote this report and a dashboard status section.
8. Made zero external changes (no X, no Telegram, no timer, no model, no media, no systemd).

## What Phase 6C did NOT do

1. Publish anything.
2. Call any model.
3. Send any Telegram message.
4. Start any timer.
5. Modify any system service.
6. Overwrite any daily-digest or status file.

---

_辛 🔮 — Round 1 shortlists ready for human review. No automation triggered._
