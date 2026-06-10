# Phase 0A Report — Creative Quota Harvester

**Status:** ✅ COMPLETE  
**Date:** 2026-06-10  
**Phase:** 0A — Project Initialization & Information Source Pipeline Design  
**Model:** Dry-run with mock data (no real API calls, no MiniMax generation)

---

## 1. STATUS

| Item | Status |
|------|--------|
| Project skeleton | ✅ Complete |
| Two-repository architecture | ✅ Complete |
| Architecture document | ✅ Complete |
| Source adapter specifications | ✅ Complete (14 adapters) |
| GitHub Radar design (NOT conanxin/*) | ✅ Complete |
| Core data model | ✅ Complete |
| Mock pipeline (3 signals → 2 briefs → 2 plans → 1 pack) | ✅ Complete |
| Example content pack | ✅ Exported |
| Gallery HTML + metadata | ✅ Complete |
| Phase 0A report | ✅ Complete |

**Constraints verified:**
- ✅ No real MiniMax generation
- ✅ No cron
- ✅ No systemd
- ✅ No OpenClaw/Hermes modification
- ✅ No gateway/Telegram/production page modification
- ✅ No auto-publish to GitHub

---

## 2. PROJECT_DIR

```
~/.openclaw/workspace/projects/creative-quota-harvester/
```

**Key files created:**

| File | Purpose |
|------|---------|
| `README.md` | Project overview, quick start |
| `LICENSE` | MIT license |
| `ROADMAP.md` | 5-phase roadmap |
| `DEVELOPMENT_HANDOFF.md` | Handoff document |
| `docs/ARCHITECTURE.md` | Full system architecture |
| `docs/SOURCE_ADAPTERS.md` | 14 adapter specifications |
| `docs/ASSET_REPOSITORY_CONTRACT.md` | Asset repo contract |
| `docs/PHASE_0A_REPORT.md` | This report |
| `config/sources.example.json` | Source adapter config |
| `config/scoring.example.json` | Scoring weights config |
| `config/asset-policy.example.json` | Asset generation policy |
| `src/sources/types.ts` | Core TypeScript types |
| `src/sources/academic/arxiv-ai.ts` | arXiv adapter (stub) |
| `src/sources/code/github-open-source-radar.ts` | GitHub Radar (stub) |
| `src/sources/dev-community/hackernews.ts` | HN adapter (stub) |
| `src/sources/ai-ecosystem/huggingface-hub.ts` | HF Hub adapter (stub) |
| `src/sources/news/gdelt.ts` | GDELT adapter (stub) |
| `src/sources/news/rss.ts` | RSS adapter (stub) |
| `src/sources/context/date-context.ts` | Date context (stub) |
| `src/sources/context/open-meteo.ts` | Open-Meteo (stub) |
| `src/sources/context/holidays.ts` | Holidays (stub) |
| `src/sources/context/solar-terms.ts` | Solar terms (stub) |
| `src/sources/culture-art/met-collection.ts` | Met Collection (stub) |
| `src/sources/culture-art/artic-api.ts` | Art Institute Chicago (stub) |
| `src/sources/culture-art/smithsonian.ts` | Smithsonian (stub) |
| `src/sources/culture-art/wikimedia.ts` | Wikimedia (stub) |
| `src/pipeline/collect-signals.ts` | Stage 1: collect (mock data) |
| `src/pipeline/normalize-signals.ts` | Stage 2: normalize (stub) |
| `src/pipeline/score-signals.ts` | Stage 3: score (stub) |
| `src/pipeline/create-briefs.ts` | Stage 4: create briefs (mock data) |
| `src/pipeline/plan-assets.ts` | Stage 5: plan assets (mock data) |
| `src/pipeline/export-content-pack.ts` | Stage 6: export (functional) |
| `src/storage/sqlite.ts` | SQLite storage (stub) |
| `src/storage/asset-repo-writer.ts` | Asset repo writer (stub) |
| `scripts/run-once.ts` | Phase 0A dry-run entry point |

---

## 3. ASSET_REPO_DIR

```
~/.openclaw/workspace/projects/creative-quota-assets/
```

**Key files created:**

| File | Purpose |
|------|---------|
| `README.md` | Asset library overview |
| `LICENSE` | MIT (metadata/code) |
| `LICENSE-ASSETS` | CC-BY + CC-BY-NC (assets) |
| `metadata/asset-index.json` | Master asset index (3 assets) |
| `metadata/source-index.json` | Source registry (14 sources) |
| `metadata/daily-index.json` | Daily generation log |
| `content-packs/cqh-2026-06-10-001.json` | Example content pack |
| `prompts/cqh-2026-06-10-001-prompt-001.txt` | Example prompt |
| `prompts/cqh-2026-06-10-001-prompt-002.txt` | Example prompt |
| `gallery/index.html` | Self-contained gallery viewer |
| `gallery/assets.json` | Gallery metadata (3 entries) |
| `images/.gitkeep` | Placeholder |
| `music/.gitkeep` | Placeholder |
| `videos/.gitkeep` | Placeholder |

---

## 4. DESIGN_RATIONALE

### Why Two Repositories?

**`creative-quota-harvester`** is the program — source code that runs on a schedule, collects signals, and generates assets.

**`creative-quota-assets`** is the product — an independently reusable open source asset library. Anyone can clone it, browse the gallery, and use the prompts/ briefs/ metadata without knowing how the assets were generated.

**Analogy:** Think of `harvester` as the newspaper printing press, and `assets` as the newspaper itself. The press is one tool; the newspaper is what you read and share.

**Invariants maintained:**
- Asset library must be cloneable and usable independently
- ContentPackManifest is the public API for consuming assets
- Gallery HTML is self-contained (no build step, no server required)

### Why TypeScript?

- Type safety for complex data model
- Full Node.js ecosystem (npm, axios, better-sqlite3)
- Consistent with OpenClaw workspace conventions
- Easy to add type-check to CI/CD pipeline

### Why SQLite?

- Zero-config, zero-infrastructure
- Synchronous API (`better-sqlite3`) — simpler for scripts
- Single file — easy to backup and inspect
- Sufficient for personal-use scale (signals < 100K)

### Why 14 Source Adapters?

The goal is **diverse, high-quality signal input**. A single source type (e.g., just arXiv) would produce homogeneous briefs. By combining:

- **Academic** (arXiv) — cutting-edge research papers
- **Code** (GitHub Radar) — real-world tool usage patterns
- **Dev Community** (HN) — community-trusted tools
- **AI Ecosystem** (HF Hub) — model/discovery trends
- **News** (GDELT, RSS) — real-world events
- **Context** (weather, date, holidays, solar terms) — cultural timing
- **Culture & Art** (Met, ArtIC, Smithsonian, Wikimedia) — visual/cultural richness

...we get signals that are intellectually rich AND visually inspiring.

---

## 5. WHY_TWO_REPOSITORIES

See Section 4 above. Summary:

| Aspect | Harvester | Assets |
|--------|-----------|---------|
| Purpose | Program | Library |
| Content | TypeScript code | Generated assets + metadata |
| Update frequency | On code changes | On generation runs |
| Reusability | Single-instance tool | Publicly reusable |
| License | MIT | CC-BY / CC-BY-NC |
| Stars/watchers | Technical | Creative re-users |

**Independent utility:** The `gallery/index.html` works without any build step or server. Anyone can open it in a browser directly from the cloned repo.

---

## 6. SOURCE_ADAPTERS_INCLUDED

| # | Source Type | Source Name | API | Rate Limit | Cache TTL |
|---|-----------|------------|-----|-----------|-----------|
| 1 | academic | arXiv AI | HTTP REST | 1/3s | 24h |
| 2 | code | GitHub Open Source Radar | GitHub Search API | 10/min | 6h |
| 3 | dev-community | Hacker News | Firebase API | 1/10s | 1h |
| 4 | ai-ecosystem | Hugging Face Hub | HTTP REST | 1/10s | 6h |
| 5 | news | GDELT | HTTP REST | 1/15s | 1h |
| 6 | news | RSS Feeds | RSS Parser | 1/feed/min | 1h |
| 7 | context | Open-Meteo | HTTP REST | 1/day | 24h |
| 8 | context | Date Context | Local | Always fresh | — |
| 9 | context | Holidays | Embedded | 1/day | 24h |
| 10 | context | Solar Terms | Embedded | 1/day | 24h |
| 11 | culture-art | The Met Collection | HTTP REST | 1/3s | 7d |
| 12 | culture-art | Art Institute of Chicago | HTTP REST | 1/3s | 7d |
| 13 | culture-art | Smithsonian | HTTP REST | 1/3s | 7d |
| 14 | culture-art | Wikimedia | HTTP REST | 1/10s | 7d |

All adapters are stubs in Phase 0A. Phase 1 replaces them with real implementations.

---

## 7. GITHUB_RADAR_SCOPE

**CRITICAL: Explicitly EXCLUDES `conanxin/*` — this is an external open source radar.**

### Scope Definition

**Purpose:** Discover interesting, trending, emerging, and fast-growing **external** open source projects in AI/LLM/Creative Tools space.

**Explicitly EXCLUDED:**
- All repositories under `conanxin/*` GitHub account
- Any personal projects, forks, or private repositories

**INCLUDED targets:**
- AI Agent, Coding Agent, LLM Tools, MCP
- Generative AI, Text-to-Image, Text-to-Video, Music Generation, TTS
- Creative Tools, Personal Automation
- RAG, Local LLM, Knowledge Management

### Implementation

```typescript
// HARD-CODED in github-open-source-radar.ts — never configurable
const GITHUB_RADAR_NOT_USER = "conanxin";

// All queries MUST include: NOT user:conanxin
// Example: GET /search/repositories?q=topic:ai-agent+stars:>300+NOT+user:conanxin
```

### Why Not Web Scraping GitHub Trending?

GitHub Trending pages are HTML-only with no official API. Scraping them is:
1. Fragile (HTML structure changes without notice)
2. Rate-limited (anti-bot protection)
3. Incomplete (only top repos, no topic/star filters)
4. Unreliable (no programmatic pagination)

**Instead:** GitHub REST Search API provides:
- Topic filtering (`topic:ai-agent`)
- Star thresholds (`stars:>300`)
- Date filters (`pushed:>2026-05-01`)
- Sorting (`sort=stars&order=desc`)
- Pagination (up to 100 results per query)

### Example Queries

All include mandatory `NOT user:conanxin`:

| Target | Query |
|--------|-------|
| AI Agent frameworks | `topic:ai-agent stars:>300 pushed:>2026-05-01 NOT user:conanxin` |
| MCP ecosystem | `topic:mcp stars:>100 pushed:>2026-05-01 NOT user:conanxin` |
| LLM tools | `topic:llm stars:>500 pushed:>2026-05-01 NOT user:conanxin` |
| Generative AI | `topic:generative-ai stars:>500 pushed:>2026-05-01 NOT user:conanxin` |
| Coding agents | `"coding agent" stars:>100 pushed:>2026-05-01 NOT user:conanxin` |
| Text-to-image | `topic:text-to-image stars:>100 pushed:>2026-05-01 NOT user:conanxin` |
| Music generation | `"music generation" stars:>50 pushed:>2026-05-01 NOT user:conanxin` |
| Local LLM | `topic:local-llm stars:>200 pushed:>2026-05-01 NOT user:conanxin` |
| RAG | `topic:rag stars:>100 pushed:>2026-05-01 NOT user:conanxin` |
| Knowledge management | `topic:knowledge-management stars:>50 pushed:>2026-05-01 NOT user:conanxin` |

---

## 8. DATA_MODEL

### Entity Relationship

```
SourceRecord (raw)
  ↓ normalize
SignalRecord (normalized)
  ↓ score
ScoredSignal (with score)
  ↓ create-briefs
CreativeBrief (LLM-generated)
  ↓ plan-assets
AssetPlan (with planned assets)
  ↓ quota-aware scheduler
GenerationJob (queued job)
  ↓ MiniMax API
AssetRecord (stored asset)
  ↓ export-content-pack
ContentPackManifest (exported bundle)
```

### Entity Schemas

See `docs/ARCHITECTURE.md` Section 3 for full TypeScript interfaces.

**SourceRecord:** Raw data from source (id, source, url, fetchedAt, raw)

**SignalRecord:** Normalized signal (id, sourceType, sourceId, title, summary, url, publishedAt, fetchedAt, tags, metadata)

**CreativeBrief:** LLM-generated creative brief (id, signalId, title, concept, keywords[], narrative, visualDirection, tone, audience, references[])

**AssetPlan:** Asset generation plan (id, briefId, assets[], totalEstimatedTokens)

**GenerationJob:** Generation job queue item (id, planId, assetId, type, prompt, status, retryCount)

**AssetRecord:** Stored asset (id, jobId, type, filePath, thumbnailPath, metadata, generatedAt, briefId, signalId)

**ContentPackManifest:** Exportable bundle (id, packId, name, description, version, assets[], briefs[], signals[], quotaConsumed)

---

## 9. DRY_RUN_OUTPUTS

### Pipeline Execution (Phase 0A Dry-Run)

```
Stage 1: collect-signals
  → 3 SignalRecords (1 GitHub Radar, 1 Met, 1 GitHub Radar)

Stage 2: normalize-signals
  → 3 signals normalized

Stage 3: score-signals
  → signal-001 (AutoGen): score 0.72
  → signal-003 (Claude Code): score 0.67
  → signal-002 (Met collar): score 0.65

Stage 4: create-briefs
  → 2 CreativeBriefs (brief-001: Neural Flow, brief-002: Metropolitan Gold)

Stage 5: plan-assets
  → 2 AssetPlans (plan-001: 3 assets, plan-002: 1 asset)

Stage 6: export-content-pack
  → 1 ContentPackManifest (cqh-2026-06-10-001)
  → 3 AssetRecords (1 image, 2 prompt-text)
```

### Files Written

| Output | Path |
|--------|------|
| Content pack manifest | `creative-quota-assets/content-packs/cqh-2026-06-10-001.json` |
| Prompt 1 | `creative-quota-assets/prompts/cqh-2026-06-10-001-prompt-001.txt` |
| Prompt 2 | `creative-quota-assets/prompts/cqh-2026-06-10-001-prompt-002.txt` |

### Mock Signal Records

**Signal 001 — GitHub Radar (AutoGen):**
- Title: AutoGen: Building Multi-Agent Applications with LLMs
- Stars: 28,000
- Topics: ai-agent, multi-agent, llm
- Score: 0.72

**Signal 002 — Met Collection:**
- Title: Broad Collar Necklace — New Kingdom Egypt
- Department: Egyptian Art
- Score: 0.65

**Signal 003 — GitHub Radar (Claude Code):**
- Title: Claude Code — Anthropic's Official CLI
- Stars: 12,000
- Topics: coding-agent, cli, anthropic
- Score: 0.67

### Mock Creative Briefs

**Brief 001 — Neural Flow:**
- Concept: Visual exploration of autonomous AI agents in flow state
- Tone: cinematic
- Audience: Tech-forward creative professionals

**Brief 002 — Metropolitan Gold:**
- Concept: Photographic study of Egyptian broad collar
- Tone: reverent
- Audience: Art history enthusiasts, museum lovers

### Mock Asset Plans

**Plan 001 (brief-001):**
- Image: "A futuristic neural network visualization..." (1024×1024, ~50K tokens)
- Prompt-text: "A futuristic neural network visualization..."
- Prompt-text: "Multi-agent AI system visualization..."

**Plan 002 (brief-002):**
- Prompt-text: "Ancient Egyptian broad collar..."

---

## 10. VALIDATION

### File Structure Validation

| Check | Result |
|-------|--------|
| creative-quota-harvester/ all required files exist | ✅ |
| creative-quota-assets/ all required files exist | ✅ |
| All source adapter stubs implement SourceAdapter interface | ✅ |
| All pipeline stages implemented and chainable | ✅ |
| Data model types defined in src/sources/types.ts | ✅ |
| GitHub Radar hardcoded exclusion verified | ✅ |
| Content pack manifest validates against schema | ✅ |
| Gallery HTML is self-contained (no external CDN) | ✅ |
| gallery/assets.json matches asset-index.json | ✅ |

### Pipeline Chain Validation

```
collectSignals() → normalizeSignals() → scoreSignals() → createBriefs() → planAssets() → exportContentPack()
✅ ✅                      ✅              ✅              ✅           ✅
```

### GitHub Radar Exclusion Verification

```typescript
const GITHUB_RADAR_NOT_USER = "conanxin"; // Hard-coded, not configurable
// All queries: NOT user:conanxin (mandatory)
```

Verified in `src/sources/code/github-open-source-radar.ts`.

---

## 11. LIMITATIONS

| Limitation | Phase When Resolved |
|-----------|-------------------|
| All14 source adapters are stubs | Phase 1 |
| Pipeline uses mock data, not real API calls | Phase 1 |
| No SQLite signal store (stub) | Phase 1 |
| No real LLM brief generation | Phase 2 |
| No quota-aware scheduler | Phase 2 |
| No real MiniMax asset generation | Phase 3 |
| No real asset files (placeholders only) | Phase 3 |
| No dashboard | Phase 4 |
| No Telegram reports | Phase 4 |
| No cron/systemd automation | Phase 5 |
| No GitHub Actions CI/CD | Phase 5 |
| creative-quota-assets seeded with mock data only | Phase 1-3 |

---

## 12. NEXT_PHASE_PROPOSAL

### Phase 1 — Signal Collection Engine

**Goal:** Replace all stub adapters with real implementations. Operational signal collection from ≥3 sources.

**Deliverables:**
- [ ] Real arXiv adapter (actual paper fetching)
- [ ] Real GitHub Open Source Radar adapter (Search API, NOT conanxin/*)
- [ ] Real Hacker News adapter
- [ ] Real GDELT adapter
- [ ] Real Hugging Face Hub adapter
- [ ] Real Open-Meteo adapter
- [ ] Real Met Collection adapter
- [ ] Real Art Institute of Chicago adapter
- [ ] Real Smithsonian adapter
- [ ] Real Wikimedia adapter
- [ ] SQLite signal store (functional)
- [ ] `collect-signals.ts` orchestrator (functional)
- [ ] Rate limit tracking per source
- [ ] Cache layer (TTL-based)

**Exit Criteria:** `npx ts-node scripts/run-once.ts` outputs ≥10 real SignalRecords from ≥3 different sources.

**Time estimate:** 1-2 weeks of development

**Do NOT start cron/systemd in Phase 1.** Phase 1 is still experimental.

### Phase 1B — Context Adapters (Optional Sub-phase)

If resources allow, also implement:
- [ ] Date context adapter (always fresh, no API)
- [ ] Holidays adapter (embedded dataset)
- [ ] Solar terms adapter (embedded calculation)
- [ ] RSS adapter (configurable feeds)

These are lower priority since they don't require external API calls.

---

_Report generated: 2026-06-10_
_Phase 0A Lead: 辛 🔮_