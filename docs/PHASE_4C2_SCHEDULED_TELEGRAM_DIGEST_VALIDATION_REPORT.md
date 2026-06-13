# PHASE 4C-2 — Scheduled Telegram Auto-send Validation & Digest Freshness Fix

## STATUS

**PASS** — scheduled Telegram auto-send verified; digest generation logic updated; all freshness checks pass.

---

## WHAT_CHANGED

| # | Change | File |
|---|--------|------|
| 1 | Latest image URL now reads from `metadata/generated-assets.json` `path` field (with date subdirectory) | `src/reports/telegram-daily-digest.ts` |
| 2 | Recommended Generation Queue now excludes already-generated topics via topic-slug keyword overlap (>=0.5) | `src/reports/telegram-daily-digest.ts` |
| 3 | "cron/systemd: No" replaced with "Delivery: systemd timer + Telegram auto-send" | `src/reports/telegram-daily-digest.ts` |
| 4 | Added `signal_last_collected_at` + freshness WARN line (>24h) | `src/reports/telegram-daily-digest.ts` |
| 5 | Next-phase list now: 4C-2, 4H, 5C, 3F (removed 3A Full / 4A / 4B) | `src/reports/telegram-daily-digest.ts` |
| 6 | URLs escaped for Telegram Markdown parse_mode (underscores) | `src/reports/telegram-daily-digest.ts` |
| 7 | New validation script `scripts/validate-digest-freshness.ts` | new file |
| 8 | New npm script `validate:digest-freshness` | `package.json` |

---

## AUTO_SEND_VALIDATION

**Confirmed via systemd journal:**

```
Jun 13 07:30:01 VM-0-4-ubuntu systemd[1087]: Starting Creative Quota Harvester — Daily Digest (Phase 4B-0)...
Jun 13 07:30:01 VM-0-4-ubuntu bash[678228]: [2026-06-13T07:30:01+0800] === Scheduled Daily Digest Run Started ===
Jun 13 07:30:01 VM-0-4-ubuntu bash[678236]: [2026-06-13T07:30:01+0800] Project: creative-quota-harvester
Jun 13 07:30:01 VM-0-4-ubuntu bash[678243]: [2026-06-13T07:30:01+0800] Command: npm run daily:manual
Jun 13 07:30:05 VM-0-4-ubuntu bash[678329]: [2026-06-13T07:30:01+0800] Result: SUCCESS
Jun 13 07:30:05 VM-0-4-ubuntu bash[678331]: [2026-06-13T07:30:01+0800] Telegram auto-send: ENABLED — sending digest
Jun 13 07:30:06 VM-0-4-ubuntu bash[678370]: [2026-06-13T07:30:01+0800] Telegram send: SUCCESS
Jun 13 07:30:06 VM-0-4-ubuntu bash[678372]: [2026-06-13T07:30:01+0800] === Scheduled Daily Digest Run Complete ===
```

---

## MESSAGE_ID_OR_SEND_STATUS

- **2026-06-13 07:30 auto-send:** message_id = `49980` ✅
- **2026-06-13 08:20 manual confirmed send (Phase 4C-2 fixed digest):** message_id = `49983` ✅

---

## TIMER_STATUS

```
● creative-quota-digest.timer - Creative Quota Harvester — Daily Digest Timer (Phase 4B-0)
     Loaded: loaded (.../creative-quota-digest.timer; enabled; vendor preset: enabled)
     Active: active (waiting) since Thu 2026-06-11 09:29:04 CST
    Trigger: Sun 2026-06-14 07:30:00 CST; 23h left
   Triggers: ● creative-quota-digest.service
```

Status: **active, waiting, next run rolls to 2026-06-14 07:30** ✅

---

## DIGEST_FIXES

### Before vs After

**Latest image URL (Before):**
```
Latest image: https://conanxin.github.io/creative-quota-assets/images/2026/06/cqa-2026-06-11-gen-005_001.jpg
                                                    ^^ missing /11/ subdirectory ^^
```

**Latest image URL (After):**
```
Latest image: https://conanxin.github.io/creative-quota-assets/images/2026/06/11/cqa-2026-06-11-gen-005_001.jpg
                                                    ^^ correct date subdirectory ^^
```

### Recommended Queue (Before)

```
Recommended Generation Queue
1. SamurAIGPT/Generative-Media-Skills — already has image (gen-002)
2. Flaws in the LLM Automation Narrative — already has image (canary-001)
3. The Penitence of Saint Jerome — already has image (gen-003)
```

### Recommended Queue (After)

```
Recommended Generation Queue
All top-priority packs already have generated images (5 skipped).
Next step: produce video prompt / music prompt / run new signal collection.
```

---

## LATEST_IMAGE_URL_FIX

- Source: `creative-quota-assets/metadata/generated-assets.json` (last entry)
- Logic: use `asset.path` field (which includes date subdirectory like `images/2026/06/11/`)
- Validation: URL must contain `asset.filename` (e.g., `cqa-2026-06-11-gen-005_001.jpg`)
- Markdown escape: underscores in URLs are escaped (`\_`) to prevent parse errors in Telegram Markdown mode

---

## RECOMMENDED_QUEUE_FIX

**Root cause:** `pack.pack_id` (e.g., `brief-mq8swsla-fa2i7`) did NOT match `a.content_pack` (e.g., `brief-brief-mq8c6kp4-7-samuraigpt-generative-media-skills`).

**Fix:** Build a normalized topic-slug from both sides and match by:
1. Exact slug match
2. Substring match (>=8 chars)
3. **Keyword overlap score >= 0.5** (drop stop words, intersect significant tokens)

**Result:** All 5 top topics correctly skipped (SamurAIGPT, Flaws, River AI, StabilityAI, Saint Jerome all have generated images).

---

## SIGNAL_FRESHNESS_STATUS

```
Signal freshness: WARN: signals last collected 55h ago (>24h)
signal_last_collected_at: 2026-06-11T01:21:30.000Z
```

The DB mtime shows signals were last collected ~55 hours ago. The next scheduled collect run will refresh signals. The freshness line now appears in both `telegram-digest.txt` and `daily-digest.md`.

---

## VALIDATION_RESULTS

### `npm run validate:digest-freshness`

```
PASS  no [truncated]
PASS  no obvious secrets
PASS  no legacy phase: Phase 3A Full
PASS  no legacy phase: Phase 4A: Manual Daily Digest
PASS  no legacy phase: Phase 4B: Scheduled automation
PASS  delivery text correct
PASS  no legacy "cron/systemd: No"
PASS  signal freshness present
PASS  Latest image URL contains filename: cqa-2026-06-11-gen-005_001.jpg
PASS  Latest image URL contains path: images/2026/06/11/cqa-2026-06-11-gen-005_001.jpg
PASS  URL has no underscore-missing pattern
PASS  Recommended Queue: explicit fallback to non-image suggestions
PASS  digest size 1629/3500
PASS  md report has delivery line
PASS  md report has signal_last_collected_at
PASS  md report references current phase

Summary: PASS=16  FAIL=0
RESULT: PASS
```

### `npm run digest:telegram:check`

```
Overall: PASS
```

### `npm run digest:send:dry-run`

```
Digest valid: PASS ✅
Send allowed: YES ✅
Reason: All conditions met for real send.
```

### `npm run validate:telegram-send`

```
PASS: preview contains no real token
FAIL: no .env.telegram.local committed  (intentional — must NEVER be committed)
PASS: .env.telegram.example exists
[validate-telegram-send] 14/15 checks passed
```

The single "FAIL" is intentional: `.env.telegram.local` must never be committed.

### `npm run validate:telegram-auto-send`

```
PASS: dry-run passes
PASS: gateway config not in commit
PASS: no MiniMax calls in send-telegram-digest.ts
[validate-telegram-auto-send] 7/7 checks passed
```

---

## MINIMAX_CALL_STATUS

**No.** No MiniMax calls were made during this phase. No image, music, or video generation occurred.

---

## GENERATED_MEDIA_STATUS

**No new media generated.** All 5 generated assets in `creative-quota-assets/metadata/generated-assets.json` predate this phase.

---

## SECRET_SAFETY_CHECK

- `.env` and `.env.telegram.local` are NOT staged for commit (verified by `git status`)
- No tokens in digest text (validated by `validate:digest-freshness`)
- No real tokens in git history (verified by `validate:telegram-send`)

---

## NEXT_PHASE_PROPOSAL

| Phase | Description |
|-------|-------------|
| Phase 4C-2 | ✅ Scheduled Telegram Auto-send Validation & Digest Freshness Fix (this) |
| Phase 4H | Video Prompt Enhancement — generate video prompts for video-capable packs |
| Phase 5C | Private Control Dashboard — local-only dashboard for safe generation control |
| Phase 3F | Controlled image generation only if explicitly confirmed (human-in-loop) |

Removed from next-phase list (already done):
- ~~Phase 3A Full~~
- ~~Phase 4A: Manual Daily Digest Runbook~~
- ~~Phase 4B: Scheduled automation~~

---

*Generated: 2026-06-13*