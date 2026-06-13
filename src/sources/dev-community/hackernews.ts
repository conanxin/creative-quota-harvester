/**
 * Hacker News Source Adapter — Phase 4C-5
 * Uses official Hacker News Firebase API.
 *
 * Phase 4C-5 changes:
 *   - profile-aware: fast (60 stories, top+new, 5 concurrent) vs full (100)
 *   - bounded concurrent pool (5) for item fetches
 *   - per-item timeout (4s) and per-class cap (20)
 *   - individual item failures no longer break the batch
 *   - if keyword-matched count is 0, fall back to top tech / AI-adjacent items
 *     (≤ `keyword_fallback` count) and tag them with metadata.fallback=true
 *   - do not let HN return 0 due to a few fetch failures
 */
import { generateId, matchesKeywords, truncate } from "../utils";
import { getActiveProfile, getFastOrFullConfig, runWithPool, type CollectProfile } from "../profile";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

const HN_KEYWORDS = [
  "AI", "LLM", "agent", "coding", "automation", "model",
  "open source", "video", "music", "image generation",
  "generative", "claude", "gpt", "gemini", "copilot",
  "cursor", "aider", "swe-agent", "devin", "tool use",
  "artificial intelligence", "machine learning", "deep learning",
  "neural", "transformer", "diffusion", "rag", "embedding",
  "hugging", "anthropic", "openai", "mistral", "llama", "qwen",
];

// Tech / AI adjacent fallback terms (broader than strict keyword match)
const HN_FALLBACK_TERMS = [
  "startup", "tech", "programming", "developer", "engineer",
  "github", "open source", "python", "javascript", "rust", "go",
  "database", "linux", "kernel", "compiler", "neural", "chip",
  "gpu", "browser", "kernel", "robot", "drone", "api",
  "framework", "library", "tool", "platform", "service",
  "release", "announce", "launch", "show hn", "ask hn",
];

const HN_API = "https://hacker-news.firebaseio.com/v0";

interface HNItem {
  id: number;
  type: string;
  by?: string;
  time?: number;
  title?: string;
  text?: string;
  url?: string;
  score?: number;
  descendants?: number;
  kids?: number[];
}

interface ItemFetchResult {
  id: number;
  item: HNItem | null;
  ok: boolean;
  error?: string;
  durationMs: number;
}

async function fetchItem(id: number, timeoutMs: number): Promise<ItemFetchResult> {
  const start = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${HN_API}/item/${id}.json`, {
      headers: { "User-Agent": "creative-quota-harvester/0.1.0 (personal research project)" },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!resp.ok) {
      return { id, item: null, ok: false, error: `HTTP ${resp.status}`, durationMs: Date.now() - start };
    }
    const data = await resp.json() as HNItem;
    return { id, item: data, ok: true, durationMs: Date.now() - start };
  } catch (err) {
    clearTimeout(t);
    return {
      id,
      item: null,
      ok: false,
      error: (err as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

async function fetchStoryIds(endpoint: string, maxCount: number): Promise<number[]> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(`${HN_API}/${endpoint}.json`, {
      headers: { "User-Agent": "creative-quota-harvester/0.1.0 (personal research project)" },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return [];
    const data = await resp.json() as number[];
    return (data || []).slice(0, maxCount);
  } catch {
    clearTimeout(t);
    return [];
  }
}

let lastProfileUsed: CollectProfile | null = null;

export const hackernewsAdapter: SourceAdapter = {
  sourceType: "dev-community",
  sourceName: "Hacker News",

  async fetch(_after?: Date): Promise<SourceRecord[]> {
    const profile = getActiveProfile();
    lastProfileUsed = profile;

    if (profile === "diagnose") return [];

    const config = getFastOrFullConfig(profile);

    const storyCount = config.hackernews_story_count;
    const maxPerClass = config.hackernews_max_items_per_class;
    const itemConcurrency = config.hackernews_item_concurrency;
    const itemTimeoutMs = config.hackernews_item_timeout_ms;
    const fallbackLimit = config.hackernews_keyword_fallback;

    // Fetch IDs from top + new in parallel
    const [topIds, newIds] = await Promise.all([
      fetchStoryIds("topstories", maxPerClass),
      fetchStoryIds("newstories", maxPerClass),
    ]);

    // Dedupe and cap to storyCount
    const seen = new Set<number>();
    const allIds: number[] = [];
    for (const id of [...topIds, ...newIds]) {
      if (seen.has(id)) continue;
      seen.add(id);
      allIds.push(id);
      if (allIds.length >= storyCount) break;
    }

    console.log(
      `[hackernews] profile=${profile} topIds=${topIds.length} newIds=${newIds.length} unique=${allIds.length} ` +
        `concurrency=${itemConcurrency} timeoutMs=${itemTimeoutMs} fallbackLimit=${fallbackLimit}`
    );

    if (allIds.length === 0) {
      console.warn(`[hackernews] No story IDs returned`);
      return [];
    }

    // Concurrent item fetches
    const tasks = allIds.map(id => () => fetchItem(id, itemTimeoutMs));
    const results = await runWithPool(tasks, itemConcurrency);

    const records: SourceRecord[] = [];
    const fallbackCandidates: SourceRecord[] = [];
    let fetchOk = 0;
    let fetchFail = 0;

    for (const r of results) {
      if (r.error || !r.value) {
        fetchFail++;
        continue;
      }
      const ir = r.value as ItemFetchResult;
      if (!ir.ok || !ir.item) {
        fetchFail++;
        continue;
      }
      fetchOk++;
      const item = ir.item;
      if (item.type !== "story" || !item.title) continue;

      const title = item.title;
      const text = item.text || "";

      const isKeywordMatch = matchesKeywords(title, HN_KEYWORDS) || matchesKeywords(text, HN_KEYWORDS);
      const isFallbackMatch = matchesKeywords(title, HN_FALLBACK_TERMS) || matchesKeywords(text, HN_FALLBACK_TERMS);

      const record: SourceRecord = {
        id: generateId("hn"),
        source: "hackernews",
        sourceType: "dev-community",
        url: item.url || `https://news.ycombinator.com/item?id=${ir.id}`,
        fetchedAt: new Date().toISOString(),
        raw: {
          item_id: ir.id,
          title,
          text: text ? truncate(text.replace(/<[^>]*>/g, " "), 500) : "",
          by: item.by || "",
          score: item.score || 0,
          descendants: item.descendants || 0,
          time: item.time ? new Date(item.time * 1000).toISOString() : "",
          url: item.url || "",
          type: item.type,
          isKeywordMatch,
          isFallbackMatch,
        },
      };

      if (isKeywordMatch) {
        records.push(record);
      } else if (isFallbackMatch) {
        fallbackCandidates.push(record);
      }
    }

    // Apply fallback if keyword matches are too few
    if (records.length === 0 && fallbackCandidates.length > 0) {
      const topFallback = fallbackCandidates
        .sort((a, b) => ((b.raw["score"] as number) || 0) - ((a.raw["score"] as number) || 0))
        .slice(0, fallbackLimit);
      for (const rec of topFallback) {
        (rec.raw as any).fallback = true;
        records.push(rec);
      }
      console.log(`[hackernews] Using ${topFallback.length} fallback items (broad AI/tech adjacent)`);
    }

    console.log(
      `[hackernews] fetchOk=${fetchOk} fetchFail=${fetchFail} keywordMatched=${records.filter(r => (r.raw as any).isKeywordMatch).length} ` +
        `fallbackUsed=${records.filter(r => (r.raw as any).fallback).length} records=${records.length}`
    );

    return records;
  },

  normalize(record: SourceRecord): SignalRecord[] {
    const raw = record.raw as Record<string, unknown>;
    const title = raw["title"] as string || "";
    const text = raw["text"] as string || "";
    const domain = (raw["url"] as string || "").replace(/^https?:\/\//, "").split("/")[0];
    const tags = ["hackernews", "dev-community", domain || "link-post"].filter(Boolean);
    if (raw["fallback"]) {
      tags.push("hn-fallback");
    }

    return [{
      id: record.id,
      sourceType: record.sourceType,
      sourceId: String(raw["item_id"] || record.id),
      title,
      summary: text || `HN Discussion: ${title}`,
      url: record.url,
      publishedAt: raw["time"] as string || record.fetchedAt,
      fetchedAt: record.fetchedAt,
      tags,
      metadata: {
        score: raw["score"] as number,
        comments: raw["descendants"] as number,
        user: raw["by"] as string,
        domain,
        topics: tags,
        fallback: raw["fallback"] === true,
        isKeywordMatch: raw["isKeywordMatch"] === true,
      },
    }];
  },

  estimatedCallsPerRun() {
    const profile = getActiveProfile();
    if (profile === "diagnose") return 0;
    const config = getFastOrFullConfig(profile);
    return config.hackernews_story_count + 2;
  },
  cacheTTLMs() { return 60 * 60 * 1000; },
};

export function getLastProfileUsed(): CollectProfile | null {
  return lastProfileUsed;
}

export default hackernewsAdapter;
