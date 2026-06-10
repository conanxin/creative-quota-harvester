/**
 * GDELT News Source Adapter — Phase 1R
 * Uses GDELT v2 DOC API with correct endpoint and parameters
 */
import { fetchWithRetry } from "../../utils/fetch-with-retry";
import { generateId, truncate } from "../utils";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

const GDELT_KEYWORDS = [
  "AI", "artificial intelligence", "agent", "robotics", "chip",
  "video generation", "music generation", "open source",
  "large language model", "llm", "generative AI",
  "text to video", "multimodal",
];

const MAX_RECORDS = 20;

// GDELT v2 DOC API — correct endpoint
const GDELT_V2_DOC = "https://api.gdeltproject.org/api/v2/doc/doc";

interface GDELTArticle {
  TITLE?: string;
  URL?: string;
  DOMAIN?: string;
  PUBLISHED?: string;
  LANGUAGE?: string;
  SOCIALIMAGE?: string;
  SEQUENCE?: string;
}

interface GDELTResponse {
  articles?: GDELTArticle[];
  articleCount?: number;
  format?: string;
}

async function tryGdeltApi(): Promise<SourceRecord[]> {
  const records: SourceRecord[] = [];

  // Build compound query with parentheses for correct boolean precedence
  const queryTerms = GDELT_KEYWORDS.slice(0, 4);
  const query = queryTerms.map(t => {
    if (t.includes(" ")) return `"${t}"`;
    return t;
  }).join(" OR ");
  const fullQuery = `(${query})`;

  const params = new URLSearchParams({
    format: "json",
    mode: "ArtList",
    maxrecords: String(MAX_RECORDS),
    sort: "DateDesc",
    query: fullQuery,
  });

  const url = `${GDELT_V2_DOC}?${params.toString()}`;
  console.log(`[gdelt] Trying v2 DOC API: ${url}`);

  const result = await fetchWithRetry({ url, timeoutMs: 25000, retries: 2 });
  const durationMs = result.durationMs;

  if (!result.ok) {
    console.warn(`[gdelt] v2 DOC API failed: HTTP ${result.status} (${durationMs}ms) — ${result.error}`);
    return records;
  }

  const data = result.data as GDELTResponse | null;
  const articles = data?.articles || [];

  if (!Array.isArray(articles) || articles.length === 0) {
    console.warn(`[gdelt] v2 DOC API returned ${articles?.length || 0} articles`);
    // Try format=html as diagnostic
    const diagUrl = `${GDELT_V2_DOC}?${new URLSearchParams({ format: "html", mode: "ArtList", maxrecords: "5", query: "AI" }).toString()}`;
    const diagResult = await fetchWithRetry({ url: diagUrl, timeoutMs: 15000, retries: 0 });
    if (diagResult.ok) {
      console.log(`[gdelt] Diagnostic: format=html returned HTTP ${diagResult.status}`);
    }
    return records;
  }

  for (const article of articles) {
    const title = (article.TITLE as string) || "";
    if (!title) continue;

    const articleUrl = (article.URL as string) || "";
    const domain = (article.DOMAIN as string) || "";
    const summary = truncate((article.SEQUENCE as string) || (article.SOCIALIMAGE as string) || title, 400);

    records.push({
      id: generateId("gdelt"),
      source: "gdelt",
      sourceType: "news",
      url: articleUrl,
      fetchedAt: new Date().toISOString(),
      raw: {
        title,
        summary,
        domain,
        published: article.PUBLISHED,
        language: article.LANGUAGE,
        socialImage: article.SOCIALIMAGE,
        articleUrl,
        usedCurlFallback: result.usedCurlFallback,
        fetchStatus: result.status,
        fetchDurationMs: durationMs,
        query: fullQuery,
      },
    });
  }

  console.log(`[gdelt] v2 DOC API success: ${records.length} articles (${durationMs}ms, curl=${result.usedCurlFallback})`);
  return records;
}

export const gdeltAdapter: SourceAdapter = {
  sourceType: "news",
  sourceName: "GDELT",

  async fetch(_after?: Date): Promise<SourceRecord[]> {
    const records = await tryGdeltApi();

    if (records.length === 0) {
      console.warn(`[gdelt] No articles from v2 API, pipeline continues gracefully`);
    }

    return records;
  },

  normalize(record: SourceRecord): SignalRecord[] {
    const raw = record.raw as Record<string, unknown>;
    const title = raw["title"] as string || "";
    const domain = raw["domain"] as string || "";
    const tags = ["news", "gdelt", "global", domain || "unknown"].filter(Boolean);

    return [{
      id: record.id,
      sourceType: record.sourceType,
      sourceId: (raw["articleUrl"] as string) || record.id,
      title,
      summary: raw["summary"] as string || title,
      url: raw["articleUrl"] as string || "",
      publishedAt: raw["published"] as string || record.fetchedAt,
      fetchedAt: record.fetchedAt,
      tags,
      metadata: {
        domain,
        language: raw["language"] as string,
        socialImage: raw["socialImage"] as string,
        query: raw["query"] as string,
        usedCurlFallback: raw["usedCurlFallback"],
        fetchStatus: raw["fetchStatus"],
        fetchDurationMs: raw["fetchDurationMs"],
        topics_list: GDELT_KEYWORDS.filter(k => title.toLowerCase().includes(k.toLowerCase())),
      },
    }];
  },

  estimatedCallsPerRun() { return 1; },
  cacheTTLMs() { return 60 * 60 * 1000; },
};

export default gdeltAdapter;