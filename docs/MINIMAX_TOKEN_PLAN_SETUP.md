# MiniMax Token Plan Setup Guide

**For:** Creative Quota Harvester — Phase 3A+ MiniMax Image Generation
**Last Updated:** 2026-06-11

---

## Overview

Creative Quota Harvester uses MiniMax Token Plan for AI media generation (images, video, music). Token Plan is a subscription model with preset credit allocations — **different from pay-per-use API keys**.

---

## Token Plan Key vs API Key

| Property | Token Plan Key | Pay-per-use API Key |
|----------|---------------|-------------------|
| **Format** | `sk-cp-...` | `ey...` (JWT) |
| **Source** | MiniMax Console > Token Plan | MiniMax Console > API Keys |
| **Auth method** | mmx CLI session cookie | Bearer token |
| **Quota model** | Subscription (monthly credits) | Pay per call |
| **Key for mmx CLI** | ✅ Yes | ❌ No |
| **Key for REST API** | ⚠️ May not work | ✅ Yes |

**Important:** If `mmx quota` returns "invalid api key", you likely have a Token Plan Key but are trying to use it as a REST API Bearer token. Use `mmx auth login --api-key` instead.

---

## Setup Steps

### 1. Get Your Token Plan Key

1. Go to [MiniMax Console](https://platform.minimaxi.com)
2. Navigate to **Token Plan Management** (Token Plan 订阅管理)
3. Copy your **Token Plan Key** (starts with `sk-cp-`)
4. **Do not use** the regular API Key from API Keys page

### 2. Configure mmx CLI

```bash
# Login with Token Plan Key
mmx auth login --api-key "sk-cp-your-token-plan-key"

# Verify login
mmx auth status

# Set region (China endpoint)
mmx config set --key region --value cn

# Check quota
mmx quota
```

### 3. Configure Harvester .env

```bash
cd ~/.openclaw/workspace/projects/creative-quota-harvester

# Create .env from example
cp .env.example .env

# Edit .env and add your key
nano .env
# Set: MINIMAX_API_KEY=sk-cp-your-token-plan-key
```

### 4. Verify with mmx quota

```bash
mmx quota
```

Expected output (Token Plan):
- `model_remains[].model_name: "general"` — general quota status
- `model_remains[].model_name: "video"` — video quota status
- `current_interval_remaining_percent` — quota remaining for current period

---

## Proxy Note

The mmx CLI does not work with SOCKS proxies (`socks5://`). If you have proxy env vars set:

```bash
unset https_proxy http_proxy all_proxy no_proxy
mmx quota  # now works
```

---

## Image Generation

After setup, Phase 3A will generate images using:

```bash
mmx image generate \
  --prompt "your prompt here" \
  --model image-01 \
  --aspect-ratio 16:9 \
  --out-dir ./output/
```

---

## Security Notes

| Item | Rule |
|------|------|
| `.env` file | Already in `.gitignore` — never commit |
| API key in logs | Never print full key — use `sk-cp-****` prefix only |
| Reports | Never include full API key |
| Git history | If key was accidentally committed, rotate it immediately |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `mmx: Invalid URL protocol` | SOCKS proxy blocking | `unset https_proxy http_proxy all_proxy` |
| `mmx quota: cookie is missing` | Not logged in | `mmx auth login --api-key "sk-cp-..."` |
| `mmx quota: invalid api key` | Key is Token Plan Key, not API Key | Use `mmx auth login`, not Bearer token |
| Direct API returns 2049 | Token Plan Key used as Bearer token | Use mmx CLI with `mmx auth login` |
| `base_url` errors | mmx version mismatch | Upgrade: `npm install -g mmx-cli` |

---

## Verification Commands

```bash
# Check mmx is working
mmx --version

# Check auth
mmx auth status

# Check quota
mmx quota

# Generate a test image
mmx image generate --prompt "test" --out /tmp/test.png
```

---

_Last updated: Phase 3A-0 — 2026-06-11_