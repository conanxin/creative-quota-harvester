# Mainline Production Queue — Phase 6A

**Phase:** 6A (Mainline Recovery)  
**Generated:** 2026-06-15T08:27:00+08:00  
**Total Queue Items:** 13  
**Mode:** Read-only queue generation (no model calls executed)

---

## QUEUE SUMMARY

| Category | Label | Count | Priority | Requires Model Call |
|----------|-------|-------|----------|---------------------|
| A | Ready for Controlled Image Generation | 15 | High | ✅ Yes |
| B | Ready for Video Prompt Publication | 5 | Medium | ❌ No |
| C | Ready for Music Prompt Publication | 25 | Low | ❌ No |
| D | Ready for X / Blog Publishing | 25 | High | ❌ No |
| E | Needs Source Refresh | 1 | High | ❌ No |
| F | Needs Quality Review | 0 | None | ❌ No |

---

## QUEUE ITEMS

### Category A — Ready for Controlled Image Generation

> ⚠️ Requires model call. Do not execute in Phase 6A. Move to Phase 6B.

| ID | Title | Source Type | Risk | Estimated Output |
|----|-------|-------------|------|-----------------|
| Q-6A-A-001 | SamurAIGPT — 4 remaining variants | code | medium | 4 JPG images |
| Q-6A-A-002 | Flaws in the LLM Automation Narrative — 4 remaining variants | academic | medium | 4 JPG images |
| Q-6A-A-003 | The Penitence of Saint Jerome — 4 remaining variants | culture-art | medium | 4 JPG images |
| Q-6A-A-004 | stabilityai/stable-video-diffusion — 4 remaining variants | ai-ecosystem | medium | 4 JPG images |
| Q-6A-A-005 | River AI — 4 remaining variants | dev-community | medium | 4 JPG images |

### Category B — Ready for Video Prompt Publication

> No model call required. Can execute immediately.

| ID | Title | Risk | Estimated Output |
|----|-------|------|-----------------|
| Q-6A-B-001 | stabilityai video prompts → blog/wiki | low | 1 blog post with 5 video prompt examples |
| Q-6A-B-002 | SamurAIGPT video prompt coverage check | low | Confirm coverage per pack |

### Category C — Ready for Music Prompt Publication

> No model call required. Can execute immediately.

| ID | Title | Risk | Estimated Output |
|----|-------|------|-----------------|
| Q-6A-C-001 | All 25 content packs music prompts → blog/compiled doc | low | 1 compiled music prompt pack |

### Category D — Ready for X / Blog Publishing

> Human review required before publishing. No model call.

| ID | Title | Risk | Estimated Output |
|----|-------|------|-----------------|
| Q-6A-D-001 | 25 X posts (Chinese) ready for publishing | medium | 25 Chinese X posts, batch publish |
| Q-6A-D-002 | 15 webpage outlines → 3 blog posts | low | 3 blog posts (1500-2500 words each) |
| Q-6A-D-003 | Gallery enhancement — complete metadata | low | Gallery cards with full metadata |

### Category E — Needs Source Refresh

> No model call. Signal refresh required before new content packs.

| ID | Title | Risk | Estimated Output |
|----|-------|------|-----------------|
| Q-6A-E-001 | Signal source refresh — collect new signals | medium | New signals → new content pack candidates |

### Category F — Needs Quality Review

> All generated assets reviewed. No pending items.

| ID | Title | Status |
|----|-------|--------|
| Q-6A-F-001 | No quality review needed | ✅ All 5 images reviewed (avg 96/100) |

---

## RECOMMENDED NEXT PHASE: Phase 6B

**Phase 6B Goal:** Execute Category D (X publishing) + prepare Category A (controlled image generation)

**Do first (no model call):**
1. Publish top 5 X posts (one per source type) — human review → send
2. Refresh signal source to get new raw material
3. Verify gallery metadata completeness

**Do second (requires model call, human review gate):**
4. Controlled image generation for top 5 packs (1 per topic)
5. Quality review of generated images
6. Gallery update with new images

**Do not do:**
- ❌ Automatic Telegram digest send (still blocked)
- ❌ C5N promote/approval expansion
- ❌ New timer/cron automation

---

## BOUNDARY COMPLIANCE

| Boundary | Status |
|----------|--------|
| No model call | ✅ Compliant |
| No media generation | ✅ Compliant |
| No collect:* | ✅ Compliant |
| No digest:send:* | ✅ Compliant |
| No timer:* | ✅ Compliant |
| No C5N promote/approval | ✅ Compliant |
| Production digest unchanged | ✅ Compliant |
| No token commit | ✅ Compliant |

---

*Queue generated read-only. No model calls executed. No production paths modified.*
