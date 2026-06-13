Phase 5C-3: Auto-generated Control Catalog from package.json Scripts

**Date:** 2026-06-13
**Phase:** 5C-3
**Status:** PASS

---

## What Changed

Phase 5C-3 adds an auto-generated control catalog derived from package.json scripts + control-policy.json:
- New dashboard/control-policy.json (68 rules + default policy)
- New scripts/generate-control-catalog.ts (auto-generator)
- New scripts/validate-control-catalog-generated.ts (drift checker, 18 checks)
- dashboard/control-catalog.json: auto-generated from 69 package.json scripts + 7 safe_readonly manual commands
- dashboard/control-catalog.generated.json: generated output
- package.json: +dashboard:control:generate, +dashboard:control:drift-check

## Auto-generation Model

package.json scripts (69)
    ↓
control-policy.json rules (68 wildcard + 1 default)
    ↓
scripts/generate-control-catalog.ts
    ↓
dashboard/control-catalog.generated.json
    ↓
merge with safe_readonly manual commands (7)
    ↓
dashboard/control-catalog.json (final, 76 commands, 9 groups)

## Policy Rules

Key rules:
- validate:* → safe, dry_run_only
- dashboard:* → safe, dry_run_only
- build:* → safe, dry_run_only
- control:server* → safe, dry_run_only
- collect:fresh* → medium, dry_run_only
- generate:image:confirmed → high, dry_run_only
- generate:controlled:images → high, dry_run_only
- digest:send:confirmed → medium, dry_run_only
- report:send* → medium, dry_run_only
- prompts:* → safe, dry_run_only
- enrich:* → medium, dry_run_only
- Default: medium, disabled, needs_policy_review

## Drift Check (18/18 PASS)

- All 69 package.json scripts in catalog ✅
- All high/danger have requires_confirm ✅
- All high/danger have real_execution_supported=false ✅
- generates_media=true → calls_model or notes ✅
- Timer group commands have modifies_timer ✅
- Send confirmed has CQA_ALLOW_TELEGRAM_SEND ✅
- Image confirmed has CQA_ALLOW_GENERATION ✅
- No API key value patterns ✅
- No .env paths in commands ✅
- All commands have execution_mode ✅
- All commands have audit_required ✅
- Generated and final catalogs identical ✅
- All real_execution_supported=false ✅
- Version and phase set (5C-3) ✅

## Validation Results

- validate:control-server: 20/20 PASS (regression)
- validate:control-actions-dry-run: 19/19 PASS (regression)
- validate:control-readonly-actions: 21/21 PASS (regression)
- dashboard:control:drift-check: 18/18 PASS (new)

## Boundaries

- MiniMax called: No
- Image/Video/Music model called: No
- LLM called: No
- New media generated: No
- New audio generated: No
- Systemd timer: untouched
- Gateway config: untouched
- .env / .env.telegram.local: not committed
- Telegram token: not printed
- Real execution: not possible
- Public Pages executable control: not possible

## GitHub Push

- creative-quota-harvester: updated (master)
- creative-quota-assets: not affected

## Next Phase

- Phase 5C-2C: Confirmed low-risk command execution (2FA for high/danger)
- Phase 5C-4: Auto-generated safe-readonly action handlers from catalog
- Phase 4J: Audio coupling (video + music)
