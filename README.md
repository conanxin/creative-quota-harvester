# Creative Quota Harvester

**Transform real-world signals into reusable AI generation素材.**

> 不是随机消耗模型额度，而是基于真实信号生成 Creative Brief、Prompt、Content Pack，并在后续阶段根据 MiniMax Token Plan 剩余额度自动生成图片、音乐、视频等素材。

## Project Status

**Phase 0A** — Project Initialization & Information Source Pipeline Design  
Status: `IN_PROGRESS` | Dry-run with mock data

## Two-Repository Architecture

| Repository | Purpose |
|------------|---------|
| `creative-quota-harvester` | Main program: source adapters, signal pipeline, quota scheduler, dashboard, Telegram report |
| `creative-quota-assets` | Open asset library: generated prompts, briefs, metadata, content-packs, gallery |

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for full design rationale.

## Quick Start (Phase 0A Dry-Run)

```bash
cd creative-quota-harvester
npm install
npx ts-node scripts/run-once.ts
```

## Information Sources (Phase 0A)

- **Academic:** arXiv AI papers
- **Code:** GitHub Open Source Radar (external repos only, NOT conanxin/*)
- **Dev Community:** Hacker News
- **AI Ecosystem:** Hugging Face Hub
- **News:** GDELT + RSS
- **Context:** Open-Meteo, Date/Holidays/Solar Terms
- **Culture & Art:** The Met Collection, Art Institute of Chicago, Smithsonian Open Access, Wikimedia

See [docs/SOURCE_ADAPTERS.md](./docs/SOURCE_ADAPTERS.md) for adapter specifications.

## Core Data Model

```
SourceRecord → SignalRecord → CreativeBrief → AssetPlan → GenerationJob → AssetRecord → ContentPackManifest
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md#data-model) for entity definitions.

## GitHub Open Source Radar

**Scope:** Discovers interesting, trending, emerging, and fast-growing external open source projects on GitHub.

**Explicitly EXCLUDED:** All `conanxin/*` repositories — this is an external project radar, not a personal repo watcher.

**Target topics:** AI Agent, Coding Agent, LLM Tools, MCP, Generative AI, Text-to-Image, Text-to-Video, Music Generation, TTS, Creative Tools, Personal Automation, RAG, Local LLM, Knowledge Management

**Design:** Uses GitHub REST Search API with topic/keyword/stars/pushed filters. Low-frequency calls, cached results, rate limit tracking. No web scraping of GitHub Trending as primary source.

See [docs/SOURCE_ADAPTERS.md](./docs/SOURCE_ADAPTERS.md#github-open-source-radar) for full specification.

## Project Roadmap

See [ROADMAP.md](./ROADMAP.md).

## License

MIT — see [LICENSE](./LICENSE)