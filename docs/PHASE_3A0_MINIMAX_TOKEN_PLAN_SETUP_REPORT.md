# Phase 3A-0 — MiniMax Token Plan CLI Setup Report

**Generated:** 2026-06-11T02:54:00+08:00
**Status:** ✅ PASS — CLI Configured, Blocked on .env

---

## STATUS

| Item | Result |
|------|--------|
| mmx installed | ✅ v1.0.16 at `/home/ubuntu/.npm-global/bin/mmx` |
| mmx auth status | ✅ Authenticated (method: api-key, source: config.json) |
| region | ✅ `cn` (China endpoint) |
| base_url | ✅ `https://api.minimaxi.com` |
| mmx quota | ✅ **Working — Token Plan detected** |
| harvester `.env` | ❌ Missing |
| Image generated | ❌ No (Phase 3A scope) |
| Music/Video | ❌ No |
| cron/systemd | ❌ No |

---

## MMX_INSTALL_STATUS

| Check | Result |
|-------|--------|
| `which mmx` | ✅ `/home/ubuntu/.npm-global/bin/mmx` |
| `mmx --version` | ✅ `1.0.16` |
| SOCKS proxy issue | ✅ Identified — unset proxy vars before running mmx |

**Note:** The SOCKS proxy (`socks5://127.0.0.1:7898`) in the environment causes mmx to fail with "Invalid URL protocol". Run `unset https_proxy http_proxy all_proxy no_proxy` before mmx commands.

---

## AUTH_STATUS

| Check | Result |
|-------|--------|
| `mmx auth status` | ✅ Authenticated |
| method | `api-key` |
| source | `config.json` (`~/.mmx/config.json`) |
| api_key prefix | `sk-cp-mP...` (key is stored in `~/.mmx/config.json`) |

**Key location:** `~/.mmx/config.json` (not in harvester `.env`)

The mmx CLI is already logged in with the Token Plan key from a previous session. The key prefix is `sk-cp-mP...`.

---

## REGION_STATUS

| Item | Value |
|------|-------|
| Region | `cn` |
| Base URL | `https://api.minimaxi.com` |
| Config file | `~/.mmx/config.json` |

---

## QUOTA_STATUS

**mmx quota output (Token Plan general + video):**

```
general model:
  current_interval_remaining_percent: 14
  current_weekly_remaining_percent: 70
  current_interval_status: 1 (active)

video model:
  current_interval_remaining_percent: 100
  current_weekly_remaining_percent: 85
  current_interval_status: 1 (active)
```

**Verdict:** Token Plan is active with remaining quota. Image generation (`image-01` model) should be available.

---

## ENV_STATUS

| Item | Result |
|------|--------|
| `~/.mmx/config.json` | ✅ Exists — mmx CLI uses this |
| `creative-quota-harvester/.env` | ❌ Missing — harvester needs this |
| `.env.example` | ✅ Created in this phase |

**The harvester pipeline needs `MINIMAX_API_KEY` in `.env`** to call MiniMax API. The mmx CLI uses its own config file (`~/.mmx/config.json`), but the harvester script reads from `.env`.

---

## SKILL_STATUS

Not attempted — no MiniMax CLI skill found in catalog.

---

## WHAT_CHANGED

| File | Action |
|------|--------|
| `.env.example` | ✅ Created — `MINIMAX_API_KEY=` placeholder |
| `docs/MINIMAX_TOKEN_PLAN_SETUP.md` | ✅ Created — setup guide |
| `creative-quota-assets/.env` | ❌ Not created |
| `.env` | ❌ Not created (requires real key) |

**No secrets were printed, logged, or written to reports.**

---

## WHAT_WAS_NOT_DONE

| Item | Reason |
|------|--------|
| No image generated | Phase 3A scope — not Phase 3A-0 |
| No `.env` created | `.env` requires real key from user |
| No music/video | Not in scope |
| No git push | Will be done after Phase 3A-0 docs commit |

---

## NEXT_PHASE_PROPOSAL

**Phase 3A-1: Create Harvester .env and Run Canary Image**

1. **User action required:** Add real `MINIMAX_API_KEY` to `creative-quota-harvester/.env`
   - Key should come from MiniMax Console > Token Plan Management
   - Format: `sk-cp-...`

2. **After `.env` is in place:**
   - `cd creative-quota-harvester && npm run generate:image:canary`
   - Select 1 content pack, read `image-prompt.md`
   - Call `mmx image generate`
   - Save to `creative-quota-assets/images/YYYY/MM/`
   - Update metadata and gallery

**Or: Phase 3B (Telegram Daily Digest) — no API key needed**

**Decision: 爸爸 decides.**

---

_Phase 3A-0 complete. mmx CLI is configured and quota is active. Ready for Phase 3A when .env is provided._