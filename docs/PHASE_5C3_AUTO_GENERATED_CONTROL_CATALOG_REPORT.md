# Phase 5C-3 — Auto-generated Control Catalog from package.json Scripts

**Date:** 2026-06-13
**Phase:** 5C-3
**STATUS:** PASS

---

## STATUS

PASS. All 69 package.json scripts auto-mapped to control catalog. No drift between generated and final catalog. No command execution. No model calls. No media generation.

## WHAT_CHANGED

Phase 5C-3 introduces an **auto-generated control catalog** derived from `package.json` scripts and `dashboard/control-policy.json`. It reduces manual maintenance drift by automatically mapping all npm scripts to control command metadata.

### New Files (4)
- `dashboard/control-policy.json` — Risk policy with 68 rules + default policy
- `scripts/generate-control-catalog.ts` — Auto-generator from package.json + policy
- `scripts/validate-control-catalog-generated.ts` — Drift checker (18 checks)
- `docs/PHASE_5C3_AUTO_GENERATED_CONTROL_CATALOG_REPORT.md` — this report

### Modified Files (5)
- `dashboard/control-catalog.json` — Auto-generated from 69 package.json scripts + 7 safe_readonly manual commands
- `dashboard/control-catalog.generated.json` — Generated output
- `package.json` — Added `dashboard:control:generate` and `dashboard:control:drift-check` scripts
- `README.md` — Phase 5C-3 added
- `ROADMAP.md` — Phase 5C-3 added to version history

## AUTO_GENERATION_MODEL

```
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
dashboard/control-catalog.json (final)
```

### Policy Rules

| Rule Pattern | Risk | Execution Mode | Examples |
|-------------|------|---------------|----------|
| `validate:*` | safe | dry_run_only | validate:assets, validate:control-server |
| `dashboard:*` | safe | dry_run_only | dashboard:build, dashboard:validate |
| `build:*` | safe | dry_run_only | build:content-packs |
| `control:server*` | safe | dry_run_only | control:server, control:server:smoke |
| `collect:diagnose*` | safe | dry_run_only | collect:diagnose, collect:diagnose:connectivity |
| `collect:fresh*` | medium | dry_run_only | collect:fresh, collect:fresh:fast, collect:fresh:full |
| `daily:manual` | safe | dry_run_only | daily:manual |
| `briefs` | safe | dry_run_only | briefs |
| `digest:telegram` | safe | dry_run_only | digest:telegram |
| `digest:send:dry-run` | safe | dry_run_only | digest:send:dry-run |
| `digest:send:confirmed` | medium | dry_run_only | digest:send:confirmed |
| `generate:image:canary` | safe | dry_run_only | generate:image:canary |
| `generate:image:confirmed` | high | dry_run_only | generate:image:confirmed |
| `generate:controlled:images` | high | dry_run_only | generate:controlled:images |
| `guard:check` | safe | dry_run_only | guard:check |
| `prompts:*` | safe | dry_run_only | prompts:image:enhance, prompts:video:enhance |
| `enrich:content` | medium | dry_run_only | enrich:content |
| `enrich:facts*` | medium | dry_run_only | enrich:facts, enrich:facts:offline, enrich:facts:force |
| `gallery:*` | safe | dry_run_only | gallery:dedup, gallery:from-dedup |
| `report:send*` | medium | dry_run_only | report:send:dry-run, report:send |
| `type-check` | safe | dry_run_only | type-check |
| `test-adapter` | safe | dry_run_only | test-adapter |
| `run-once` | safe | dry_run_only | run-once |
| `diagnose:sources` | safe | dry_run_only | diagnose:sources |
| `review:images` | safe | dry_run_only | review:images |
| `pages:content-packs` | safe | dry_run_only | pages:content-packs |
| `collect` | medium | dry_run_only | collect (legacy) |
| `report` | medium | dry_run_only | report (legacy) |

### Default Policy (Unmatched Scripts)

```json
{
  "risk_level": "medium",
  "requires_confirm": true,
  "real_execution_supported": false,
  "execution_mode": "disabled",
  "notes": "Default policy: medium risk, no real execution, needs policy review."
}
```

## COMMAND_GROUPS

| Group | Commands | Description |
|-------|----------|-------------|
| 📅 Daily Digest | 6 | digest, daily:manual, briefs, send dry-run/confirmed |
| 🌐 Source Collection | 6 | collect, diagnose, fresh fast/full |
| 🎨 Asset Generation | 6 | generate image (canary/dry-run/confirmed), controlled images, review |
| ✅ Validation | 18 | All validate:* scripts |
| ⏰ Timer | 0 | (reserved for future timer commands) |
| 📨 Reports | 3 | report send dry-run/confirmed |
| 🔧 Development | 3 | type-check, test-adapter, run-once |
| 🎛️ Dashboard & Control | 8 | dashboard, control, gallery, archive, enrich, pages |
| ✨ Prompt Enhancement | 4 | image/video/music enhance, facts enrichment |
| 🔍 Safe Read-only Queries | 7 | get_status, get_source_health, etc. (Phase 5C-2B) |

## DRIFT_CHECK_RESULTS

`npm run dashboard:control:drift-check`: **18/18 PASS**

| Check | Result |
|-------|--------|
| All package.json scripts in catalog | ✅ PASS |
| All high/danger have requires_confirm | ✅ PASS |
| All high/danger have real_execution_supported=false | ✅ PASS |
| generates_media=true → calls_model or notes | ✅ PASS |
| Timer group commands have modifies_timer | ✅ PASS |
| Send confirmed has CQA_ALLOW_TELEGRAM_SEND | ✅ PASS |
| Image confirmed has CQA_ALLOW_GENERATION | ✅ PASS |
| No API key value patterns | ✅ PASS |
| No .env paths in commands | ✅ PASS |
| All commands have execution_mode | ✅ PASS |
| All commands have audit_required | ✅ PASS |
| Generated and final catalogs identical | ✅ PASS |
| All real_execution_supported=false | ✅ PASS |
| Version and phase set (5C-3) | ✅ PASS |

## VALIDATION_RESULTS

- `validate:control-server`: 20/20 PASS (regression)
- `validate:control-actions-dry-run`: 19/19 PASS (regression)
- `validate:control-readonly-actions`: 21/21 PASS (regression)
- `dashboard:control:drift-check`: 18/18 PASS (new)

## MODEL_CALL_STATUS

- MiniMax called: **No**
- Image model called: **No**
- Video model called: **No**
- Music model called: **No**
- LLM called: **No**

## GENERATED_MEDIA_STATUS

- No new media files generated
- No images, music, or video

## LIMITATIONS

1. **Auto-generated labels are basic** — Labels are derived from script names (e.g., "Collect: Fresh: Fast"). Manual Chinese descriptions are lost for replaced commands. Future phases could add manual override merging.
2. **No automatic handler generation** — Phase 5C-2B read-only handlers are manually coded. Phase 5C-4 could auto-generate safe_readonly handlers from catalog metadata.
3. **Policy is still manual** — Rules in `control-policy.json` must be maintained. New scripts need new rules or they fall to default policy (disabled, needs review).
4. **No automatic grouping optimization** — Grouping is based on simple keyword matching. Complex cross-functional scripts may be miscategorized.
5. **No command execution yet** — All `real_execution_supported=false`. Real execution requires Phase 5C-2C.
6. **Single token auth** — No per-user or rotating tokens.
7. **No rate limiting** — localhost-only makes brute-force less likely.

## NEXT_PHASE_PROPOSAL

**Phase 5C-2C (proposed): Confirmed Low-risk Command Execution**
- `POST /api/action/execute` for `safe` risk-level commands
- Auth token + confirmation required
- Audit log marks `mode: "execute"`
- Still no `child_process`/`exec`/`spawn` for safe commands
- 2FA/OTP for `high` and `danger` commands

**Phase 5C-4 (proposed): Auto-generated Safe-readonly Handlers**
- Auto-generate `handleReadOnly` cases from catalog metadata
- Walk `control-catalog.json` and generate TypeScript handlers
- Eliminate manual handler coding for new read-only queries

**Phase 4J (longer-term): Audio Coupling**
- Auto-stitch video (8s looped) + music (60-90s) for unified pack audio

Phase 5C-3: PASS
