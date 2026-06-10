# Source Adapters — Specification

**Version:** 0.1.0 | **Phase:** 0A | **Status:** `IN_PROGRESS`

---

## Adapter Contract

All source adapters follow a common interface:

```typescript
interface SourceAdapter {
  /** Unique identifier for this source */
  readonly sourceType: string;
  
  /** Human-readable name */
  readonly sourceName: string;

  /** Fetch new records since `after` (if provided) or latest */
  fetch(after?: Date): Promise<SourceRecord[]>;

  /** Normalize a SourceRecord into a SignalRecord */
  normalize(record: SourceRecord): SignalRecord[];

  /** Estimate token cost for rate limiting */
  estimatedCallsPerRun(): number;

  /** Suggested cache TTL in milliseconds */
  cacheTTLMs(): number;
}
```

All adapters are registered in `config/sources.example.json`.

---

## 1. arXiv AI — `src/sources/academic/arxiv-ai.ts`

### Overview
Fetches recent AI/ML papers from arXiv. Targets cs.AI, cs.LG, cs.CV, cs.CL categories.

### API
- **Endpoint:** `http://export.arxiv.org/api/query`
- **Search:** `cat:cs.AI OR cat:cs.LG OR cat:cs.CV OR cat:cs.CL`
- **Parameters:** `search_query`, `start`, `max_results`, `sortBy=submittedDate`, `sortOrder=descending`
- **Rate limit:** 1 request per 3 seconds (arXiv policy)
- **Cache TTL:** 24 hours

### Query Example
```
http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&max_results=50&sortBy=submittedDate&sortOrder=descending
```

### Signal Fields
| Field | Source |
|-------|--------|
| title | Atom entry `<title>` (stripped) |
| summary | Atom entry `<summary>` (stripped, truncated to 500 chars) |
| url | Atom entry `<id>` |
| publishedAt | Atom entry `<published>` |
| tags | Extracted from abstract keywords + category |
| metadata.stars | N/A (arXiv has no stars) |
| metadata.citations | N/A (fetched separately if needed) |

### Normalization Notes
- Parse `<author><name>` for author list
- Strip HTML tags from title/summary
- Extract arXiv ID from URL: `https://arxiv.org/abs/2401.XXXXX`
- Categories: `cs.AI`, `cs.LG`, `cs.CV`, `cs.CL`

### Rate Limit Strategy
- Sleep 3s between batches of 50 papers
- Cache results24h (daily fetch is sufficient)

---

## 2. GitHub Open Source Radar — `src/sources/code/github-open-source-radar.ts`

### Overview
**CRITICAL: Discovers EXTERNAL open source projects only. `conanxin/*` is NEVER queried or included.**

Discovers trending, emerging, and fast-growing external repositories in AI/LLM/Creative Tools space.

### API
- **Endpoint:** `https://api.github.com/search/repositories`
- **Auth:** `Authorization: Bearer {GITHUB_TOKEN}` (required for 10 req/min)
- **Rate limit:** 10 req/min (authenticated), 30 req/min with premium token
- **Cache TTL:** 6 hours

### Queries (ALL include `NOT user:conanxin`)

| Priority | Query String | Target |
|----------|--------------|--------|
| P1 | `topic:ai-agent stars:>300 pushed:>2026-05-01 NOT user:conanxin` | AI Agent frameworks |
| P1 | `topic:mcp stars:>100 pushed:>2026-05-01 NOT user:conanxin` | MCP ecosystem |
| P2 | `topic:llm stars:>500 pushed:>2026-05-01 NOT user:conanxin` | LLM tools |
| P2 | `topic:generative-ai stars:>500 pushed:>2026-05-01 NOT user:conanxin` | Generative AI |
| P2 | `"coding agent" stars:>100 pushed:>2026-05-01 NOT user:conanxin` | Coding agents |
| P3 | `topic:text-to-image stars:>100 pushed:>2026-05-01 NOT user:conanxin` | Text-to-image |
| P3 | `topic:text-to-video stars:>100 pushed:>2026-05-01 NOT user:conanxin` | Text-to-video |
| P3 | `topic:music-generation stars:>50 pushed:>2026-05-01 NOT user:conanxin` | Music generation |
| P3 | `topic:local-llm stars:>200 pushed:>2026-05-01 NOT user:conanxin` | Local LLM tools |
| P3 | `topic:rag stars:>100 pushed:>2026-05-01 NOT user:conanxin` | RAG frameworks |
| P3 | `topic:knowledge-management stars:>50 pushed:>2026-05-01 NOT user:conanxin` | Knowledge management |
| P3 | `topic:personal-automation stars:>50 pushed:>2026-05-01 NOT user:conanxin` | Personal automation |

### Filter Logic
```typescript
// Pseudocode for GitHub query builder
function buildQuery(config: GitHubRadarConfig): string {
  let q = config.query; // e.g. "topic:ai-agent stars:>300"
  q += ` NOT user:${config.notUser}`; // ALWAYS add: NOT user:conanxin
  q += ` pushed:>${config.minPushedDate}`;
  return q;
}
```

### Signal Fields
| Field | Source |
|-------|--------|
| title | `repo.full_name` (e.g. "org/repo-name") |
| summary | `repo.description` (or "No description") |
| url | `repo.html_url` |
| publishedAt | `repo.created_at` |
| tags | `repo.topics` (GitHub topic array) |
| metadata.stars | `repo.stargazers_count` |
| metadata.language | `repo.language` |
| metadata.forks | `repo.forks_count` |
| metadata.pushedAt | `repo.pushed_at` |

### Hardcoded Exclusion
```typescript
const GITHUB_RADAR_NOT_USER = "conanxin"; // NEVER change this
```

This is hardcoded at the adapter level, not configurable via JSON, to prevent accidental override.

### Rate Limit Strategy
- Sleep 6s between queries (10 req/min safe margin)
- Cache responses 6h
- Track `X-RateLimit-Remaining` header
- Pause if `X-RateLimit-Remaining < 3`
- Exponential backoff on403/429

### Known Limitations
- GitHub Search API returns max 100 results per query
- Stars threshold may miss very new but fast-growing repos
- Topic tagging is inconsistent across repos

---

## 3. Hacker News — `src/sources/dev-community/hackernews.ts`

### API
- **Endpoint:** `https://hacker-news.firebaseio.com/v0/`
- **Endpoints used:**
  - `topstories.json` — top 500 story IDs
  - `item/{id}.json` — story details
- **Rate limit:**1 request per 10 seconds (be respectful)
- **Cache TTL:** 1 hour

### Signal Fields
| Field | Source |
|-------|--------|
| title | `item.title` |
| summary | `item.text` (if available, stripped HTML) or "HN Discussion" |
| url | `item.url` (if available) or `https://news.ycombinator.com/item?id={id}` |
| publishedAt | `item.time` (Unix timestamp → ISO) |
| tags | Derived from URL domain + title keywords |
| metadata.score | `item.score` (HN points) |
| metadata.comments | `item.descendants` |
| metadata.user | `item.by` |

### Normalization Notes
- Fetch top 30 stories per run (batch with 100ms delay between)
- Extract domain from `item.url` for tagging
- `item.text` may be null for link posts

### Rate Limit Strategy
- Sleep 100ms between individual item fetches
- Batch IDs: fetch30 per run, cache1h

---

## 4. Hugging Face Hub — `src/sources/ai-ecosystem/huggingface-hub.ts`

### API
- **Endpoint:** `https://huggingface.co/api`
- **Endpoints used:**
  - `/models?filter={tag}&sort=likes&direction=-1&limit=50` — top models by tag
  - `/datasets?filter={tag}&sort=likes&direction=-1&limit=50` — top datasets
- **Auth:** Optional `HF_TOKEN` for higher rate limit
- **Rate limit:** 1 request per 10 seconds
- **Cache TTL:** 6 hours

### Queries (examples)
```
/models?filter=text-to-image&sort=likes&direction=-1&limit=50
/models?filter=llm&sort=likes&direction=-1&limit=50
/models?filter=agent&sort=likes&direction=-1&limit=50
/datasets?filter=rag&sort=likes&direction=-1&limit=30
```

### Signal Fields
| Field | Source |
|-------|--------|
| title | `model.id` (e.g. "stabilityai/stable-diffusion-xl-base-1.0") |
| summary | `model.cardData.description` or `model.lastModified` |
| url | `https://huggingface.co/{model.id}` |
| publishedAt | `model.lastModified` |
| tags | `model.tags` (pipeline_tag, library_name, etc.) |
| metadata.likes | `model.likes` |
| metadata.downloads | `model.downloads` |
| metadata.pipeline | `model.pipeline_tag` |

### Rate Limit Strategy
- Sleep 10s between API calls
- Cache 6h

---

## 5. GDELT — `src/sources/news/gdelt.ts`

### API
- **Endpoint:** `https://api.gdeltproject.org/api/v2/doc/doc`
- **Query:** `https://api.gdeltproject.org/api/v2/doc/doc?format=json&query=ai OR "artificial intelligence" OR "machine learning"&mode=artlist&maxrecords=100&sort=DateDesc`
- **Rate limit:** 1 request per 15 seconds
- **Cache TTL:** 1 hour

### Signal Fields
| Field | Source |
|-------|--------|
| title | `ARTICLES[].TITLE` |
| summary | `ARTICLES[].SEQUENCE` (1-2 sentence context) |
| url | `ARTICLES[].URL` |
| publishedAt | `ARTICLES[].PUBLISHED` |
| tags | Derived from domain + title keywords |
| metadata.domain | `ARTICLES[].DOMAIN` |
| metadata.language | `ARTICLES[].LANGUAGE` |
| metadata.socialimage | `ARTICLES[].SOCIALIMAGE` |

### Rate Limit Strategy
- Sleep 15s between queries
- Cache 1h (news is time-sensitive)

---

## 6. RSS — `src/sources/news/rss.ts`

### API
- **Library:** `rss-parser`
- **Config:** `config/sources.example.json` lists feed URLs
- **Rate limit:** 1 request per feed per minute
- **Cache TTL:** 1 hour

### Config Example
```json
{
  "feeds": [
    { "url": "https://example.com/feed.xml", "name": "Example Blog", "tags": ["tech", "ai"] },
    { "url": "https://news.ycombinator.com/rss", "name": "Hacker News", "tags": ["tech"] }
  ]
}
```

### Signal Fields
| Field | Source |
|-------|--------|
| title | `item.title` |
| summary | `item.contentSnippet` (truncated 300 chars) |
| url | `item.link` |
| publishedAt | `item.pubDate` |
| tags | From feed config + auto-extracted |
| metadata.feed | `feed.title` |

### Rate Limit Strategy
- Sleep 2s between each feed
- Parse up to 20 items per feed

---

## 7. Open-Meteo — `src/sources/context/open-meteo.ts`

### API
- **Endpoint:** `https://api.open-meteo.com/v1/forecast`
- **Params:** `latitude`, `longitude`, `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum`
- **Location:** Beijing default: `39.9, 116.4`
- **Rate limit:** 1 request per day
- **Cache TTL:** 24 hours

### Signal Fields
| Field | Source |
|-------|--------|
| title | `Daily weather: {date}` |
| summary | `{weather_description}, {temp_min}°C - {temp_max}°C, precipitation: {precip}mm` |
| url | N/A |
| publishedAt | `daily.time` (date) |
| tags | Weather condition keywords |
| metadata.tempMax | `daily.temperature_2m_max` |
| metadata.tempMin | `daily.temperature_2m_min` |
| metadata.precipitation | `daily.precipitation_sum` |
| metadata.weatherCode | `daily.weather_code` |

### Use Case
Weather context enriches visual briefs (e.g., "a rainy afternoon in Beijing" → image prompt)

### Rate Limit Strategy
- Cache 24h, only1 fetch per day
- No sleep needed

---

## 8. Date Context — `src/sources/context/date-context.ts`

### Signal Fields
| Field | Source |
|-------|--------|
| title | ISO date string |
| summary | Day of week, week number, month |
| url | N/A |
| publishedAt | Current date |
| tags | ["date-context", "calendar"] |
| metadata.dayOfWeek | 0-6 |
| metadata.weekNumber | 1-52 |
| metadata.quarter | Q1-Q4 |
| metadata.isWeekend | boolean |

### Rate Limit Strategy
- Always fresh, no cache needed, no API call

---

## 9. Holidays — `src/sources/context/holidays.ts`

### API
- **Library:** `holiday-data` (embedded dataset, no API call)
- **Coverage:** CN + US + major global holidays
- **Rate limit:** 1 request per day
- **Cache TTL:** 24 hours

### Signal Fields
| Field | Source |
|-------|--------|
| title | `{country} Holiday: {holiday_name}` |
| summary | Holiday description |
| url | N/A |
| publishedAt | Holiday date |
| tags | ["holiday", country code] |
| metadata.country | ISO country code |
| metadata.holidayType | public/observance/school |

### Rate Limit Strategy
- Embedded dataset, no external API call

---

## 10. Solar Terms — `src/sources/context/solar-terms.ts`

### API
- **Library:** `solar-terms-calculator` (embedded, no API call)
- **Coverage:** 24 traditional Chinese solar terms
- **Rate limit:** 1 request per day
- **Cache TTL:** 24 hours

### Signal Fields
| Field | Source |
|-------|--------|
| title | Solar term name (e.g. "夏至 Summer Solstice") |
| summary | Solar term description + cultural significance |
| url | N/A |
| publishedAt | Solar term date |
| tags | ["solar-term", "chinese-calendar", cultural] |
| metadata.solarTerm | English + Chinese name |
| metadata.gregorianDate | ISO date |
| metadata.season | spring/summer/autumn/winter |

### Rate Limit Strategy
- Embedded calculation, no external API call

---

## 11. The Met Collection — `src/sources/culture-art/met-collection.ts`

### API
- **Endpoint:** `https://collectionapi.metmuseum.org/public/collection/v1`
- **Endpoints used:**
  - `/objects/{objectID}` — artwork details
  - `/search?hasImages=true&q={query}` — search
- **Rate limit:** 1 request per 3 seconds
- **Cache TTL:** 7 days

### Search Queries
```
/search?hasImages=true&q=artificial+intelligence
/search?hasImages=true&q=robot
/search?hasImages=true&q=digital+art
/search?hasImages=true&q=technology
```

### Signal Fields
| Field | Source |
|-------|--------|
| title | `object.title` |
| summary | `object.objectName` + `object.period` + `object.culture` |
| url | `object.objectURL` |
| publishedAt | `object.objectDate` |
| tags | `object.tags` (if available) or auto-extracted |
| metadata.department | `object.department` |
| metadata.classification | `object.classification` |
| metadata.image | `object.primaryImageSmall` |
| metadata.artist | `object.artistDisplayName` |

### Rate Limit Strategy
- Sleep 3s between object fetches
- Cache 7d

---

## 12. Art Institute of Chicago — `src/sources/culture-art/artic-api.ts`

### API
- **Endpoint:** `https://api.artic.edu/api/v1`
- **Endpoints used:**
  - `/artworks/search?q={query}&fields=id,title,date_display,artist_display,department_title,image_id,thumbnail`
  - `/artworks/{id}`
- **Rate limit:** 1 request per 3 seconds
- **Cache TTL:** 7 days

### Search Queries
```
/artworks/search?q=technology
/artworks/search?q=digital
/artworks/search?q=ai
/artworks/search?q=robot
```

### Signal Fields
| Field | Source |
|-------|--------|
| title | `artwork.title` |
| summary | `artwork.date_display` + `artwork.artist_display` + `artwork.department_title` |
| url | `https://artic.edu/artworks/{id}` |
| publishedAt | `artwork.date_display` |
| tags | Department + classification |
| metadata.department | `artwork.department_title` |
| metadata.imageId | `artwork.image_id` |
| metadata.thumbnail | `artwork.thumbnail` (IIIF URL) |

### Rate Limit Strategy
- Sleep 3s between calls
- Cache 7d

---

## 13. Smithsonian Open Access — `src/sources/culture-art/smithsonian.ts`

### API
- **Endpoint:** `https://api.smithsonianapi.com/v2`
- **Note:** Requires API key (free registration). Falls back to Wikimedia if no key.
- **Search:** `/objects/search?q={query}&rows=20`
- **Rate limit:** 1 request per 3 seconds
- **Cache TTL:** 7 days

### Signal Fields
| Field | Source |
|-------|--------|
| title | `obj.Title` |
| summary | `obj.Date`, `obj.Type`, `obj.Medium` |
| url | `obj.Id` or link to Smithsonian site |
| publishedAt | `obj.Date` |
| tags | `obj.Topic`, `obj.Type` |
| metadata.unit | `obj.Unit` |
| metadata.mediaType | `obj.Media_Type` |
| metadata.image | `obj.Image` (IIIF URL) |

### Rate Limit Strategy
- Sleep 3s between calls
- Cache 7d

---

## 14. Wikimedia — `src/sources/culture-art/wikimedia.ts`

### API
- **Endpoints used:**
  - Wikipedia API: `https://en.wikipedia.org/w/api.php`
  - Wikimedia Commons: `https://commons.wikimedia.org/w/api.php`
- **Rate limit:** 1 request per 10 seconds
- **Cache TTL:** 7 days

### Wikipedia Signal Fields
| Field | Source |
|-------|--------|
| title | `page.title` |
| summary | Extract from `extract` (first paragraph) |
| url | `https://en.wikipedia.org/wiki/{title}` |
| publishedAt | `page.touched` or current date |
| tags | `page.categories` (top 5) |
| metadata.pageId | `page.pageid` |

### Commons Image Fields
| Field | Source |
|-------|--------|
| title | `image.title` |
| summary | `image.description` (stripped) |
| url | `image.url` (full resolution) |
| publishedAt | `image.timestamp` |
| tags | `image.categories` |
| metadata.thumbnail | `image.thumburl` |
| metadata.fileSize | `image.size` |

### Rate Limit Strategy
- Sleep 10s between calls
- Cache 7d

---

## Source Adapter Index

| # | Source Type | Adapter | API Type | Rate Limit |
|---|-----------|---------|-----------|-----------|
| 1 | academic | arxiv-ai.ts | HTTP REST | 1/3s |
| 2 | code | github-open-source-radar.ts | GitHub Search API | 10/min |
| 3 | dev-community | hackernews.ts | Firebase API | 1/10s |
| 4 | ai-ecosystem | huggingface-hub.ts | HTTP REST | 1/10s |
| 5 | news | gdelt.ts | HTTP REST | 1/15s |
| 6 | news | rss.ts | RSS Parser | 1/feed/min |
| 7 | context | open-meteo.ts | HTTP REST | 1/day |
| 8 | context | date-context.ts | Local (no API) | Always fresh |
| 9 | context | holidays.ts | Embedded data | 1/day |
| 10 | context | solar-terms.ts | Embedded calc | 1/day |
| 11 | culture-art | met-collection.ts | HTTP REST | 1/3s |
| 12 | culture-art | artic-api.ts | HTTP REST | 1/3s |
| 13 | culture-art | smithsonian.ts | HTTP REST | 1/3s |
| 14 | culture-art | wikimedia.ts | HTTP REST | 1/10s |

---

## Error Handling

All adapters implement:

```typescript
async fetch(after?: Date): Promise<SourceRecord[]> {
  try {
    const data = await callApi();
    return normalize(data);
  } catch (err) {
    if (err.status === 429 || err.status === 403) {
      await sleep(exponentialBackoff(err.retryAfter || 60));
      return this.fetch(after); // retry
    }
    // Log error, return empty array
    console.error(`[${this.sourceType}] Fetch failed:`, err.message);
    return [];
  }
}
```

---

## Testing Strategy

Each adapter includes:
1. **Type check:** `npx tsc --noEmit src/sources/{category}/{adapter}.ts`
2. **Dry-run:** `npx ts-node scripts/test-adapter.ts {sourceType}` (outputs SourceRecords)
3. **Mock mode:** All adapters accept `MOCK=true` env var for testing without real API calls