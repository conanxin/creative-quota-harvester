# Telegram Final Reply Contract

**Version:** 1.0
**Applies to:** All OpenClaw agent sessions via Telegram
**Enforced from:** Phase 2B onward

---

## Core Rule

**One message. One reply. Short summary. Paths to reports.**

Every task completion reply on Telegram follows this pattern — no exceptions.

---

## The Contract

| Rule | Description |
|------|-------------|
| **1 message max** | Send exactly 1 Telegram message per task completion |
| **≤800 chars** | Total message length must not exceed 800 characters |
| **No mid-task spam** | No progress updates, no stage markers, no "starting now" messages |
| **No long tables** | Long tables go to a report file; Telegram gets a1-line summary |
| **No long logs** | Full logs go to `reports/*.md` |
| **Paths, not content** | Telegram message contains paths to reports; not the content |
| **Always include** | STATUS, report paths, what was done, what's next |

---

## Message Template

```
STATUS: ✅ PASS / ❌ FAIL

[One-line conclusion]

报告：
- docs/PHASE_X_*.md
- reports/latest-*.md

命令：cd projects/creative-quota-harvester && npm run [cmd]

[Optional: brief note on next phase]
```

---

## Intermediate Messages (Forbidden)

The following message types are **forbidden** during task execution:

```
❌ "Starting Phase 2A..."
❌ "Step 1/4: collecting signals..."
❌ "Progress: 50 signals so far"
❌ "Now writing reports..."
❌ "Almost done..."
❌ "━━━━━━━━━━━━━━━━━━━━"
❌ Any table longer than 3 rows
```

**Exception:** Only when user explicitly asks for step-by-step updates.

---

## Long Report Handling

When a report exceeds 800 characters:

1. Write the full report to `reports/PHASE_X_*.md`
2. Write a1-line summary to `reports/PHASE_X_SHORT.md` (optional)
3. Send this on Telegram:

```
STATUS: ✅ Phase 2B Complete

5 Content Packs exported, validation PASS ✅

报告：
docs/PHASE_2B_ASSET_GALLERY_REPORT.md
reports/asset-validation.md
reports/latest-briefs.md

命令：cd projects/creative-quota-harvester && npm run briefs
```

---

## Why This Matters

- Telegram is a **messaging** surface, not a **document** surface
- Long messages disrupt，爸爸's workflow and context
- The `reports/` directory is the permanent record — Telegram is the notification layer
- Following this contract respects cognitive load (from AGENTS.md 🛡️ section)

---

## Verification Checklist (Self-Check Before Sending)

- [ ] Exactly 1 Telegram message will be sent
- [ ] Message is ≤ 800 characters
- [ ] No mid-task messages sent during execution
- [ ] Report paths included
- [ ] No full tables in Telegram message
- [ ] No long logs in Telegram message
- [ ] conanxin/* exclusion verified

---

## Future Phase Commands Reference

All future phase commands must follow this contract:

| Phase | Command | Contract applies |
|-------|---------|-----------------|
| Phase 2C | GitHub publish prep | ✅ |
| Phase 3A | MiniMax generation | ✅ |
| Phase 3B | Telegram daily report | ✅ |
| Phase 4 | Scheduled automation | ✅ |

---

_Last updated: Phase 2B — 2026-06-11_