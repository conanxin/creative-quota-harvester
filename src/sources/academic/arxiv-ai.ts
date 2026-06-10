/**
 * arXiv AI Source Adapter — Phase 1R
 * HTTPS → HTTP → RSS fallback chain
 */
import { xmlParser, normalizeText, truncate, generateId } from "../utils";
import { fetchWithRetry } from "../../utils/fetch-with-retry";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

const CATEGORIES = ["cs.AI", "cs.LG", "cs.CV", "cs.CL"];
const MAX_RESULTS = 20;
const API_PATHS = [
  "https://export.arxiv.org/api/query",
  "http://export.arxiv.org/api/query",
];
const RSS_PATH = "https://arxiv.org/rss/cs.AI";

interface ArxivAtomEntry {
  id?: string;
  title?: string;
  summary?: string;
  author?: Array<{ name?: string }>;
  published?: string;
  updated?: string;
  category?: Array<{ "@_term"?: string }>;
  link?: Array<{ "@_href"?: string; "@_rel"?: string }>;
}

async function tryArxivApi(category: string, maxPerCat: number): Promise<SourceRecord[]> {
  const records: SourceRecord[] = [];

  for (const baseUrl of API_PATHS) {
    const url = `${baseUrl}?search_query=${encodeURIComponent(`cat:${category}`)}&sortBy=submittedDate&sortOrder=descending&max_results=${maxPerCat}`;

    const result = await fetchWithRetry({ url, acceptXml: true, timeoutMs: 20000, retries: 2 });
    const durationMs = result.durationMs;

    if (!result.ok) {
      console.warn(`[arxiv-ai] ${baseUrl} failed: ${result.error} (${durationMs}ms)`);
      continue;
    }

    const text = typeof result.data === "string" ? result.data : String(result.data);
    try {
      const parsed = xmlParser.parse(text) as Record<string, unknown>;
      const feed = (parsed as Record<string, unknown>).feed as Record<string, unknown> || {};
      const entries = (feed as Record<string, unknown>).entry as unknown[] || [];

      if (!Array.isArray(entries) || entries.length === 0) {
        console.warn(`[arxiv-ai] ${baseUrl}: no entries`);
        continue;
      }

      for (const entry of entries as Record<string, unknown>[]) {
        const published = (entry["published"] as string) || "";
        const links = ((entry as Record<string, unknown>).link as unknown[]) || [];
        const linkEntry = (links as Array<{ "@_href"?: string; "@_rel"?: string }>).find(l => l["@_rel"] === "alternate");
        const url2 = linkEntry?.["@_href"] || "";
        const id = url2.match(/\/abs\/([0-9.]+)/)?.[1] || String(entry["id"] || "");
        const authors = ((entry["author"] as unknown[]) || []).map((a: unknown) => (a as Record<string, unknown>)["name"] as string || "").filter(Boolean).join(", ");

        records.push({
          id: generateId("arxiv"),
          source: "arxiv-ai",
          sourceType: "academic",
          url: url2,
          fetchedAt: new Date().toISOString(),
          raw: {
            id,
            category,
            title: normalizeText((entry["title"] as string) || ""),
            summary: normalizeText((entry["summary"] as string) || ""),
            author: authors,
            published,
            updated: (entry["updated"] as string) || "",
            fetchUrl: url,
            fetchStatus: result.status,
            fetchDurationMs: durationMs,
            usedCurlFallback: result.usedCurlFallback,
          },
        });
      }

      console.log(`[arxiv-ai] ${baseUrl} success: ${records.length} records (${durationMs}ms, curl=${result.usedCurlFallback})`);
      return records;
    } catch (parseErr) {
      console.warn(`[arxiv-ai] ${baseUrl} parse failed: ${(parseErr as Error).message}`);
    }
  }

  // Final fallback: try RSS
  console.warn(`[arxiv-ai] API failed for category ${category}, trying RSS fallback: ${RSS_PATH}`);
  try {
    const result = await fetchWithRetry({ url: RSS_PATH, acceptXml: true, timeoutMs: 15000, retries: 1 });
    if (result.ok) {
      const text = typeof result.data === "string" ? result.data : String(result.data);
      const parsed = xmlParser.parse(text) as Record<string, unknown>;
      const channel = (parsed as Record<string, unknown>).rss as Record<string, unknown> ||
        (parsed as Record<string, unknown>).rdf as Record<string, unknown> ||
        {};
      const rssItems = ((channel as Record<string, unknown>).channel as Record<string, unknown>) ||
        (channel as Record<string, unknown>);
      const items = (rssItems as Record<string, unknown>).item as unknown[] || [];

      for (const item of items.slice(0,5) as Record<string, unknown>[]) {
        const title = normalizeText((item["title"] as string) || "");
        const link = (item["link"] as string) || "";
        const desc = normalizeText((item["description"] as string) || "");
        const id = link.match(/\/abs\/([0-9.]+)/)?.[1] || link;

        records.push({
          id: generateId("arxiv"),
          source: "arxiv-ai",
          sourceType: "academic",
          url: link,
          fetchedAt: new Date().toISOString(),
          raw: {
            id,
            category: `${category}-rss`,
            title,
            summary: truncate(desc, 300),
            author: "RSS feed",
            published: new Date().toISOString(),
            fetchUrl: RSS_PATH,
            fetchStatus: result.status,
            fetchDurationMs: result.durationMs,
            usedCurlFallback: result.usedCurlFallback,
            isRssFallback: true,
          },
        });
      }
      console.log(`[arxiv-ai] RSS fallback success: ${records.length} records`);
    }
  } catch (rssErr) {
    console.warn(`[arxiv-ai] RSS fallback also failed: ${(rssErr as Error).message}`);
  }

  return records;
}

export const arxivAiAdapter: SourceAdapter = {
  sourceType: "academic",
  sourceName: "arXiv AI",

  async fetch(after?: Date): Promise<SourceRecord[]> {
    const allRecords: SourceRecord[] = [];
    const perCategory = Math.ceil(MAX_RESULTS / CATEGORIES.length);

    for (const category of CATEGORIES) {
      const records = await tryArxivApi(category, perCategory);

      // Filter by date if after is provided
      const filtered = after
        ? records.filter(r => {
            const published = (r.raw as Record<string, unknown>)["published"] as string;
            return published ? new Date(published) >= after : true;
          })
        : records;

      allRecords.push(...filtered);

      // arXiv policy: 1 req per 3s
      await new Promise(r => setTimeout(r, 3500));
    }

    return allRecords;
  },

  normalize(record: SourceRecord): SignalRecord[] {
    const raw = record.raw as Record<string, unknown>;
    const title = normalizeText(raw["title"] as string) || "";
    const summaryText = normalizeText(raw["summary"] as string) || "";
    const summary = truncate(summaryText, 500);
    const author = (raw["author"] as string) || "";
    const category = raw["category"] as string || "";
    const tags = [`arxiv:${category}`, "academic", "ai", "paper"];

    return [{
      id: record.id,
      sourceType: record.sourceType,
      sourceId: raw["id"] as string || record.id,
      title,
      summary: author ? `${author}. ${summary}` : summary,
      url: record.url,
      publishedAt: raw["published"] as string || record.fetchedAt,
      fetchedAt: record.fetchedAt,
      tags,
      metadata: {
        category,
        author,
        topics: tags,
        isRssFallback: raw["isRssFallback"] as boolean | undefined,
        fetchUrl: raw["fetchUrl"] as string | undefined,
        fetchStatus: raw["fetchStatus"] as number | undefined,
        fetchDurationMs: raw["fetchDurationMs"] as number | undefined,
        usedCurlFallback: raw["usedCurlFallback"] as boolean | undefined,
      },
    }];
  },

  estimatedCallsPerRun() { return CATEGORIES.length; },
  cacheTTLMs() { return 6 * 60 * 60 * 1000; },
};

export default arxivAiAdapter;