# Scheduled Daily Digest Runbook

**Version:** 1.0
**Created:** 2026-06-11
**Phase:** 4B-0

---

## STATUS: PHASE 4B-1 — TIMER ENABLED ✅

**The systemd timer IS enabled. Runs daily at 07:30 CST.**

This runbook describes how to dry-run the scheduled digest and how to install the timer in Phase 4B-1.

---

## TIMER STATUS (Phase 4B-1)

| Item | Status |
|------|--------|
| Timer installed | ✅ Yes |
| Timer enabled | ✅ Yes |
| Next run | Fri 2026-06-12 07:30:00 CST |
| Runs at | 07:30 CST daily |
| MiniMax called | ❌ No |

---

## WHAT EXISTS NOW

| File | Purpose |
|------|---------|
| `scripts/daily-scheduled.sh` | Bash wrapper for scheduled runs |
| `systemd/creative-quota-digest.service` | systemd oneshot service unit |
| `systemd/creative-quota-digest.timer` | systemd timer unit (template) |
| `logs/daily-scheduled.log` | Append-only run log |

**Timer is NOT installed. Timer is NOT enabled.**

---

## DRY RUN (CURRENT PHASE)

### Manual dry run

```bash
cd ~/.openclaw/workspace/projects/creative-quota-harvester
bash scripts/daily-scheduled.sh
```

### View log

```bash
tail -n 120 logs/daily-scheduled.log
```

---

## PHASE 4B-1: HOW TO ENABLE THE TIMER

**Requires user confirmation. Do not enable without explicit instruction.**

### Prerequisites

1. systemd user service support (`systemd --user` available)
2. Project at standard path `~/.openclaw/workspace/projects/creative-quota-harvester/`
3. No `.env` needed for digest (no MiniMax calls)

### Installation steps

```bash
# 1. Create systemd user directory
mkdir -p ~/.config/systemd/user/

# 2. Copy unit files
cp ~/.openclaw/workspace/projects/creative-quota-harvester/systemd/creative-quota-digest.service \
   ~/.config/systemd/user/
cp ~/.openclaw/workspace/projects/creative-quota-harvester/systemd/creative-quota-digest.timer \
   ~/.config/systemd/user/

# 3. Reload systemd
systemctl --user daemon-reload

# 4. Enable and start the timer
systemctl --user enable --now creative-quota-digest.timer

# 5. Verify
systemctl --user status creative-quota-digest.timer
systemctl --user list-timers
```

---

## TIMER BEHAVIOR

- **Runs at:** 07:30 CST every day
- **What it runs:** `npm run daily:manual` (collect → briefs → digest → check)
- **MiniMax called:** ❌ No — timer only runs digest pipeline
- **New media generated:** ❌ No
- **Failure handling:** Logs failure, does NOT restart service repeatedly
- **On missed run:** If machine was off, runs once at next boot (Persistent=true)

---

## HOW TO CHECK STATUS

```bash
# Timer status
systemctl --user status creative-quota-digest.timer

# List all timers
systemctl --user list-timers

# View recent log
tail -n 120 ~/.openclaw/workspace/projects/creative-quota-harvester/logs/daily-scheduled.log
```

---

## HOW TO STOP / DISABLE

```bash
# Stop and disable the timer
systemctl --user disable --now creative-quota-digest.timer

# Verify stopped
systemctl --user list-timers | grep creative-quota-digest
```

---

## IMPORTANT NOTES

1. **No MiniMax calls via timer** — The timer only runs `daily-scheduled.sh` which calls `npm run daily:manual`. No MiniMax generation happens automatically. Real generation requires explicit commands (`npm run generate:image:confirmed`).

2. **Timer runs regardless of network** — If sources are temporarily unavailable, the digest step logs a warning and continues. No retry loop in this phase.

3. **Logs grow over time** — `logs/daily-scheduled.log` appends every run. Rotate or truncate periodically.

4. **No API keys in systemd unit** — Secrets are in `creative-quota-harvester/.env` (gitignored). systemd unit does not contain secrets.

5. **User-level systemd** — This is a user systemd timer, not a system one. No root required. Works on desktop/laptop that sleeps.

---

## FUTURE: PHASE 4B-1+ ADDITIONS (NOT YET IMPLEMENTED)

| Feature | Status |
|---------|--------|
| Auto-push after digest | ❌ Future |
| Telegram auto-send after digest | ❌ Future |
| Quota check before any generation | ❌ Phase 3C (not in timer yet) |
| Email/SMS alert on failure | ❌ Future |
| Log rotation | ❌ Future |

---

## PHASE 4B-2: FIRST SCHEDULED RUN VALIDATION ✅

**Date:** 2026-06-12  
**Validation Status:** PASS

### First Scheduled Run Result

| Property | Value |
|----------|-------|
| Scheduled Run Time | Fri 2026-06-12 07:30:00 CST |
| Actual Run Time | Fri 2026-06-12 07:30:01 CST |
| Exit Status | 0/SUCCESS ✅ |
| CPU Time | 3.392s |
| Next Run | Sat 2026-06-13 07:30:00 CST |

### Run History

```
Jun 11 09:29:24 — First enable-time run (SUCCESS, 2.887s)
Jun 12 07:30:01 — First scheduled 07:30 run (SUCCESS, 3.392s)
```

Both runs exited 0 with no errors.

### Digest Output Quality

| Check | Result |
|-------|--------|
| reports/daily-digest.md | Updated (2.1K) ✅ |
| reports/telegram-digest.txt | Updated (1.7K) ✅ |
| telegram-digest:check | PASS ✅ |
| Char count | 1666 ≤ 3500 ✅ |
| No [truncated] | ✅ |
| No large JSON | ✅ |

### Safety Verification

| Check | Result |
|-------|--------|
| MiniMax called | No ✅ |
| New images generated | No ✅ |
| Music generated | No ✅ |
| Video generated | No ✅ |
| .env tracked | No ✅ |
| Timer modified | No ✅ |

### How to Tell If Scheduled Run Succeeded

1. Check timer: `systemctl --user status creative-quota-digest.timer` → look for "active (waiting)"
2. Check service: `systemctl --user status creative-quota-digest.service` → look for "0/SUCCESS" and timestamp
3. Check log: `tail -n 40 logs/daily-scheduled.log` → look for "Result: SUCCESS"
4. Check digest: `npm run digest:telegram:check` → should PASS
5. Check files: `ls -la reports/telegram-digest.txt` → should have recent timestamp

### How to Troubleshoot Failure

1. **Check systemd journal**: `journalctl --user -u creative-quota-digest.service -n 40`
2. **Check wrapper log**: `tail -n 40 logs/daily-scheduled.log`
3. **Common issues**:
   - `node`/`npm` not found → check PATH in service unit
   - Permission denied → check `daily-scheduled.sh` is executable
   - `.env` missing → digest doesn't need it, but generation does
   - Network timeout → digest logs warning, continues

### Next Steps

1. **Phase 4B-3**: Long-term monitoring (1 week run observation)
2. **Phase 4B-4**: Telegram auto-send integration (if desired)
3. **Phase 4H**: Video Prompt Enhancement

---

_Runbook v1.1 — Phase 4B-2 (first scheduled run validated)_