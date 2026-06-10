/**
 * Hacker News Source Adapter — Phase 1 Real Implementation
 * Uses official Hacker News Firebase API
 */
import { fetchWithTimeout, generateId, matchesKeywords, truncate } from "../utils";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

const HN_KEYWORDS = [
  "AI", "LLM", "agent", "coding", "automation", "model",
  "open source", "video", "music", "image generation",
  "generative", "claude", "gpt", "gemini", "copilot",
  "cursor", "aider", "swe-agent", "devin", "tool use",
  "artificial intelligence", "machine learning", "deep learning",
];

const MAX_ITEMS = 30;
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

export const hackernewsAdapter: SourceAdapter = {
  sourceType: "dev-community",
  sourceName: "Hacker News",

  async fetch(_after?: Date): Promise<SourceRecord[]> {
    const records: SourceRecord[] = [];

    try {
      // Fetch top story IDs
      const topResp = await fetchWithTimeout(`${HN_API}/topstories.json`, {});
      if (!topResp.ok || typeof topResp.data !== "number") {
        // Fallback: try newstories
        const newResp = await fetchWithTimeout(`${HN_API}/newstories.json`, {});
        if (!newResp.ok) {
          console.warn("[hackernews] Could not fetch story IDs");
          return [];
        }
        topResp.data = newResp.data;
      }
      const storyIds = (topResp.data as number[]).slice(0, MAX_ITEMS);

      for (const id of storyIds) {
        try {
          const itemResp = await fetchWithTimeout(`${HN_API}/item/${id}.json`, {});
          if (!itemResp.ok) continue;

          const item = itemResp.data as HNItem;
          if (!item || item.type !== "story" || !item.title) continue;

          const title = item.title;
          const text = item.text || "";

          // Filter by keywords
          if (!matchesKeywords(title, HN_KEYWORDS) && !matchesKeywords(text, HN_KEYWORDS)) {
            continue;
          }

          records.push({
            id: generateId("hn"),
            source: "hackernews",
            sourceType: this.sourceType,
            url: item.url || `https://news.ycombinator.com/item?id=${id}`,
            fetchedAt: new Date().toISOString(),
            raw: {
              item_id: id,
              title,
              text: text ? truncate(text.replace(/<[^>]*>/g, " "), 500) : "",
              by: item.by || "",
              score: item.score || 0,
              descendants: item.descendants || 0,
              time: item.time ? new Date(item.time * 1000).toISOString() : "",
              url: item.url || "",
              type: item.type,
            },
          });

          // Gentle rate limit: 100ms between items
          await new Promise(r => setTimeout(r, 120));
        } catch (err) {
          console.warn(`[hackernews] Failed to fetch item ${id}:`, (err as Error).message);
        }
      }
    } catch (err) {
      console.warn(`[hackernews] Fetch failed:`, (err as Error).message);
    }

    return records;
  },

  normalize(record: SourceRecord): SignalRecord[] {
    const raw = record.raw as Record<string, unknown>;
    const title = raw["title"] as string || "";
    const text = raw["text"] as string || "";
    const domain = (raw["url"] as string || "").replace(/^https?:\/\//, "").split("/")[0];
    const tags = ["hackernews", "dev-community", domain || "link-post"].filter(Boolean);

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
      },
    }];
  },

  estimatedCallsPerRun() { return MAX_ITEMS + 1; },
  cacheTTLMs() { return 60 * 60 * 1000; }, // 1h
};

export default hackernewsAdapter;