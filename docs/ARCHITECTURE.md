# Creative Quota Harvester — Architecture

**Version:** 0.1.0 | **Phase:** 0A | **Status:** `IN_PROGRESS`

---

## 1. Design Principles

| Principle | Implication |
|-----------|-------------|
| **Signal-driven, not random** | Assets are generated from real-world signals (papers, repos, news, art) — not arbitrary prompts |
| **Quota-aware generation** | MiniMax token budget is tracked per day/week; generation is scheduled when quota is available |
| **Two-repo architecture** | Harvester (program) and Assets (library) are separate so assets can be independently reused |
| **External-only GitHub Radar** | GitHub Open Source Radar discovers external projects; `conanxin/*` is explicitly excluded |
| **Provenance chain** | Every asset tracks: signal → brief → plan → job → record → content-pack |
| **Privacy-first** | No personal data harvested; all sources are public APIs |

---

## 2. SystemArchitecture

```
┌─────────────────────────────────────────────────────────────┐
│                    INFORMATION SOURCES                       │
│  arXiv │ GitHub Radar │ HN │ GDELT │ RSS │ HF Hub │ Meteo  │
│  DateContext │ Met │ ArtIC │ Smithsonian │ Wikimedia │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 PIPELINE (collect-signals.ts)                │
│  SourceRecord[] → collect → SignalRecord[]                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 PIPELINE (normalize-signals.ts)              │
│  SignalRecord[] → normalize → SignalRecord[] (clean)         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 PIPELINE (score-signals.ts)                  │
│  SignalRecord[] → score → ScoredSignal[]                     │
│  Scores: relevance × 0.4 + timeliness × 0.3 + creative × 0.3│
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 PIPELINE (create-briefs.ts)                  │
│  ScoredSignal[] → LLM → CreativeBrief[] │
│  Cache: brief cached by signalId (no re-generation)         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 PIPELINE (plan-assets.ts) │
│  CreativeBrief[] → AssetPlan[] │
│  Priority queue: score × quota_factor │
└──────────────────────────�┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              QUOTA-AWARE GENERATION SCHEDULER                │
│  AssetPlan[] → GenerationJob[] (quota budget check)         │
│  MiniMax Token Plan tracking: daily_remaining, weekly_limit │
└──────────────────────────┬──────────────────────────────────┘
                           │ generate (Phase 3+)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 ASSET STORAGE LAYER │
│  GenerationJob[] → AssetRecord[]                            │
│  → creative-quota-assets/ (images/, music/, videos/) │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              EXPORT (export-content-pack.ts) │
│  AssetRecord[] → ContentPackManifest[] │
│  → creative-quota-assets/content-packs/ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### SourceRecord
```typescript
interface SourceRecord {
  id: string; // UUID
  source: string;               // e.g. "arxiv", "github-radar", "hackernews"
  sourceType: string;           // e.g. "academic", "code", "news"
  url: string;                  // Original URL
  fetchedAt: string;            // ISO timestamp
  raw: Record<string, unknown>; // Raw payload from source
}
```

### SignalRecord
```typescript
interface SignalRecord {
  id: string;
  sourceType: string;
  sourceId: string; // ID within the source system
  title: string;
  summary: string;              // Normalized: 1-3 sentence summary
  url: string;
  publishedAt: string;          // When the signal was published (not fetched)
  fetchedAt: string;
  tags: string[];               // Normalized tags
  metadata: {
    stars?: number;             // GitHub stars (if applicable)
    citations?: number;         // arXiv citations (if applicable)
    views?: number;              // HN votes / GDELT mentions
    language?: string;          // Programming language
    topics?: string[];          // GitHub topics / HF tags
    [key: string]: unknown;
  };
}
```

### CreativeBrief
```typescript
interface CreativeBrief {
  id: string;
  signalId: string;
  title: string;                // Generated brief title
  concept: string;             // 1-2 sentence creative concept
  keywords: string[];          // 5-10 keywords for retrieval
  narrative: string;           // 2-3 paragraph narrative context
  visualDirection: string;      // Visual style guidance
  tone: string;                // e.g. "cinematic", "whimsical", "technical"
  audience: string;            // Target audience description
  references: {
    type: "image" | "music" | "video" | "text";
    description: string;
    url?: string;
  }[];
  createdAt: string;
  cached: boolean;             // true if re-used from cache
}
```

### AssetPlan
```typescript
interface AssetPlan {
  id: string;
  briefId: string;
  assets: {
    type: "image" | "music" | "video" | "prompt-text";
    priority: number;          // 1-5, 1=highest
    prompt: string;            // Generation prompt
    estimatedTokens: number;   // Estimated token cost
    style?: string;            // e.g. "photorealistic", "watercolor"
    duration?: number;         // For music/video (seconds)
    dimensions?: { width: number; height: number }; // For image
  }[];
  totalEstimatedTokens: number;
  createdAt: string;
}
```

### GenerationJob
```typescript
interface GenerationJob {
  id: string;
  planId: string;
  assetId: string;
  type: "image" | "music" | "video" | "prompt-text";
  prompt: string;
  status: "pending" | "queued" | "running" | "done" | "failed" | "skipped";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
}
```

### AssetRecord
```typescript
interface AssetRecord {
  id: string;
  jobId: string;
  type: "image" | "music" | "video" | "prompt-text";
  filePath: string;            // Relative path within creative-quota-assets
  thumbnailPath?: string;
  metadata: {
    prompt: string;
    model: string;
    generationTimeMs: number;
    tokenCost?: number;
    dimensions?: { width: number; height: number };
    duration?: number;
    fileSize: number;
    mimeType: string;
  };
  generatedAt: string;
  briefId: string;
  signalId: string;
}
```

### ContentPackManifest
```typescript
interface ContentPackManifest {
  id: string;
  packId: string;              // e.g. "cqh-2026-06-10-001"
  name: string;
  description: string;
  assets: {
    assetId: string;
    type: string;
    filePath: string;
    thumbnailPath?: string;
    metadata: Record<string, unknown>;
  }[];
  briefs: CreativeBrief[];    // Included briefs
  signals: {
    id: string;
    title: string;
    sourceType: string;
    url: string;
  }[];
  createdAt: string;
  version: string; // e.g. "0.1.0"
  tags: string[];
}
```

---

## 4. Two-Repository Architecture

### Why Two Repositories

| Aspect | creative-quota-harvester | creative-quota-assets |
|--------|--------------------------|----------------------|
| **Purpose** | Program (source adapters, pipeline, scheduler) | Asset library (generated content) |
| **Content** | TypeScript source code, configs, docs | Prompts, briefs, metadata, media files |
| **Update frequency** | Code changes (daily/weekly) | New assets (per generation run) |
| **Reusability** | Program is single-instance | Assets are publicly reusable |
| **License** | MIT | MIT (program) + CC-BY-NC / CC-BY (assets) |
| **Stars/watchers** | Technical users | Creative re-users |

**Key invariant:** `creative-quota-assets` must be independently useful without `creative-quota-harvester`. Any tool that understands the `ContentPackManifest` format should be able to consume assets.

### Sync Mechanism

The harvester writes to `creative-quota-assets/` via the `asset-repo-writer.ts` module. In Phase 5, GitHub Actions can automate sync + PR workflow.

```
harvester writes → local creative-quota-assets/
  → git commit → GitHub Actions → PR → merge → public asset repo
```

---

## 5. GitHub Open Source Radar — Scope Definition

**CRITICAL: This radar is for EXTERNAL projects only. `conanxin/*` is explicitly excluded.**

### Excluded
- All repositories under `conanxin/*` GitHub account
- Any personal projects, forks, or private repositories

### Included Targets
- AI Agent, Coding Agent, LLM Tools, MCP
- Generative AI, Text-to-Image, Text-to-Video, Music Generation, TTS
- Creative Tools, Personal Automation
- RAG, Local LLM, Knowledge Management
- Emerging projects with ≥50 stars, recent activity (pushed > 2026-05-01)

### API Design

```typescript
// src/sources/code/github-open-source-radar.ts
interface GitHubRadarConfig {
  token: string; // GitHub personal access token
  queries: {
    query: string;             // e.g. "topic:ai-agent stars:>300"
    topics: string[];
    priority: number;          // 1-5, 1=highest
  }[];
  minStars: number; // Minimum stars threshold
  notUser: string;             // ALWAYS "conanxin" — hardcoded exclusion
  cacheTTLMs: number;          // Cache TTL in milliseconds
  rateLimitDelayMs: number;    // Delay between API calls (ms)
}

// API usage: GitHub REST Search API
// GET /search/repositories?q={query}+NOT+user:conanxin+...&sort=stars&order=desc
// Headers: Authorization: Bearer {GITHUB_TOKEN}
// Rate limit: 10 requests/min (authenticated), 500 requests/hour
```

### Search Query Examples

| Purpose | Query |
|---------|-------|
| AI Agent frameworks | `topic:ai-agent stars:>300 pushed:>2026-05-01 NOT user:conanxin` |
| LLM tools | `topic:llm stars:>500 pushed:>2026-05-01 NOT user:conanxin` |
| MCP ecosystem | `topic:mcp stars:>100 pushed:>2026-05-01 NOT user:conanxin` |
| Generative AI | `topic:generative-ai stars:>500 pushed:>2026-05-01 NOT user:conanxin` |
| Coding agents | `"coding agent" stars:>100 pushed:>2026-05-01 NOT user:conanxin` |
| Text-to-video | `"text to video" stars:>100 pushed:>2026-05-01 NOT user:conanxin` |
| Music generation | `"music generation" stars:>50 pushed:>2026-05-01 NOT user:conanxin` |

---

## 6. Storage Layer

### SQLite Schema (Signal Store)

```sql
CREATE TABLE source_records (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  raw TEXT NOT NULL  -- JSON string
);

CREATE TABLE signal_records (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  tags TEXT NOT NULL,  -- JSON array
  metadata TEXT NOT NULL,  -- JSON object
  score REAL,
  brief_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE creative_briefs (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  title TEXT NOT NULL,
  concept TEXT NOT NULL,
  keywords TEXT NOT NULL,  -- JSON array
  narrative TEXT NOT NULL,
  visual_direction TEXT,
  tone TEXT,
  audience TEXT,
  references TEXT NOT NULL,  -- JSON array
  created_at TEXT NOT NULL,
  cached INTEGER DEFAULT 0
);

CREATE TABLE asset_plans (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL,
  assets TEXT NOT NULL,  -- JSON array
  total_estimated_tokens INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE generation_jobs (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  error TEXT,
  retry_count INTEGER DEFAULT 0
);

CREATE TABLE asset_records (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  metadata TEXT NOT NULL,  -- JSON object
  generated_at TEXT NOT NULL,
  brief_id TEXT NOT NULL,
  signal_id TEXT NOT NULL
);

CREATE TABLE content_pack_manifests (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  assets TEXT NOT NULL,  -- JSON array
  briefs TEXT NOT NULL,  -- JSON array
  signals TEXT NOT NULL,  -- JSON array
  created_at TEXT NOT NULL,
  version TEXT NOT NULL,
  tags TEXT NOT NULL  -- JSON array
);

CREATE TABLE quota_tracker (
  date TEXT PRIMARY KEY,
  tokens_used INTEGER DEFAULT 0,
  tokens_limit INTEGER,
  generation_count INTEGER DEFAULT 0
);

CREATE INDEX idx_signal_source_type ON signal_records(source_type);
CREATE INDEX idx_signal_score ON signal_records(score DESC);
CREATE INDEX idx_brief_signal ON creative_briefs(signal_id);
CREATE INDEX idx_job_status ON generation_jobs(status);
CREATE INDEX idx_asset_brief ON asset_records(brief_id);
```

---

## 7. Pipeline Stages

### collect-signals.ts
- Iterates all registered source adapters
- Calls `fetch(after?: Date): Promise<SourceRecord[]>`
- Deduplicates by source+sourceId
- Writes to SQLite `source_records`

### normalize-signals.ts
- Reads `source_records`
- Maps to `SignalRecord` schema (source-specific normalization)
- Extracts tags, metadata, summary
- Writes to SQLite `signal_records`

### score-signals.ts
- Reads `signal_records`
- Computes composite score:
  - `relevance × 0.4` — keyword/topic match score
  - `timeliness × 0.3` — recency decay (half-life7 days)
  - `creative_potential × 0.3` — signal richness score
- Updates `score` in `signal_records`
- Returns top N signals for brief creation

### create-briefs.ts
- Reads top-scored `signal_records` without briefs
- Calls LLM (cached by signalId)
- Generates `CreativeBrief`
- Writes to SQLite `creative_briefs`

### plan-assets.ts
- Reads `creative_briefs`
- Generates `AssetPlan` per brief (image/prompt/music/video)
- Priority = brief score × asset_type_priority
- Writes to SQLite `asset_plans`

### export-content-pack.ts
- Reads `asset_records` + `creative_briefs` + `signal_records`
- Builds `ContentPackManifest`
- Writes to `creative-quota-assets/content-packs/`
- Updates `creative-quota-assets/metadata/asset-index.json`

---

## 8. Quota-Aware Scheduler

```typescript
interface QuotaStatus {
  date: string;
  tokensUsed: number;
  tokensLimit: number; // From MiniMax plan
  dailyRemaining: number;
  weeklyUsed: number;
  weeklyLimit: number;
  canGenerate: boolean;
}

interface SchedulerDecision {
  action: "generate" | "queue" | "skip" | "wait";
  reason: string;
  tokensEstimate: number;
  waitUntil?: string;         // ISO timestamp
}
```

**Logic:**
1. Before generating, check `quota_tracker` for today's remaining
2. If `tokensEstimate > dailyRemaining` → `skip` or `queue`
3. If `dailyRemaining < tokensLimit × 0.1` → send Telegram alert
4. After generation, update `quota_tracker.tokens_used`

---

## 9. Dashboard (Phase 4)

Static HTML dashboard at `dashboard/index.html`:

| Section | Content |
|---------|---------|
| Daily Signals | Table of today's signals by source |
| Signal Trends | 7-day sparklines per source |
| Quota Usage | Daily/weekly token consumption chart |
| Recent Briefs | Last 10 briefs with scores |
| Recent Assets | Last 10 generated assets with thumbnails |
| Content Packs | List of exported content packs |

Data source: SQLite + JSON index files.

---

## 10. Telegram Reports (Phase 4)

Daily digest format:

```
🔮 Creative Quota Harvester — Daily Digest
📅 2026-06-10

📊 Signals: 47 (↑12 from yesterday)
  ├─ arXiv: 8
  ├─ GitHub Radar: 15
  ├─ HN: 12
  └─ ...

📝 Briefs Created: 12
🖼️ Assets Generated: 8 (images) + 3 (music) + 1 (video)
💰 Quota Used: 1.2M / 5M tokens (24%)

🔥 Top Signal: [Title] (score: 0.92)

📦 Latest Content Pack: cqh-2026-06-10-001
   → 5 assets, 3 briefs

⚠️ Quota Alert: Daily remaining < 10%
```

---

## 11. Source Adapter Registry

| Source | Type | Adapter | Rate Limit | Cache TTL |
|--------|------|---------|-----------|-----------|
| arXiv AI | academic | `arxiv-ai.ts` | 1 req/3s | 24h |
| GitHub Radar | code | `github-open-source-radar.ts` | 10 req/min | 6h |
| Hacker News | dev-community | `hackernews.ts` | 1 req/10s | 1h |
| Hugging Face Hub | ai-ecosystem | `huggingface-hub.ts` | 1 req/10s | 6h |
| GDELT | news | `gdelt.ts` | 1 req/15s | 1h |
| RSS | news | `rss.ts` | 1 req/feed/min | 1h |
| Open-Meteo | context | `open-meteo.ts` | 1 req/day | 24h |
| DateContext | context | `date-context.ts` | 1 req/day | 24h |
| Holidays | context | `holidays.ts` | 1 req/day | 24h |
| Solar Terms | context | `solar-terms.ts` | 1 req/day | 24h |
| Met Collection | culture-art | `met-collection.ts` | 1 req/3s | 7d |
| Art Institute Chicago | culture-art | `artic-api.ts` | 1 req/3s | 7d |
| Smithsonian | culture-art | `smithsonian.ts` | 1 req/3s | 7d |
| Wikimedia | culture-art | `wikimedia.ts` | 1 req/10s | 7d |

---

## 12. Technology Stack

| Layer | Technology | Justification |
|------|------------|---------------|
| Language | TypeScript | Type safety, Node.js ecosystem |
| Runtime | Node.js 20+ | LTS, ESM support |
| Package Manager | npm | npm workspace for two packages |
| HTTP Client | axios | Universal, well-tested |
| Database | better-sqlite3 | Zero-config, synchronous SQLite |
| LLM | MiniMax API | Primary generation target |
| Image Gen | MiniMax image gen API | Phase 3+ |
| Music Gen | MiniMax music gen API | Phase 3+ |
| Video Gen | MiniMax video gen API | Phase 3+ |
| HTML | Vanilla + minimal CSS | Dashboard (no framework needed) |
| Telegram | telegram-bot-api | Simple bot integration |
| CI/CD | GitHub Actions | Phase 5+ |

---

## 13. File Structure

```
creative-quota-harvester/
├── README.md
├── LICENSE (MIT)
├── ROADMAP.md
├── DEVELOPMENT_HANDOFF.md
├── package.json
├── tsconfig.json
├── .env.example
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SOURCE_ADAPTERS.md
│   ├── ASSET_REPOSITORY_CONTRACT.md
│   └── PHASE_0A_REPORT.md
├── config/
│   ├── sources.example.json
│   ├── scoring.example.json
│   └── asset-policy.example.json
├── src/
│   ├── sources/
│   │   ├── academic/
│   │   │   └── arxiv-ai.ts
│   │   ├── code/
│   │   │   └── github-open-source-radar.ts
│   │   ├── dev-community/
│   │   │   └── hackernews.ts
│   │   ├── ai-ecosystem/
│   │   │   └── huggingface-hub.ts
│   │   ├── news/
│   │   │   ├── gdelt.ts
│   │   │   └── rss.ts
│   │   ├── context/
│   │   │   ├── date-context.ts
│   │   │   ├── open-meteo.ts
│   │   │   ├── holidays.ts
│   │   │   └── solar-terms.ts
│   │   └── culture-art/
│   │       ├── met-collection.ts
│   │       ├── artic-api.ts
│   │       ├── smithsonian.ts
│   │       └── wikimedia.ts
│   ├── pipeline/
│   │   ├── collect-signals.ts
│   │   ├── normalize-signals.ts
│   │   ├── score-signals.ts
│   │   ├── create-briefs.ts
│   │   ├── plan-assets.ts
│   │   └── export-content-pack.ts
│   └── storage/
│       ├── sqlite.ts
│       └── asset-repo-writer.ts
├── scripts/
│   └── run-once.ts
└── dashboard/
    └── index.html

creative-quota-assets/
├── README.md
├── LICENSE (MIT)
├── LICENSE-ASSETS (CC-BY + CC-BY-NC)
├── metadata/
│   ├── asset-index.json
│   ├── source-index.json
│   └── daily-index.json
├── content-packs/
├── images/
├── music/
├── videos/
├── prompts/
└── gallery/
    ├── index.html
    └── assets.json
```

---

## 14. Security & Privacy

| Concern | Mitigation |
|---------|------------|
| GitHub token exposure | Stored in env vars, never in config files |
| MiniMax API key | Stored in env vars, never in config files |
| Telegram token | Stored in env vars, never in config files |
| Personal repo data | `conanxin/*` explicitly excluded from GitHub Radar |
| Rate limit abuse | All adapters implement delay + backoff |
| SQLite injection | Parameterized queries only (better-sqlite3) |
| Untrusted content | All fetched content sanitized before storage |

---

## 15. Limitations (Phase 0A)

- All source adapters are stubs → Phase 1 replaces with real implementations
- All pipeline stages are stubs → Phase 2 replaces with real LLM calls
- No real MiniMax generation → Phase 3
- No automation → Phase 5
- creative-quota-assets is seeded with mock data only
- No GitHub Actions CI/CD → Phase 5
- No Telegram bot → Phase 4