# Creative Quota Harvester

**AI-powered signal collection and creative brief pipeline.**

> Transforms real-world signals from 7+ sources into reusable Creative Briefs and Content Packs — ready for image, video, music, and webpage generation.

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/conanxin/creative-quota-harvester/blob/main/LICENSE)
[![Phase 2C](https://img.shields.io/badge/Phase-2C-blue.svg)](https://github.com/conanxin/creative-quota-harvester/blob/main/ROADMAP.md)

## What It Does

```
Signal Collection → Scoring → Creative Brief → Content Pack → Asset Generation (Phase 3A)
```

1. **Collects signals** from 7+ sources (arXiv, HuggingFace, GitHub, HN, GDELT, Smithsonian, RSS)
2. **Scores on 5 dimensions** — freshness, relevance, visual potential, social reach, creative angle
3. **Generates creative briefs** — template-based, no LLM call required
4. **Exports content packs** — self-contained bundles with prompts, facts, and asset plans
5. **(Phase 3A) Generates assets** — images, music, video via MiniMax API quota

## Project Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0A–2B | ✅ Complete | Signal collection through asset gallery |
| **Phase 2C** | **✅ Complete** | **GitHub open source publish** |
| Phase 3A | ✅ Complete | MiniMax image canary (1 image generated) |
| Phase 3B | ✅ Complete | Telegram daily digest pipeline |
| Phase 3B-1 | ✅ Complete | Daily digest quality patch (dedup + structured counting) |
| Phase 3B-2 | ✅ Complete | Telegram digest delivery contract patch |
| Phase 3A Full | ✅ Complete | Batch image generation (2 images generated) |
| Phase 3C | ✅ Complete | MiniMax quota guard + explicit generation command |
| Phase 4A | ✅ Complete | Manual daily digest runbook |
| Phase 4B-1 | ✅ Complete | Timer enabled, daily 07:30 CST, no MiniMax |
| Phase 4C | ✅ Complete | Gallery UI refresh (mobile + sections) |
| Phase 4D | ✅ Complete | Content pack detail enrichment (summary + facts) |
| **Phase 4D-1** | **✅ Complete** | **Content Pack human-readable detail pages (index.html)** |
| Phase 4D-2 | ✅ Complete | Gallery dedup (25 packs → 5 unique topics) |
| **Phase 4C-5** | **✅ Complete** | **Adapter parallelization & query reduction (fast profile, 30→86 signals)** |
| Phase 4E | ✅ Complete | Daily calendar archive |
| Phase 4F | ✅ Complete | Facts enrichment from public sources |
| Phase 4G | ✅ Complete | Source-aware image prompt enhancement |
| Phase 3D | ✅ Complete | Controlled image batch with guard |
| Phase 3E | ✅ Complete | Image quality review & asset scoring (5 dims, 20pts each) |
| **Phase 5A** | **✅ Complete** | **Harvester Read-only Dashboard (timer + guard + assets)** |
| **Phase 4H** | **✅ Complete** | **Source-aware video prompt enhancement (25 packs × 3 files)** |
| **Phase 4I** | **✅ Complete** | **Source-aware music prompt enhancement (25 packs × 3 files)** |
| **Phase 4I-1** | **✅ Complete** | **Music metadata naming & sanitizer scope fix (MiniMax product name allowed)** |
| **Phase 5C-0** | **✅ Complete** | **Private Control Command Catalog (read-only, no execution, 25 commands × 6 groups)** |
| **Phase 5C-1** | **✅ Complete** | **localhost-only Private Control Server (127.0.0.1:8788, read-only, no command execution)** |
| **Phase 5C-2A** | **✅ Complete** | **Authenticated Control Actions Dry-run (auth + confirm + audit, no real execution)** |
| **Phase 5C-2B** | **✅ Complete** | **Safe Read-only Action Execution (read-only queries, no side effects, no model calls)** |
| **Phase 5C-3** | **✅ Complete** | **Auto-generated Control Catalog from package.json scripts (policy-driven, drift-check)** |
| **Phase 5C-4** | **✅ Complete** | **Policy Review UI (auto-generated policy analysis, future execution candidates, never-execute list)** |
| **Phase 5C-2C-A** | **✅ Complete** | **Confirmed Low-risk Execution Canary (5 safe validation scripts, spawn(shell=false), 60s timeout, 12K output limit)** |
| **Phase 5C-2C-A1** | **✅ Complete** | **Policy Review Validation Fix (dynamic never_execute, confirmed_low_risk=5, allowlist validation, 34/34 PASS)** |
| **Phase 5C-2C-A2** | **✅ Complete** | **Sanitizer False Positive Fix for sk- Pattern (negative lookbehind, 25/25 false-positive tests, 43/43 sanitizer tests)** |
| **Phase 5C-2C-A3** | **✅ Complete** | **Secret Redaction Completeness Check (colon fix, CQA_CONTROL_TOKEN, standalone Telegram token, 36/36 PASS)** |

See [ROADMAP.md](./ROADMAP.md) for full phase history.

## Two-Repository Architecture

| Repository | Purpose |
|------------|---------|
| `creative-quota-harvester` | Main program: source adapters, signal pipeline, brief engine |
| `creative-quota-assets` | Open asset library: content packs, gallery, generated media |

## Quick Start

```bash
cd creative-quota-harvester
npm install
npm run collect      # Collect signals from all sources
npm run briefs       # Generate briefs + content packs
npm run digest:telegram     # Generate Telegram daily digest
npm run digest:telegram:check  # Validate digest
npm run daily:manual  # One-command daily run (collect → briefs → digest → check)
```

## Information Sources

| Source | Type | Status |
|--------|------|--------|
| arXiv AI | Academic | ✅ Working |
| GitHub Open Source Radar | Code | ✅ Working |
| Hacker News | Dev Community | ✅ Working |
| Hugging Face Hub | AI Ecosystem | ✅ Working (curl fallback) |
| The Met Collection | Culture/Art | ✅ Working |
| GDELT | News | ⚠️ Rate-limited (graceful degradation) |
| Smithsonian | Culture/Art | ✅ Working |
| RSS | News | ✅ Working |

**Explicitly excluded:** All `conanxin/*` repositories — external repos only.

See [docs/SOURCE_ADAPTERS.md](./docs/SOURCE_ADAPTERS.md) for full adapter specs.

## Core Data Model

```
SourceRecord → SignalRecord → CreativeBrief → AssetPlan → GenerationJob → AssetRecord → ContentPackManifest
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md#data-model) for entity definitions.

## Documentation

| Doc | Purpose |
|-----|---------|
| [ROADMAP.md](./ROADMAP.md) | Full phase history and version log |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design and data model |
| [docs/SOURCE_ADAPTERS.md](./docs/SOURCE_ADAPTERS.md) | Source adapter specifications |
| [docs/PHASE_1R_SOURCE_RELIABILITY_REPORT.md](./docs/PHASE_1R_SOURCE_RELIABILITY_REPORT.md) | Source reliability and fallback chains |
| [docs/PHASE_2A_CREATIVE_BRIEF_ENGINE_REPORT.md](./docs/PHASE_2A_CREATIVE_BRIEF_ENGINE_REPORT.md) | Brief engine documentation |
| [docs/TELEGRAM_FINAL_REPLY_CONTRACT.md](./docs/TELEGRAM_FINAL_REPLY_CONTRACT.md) | Telegram output specification |
| [docs/PHASE_5C0_PRIVATE_CONTROL_COMMAND_CATALOG_REPORT.md](./docs/PHASE_5C0_PRIVATE_CONTROL_COMMAND_CATALOG_REPORT.md) | Private control command catalog (Phase 5C-0) |
| [docs/PHASE_5C1_LOCALHOST_PRIVATE_CONTROL_SERVER_REPORT.md](./docs/PHASE_5C1_LOCALHOST_PRIVATE_CONTROL_SERVER_REPORT.md) | Private control server (Phase 5C-1) |
| [docs/PHASE_5C2A_AUTH_CONTROL_DRY_RUN_REPORT.md](./docs/PHASE_5C2A_AUTH_CONTROL_DRY_RUN_REPORT.md) | Authenticated control actions dry-run (Phase 5C-2A) |
| [docs/PHASE_5C2B_SAFE_READONLY_ACTIONS_REPORT.md](./docs/PHASE_5C2B_SAFE_READONLY_ACTIONS_REPORT.md) | Safe read-only action execution (Phase 5C-2B) |
| [docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md](./docs/PRIVATE_CONTROL_SERVER_RUNBOOK.md) | Operator runbook for the control server |

## Private Control Command Catalog (Phase 5C-0)

The harvester exposes a **read-only command catalog** at `dashboard/control.html`. It documents every control action in the system, the corresponding shell/npm command, risk level, and safety requirements.

**This is documentation only.** The page cannot execute any command:
- No `<button>` elements
- No `fetch POST`, no `WebSocket`, no `child_process`
- Command text is in plain text/code blocks (manual copy only)
- High/danger commands require `CQA_ALLOW_*` env flags

Public GitHub Pages deployment only **displays** the catalog; it has no execution capability. Real control surfaces (Phase 5C-1 localhost-only server / Phase 5C-2 authenticated dashboard) are out of scope for Phase 5C-0 and will be guarded with additional authentication.

## Private Control Server (Phase 5C-1)

A **localhost-only HTTP server** (`127.0.0.1:8788`) that exposes dashboard status, control catalog, and whitelisted reports in a read-only format.

```bash
npm run control:server      # start server
npm run control:server:smoke # run smoke test
```

**This server does not execute commands:**
- Only accepts GET (405 for everything else)
- No `child_process`, no `exec`, no `spawn`
- No `.env` reading, no token exposure
- Path traversal blocked (`..` → 400)
- Report whitelist enforced (24 named reports only)

Remote access requires SSH port forward:
```bash
ssh -L 8788:127.0.0.1:8788 user@your-server
```

## Authenticated Control Actions Dry-run (Phase 5C-2A)

Phase 5C-2A adds **authenticated dry-run actions** to the localhost-only control server. It validates auth tokens, confirmation phrases, and risk levels — but **never executes any command**.

```bash
# Configure auth
cat > .control.local << 'EOF'
CQA_CONTROL_TOKEN=your-secret-token
CQA_CONTROL_ENABLE_ACTIONS=1
EOF

# Start server
npm run control:server

# Dry-run a safe action
curl -s -X POST http://127.0.0.1:8788/api/action/dry-run \
  -H "Content-Type: application/json" \
  -d '{"action_id":"run_manual_digest","confirm_phrase":"dry-run-safe","token":"your-secret-token"}'
```

**All responses have `real_execution: false`.** No `child_process`, no `exec`, no `spawn`. Audit logs go to `reports/control-action-audit.jsonl` (git-ignored, no secrets).

Real execution is planned for Phase 5C-2B (safe read-only queries) and Phase 5C-2C (confirmed high/danger commands).

## Safe Read-only Action Execution (Phase 5C-2B)

Phase 5C-2B adds **safe read-only queries** to the localhost-only control server. These endpoints read existing system state data without executing commands, calling models, or modifying files.

```bash
# Query system status (reads dashboard/status.json)
curl -s -X POST http://127.0.0.1:8788/api/action/read-only \
  -H "Content-Type: application/json" \
  -d '{"action_id":"get_status","token":"your-secret-token"}'

# Query source health (reads reports/source-health.*)
curl -s -X POST http://127.0.0.1:8788/api/action/read-only \
  -H "Content-Type: application/json" \
  -d '{"action_id":"get_source_health","token":"your-secret-token"}'

# Query timer snapshot (reads dashboard/status.json timer fields)
curl -s -X POST http://127.0.0.1:8788/api/action/read-only \
  -H "Content-Type: application/json" \
  -d '{"action_id":"get_timer_snapshot","token":"your-secret-token"}'

# Query dashboard links (static data, no file read)
curl -s -X POST http://127.0.0.1:8788/api/action/read-only \
  -H "Content-Type: application/json" \
  -d '{"action_id":"get_dashboard_links","token":"your-secret-token"}'
```

**All responses have `real_execution: false` and `side_effects: false`.** No `child_process`, no `exec`, no `spawn`, no file writes, no network calls. Only `safeReadJson` and `safeReadText` are used.

Available read-only actions: `get_status`, `get_source_health`, `get_latest_digest`, `get_generation_queue`, `get_asset_summary`, `get_timer_snapshot`, `get_dashboard_links`.

## GitHub Repos

| Repo | URL |
|------|-----|
| `creative-quota-harvester` | https://github.com/conanxin/creative-quota-harvester |
| `creative-quota-assets` | https://github.com/conanxin/creative-quota-assets |
| Assets Gallery (GitHub Pages) | https://conanxin.github.io/creative-quota-assets/gallery/ |

## License

MIT — see [LICENSE](./LICENSE)
