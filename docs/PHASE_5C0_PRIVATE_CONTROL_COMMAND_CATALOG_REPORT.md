# Phase 5C-0 — Private Control Dashboard Command Catalog

**Date:** 2026-06-13
**Phase:** 5C-0
**STATUS:** PASS

---

## WHAT_CHANGED

Phase 5C-0 introduces a **read-only command catalog** for the Creative Quota Harvester. The catalog lists every control action that exists in the system, with the corresponding shell/npm command, risk level, and safety requirements. The catalog is **display-only** — no command can be triggered from the public page.

New files (3 + report):
- `dashboard/control-catalog.json` — 25 commands across 6 groups (machine-readable)
- `dashboard/control.html` — read-only UI that renders the catalog (text-only, no buttons)
- `scripts/validate-control-catalog.ts` — 15 checks (catalog structure + HTML safety)
- `package.json` — `npm run dashboard:control:validate`

Modified:
- `dashboard/index.html` — added link to `control.html` with "🔒 私有控制目录（只读）" badge

---

## COMMAND_GROUPS

6 groups, 25 commands total:

| Group | Count | Examples |
|-------|------:|----------|
| 📅 Daily Digest | 5 | run_manual_digest, regenerate_digest, send_digest_dry_run, send_digest_confirmed, check_digest_freshness |
| 🌐 Source Collection | 4 | collect_fast, collect_full, collect_diagnose, show_source_health |
| 🎨 Asset Generation | 5 | image_dry_run, image_confirmed_1, image_confirmed_2, video_prompt_only, music_prompt_only |
| ✅ Validation | 5 | validate_assets, validate_gallery, validate_daily_archive, validate_dashboard, validate_telegram_sanitizer |
| ⏰ Timer | 4 | timer_status, timer_logs, timer_disable_command, timer_enable_command |
| 📨 Reports | 2 | send_project_report_dry_run, send_project_report_confirmed |

Each command has 12 fields: `id`, `label_zh`, `description_zh`, `command`, `risk_level`, `requires_confirm`, `requires_env[]`, `calls_model`, `generates_media`, `modifies_timer`, `public_safe`, `notes`.

## RISK_MODEL

Risk distribution: **safe=18, medium=4, high=2, danger=1**

| Risk | Definition | Examples |
|------|------------|----------|
| **safe** | Read-only / dry-run / validation. No side effects. | collect_diagnose, validate_*, image_dry_run, video_prompt_only, music_prompt_only |
| **medium** | Has observable side effects (file writes, network calls, message sends). Requires confirmation. | send_digest_confirmed, send_project_report_confirmed, collect_full, timer_enable_command |
| **high** | Triggers model calls (image generation). Requires CQA_ALLOW_GENERATION=1 and confirm_spend. | image_confirmed_1, image_confirmed_2 |
| **danger** | Modifies system-level state (timer/service). Requires double confirmation. | timer_disable_command |

Validator enforces: every `high` / `danger` command has `requires_confirm=true` ✓

## PUBLIC_SAFETY_MODEL

- **control.html is read-only by construction:**
  - No `<button>` elements (validator checked)
  - No `fetch POST` (only `fetch GET` for the catalog JSON)
  - No `new WebSocket`
  - No `exec()`, `child_process`, or `document.write`
  - All command text is in `<div class="cmd-code">` blocks with `user-select: all` (manual copy, no execution)
- **control-catalog.json contains no secrets:**
  - No `sk-...`, `ghp_...`, `xox[baprs]-...`
  - No `TELEGRAM_BOT_TOKEN=`, `MINIMAX_API_KEY=`, `*_API_KEY=` assignments
  - No `.env.telegram.local` content
  - No `[truncated]` markers
- **Public GitHub Pages is the deployment target** (conanxin.github.io/creative-quota-harvester/dashboard/control.html)
  - Public deployment cannot trigger any command
  - All trigger surfaces require a localhost server (Phase 5C-1) or authenticated dashboard (Phase 5C-2), both out of scope for Phase 5C-0

## VALIDATION_RESULTS

`npm run dashboard:control:validate`:

```
PASS  control-catalog.json: valid JSON (16542 chars)
PASS  control-catalog.json: no secret / token / .env leak
PASS  control-catalog.json: 6 command groups
PASS  control-catalog.json: all 25 commands structurally valid
PASS  control-catalog.json: risk distribution safe=18 medium=4 high=2 danger=1
PASS  control-catalog.json: 3 high/danger commands have requires_confirm=true
PASS  control.html: loaded (11672 chars)
PASS  control.html: contains "Creative Quota 私有控制目录"
PASS  control.html: contains "只读命令目录"
PASS  control.html: contains "不会执行任何命令"
PASS  control.html: contains "GitHub Pages"
PASS  control.html: no POST / WebSocket / exec / child_process / document.write in code
PASS  control.html: no <button> tags in DOM
PASS  control.html: no secret / token / [truncated]
PASS  control.html: references control-catalog.json via fetch
```

15/15 PASS. Other validators regression:
- `dashboard:validate` PASS — 22/22 (index.html still valid)
- `dashboard:build` PASS

## LOCAL_PREVIEW_RESULT

`python3 -m http.server 8767` started, checks:

- `curl -I /dashboard/control.html` → 200 OK, 12177 bytes
- `curl /dashboard/control.html` contains: "私有控制目录", "只读命令目录", "风险等级" ✓
- `curl /dashboard/control-catalog.json` → 200, valid JSON ✓

Server stopped after checks.

## MODEL_CALL_STATUS

- MiniMax called: **No**
- Image model called: **No**
- Video model called: **No**
- Music model called: **No**
- LLM called: **No**
- Any model call from the catalog or HTML page: **No** (catalog is just data + read-only DOM)

The catalog lists commands that *could* call models, but the public page itself never executes them.

## GENERATED_MEDIA_STATUS

- No new media files generated
- No images, music, or video
- Only text files (JSON catalog + HTML page + validator script + reports)

## LIMITATIONS

1. **No real execution yet** — Phase 5C-0 is documentation only. Real control requires Phase 5C-1 (localhost-only control server) or Phase 5C-2 (authenticated dashboard).
2. **No command-history view** — the catalog doesn't show which commands were last run. This is a Phase 5A dashboard feature that's already in `dashboard/status.json` but not surfaced in the control catalog.
3. **No per-user permissions** — currently a single global catalog. Multi-user scoping would be a Phase 5C-2 concern.
4. **No risk-based gating UI** — high-risk commands are visually styled but not interactive. Future phase could add a "read-only preview" step.
5. **Validation rules are heuristic** — the validator uses regex patterns that could be evaded by sophisticated encoding. Acceptable for the public Pages deployment where no execution path exists.
6. **Catalog is manually maintained** — `control-catalog.json` is hand-written. Drift between catalog and actual `package.json` scripts is possible. A future phase could auto-generate the catalog from `package.json`.

## NEXT_PHASE_PROPOSAL

**Phase 5C-1 (proposed): localhost-only Private Control Server**
- Bind to `127.0.0.1` only
- Express/Fastify server that wraps each catalog command behind a `POST /execute/:id` endpoint
- CORS locked to localhost
- Logs every invocation to `logs/control-server.log`
- Auth: simple shared-secret token (no user accounts)

**Phase 5C-2 (proposed): Authenticated Control Actions**
- Add per-command 2FA / OTP for `high` / `danger` commands
- Per-invocation signed receipt in JSON
- Per-user audit log
- Optional Telegram confirmation message before execution

**Phase 5C-3 (proposed): Auto-Generated Catalog**
- Walk `package.json` scripts and derive `command`, `risk_level` from naming conventions
- Compare with existing catalog; flag drift
- Add `npm run dashboard:control:sync` to regenerate

**Phase 4J (longer-term): Audio Coupling**
- Auto-stitch video (8s looped) + music (60-90s) for unified pack audio

Phase 5C-0: PASS
