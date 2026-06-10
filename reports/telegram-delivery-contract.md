# Telegram Digest Delivery Contract

**Version:** 1.0
**Created:** 2026-06-11
**Phase:** 3B-2

---

## CONTRACT

The single source of truth for Telegram digest delivery is `reports/telegram-digest.txt`.

**All Telegram messages for daily digest must use the exact content of this file.**

---

## TELEGRAM_FINAL_REPLY_RULE

When delivering the daily digest to Telegram:

1. Read `reports/telegram-digest.txt`
2. Verify length <= 3500 chars
3. Send the **exact content** as the Telegram message body
4. Do NOT append phase reports, summaries, or paths
5. Do NOT send as a file attachment instead of text

---

## FILE SPECIFICATION

**Path:** `reports/telegram-digest.txt`

**Required sections:**
- [ ] STATUS
- [ ] Signals / Content Packs / Generated Assets counts
- [ ] Top 5 Signals (deduplicated)
- [ ] Recommended Generation Queue
- [ ] Gallery URL
- [ ] MiniMax called: No
- [ ] New media generated: No
- [ ] Report paths
- [ ] Next phase suggestions

**Constraints:**
- <= 3500 chars
- No "[truncated"
- No large JSON blocks
- No long tables
- Single message (no multi-part)

---

## VALIDATION COMMAND

```bash
npm run digest:telegram       # Generate digest
npm run digest:telegram:check # Validate contract
```

All 8 checks must PASS before sending.

---

## OPENCLAW INTEGRATION NOTE

When OpenClaw sends the final reply for the digest task, it must use `reports/telegram-digest.txt` content as the message body — not the phase report text, not a file path, not a summary.

If the digest file exceeds 3500 chars after compaction, the digest generation script must compact it further (remove less critical sections) until it fits.

---

_Contract v1.0 — Phase 3B-2_