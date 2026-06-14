# Sandbox Runtime Outputs

This directory contains **sandbox runtime outputs** for test and development runs.

## Rules

- **No production files** are written here.
- **All runtime outputs** are local/ignored and never committed.
- **Safe for test runs** — no impact on production digest, status, or Telegram.
- Only `README.md` and `.gitkeep` are committed to establish the directory structure.

## Subdirectories

- `daily-digest/` — Daily digest sandbox runs (YYYYMMDD_HHMMSS format)
  - Each run contains: `inputs/`, `outputs/`, `reports/`, `diffs/`, `logs/`

## Safety

- Sandbox runs do not modify `reports/daily-digest.md`.
- Sandbox runs do not modify `reports/telegram-digest.txt`.
- Sandbox runs do not modify `dashboard/status.json`.
- Sandbox runs do not send Telegram messages.
- Sandbox runs do not collect data.
- Sandbox runs do not modify timers.

---

*Managed by daily-digest-sandbox-manager.ts*
