# Scheduled Daily Digest Runbook

**Version:** 1.0
**Created:** 2026-06-11
**Phase:** 4B-0

---

## STATUS: PHASE 4B-0 — DRY RUN TEMPLATES ONLY

**The systemd timer is NOT yet enabled. Do NOT install it yet.**

This runbook describes how to dry-run the scheduled digest and how to install the timer in Phase 4B-1.

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

_Runbook v1.0 — Phase 4B-0 (dry run templates only)_