/**
 * GDELT News Source Adapter — Phase 4C-5
 * Uses GDELT v2 DOC API with correct endpoint and parameters.
 *
 * Phase 4C-5 changes:
 *   - profile-aware: fast (smaller query, maxrecords=15) vs full (25)
 *   - on HTTP 429, record cooldown (reports/source-cooldowns.json)
 *   - if fast profile and cooldown active, skip without HTTP call
 *   - full profile always tries (manual override)
 *   - return empty on cooldown (not error) so digest still flows
 */
import { fetchWithRetry } from "../../utils/fetch-with-retry";
import { generateId, truncate } from "../utils";
import { getActiveProfile, getFastOrFullConfig, getCooldown, getCooldownMs, setCooldown, type CollectProfile } from "../profile";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

const GDELT_KEYWORDS = [
  "AI", "artificial intelligence", "agent", "robotics", "chip",
  "video generation", "music generation", "open source",
  "large language model", "llm", "generative AI",
  "text to video", "multimodal",
];

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

export interface GdeltRunInfo {
  profile: CollectProfile;
  cooldownSkipped: boolean;
  cooldownUntil?: string;
  cooldownReason?: string;
  httpCallsMade: number;
  recordsCollected: number;
  lastStatus: number | null;
  lastError?: string;
  cooldownSet?: { until: string; reason: string };
}

let lastRunInfo: GdeltRunInfo | null = null;

export function getLastRunInfo(): GdeltRunInfo | null {
  return lastRunInfo;
}

async function tryGdeltApi(maxRecords: number): Promise<{ records: SourceRecord[]; status: number | null; error?: string; durationMs: number; rateLimited: boolean }> {
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
    maxrecords: String(maxRecords),
    sort: "DateDesc",
    query: fullQuery,
  });

  const url = `${GDELT_V2_DOC}?${params.toString()}`;

  const result = await fetchWithRetry({ url, timeoutMs: 20000, retries: 1, retryDelayMs: 2000 });
  const durationMs = result.durationMs;

  if (!result.ok) {
    return {
      records,
      status: result.status,
      error: result.error || `HTTP ${result.status}`,
      durationMs,
      rateLimited: result.status === 429,
    };
  }

  const data = result.data as GDELTResponse | null;
  const articles = data?.articles || [];

  if (!Array.isArray(articles) || articles.length === 0) {
    return { records, status: result.status, durationMs, rateLimited: false };
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
  return { records, status: result.status, durationMs, rateLimited: false };
}

export const gdeltAdapter: SourceAdapter = {
  sourceType: "news",
  sourceName: "GDELT",

  async fetch(_after?: Date): Promise<SourceRecord[]> {
    const profile = getActiveProfile();

    if (profile === "diagnose") {
      lastRunInfo = {
        profile,
        cooldownSkipped: false,
        httpCallsMade: 0,
        recordsCollected: 0,
        lastStatus: null,
      };
      return [];
    }

    const config = getFastOrFullConfig(profile);

    // Cooldown check
    const cooldown = await getCooldown("gdelt");
    if (cooldown && config.gdelt === "skip_on_cooldown") {
      console.log(`[gdelt] Skipped (cooldown active until ${cooldown.cooldown_until}, reason: ${cooldown.reason})`);
      lastRunInfo = {
        profile,
        cooldownSkipped: true,
        cooldownUntil: cooldown.cooldown_until,
        cooldownReason: cooldown.reason,
        httpCallsMade: 0,
        recordsCollected: 0,
        lastStatus: 0,
      };
      return [];
    }

    const maxRecords = config.gdelt_max_records;
    const { records, status, error, durationMs, rateLimited } = await tryGdeltApi(maxRecords);

    if (rateLimited) {
      const cdMs = getCooldownMs("gdelt");
      const cd = await setCooldown("gdelt", `HTTP 429 at ${new Date().toISOString()}`, cdMs);
      console.warn(`[gdelt] HTTP 429 — cooldown set until ${cd.cooldown_until} (${Math.round(cdMs / 60000)}min)`);
      lastRunInfo = {
        profile,
        cooldownSkipped: false,
        httpCallsMade: 1,
        recordsCollected: 0,
        lastStatus: status,
        lastError: error,
        cooldownSet: { until: cd.cooldown_until, reason: cd.reason },
      };
      return [];
    }

    if (records.length === 0) {
      console.warn(`[gdelt] No articles returned (status=${status}, error=${error || "none"})`);
    } else {
      console.log(`[gdelt] OK: ${records.length} articles (${durationMs}ms)`);
    }

    lastRunInfo = {
      profile,
      cooldownSkipped: false,
      httpCallsMade: 1,
      recordsCollected: records.length,
      lastStatus: status,
      lastError: error,
    };
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
