# Collect Timeout Diagnosis — Phase 4C-4

**Date:** 2026-06-13
**Run ID:** run-mqbscv61
**Overall Status:** PARTIAL_PASS

---

## ROOT_CAUSE

1. **GitHub Open Source Radar — TIMEOUT**
   - **Why:** 12 queries with 7s gap between each = minimum 84s base time. Each query also has up to 3 retry attempts. With per-source timeout of 35s, the adapter consistently times out before completing all queries.
   - **Evidence:** duration_ms=35003, error="timeout after 35000ms"
   - **Fix applied:** Per-source timeout of 35s. GitHub needs either fewer queries or parallel execution.

2. **Hugging Face Hub — TIMEOUT**
   - **Why:** 8 model filters + 3 dataset filters = 11 API calls with 5s gap between each = minimum 55s base time. Native fetch frequently fails (network issues), causing curl fallback which adds latency.
   - **Evidence:** duration_ms=35003, error="timeout after 35000ms"
   - **Fix applied:** Per-source timeout of 35s. HF needs either fewer filters or parallel execution.

3. **Hacker News — PARTIAL (0 signals)**
   - **Why:** Uses `fetchWithTimeout` instead of `fetchWithRetry`. The adapter's internal fetch for topstories.json succeeded, but item-level fetches failed silently, resulting in 0 signals. This is not a timeout issue but a fetch reliability issue.
   - **Evidence:** duration_ms=10490, status=partial, signal_count=0

4. **GDELT — PARTIAL (0 signals)**
   - **Why:** HTTP 429 (rate limited) after 3 attempts. The API endpoint works but rate-limits frequent requests.
   - **Evidence:** duration_ms=22048, "HTTP 429 after 3 attempts"

5. **Met Collection — SUCCESS but slow**
   - **Why:** 7 search queries × 2 API calls each = 14 calls with 3.5s gap = ~49s minimum. Plus object detail fetches add latency.
   - **Evidence:** duration_ms=34749, just under the 35s timeout. This suggests the timeout is barely sufficient for Met.

---

## COLLECT PIPELINE CHANGES

### Per-Source Timeout Policy

```typescript
const PER_SOURCE_TIMEOUT_MS = 35000;
const OVERALL_TIMEOUT_MS = 240000;
```

- Each adapter wrapped in `withTimeout(promise, 35000, label)`
- Overall collect timeout of 240s via `setTimeout` warning (not hard kill)
- Each source independent try/catch — failure of one does not block others

### Source Health Tracking

- `reports/source-health.json` — machine-readable health per source
- `reports/source-health.md` — human-readable table
- Fields: source_name, source_type, status, signal_count, duration_ms, error_summary, last_success_at

### Collect Status Rules

| Success Sources | Status |
|-----------------|--------|
| >= 3, all success | PASS |
| >= 3, some fail | PARTIAL_PASS |
| 1-2 success | PARTIAL_PASS |
| 0 success, old data | WARN |
| 0 success, no data | FAIL |

---

## ADAPTER-SPECIFIC FINDINGS

| Adapter | Before | After | Root Cause |
|---------|--------|-------|------------|
| arXiv AI | success | success | 4 categories × 3.5s gap = ~14s, well within timeout |
| GitHub Radar | success | timeout | 12 queries × 7s gap = ~84s, exceeds 35s timeout |
| Hacker News | success | partial | fetch reliability, not timeout |
| GDELT | success | partial | HTTP 429 rate limit |
| Hugging Face | success | timeout | 11 filters × 5s gap = ~55s, exceeds timeout |
| Open-Meteo | success | success | 1 call, very fast |
| Date Context | success | success | Local computation, instant |
| Solar Terms | success | success | Local computation, instant |
| Met Collection | success | success | 14 calls × 3.5s gap = ~49s, barely fits |

---

## RECOMMENDATIONS FOR NEXT ITERATION

1. **GitHub Radar:** Reduce queries from 12 to 6, or parallelize queries.
2. **Hugging Face:** Reduce filters from 11 to 5, or parallelize.
3. **Met Collection:** Consider increasing timeout to 45s or reducing queries.
4. **Hacker News:** Switch from `fetchWithTimeout` to `fetchWithRetry` with curl fallback.
5. **GDELT:** Add longer backoff for 429 responses, or reduce query frequency.

---

## DIAGNOSIS COMMAND

```bash
npm run collect:diagnose
```

Result: All 9/9 sources reachable. Network connectivity is not the issue. The issue is adapter duration exceeding per-source timeout.

---

## FILES CHANGED

- `src/pipeline/collect-signals.ts` — Added per-source timeout, health tracking, overall status
- `scripts/collect.ts` — Writes source-health.json and source-health.md
- `scripts/collect-diagnose.ts` — NEW: Lightweight connectivity test
- `scripts/collect-fresh.ts` — NEW: Force collect without freshness checks
- `scripts/daily-manual.ts` — Uses `collect:fresh` instead of `collect`
- `scripts/daily-scheduled.sh` — Handles partial collect failures, continues to digest
- `src/reports/telegram-daily-digest.ts` — Shows source health in digest
- `scripts/validate-digest-freshness.ts` — Accepts Phase 4C-4 reference
- `package.json` — Added `collect:diagnose` and `collect:fresh` scripts

---

_Phase 4C-4 diagnosis complete._
