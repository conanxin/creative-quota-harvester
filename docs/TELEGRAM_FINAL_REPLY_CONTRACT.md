# Telegram Final Reply Contract

**Version:** 2.0 (Phase 4C-3A)
**Status:** ACTIVE

---

## Purpose

Prevent OpenClaw final-reply channel from leaking tool residue (`<tool_call>`, `</tool_call>`, `<|tool_call|>`, etc.) or long report payloads into Telegram.

---

## Rules (binding)

### 1. OpenClaw final reply MUST be short

Maximum: **one sentence**. No exceptions. Examples:

- `Phase 4C-3A complete. Sanitized report sent by project sender. message_id=50003.`
- `Phase X finished but report send failed. See reports/<file>.md.`

### 2. No long report in final reply

The final reply MUST NOT contain:
- Full report text
- Code blocks > 5 lines
- Tables > 3 rows
- Markdown headers (no `#`, `##`, `###`)
- More than 80 characters (rough guideline)

### 3. No attachments in final reply

OpenClaw final reply MUST NOT include:
- `attachments` array
- `[/path/to/file]`
- Image / Document references

### 4. No tool residue allowed ANYWHERE

Final reply MUST NOT contain:
- `<tool_call>`, `</tool_call>`, `<|tool_call|>`, `</invoke>`, `</content>`, `<content>`
- `<tool`, `<invoke`, `<function` (open tags)
- `minimax`, `MiniMax` (model identifier mentions)
- `Authorization: Bearer ...`
- Raw JSON tool payloads (`{"name": "...", "tool": "...", "arguments": {...}`)
- `[truncated]`
- `.env`, `TELEGRAM_BOT_TOKEN=`, `MINIMAX_API_KEY=`

### 5. Long reports MUST go through project sender

Any report > 350 chars MUST be sent via the project's own sender:

```
npm run report:send -- --file reports/<file>.txt --label "Phase X"
```

This:
- Applies sanitizer
- Verifies length <= 3500
- Verifies no forbidden patterns
- Uses project's Telegram bot token (not OpenClaw gateway)
- Logs `message_id` to `reports/project-report-send-result.json`

### 6. Daily Digest stays in its own pipeline

The Daily Digest (Phase 4B) continues to use:

```
npm run digest:send:confirmed
```

It does NOT go through `report:send`. The two pipelines are separate.

### 7. If project sender fails

OpenClaw final reply MUST say:

```
Phase X finished but report send failed. See reports/<file>.md.
```

OpenClaw MUST NOT paste the long report body as a fallback.

### 8. Token safety

- `.env.telegram.local` MUST NOT be committed
- Tokens MUST NOT appear in any committed file or report
- `git status` MUST show no `.env*` files

---

## Validation

Run after each phase:

```
npm run validate:project-report-send
```

Must return **PASS** before any phase is marked complete.

---

## What this prevents

- Tool residue leaking into Telegram from long agent outputs
- Long report payloads flooding Telegram
- `<|tool_call|>` or similar XML tags reaching the user
- `minimax` / `MiniMax` identifiers leaking the underlying model
- Multiple-message spam from retry logic
- Token leaks via `Authorization:` headers in copied text

---

## When this contract applies

- Any OpenClaw final reply that mentions a phase, a report, or any file path
- Any agent that completes a creative-quota-harvester task
- Any Telegram-bound output produced by this project

---

*Effective: 2026-06-13 (Phase 4C-3A)*