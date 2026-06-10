# Development Handoff — Creative Quota Harvester

**Last Updated:** 2026-06-10  
**Phase:** 0A (Project Initialization)  
**Status:** `IN_PROGRESS` — Dry-run with mock data

---

## Project Overview

**What it does:** Transforms real-world information signals into reusable AI generation materials (Creative Briefs, Prompts, Content Packs, then images/music/video) by harvesting from13+ sources and generating assets quota-aware based on MiniMax Token Plan.

**Why two repos:**
- `creative-quota-harvester` — main program (source adapters, pipeline, scheduler, dashboard)
- `creative-quota-assets` — open asset library (prompts, briefs, metadata, content-packs, gallery)

**GitHub Radar explicitly excludes `conanxin/*`** — this is an external open source radar, not a personal repo watcher.

---

## What Exists Now (Phase 0A)

### File Structure

```
creative-quota-harvester/
├── README.md, LICENSE, ROADMAP.md, DEVELOPMENT_HANDOFF.md
├── docs/
│   ├── ARCHITECTURE.md          ← Full system design
│   ├── SOURCE_ADAPTERS.md       ← 13 adapter specs
│   ├── ASSET_REPOSITORY_CONTRACT.md ← Asset repo contract
│   └── PHASE_0A_REPORT.md       ← This phase's report
├── config/
│   ├── sources.example.json     ← Source config template
│   ├── scoring.example.json     ← Scoring weights
│   └── asset-policy.example.json ← Asset generation policy
├── src/
│   ├── sources/                 ← 13 source adapter dirs (stub implementations)
│   ├── pipeline/               ← Pipeline stage files (stub implementations)
│   └── storage/                ← SQLite + asset-repo-writer (stub implementations)
└── scripts/
    └── run-once.ts             ← Main dry-run entry point

creative-quota-assets/
├── README.md, LICENSE, LICENSE-ASSETS.md
├── metadata/
│   ├── asset-index.json         ← Master asset index
│   ├── source-index.json        ← Source registry
│   └── daily-index.json         ← Daily generation log
├── content-packs/              ← Exported content packs
├── images/, music/, videos/, prompts/  ← Asset directories (empty)
└── gallery/
    ├── index.html               ← Gallery viewer
    └── assets.json              ← Gallery metadata
```

### Mock Outputs (from `scripts/run-once.ts`)

```
creative-quota-assets/
├── metadata/asset-index.json        ← 3 mock assets
├── metadata/daily-index.json        ← 1 daily entry
├── content-packs/
│   └── cqh-2026-06-10-phase0a.json ← 1 example content pack
└── gallery/
    ├── index.html ← Gallery HTML
    └── assets.json                  ← 3 gallery entries
```

---

## How to Run (Phase 0A Dry-Run)

```bash
cd ~/.openclaw/workspace/projects/creative-quota-harvester
# Install dependencies (Phase 1 will add real ones)
# For now: mock pipeline via:
npx ts-node scripts/run-once.ts
```

---

## Data Flow (Target)

```
SourceRecord[]
  ↓ collect-signals.ts
SignalRecord[]
  ↓ normalize-signals.ts
SignalRecord[] (normalized)
  ↓ score-signals.ts
ScoredSignal[]
  ↓ create-briefs.ts
CreativeBrief[]
  ↓ plan-assets.ts
AssetPlan[]
  ↓ [quota-aware scheduler]
GenerationJob[]
  ↓ MiniMax API (Phase 3+)
AssetRecord[]
  ↓ export-content-pack.ts
ContentPackManifest[]
  ↓ asset-repo-writer.ts
→ creative-quota-assets/
```

---

## Core Data Model

| Entity | Fields | Notes |
|---------|--------|-------|
| `SourceRecord` | id, source, url, fetchedAt, raw | Raw data from source |
| `SignalRecord` | id, sourceType, sourceId, title, summary, url, publishedAt, fetchedAt, tags, metadata | Normalized across sources |
| `CreativeBrief` | id, signalId, title, concept, keywords, narrative, visualDirection, tone, audience, references | LLM-generated |
| `AssetPlan` | id, briefId, assets[], priority, estimatedTokens, createdAt | Planned assets per brief |
| `GenerationJob` | id, planId, assetId, type, prompt, status, createdAt, startedAt, completedAt | Job queue item |
| `AssetRecord` | id, jobId, type, filePath, thumbnailPath, metadata, generatedAt, briefId, signalId | Stored asset |
| `ContentPackManifest` | id, packId, name, description, assets[], briefs[], createdAt, tags | Exportable bundle |

---

## GitHub Open Source Radar — Critical Design Rule

**SCOPE:** External open source projects only. **Explicitly EXCLUDED:** all `conanxin/*` repositories.

**Rationale:** This is a GitHub Open Source Radar for discovering interesting external projects in AI/LLM/Creative Tools space. A personal repo watcher belongs in a separate personal ops tool, not in a public open source project.

**Implementation:** GitHub REST Search API with `NOT user:conanxin` filter. No web scraping. Rate limit awareness.

**Search queries (examples):**
```
topic:ai-agent stars:>300 pushed:>2026-05-01
topic:llm stars:>500 pushed:>2026-05-01
topic:mcp stars:>100 pushed:>2026-05-01
topic:generative-ai stars:>500 pushed:>2026-05-01
"coding agent" stars:>100 pushed:>2026-05-01
"text to video" stars:>100 pushed:>2026-05-01
"music generation" stars:>50 pushed:>2026-05-01
```

---

## Configuration

All secrets/keys via environment variables:

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | GitHub API auth (Search API rate limit) |
| `MINIMAX_API_KEY` | MiniMax generation (Phase 3+) |
| `TELEGRAM_BOT_TOKEN` | Telegram reports (Phase 4+) |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for reports |

Config files in `config/*.example.json` are templates (no real keys).

---

## Next Steps (Phase 1)

1. Install real dependencies (`axios`, `better-sqlite3`, `dotenv`, etc.)
2. Implement real source adapters (arXiv, GitHub Radar, HN, GDELT, RSS, HF Hub, etc.)
3. Replace mock data with real API calls
4. Add SQLite signal store
5. `npm run collect` → ≥10 real SignalRecords from ≥3 sources

**Do NOT start cron/systemd in Phase 1.** Phase 1 is still experimental.

---

## Known Limitations (Phase 0A)

- All source adapters are stubs (Phase 1 replaces with real implementations)
- All pipeline stages are stubs (Phase 2 replaces with real LLM calls)
- No real MiniMax generation (Phase 3)
- No automation (Phase 5)
- creative-quota-assets is seeded with mock data only

---

## Key Files to Read Next

1. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Full system design
2. [docs/SOURCE_ADAPTERS.md](./docs/SOURCE_ADAPTERS.md) — All13 adapter specs
3. [docs/PHASE_0A_REPORT.md](./docs/PHASE_0A_REPORT.md) — This phase's complete report
4. [scripts/run-once.ts](./scripts/run-once.ts) — Main entry point (mock dry-run)