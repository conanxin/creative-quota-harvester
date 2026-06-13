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

## GitHub Repos

| Repo | URL |
|------|-----|
| `creative-quota-harvester` | https://github.com/conanxin/creative-quota-harvester |
| `creative-quota-assets` | https://github.com/conanxin/creative-quota-assets |
| Assets Gallery (GitHub Pages) | https://conanxin.github.io/creative-quota-assets/gallery/ |

## License

MIT — see [LICENSE](./LICENSE)
