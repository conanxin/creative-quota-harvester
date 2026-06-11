# Manual Daily Digest Runbook

**Version:** 1.0
**Created:** 2026-06-11
**Phase:** 4A

---

## PURPOSE

This runbook describes how to manually run the daily digest workflow for the Creative Quota Harvester. This is the manual counterpart to the future Phase 4B automated timer.

**Use this runbook when:**
- Running the digest for the first time setup
- Verifying the digest pipeline before Phase 4B automation
- Manually triggering a daily digest
- Troubleshooting digest issues

---

## DAILY COMMANDS

### One-command daily run (if all data is fresh)

```bash
cd ~/.openclaw/workspace/projects/creative-quota-harvester
npm run daily:manual
```

This executes: collect → briefs → digest → check

### Step-by-step daily run (recommended for verification)

```bash
cd ~/.openclaw/workspace/projects/creative-quota-harvester

# Step 1: Collect signals
npm run collect

# Step 2: Generate briefs and content packs
npm run briefs

# Step 3: Generate Telegram digest
npm run digest:telegram

# Step 4: Validate digest contract
npm run digest:telegram:check
```

---

## OUTPUT FILES

| File | Description |
|------|-------------|
| `reports/telegram-digest.txt` | Single-message Telegram digest (≤3500 chars) |
| `reports/daily-digest.md` | Full markdown digest report |
| `reports/latest-signals.md` | Top signals from last collection |
| `reports/latest-briefs.md` | Generated creative briefs |
| `reports/latest-content-packs.md` | Content packs manifest |

---

## HOW TO READ THE DIGEST

### Status Line
`STATUS: PASS` — All checks passed. Digest is Telegram-ready.

### Signals Section
Shows total signals and breakdown by source (code, ai-ecosystem, dev-community, academic, culture-art, context). Higher counts = more sources are working.

### Top 5 Signals (Deduplicated)
Shows the top 5 signals by score, deduplicated by URL and title. Good diversity across source types indicates healthy signal collection.

### Recommended Generation Queue
Lists content packs that:
1. Have an `image-prompt.md`
2. Do NOT yet have a generated image
3. Are sorted by score (if score is available)

**How to decide if generation is worth it:**
- Check if quota allows: `unset https_proxy http_proxy all_proxy no_proxy && mmx quota`
- If general interval remaining ≥ 50% → generation is safe
- If recommended queue has 3+ items with real scores → batch generation worthwhile

---

## IF YOU WANT TO GENERATE IMAGES

**IMPORTANT: Follow Phase 3C Guard Rules**

1. **Dry-run first** (always safe, no MiniMax call):
   ```bash
   npm run generate:image:dry-run
   ```

2. **Check quota** (optional but recommended):
   ```bash
   unset https_proxy http_proxy all_proxy no_proxy && mmx quota
   ```

3. **Real generation** (requires explicit confirmation):
   ```bash
   CQA_ALLOW_GENERATION=1 npm run generate:image:confirmed
   ```

**What "continue" / "continue" / "run next" does NOT do:**
- ❌ Does NOT trigger real MiniMax generation
- ❌ Does NOT consume quota
- ✅ Only triggers dry-run planning

---

## PROHIBITED COMMANDS

The following commands are blocked by the generation guard and **will not** trigger real generation:

- "继续" / "continue" / "下一步" / "run next" / "go" / "执行"

If you want real generation, you must use explicit commands like:
- `npm run generate:image:confirmed`
- `CQA_ALLOW_GENERATION=1 npm run generate:image:confirmed`

---

## COMMON FAILURES AND SOLUTIONS

### arXiv / GitHub / HF network failure during `npm run collect`

**Symptom:** `collect` step times out or returns 0 signals
**Solution:** Run `npm run diagnose:sources` to check individual source health. Most failures are transient — retry after 5 minutes.

### GDELT returns HTTP 429

**Symptom:** GDELT signals missing, others OK
**Solution:** This is expected — GDELT has rate limits. The pipeline degrades gracefully. Skip GDELT and continue.

### Digest file exceeds 3500 chars

**Symptom:** `npm run digest:telegram:check` fails
**Solution:** The digest script automatically truncates if needed. Check `reports/telegram-digest.txt` for the trimmed version.

### Gallery validation fails

**Symptom:** `npm run validate:assets` shows failures
**Solution:** Check `reports/asset-validation.md` for details. Common issues: missing image files, broken URLs.

### Brief count shows 0 or low

**Symptom:** Digest shows "Briefs: 0"
**Solution:** Run `npm run briefs` separately to regenerate content packs. Check `reports/latest-briefs.md` for parsing issues.

---

## SCHEDULING STATUS

| Item | Status |
|------|--------|
| Manual run | ✅ Available (`npm run daily:manual`) |
| systemd timer | ❌ Phase 4B (future) |
| cron job | ❌ Phase 4B (future) |

Phase 4B will add automatic daily execution via external systemd timer or cron.

---

## QUICK REFERENCE CARD

```bash
# Full daily digest (one command)
npm run daily:manual

# Individual steps
npm run collect      # Gather signals
npm run briefs       # Generate briefs + content packs
npm run digest:telegram    # Generate Telegram digest
npm run digest:telegram:check  # Validate digest

# Generation (with guard)
npm run generate:image:dry-run     # Plan only
npm run generate:image:confirmed    # Real generation

# Validation
npm run validate:assets    # Check asset repo
npm run guard:check         # Test generation guard

# Check quota
unset https_proxy http_proxy all_proxy no_proxy && mmx quota
```

---

_Runbook v1.0 — Phase 4A_