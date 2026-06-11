# Phase 3C — MiniMax Quota Guard & Explicit Generation Command Report

**Generated:** 2026-06-11T08:36:00+08:00
**Status:** ✅ PASS

---

## STATUS

| Item | Result |
|------|--------|
| `src/generators/generation-guard.ts` | ✅ Created |
| `src/generators/minimax-quota-guard.ts` | ✅ Created |
| `src/generators/minimax-image-canary.ts` | ✅ Updated with guard integration |
| `scripts/check-generation-guard.ts` | ✅ Created (12 test cases) |
| `config/generation-policy.example.json` | ✅ Created |
| `npm run guard:check` | ✅ PASS — 12/12 |
| `npm run generate:image:dry-run` | ✅ PASS — dry-run works, quota shown |
| MiniMax called | ❌ No |
| New media generated | ❌ No |
| cron/systemd | ❌ No |

---

## WHAT_CHANGED

| File | Change |
|------|--------|
| `src/generators/generation-guard.ts` | New — two-layer guard (ambiguity + policy) |
| `src/generators/minimax-quota-guard.ts` | New — quota check via mmx quota |
| `src/generators/minimax-image-canary.ts` | Updated — guard integration + dry-run mode |
| `scripts/check-generation-guard.ts` | New — 12 test cases for guard validation |
| `config/generation-policy.example.json` | New — policy configuration template |
| `package.json` | Added `guard:check`, `generate:image:dry-run`, `generate:image:confirmed` scripts |
| `docs/MINIMAX_QUOTA_GUARD_DESIGN.md` | Updated — Phase 3C implementation details |

---

## INCIDENT_REVIEW

**What happened:** User sent "继续" → OpenClaw interpreted as Phase 3A Full trigger → real MiniMax images generated (2 images, 184KB + 353KB).

**Root cause:** No generation guard existed. "继续" / "continue" commands were not blocked.

**Guard added:** Ambiguous commands now explicitly denied. Real generation requires:
1. Explicit media_type (image/music/video)
2. Explicit max_count (within policy limits)
3. confirm_spend=true
4. CQA_ALLOW_GENERATION=1 env flag or --confirm-spend flag
5. Quota guard passes

---

## GUARD_RULES

| Rule | Description |
|------|-------------|
| Block ambiguous commands | "继续", "continue", "下一步", "run next", "go", "执行" → DENY |
| Require explicit media_type | null → DENY; must be image/music/video |
| Require confirm_spend | confirm_spend=false + dry_run=false → DENY |
| Image: max 2 per run | max_count > 2 → DENY |
| Music: disabled by default | music + confirm_spend=true → DENY |
| Video: disabled by default | video + confirm_spend=true → DENY |
| Dry-run always allowed | dry_run=true + other checks pass → ALLOW_DRY_RUN |

---

## QUOTA_GUARD_RULES

| Rule | Threshold |
|------|-----------|
| General interval remaining | < 50% → BLOCK |
| General weekly remaining | < 50% → BLOCK (advisory) |
| Error reading quota | BLOCK (fail-safe) |

---

## DRY_RUN_RESULT

```
=== MiniMax Image Canary Generator (Phase 3C Guard) ===
Mode: DRY-RUN
Asset repo: /home/ubuntu/.openclaw/workspace/projects/creative-quota-assets
[Generation Guard] ALLOW_DRY_RUN: Dry-run allowed. media_type=image, max_count=1.
[Quota Guard] SKIPPED (dry-run / legacy canary mode).
MiniMax Quota Status
general: 58% interval / 66% weekly
video: 100% interval / 85% weekly
Decision: ALLOW (threshold: 50%)

Selected pack: brief-brief-mq8c663q-4-stabilityai-stable-video-diffusion-img2vid-xt
Source: ai-ecosystem
Prompt: Futuristic depiction of machine learning landscape...

[Dry-Run] Would generate:
  1 image: Futuristic depiction of machine learning landscape...
  Content pack: brief-brief-mq8c663q-4-stabilityai-stable-video-diffusion-img2vid-xt
  Output: .../images/YYYY/MM/cqa-YYYY-MM-DD-canary-001_001.jpg

Dry-run complete. No image generated.
```

---

## GUARD_CHECK_RESULT

```
=== Generation Guard Check (Phase 3C) ===
PASS  command="继续" → DENY
PASS  command="continue" → DENY
PASS  command="下一步" → DENY
PASS  command="run next" → DENY
PASS  image + confirm_spend=false → DENY
PASS  image + max_count=3 → DENY
PASS  video + confirm_spend=true → DENY
PASS  music + confirm_spend=true → DENY
PASS  media_type=null → DENY
PASS  image + max_count=2 + confirm_spend=true + dry_run=true → ALLOW_DRY_RUN
PASS  image + max_count=1 + confirm_spend=true + dry_run=true → ALLOW_DRY_RUN
PASS  image + max_count=0 → DENY

12/12 passed
Overall: PASS
```

---

## MINIMAX_CALL_STATUS

No MiniMax API calls were made during this phase (dry-run only).

---

## GENERATED_MEDIA_STATUS

| Type | Count |
|------|-------|
| Images | 0 (none generated in this phase) |
| Music | 0 |
| Video | 0 |

---

## ENV_SECRET_CHECK

✅ No `.env` files committed. `config/generation-policy.example.json` is the template; `config/generation-policy.local.json` (if created) must be gitignored.

---

## NEXT_PHASE_PROPOSAL

**Phase 3D: Controlled Image Batch with Guard** — Use `npm run generate:image:confirmed` to generate 1-2 images with full guard enforcement.

**Phase 4A: Manual Daily Digest Runbook** — Document the complete daily workflow.

**Phase 4B: Scheduled Automation** — External cron/systemd for daily digest.

**Decision: 爸爸 decides.**

---

_Phase 3C complete. Generation guard active._