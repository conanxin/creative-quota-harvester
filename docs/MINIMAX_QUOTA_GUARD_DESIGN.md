# MiniMax Quota Guard Design

**Version:** 1.0
**Created:** 2026-06-11
**Phase:** 3C (proposed)

---

## PROBLEM STATEMENT

During Phase 3A Full execution, the "继续" command caused OpenClaw to invoke real MiniMax image generation without explicit user confirmation. This violated the "no new media" closeout constraint.

**Root cause:** Ambiguous commands ("继续", "go", "run") can trigger real API calls that consume quota.

**Goal:** Prevent accidental quota consumption from ambiguous commands while keeping intentional generation easy to trigger.

---

## QUOTA GUARD RULES

### Rule 1: Quota Check Before Any Generation

Before executing any `mmx image generate`, `mmx music generate`, or `mmx video generate`:
1. Run `mmx quota` and parse the response
2. Check the relevant model's remaining percentage
3. If remaining < 50%: abort and alert user
4. Log the quota check result to `metadata/quota-check-log.json`

### Rule 2: Image Batch Limit

- Default batch size: **max 2 images per command**
- User must explicitly specify count: "generate 5 images"
- Never auto-generate more than 2 without explicit user consent

### Rule 3: Quota Threshold

- **Below 50% interval remaining**: block generation, alert user
- **Above 50%**: allow generation with confirmation prompt

### Rule 4: Video and Music Disabled by Default

- `mmx video generate`: ❌ Disabled unless user explicitly requests
- `mmx music generate`: ❌ Disabled unless user explicitly requests
- These consume quota faster; explicit opt-in required

### Rule 5: Ambiguous Commands Do Not Trigger Generation

The following commands must **NOT** trigger real generation:
- "继续" / "continue" / "go" / "run"
- "执行" without specifying generation
- "生成图片" without quota check confirmation

Only **explicit generation commands** trigger actual API calls:
- "执行 Phase 3A Full，生成 2 张图片"
- "Generate 3 images for top 3 content packs"
- "调用 MiniMax 生成图片"

### Rule 6: All Generations Must Be Tracked

After every successful generation:
1. Write to `metadata/generated-assets.json`
2. Update `gallery/assets.json`
3. Run `npm run validate:assets`
4. Push to GitHub

### Rule 7: Generation Command Signature

Every real MiniMax generation command must include:
- **What**: image / music / video
- **How many**: count (max 2 unless explicitly higher)
- **Which content packs**: pack ID(s)
- **User confirmation**: explicit Y/yes before API call

---

## QUOTA CHECK COMMAND

```bash
# Check quota before generation
npm run quota:check

# Output format:
#   general: 60% interval remaining
#   video: 100% interval remaining
#   Decision: ALLOW (above 50%) / BLOCK (below 50%)
```

---

## IMPLEMENTATION PLAN

### Phase 3C-1: Quota Check Script

Create `scripts/check-quota.ts`:
- Run `mmx quota` via exec with proxy unset
- Parse JSON response
- Return ALLOW/BLOCK decision with percentages
- Fail if quota < 50%

### Phase 3C-2: Generation Confirmation Prompt

Before any `mmx image generate`, the pipeline must:
1. Run quota check
2. If ALLOW: print summary and wait for explicit confirmation
3. If BLOCK: abort and print "Quota below 50%, aborting. Contact 爸爸 to replenish."

### Phase 3C-3: Batch Size Limit

In `src/generators/minimax-image-batch.ts`:
- Default: `maxBatch = 2`
- User can override: `batchSize = N` but max capped at 5
- Print: "Will generate N images (max 2 default)"

### Phase 3C-4: Generation Log

Create `metadata/generation-log.json`:
```json
{
  "generations": [
    {
      "asset_id": "cqa-2026-06-11-gen-002",
      "type": "image",
      "count": 1,
      "quota_before": "general:62%",
      "quota_after": "general:60%",
      "generated_at": "2026-06-11T08:19:00+08:00",
      "triggered_by": "explicit Phase 3A Full command"
    }
  ]
}
```

---

## OPENCLAW INTEGRATION NOTE

When OpenClaw processes a generation request:
1. Check if command is ambiguous ("继续", "go", "run")
2. If ambiguous: refuse to generate, reply "Ambiguous command. Please specify: 'Generate N images for [content pack]'"
3. If explicit: proceed with quota check → confirmation → generation

---

## EXAMPLE INTERACTION FLOWS

### ✅ Correct (Explicit Command)
```
User: "Execute Phase 3A Full, generate 2 images"
Agent: "Quota check: general 60% remaining. Proceeding."
Agent: "Generating 2 images for SamurAIGPT + Saint Jerome packs..."
Agent: "Done. Gallery updated. Push complete."
```

### ❌ Blocked (Ambiguous Command)
```
User: "继续"
Agent: "Ambiguous command. '继续' does not trigger generation."
Agent: "To generate images, please say: 'Generate 2 images for top content packs'"
```

### ❌ Blocked (Low Quota)
```
User: "Generate 2 images"
Agent: "Quota check: general 42% remaining (below 50% threshold)."
Agent: "Aborting generation. Quota too low."
Agent: "Next step: Phase 3C quota guard recommended."
```

---

_Quota Guard Design v1.0 — Phase 3C_