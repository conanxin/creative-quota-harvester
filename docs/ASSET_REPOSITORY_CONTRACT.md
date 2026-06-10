# Asset Repository Contract

**Version:** 0.1.0 | **Phase:** 0A | **Status:** `IN_PROGRESS`

> Defines the contract between `creative-quota-harvester` and `creative-quota-assets`.

---

## 1. Contract Overview

`creative-quota-assets` is a **separate, independently reusable** open source asset library. It is NOT a build artifact of the harvester — it is a publication target.

**Invariant:** Any tool that understands the `ContentPackManifest` schema should be able to consume assets from `creative-quota-assets` without knowing anything about `creative-quota-harvester`.

---

## 2. Directory Structure

```
creative-quota-assets/
├── README.md                    ← Required: license, usage, contribution guide
├── LICENSE                      ← MIT (program code)
├── LICENSE-ASSETS               ← CC-BY-NC + CC-BY (generated assets)
├── metadata/
│   ├── asset-index.json         ← Master index: ALL assets
│   ├── source-index.json ← Source registry: which sources are active
│   └── daily-index.json         ← Daily log: assets generated per day
├── content-packs/ ← Exported content bundles (JSON manifests)
│   └── cqh-YYYY-MM-DD-NNN.json
├── images/                      ← Generated images (*.jpg, *.png, *.webp)
│   └── cqh-YYYY-MM-DD-NNN-{assetId}.{ext}
├── music/ ← Generated music (*.mp3, *.wav)
│   └── cqh-YYYY-MM-DD-NNN-{assetId}.{ext}
├── videos/                      ← Generated video (*.mp4, *.webm)
│   └── cqh-YYYY-MM-DD-NNN-{assetId}.{ext}
├── prompts/ ← Text prompts (*.txt, *.md)
│   └── cqh-YYYY-MM-DD-NNN-{assetId}.txt
└── gallery/
    ├── index.html               ← Web gallery viewer
    └── assets.json              ← Gallery metadata (lightweight index)
```

---

## 3. Metadata Schemas

### asset-index.json (Master Index)

```json
{
  "version": "0.1.0",
  "generatedAt": "2026-06-10T15:52:00Z",
  "totalAssets": 3,
  "byType": {
    "image": 1,
    "prompt-text": 2
  },
  "assets": [
    {
      "assetId": "cqh-img-001",
      "type": "image",
      "filePath": "images/cqh-2026-06-10-001-img-001.jpg",
      "thumbnailPath": "images/cqh-2026-06-10-001-img-001-thumb.jpg",
      "mimeType": "image/jpeg",
      "fileSize": 245000,
      "dimensions": { "width": 1024, "height": 1024 },
      "generatedAt": "2026-06-10T15:52:00Z",
      "packId": "cqh-2026-06-10-001",
      "briefId": "brief-001",
      "signalId": "signal-001",
      "tags": ["ai-agent", "neural", "blue"]
    }
  ]
}
```

### source-index.json (Source Registry)

```json
{
  "version": "0.1.0",
  "updatedAt": "2026-06-10T15:52:00Z",
  "sources": [
    {
      "sourceType": "code",
      "sourceName": "GitHub Open Source Radar",
      "adapter": "github-open-source-radar.ts",
      "lastFetchedAt": "2026-06-10T15:00:00Z",
      "signalsCount": 15,
      "status": "active"
    }
  ]
}
```

### daily-index.json (Daily Log)

```json
{
  "version": "0.1.0",
  "days": [
    {
      "date": "2026-06-10",
      "signalsCollected": 47,
      "briefsCreated": 12,
      "assetsGenerated": {
        "image": 5,
        "music": 3,
        "video": 1,
        "prompt-text": 3
      },
      "quotaUsed": 1200000,
      "contentPacks": ["cqh-2026-06-10-001"]
    }
  ]
}
```

---

## 4. Content Pack Manifest Schema

```json
{
  "id": "cqh-manifest-001",
  "packId": "cqh-2026-06-10-001",
  "name": "AI Agent Creative Collection — 2026-06-10",
  "description": "Creative briefs, prompts and assets generated from GitHub Open Source Radar signals about AI Agent frameworks, harvested2026-06-10.",
  "version": "0.1.0",
  "createdAt": "2026-06-10T15:52:00Z",
  "tags": ["ai-agent", "creative-brief", "github-radar", "2026-06-10"],
  "assets": [
    {
      "assetId": "cqh-img-001",
      "type": "image",
      "filePath": "images/cqh-2026-06-10-001-img-001.jpg",
      "thumbnailPath": "images/cqh-2026-06-10-001-img-001-thumb.jpg",
      "metadata": {
        "prompt": "A futuristic AI agent interface...",
        "model": "minimax/image-01",
        "generationTimeMs": 4500,
        "dimensions": { "width": 1024, "height": 1024 },
        "fileSize": 245000,
        "mimeType": "image/jpeg"
      }
    }
  ],
  "briefs": [
    {
      "id": "brief-001",
      "signalId": "signal-001",
      "title": "Neural Flow: AI Agent Creative Brief",
      "concept": "A visual exploration of autonomous AI agents in flow state...",
      "keywords": ["ai-agent", "neural", "autonomous", "flow", "interface"],
      "narrative": "The concept of an AI agent in its natural flow state...",
      "visualDirection": "Cinematic, high-tech, neural network aesthetic",
      "tone": "cinematic",
      "audience": "Tech-forward creative professionals",
      "references": []
    }
  ],
  "signals": [
    {
      "id": "signal-001",
      "title": "AutoGen: Building Multi-Agent Applications",
      "sourceType": "code",
      "url": "https://github.com/microsoft/autogen",
      "metadata": {
        "stars": 28000,
        "topics": ["ai-agent", "multi-agent", "llm"]
      }
    }
  ],
  "quotaConsumed": {
    "tokens": 520000,
    "generationCount": 6
  }
}
```

---

## 5. Naming Conventions

### Asset Files
```
{type}-{YYYY-MM-DD}-{packSeq}-{assetSeq}.{ext}

Examples:
  img-2026-06-10-001-001.jpg       (image, pack 001, asset 001)
  music-2026-06-10-001-001.mp3    (music, pack 001, asset 001)
  video-2026-06-10-001-001.mp4    (video, pack 001, asset 001)
  prompt-2026-06-10-001-001.txt   (text prompt, pack 001, asset 001)
```

### Content Pack Directory
```
content-packs/cqh-YYYY-MM-DD-NNN.json
  e.g. content-packs/cqh-2026-06-10-001.json
```

### Gallery Entry (gallery/assets.json)
```json
{
  "id": "cqh-img-001",
  "type": "image",
  "title": "Neural Flow — AI Agent Interface",
  "description": "Generated from GitHub Open Source Radar signal: AutoGen",
  "thumbnail": "images/cqh-2026-06-10-001-img-001-thumb.jpg",
  "full": "images/cqh-2026-06-10-001-img-001.jpg",
  "prompt": "A futuristic AI agent interface...",
  "tags": ["ai-agent", "neural"],
  "createdAt": "2026-06-10T15:52:00Z",
  "packId": "cqh-2026-06-10-001",
  "sourceUrl": "https://github.com/microsoft/autogen"
}
```

---

## 6. Gallery HTML Specification

`gallery/index.html` must be a self-contained, zero-dependency HTML file:

- Loads `assets.json` via `fetch()` or embedded data
- Displays assets in a responsive grid
- Clicking an asset shows a modal with metadata
- No external CSS/JS CDN (inline or local references only)
- Renders gracefully even if images are missing (shows placeholder + metadata)

**Gallery Layout:**
```
┌──────────────────────────────────────────────┐
│  🔮 Creative Quota Assets — Gallery │
├──────────────────────────────────────────────┤
│  Filter: [All] [Images] [Music] [Video] [Prompts] │
├──────────────────────────────────────────────┤
│  ┌─────┐  ┌─────┐ ┌─────┐  ┌─────┐ │
│  │ img │  │ img │  │ mus │  │ vid │        │
│  │thumb│  │thumb│  │ icn │  │ icn │        │
│  └─────┘  └─────┘└─────┘  └─────┘        │
│  Title Title     Title    Title          │
└──────────────────────────────────────────────┘
```

---

## 7. Sync Protocol (Harvester → Assets)

```
Step 1: Harvester generates assets → writes to local creative-quota-assets/
Step 2: Harvester updates metadata/*.json (asset-index, daily-index)
Step 3: Harvester creates content-packs/cqh-*.json
Step 4: (Phase 5) GitHub Actions commits + PRs to creative-quota-assets
Step 5: (Phase 5) Human reviews PR → merges → assets become public
```

### File Write Order (Atomic)
1. Write all asset files first
2. Write `metadata/asset-index.json` last
3. If write fails mid-way, index is stale but not corrupted (next run fixes)

### Index Update Strategy
- `asset-index.json` — append-only for new assets, update in-place for status changes
- `daily-index.json` — append-only for new days
- `source-index.json` — overwrite on each run (small, fast)

---

## 8. License Strategy

| File | License | Rationale |
|------|---------|-----------|
| Program source code | MIT | Standard open source license |
| Generated AI assets | CC-BY-NC + CC-BY | Generated content needs clear license; CC-BY-NC prevents commercial misuse without restricting creative reuse |
| Prompts/briefs | CC-BY | Text content can be freely reused with attribution |
| Metadata JSON | MIT | Data format is not creative work |

**CC-BY-NC + CC-BY combined:** Non-commercial use allowed with attribution. Commercial use requires separate licensing (contact author).

---

## 9. Validation Rules

Before any commit to `creative-quota-assets`, validate:

- [ ] All asset files exist at declared paths in `asset-index.json`
- [ ] `asset-index.json` is valid JSON and matches schema
- [ ] `daily-index.json` is valid JSON and matches schema
- [ ] `content-packs/*.json` are valid JSON and match schema
- [ ] `gallery/assets.json` is valid JSON
- [ ] All file paths use forward slashes (`/`) not backslashes (`\`)
- [ ] No file path exceeds255 characters
- [ ] All required fields present in every manifest entry

---

## 10. Retention & Pruning (Phase 5)

**Retention policy:**
- `content-packs/` — kept forever (immutable audit trail)
- `images/` — kept forever (public asset library)
- `music/` — kept forever
- `videos/` — kept forever
- `prompts/` — kept forever
- `metadata/asset-index.json` — never deleted

**Pruning:**
- No automatic deletion of generated assets
- Assets are the product; they should accumulate over time
- Gallery UI can filter by date/tag but never delete

---

## 11. Public API Compatibility

`creative-quota-assets` should be consumable by:

1. **Direct clone** — `git clone` the repo, read JSON manifests, access files
2. **GitHub raw** — `https://raw.githubusercontent.com/{owner}/creative-quota-assets/main/metadata/asset-index.json`
3. **GitHub API** — `GET /repos/{owner}/creative-quota-assets/contents/` for programmatic access
4. **Gallery UI** — `index.html` loads from same-origin `assets.json`

**No authentication required** for public consumption.