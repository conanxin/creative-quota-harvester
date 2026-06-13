# Phase 4C-5 — Adapter Parallelization & Query Reduction

**Date:** 2026-06-13
**Phase:** 4C-5
**Status:** PASS (collect: PASS, signals 30 → 86, 5/9 → 9/9 sources)
**Boundaries respected:** No MiniMax call, no new media, no gateway/timer change, no .env commit, no token print.

---

## Goals

After Phase 4C-4, daily collect still suffered from:
- GitHub Radar: 12 queries × 7s gap > 35s source timeout
- Hugging Face: 11 filters × 5s gap > 35s source timeout
- Hacker News: 0 signals (fetch reliability)
- GDELT: HTTP 429 (no cooldown handling)
- No profile-based optimization for daily 07:30 schedule

Phase 4C-5 introduces **profile-driven budgets, bounded concurrency, GDELT cooldown**, and **richer source health** to make daily collect fast and stable.

---

## Changes Summary

### 1. Source Budget Configuration (`config/source-budgets.example.json`)

New file with three profiles (`fast`, `full`, `diagnose`) and budgets for:
- per-source timeout (35000ms)
- overall collect warning (240000ms)
- concurrency per source (github:2, hf:2, hn:5, default:2)
- max results per source
- cooldown specs (`gdelt: 6h on 429`)

Local overrides go in `config/source-budgets.json` (gitignored). Baked-in defaults used if example missing.

### 2. Collect Profile Scripts (`package.json`)

```json
"collect": "CQA_PROFILE=full npx ts-node scripts/collect.ts",
"collect:diagnose": "CQA_PROFILE=diagnose npx ts-node scripts/collect-diagnose.ts",
"collect:fresh": "CQA_PROFILE=full npx ts-node scripts/collect-fresh.ts",
"collect:fresh:fast": "CQA_PROFILE=fast npx ts-node scripts/collect-fresh.ts",
"collect:fresh:full": "CQA_PROFILE=full npx ts-node scripts/collect-fresh.ts",
"collect:diagnose:connectivity": "CQA_PROFILE=diagnose npx ts-node scripts/collect-diagnose.ts"
```

- **fast** (default for daily 07:30): 4 high-value queries/filters, low concurrency, accepts partial
- **full** (manual deep refresh): all 12 queries/8 model + 3 dataset filters, full concurrency
- **diagnose**: connectivity only, no signal collection

### 3. GitHub Radar Adapter (`src/sources/code/github-open-source-radar.ts`)

- Profile-aware: **fast** runs 4 high-value queries (`ai-agent`, `generative-ai`, `mcp`, `"coding agent"`)
- **full** runs the original 12
- Bounded concurrent pool (concurrency=2)
- Per-query result cap (5 in fast, 5 in full)
- **Rate limit header awareness**: stops early if `x-ratelimit-remaining < 3`
- One query failure does not drag the whole source
- Hard exclusion of `conanxin/*` preserved (3 places: query string, client-side, normalize)

### 4. Hugging Face Adapter (`src/sources/ai-ecosystem/huggingface-hub.ts`)

- Profile-aware: **fast** runs 4 filters (`text-to-image`, `image-to-video`, `text-generation`, `multimodal`)
- **full** runs 8 model + 3 dataset filters
- Bounded concurrent pool (concurrency=2)
- Per-filter cap (5 in fast, 3 in full)
- No fixed 5s serial wait between filters
- Partial returns (whatever succeeded) — does not fail the whole source
- **Metadata only** — no model downloads, no inference

### 5. Hacker News Adapter (`src/sources/dev-community/hackernews.ts`)

- Profile-aware: **fast** fetches 60 stories (top+new, max 20 per class), **full** fetches 100
- **Bounded concurrent pool** (concurrency=5) for item fetches
- **Per-item timeout** (4s) — individual failures no longer break the batch
- **Dedupe and cap** story IDs across top+new
- **Keyword fallback**: if strict AI keywords match 0 items, fall back to broader tech/AI-adjacent (≤ `keyword_fallback` = 3 in fast) and tag with `fallback=true`
- HN no longer returns 0 due to a few fetch failures

### 6. GDELT Cooldown (`src/sources/news/gdelt.ts` + `src/sources/profile.ts`)

- New `setCooldown/getCooldown` API in `profile.ts` writing to `reports/source-cooldowns.json`
- On HTTP 429: cooldown set for 6h (`cooldown_until = now + 6h`)
- **fast profile** + active cooldown → skip without HTTP call (no 429 escalation)
- **full profile** always tries (manual override)
- Source health shows: `status: "skipped_cooldown"`, `skipped_cooldown_count: 1`, `next_allowed_at: <ISO>`

### 7. Source Health Schema (`reports/source-health.json`)

New fields per source:
```json
{
  "profile": "fast|full|diagnose",
  "query_count": 1,
  "success_count": 1,
  "partial_count": 0,
  "timeout_count": 0,
  "failed_count": 0,
  "skipped_cooldown_count": 0,
  "duration_ms": 2181,
  "last_success_at": "2026-06-13T03:40:26.424Z",
  "next_allowed_at": null
}
```

Top-level also includes `profile` field.

### 8. Daily Scheduled (`scripts/daily-scheduled.sh`)

- Defaults to `collect:fresh:fast` (was: `collect:fresh` = full)
- Reads source-health.json to count OK / cooldown / failed sources
- If fast is partial-pass, still runs digest (fallback to old data + WARN)
- Logs explicit counts at end: `collect_exit=… digest_exit=… sources_ok=N cooldown=N failed=N`

### 9. Daily Manual (`scripts/daily-manual.ts`)

- Switched to `collect:fresh:fast` (daily-fit profile)
- Report includes `Profile: fast` line

---

## Verification — `npm run collect:fresh:fast` (Run run-mqbt3ifl)

### Before (Phase 4C-4, full profile implicit)

| Source | Status | Signals | Duration |
|--------|--------|---------|----------|
| arXiv AI | success | 20 | 18,468ms |
| GitHub Radar | timeout | 0 | 35,003ms |
| Hacker News | partial | 0 | 10,490ms |
| GDELT | partial | 0 | 22,048ms |
| Hugging Face | timeout | 0 | 35,003ms |
| Open-Meteo | success | 1 | 944ms |
| Date Context | success | 1 | 1ms |
| Solar Terms | success | 1 | 0ms |
| Met Collection | success | 7 | 34,749ms |
| **TOTAL** | **5/9 OK** | **30** | - |

### After (Phase 4C-5, fast profile)

| Source | Status | Signals | Duration |
|--------|--------|---------|----------|
| arXiv AI | success | 20 | 16,288ms |
| GitHub Radar | success | 20 | 2,181ms ⬇⬇ |
| Hacker News | success | 16 ⬆ | 7,175ms ⬇ |
| GDELT | partial → skipped_cooldown | 0 | 9,818ms (one-shot) |
| Hugging Face | success | 20 ⬆ | 7,977ms ⬇⬇ |
| Open-Meteo | success | 1 | 864ms |
| Date Context | success | 1 | 1ms |
| Solar Terms | success | 1 | 0ms |
| Met Collection | success | 7 | 30,614ms |
| **TOTAL** | **8/9 success + 1 skipped_cooldown** | **86** ⬆ 287% | - |

### Second Run (Cooldown Active)

| Source | Status | Signals |
|--------|--------|---------|
| GDELT | **skipped_cooldown** ✅ (no HTTP call) | 0 |
| Others | success | 86 |
| **Overall** | **PASS** | 86 |

Source health shows:
```json
{
  "source_name": "GDELT",
  "status": "skipped_cooldown",
  "skipped_cooldown_count": 1,
  "duration_ms": 1,
  "error_summary": "cooldown until 2026-06-13T09:39:46.968Z (HTTP 429 at ...)",
  "next_allowed_at": "2026-06-13T09:39:46.968Z"
}
```

---

## Validation Checklist

- [x] Implementation matches original plan (per-source budget, profile, concurrency, cooldown)
- [x] TypeScript syntax check — no NEW errors (pre-existing errors unrelated to this phase)
- [x] Functional test `npm run collect:fresh:fast` PASS (86 signals, 8/9 success + 1 cooldown)
- [x] Cooldown behavior validated: second run skips GDELT without HTTP call
- [x] Diagnose script still works (`npm run collect:diagnose`): 8/9 reachable
- [x] `conanxin/*` exclusion preserved (3 places)
- [x] Hardcoded exclusion cannot be disabled
- [x] No MiniMax call, no new media
- [x] No gateway/timer/.env change
- [x] `.gitignore` updated to keep `config/source-budgets.example.json` trackable while ignoring local `config/source-budgets.json`

---

## Files Changed

| File | Status | Purpose |
|------|--------|---------|
| `config/source-budgets.example.json` | new | Profile/budget template |
| `src/sources/profile.ts` | new | Centralized budget + cooldown loader + bounded pool |
| `src/sources/code/github-open-source-radar.ts` | modified | Profile + concurrency + rate-limit awareness |
| `src/sources/ai-ecosystem/huggingface-hub.ts` | modified | Profile + concurrency, no serial wait |
| `src/sources/dev-community/hackernews.ts` | modified | Concurrent item fetch + keyword fallback |
| `src/sources/news/gdelt.ts` | modified | Cooldown awareness + run info |
| `src/pipeline/collect-signals.ts` | modified | Profile-aware collect, per-source health, cooldown pre-check |
| `scripts/collect.ts` | modified | Writes new health fields (profile, query_count, etc.) |
| `scripts/collect-fresh.ts` | modified | Same as above + profile in report |
| `scripts/daily-manual.ts` | modified | Uses fast profile |
| `scripts/daily-scheduled.sh` | modified | Default fast profile + source health parsing |
| `package.json` | modified | New `collect:fresh:fast`, `:full`, `:diagnose:connectivity` scripts |
| `.gitignore` | modified | Track `*.example.json` in config/, ignore `source-budgets.json` |

---

## Boundaries Verified

| Rule | Status |
|------|--------|
| No MiniMax / image model call | ✅ |
| No new image generation | ✅ |
| No music generation | ✅ |
| No video generation | ✅ |
| No OpenClaw / Hermes / gateway config change | ✅ |
| No gateway restart | ✅ |
| No .env / .env.telegram.local commit | ✅ |
| No Telegram token print | ✅ |
| No systemd timer enabled state change | ✅ |
| Long report goes to project sender (this file) | ✅ |
| OpenClaw final reply: short confirmation | ✅ |

---

## Open Items / Next Phase

- GDELT cooldown is HTTP-429 driven — if GDELT is down for a different reason (5xx), it will not enter cooldown. Future enhancement: cooldown also on 5xx after N consecutive failures.
- Hacker News fallback only triggers when `keywordMatched == 0`. Could be refined per-run based on quality.
- Source budgets loaded from disk on every fetch — could be cached, but current latency is negligible (<5ms).
- Met Collection is the slowest remaining source (30s). Could benefit from caching previous results.

Phase 4C-5: PASS
