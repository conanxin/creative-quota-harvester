/**
 * The Met Collection Source Adapter — Phase 1 Real Implementation
 * Uses The Met Collection Public API (no key required)
 */
import { fetchWithTimeout, generateId, matchesKeywords, truncate } from "../utils";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

const SEARCH_QUERIES = ["landscape", "night", "music", "mythology", "China", "Japan", "print"];
const MAX_PER_QUERY = 1;
const MET_BASE = "https://collectionapi.metmuseum.org/public/collection/v1";

interface MetSearchResult {
  total: number;
  objectIDs: number[];
}

interface MetObject {
  objectID: number;
  title: string;
  objectName: string | null;
  period: string | null;
  dynasty: string | null;
  culture: string | null;
  medium: string | null;
  primaryImageSmall: string | null;
  primaryImage: string | null;
  department: string | null;
  classification: string | null;
  artistDisplayName: string | null;
  objectDate: string | null;
  dimensions: string | null;
  objectURL: string | null;
}

export const metCollectionAdapter: SourceAdapter = {
  sourceType: "culture-art",
  sourceName: "The Met Collection",

  async fetch(_after?: Date): Promise<SourceRecord[]> {
    const records: SourceRecord[] = [];

    for (const query of SEARCH_QUERIES) {
      try {
        const searchUrl = `${MET_BASE}/search?q=${encodeURIComponent(query)}&hasImages=true&isPublicDomain=true`;
        const searchResp = await fetchWithTimeout(searchUrl, { timeoutMs: 20000 });

        if (!searchResp.ok) {
          console.warn(`[met] Search "${query}" returned ${searchResp.status}`);
          continue;
        }

        const searchData = searchResp.data as MetSearchResult;
        const objectIds = (searchData.objectIDs || []).slice(0, MAX_PER_QUERY);

        for (const objectId of objectIds) {
          try {
            const objResp = await fetchWithTimeout(`${MET_BASE}/objects/${objectId}`, { timeoutMs: 15000 });
            if (!objResp.ok) continue;

            const obj = objResp.data as MetObject;
            if (!obj.title || !obj.primaryImageSmall) continue;

            records.push({
              id: generateId("met"),
              source: "met-collection",
              sourceType: this.sourceType,
              url: obj.objectURL || "",
              fetchedAt: new Date().toISOString(),
              raw: {
                objectId: obj.objectID,
                title: obj.title,
                objectName: obj.objectName,
                period: obj.period,
                dynasty: obj.dynasty,
                culture: obj.culture,
                medium: obj.medium,
                primaryImageSmall: obj.primaryImageSmall,
                primaryImage: obj.primaryImage,
                department: obj.department,
                classification: obj.classification,
                artist: obj.artistDisplayName,
                objectDate: obj.objectDate,
                dimensions: obj.dimensions,
                objectURL: obj.objectURL,
                searchQuery: query,
              },
            });

            await new Promise(r => setTimeout(r, 3500)); // 1 req/3s
          } catch (err) {
            console.warn(`[met] Object ${objectId} failed:`, (err as Error).message);
          }
        }
      } catch (err) {
        console.warn(`[met] Search "${query}" failed:`, (err as Error).message);
      }
    }

    return records;
  },

  normalize(record: SourceRecord): SignalRecord[] {
    const raw = record.raw as Record<string, unknown>;
    const title = raw["title"] as string || "";
    const culture = raw["culture"] as string || "";
    const period = raw["period"] as string || "";
    const artist = raw["artist"] as string || "Unknown";
    const medium = raw["medium"] as string || "";
    const department = raw["department"] as string || "";
    const tags = [
      "met", "art", "museum", "cultural",
      culture.toLowerCase() || "",
      department.toLowerCase() || "",
      (raw["searchQuery"] as string || "").toLowerCase(),
    ].filter(Boolean);

    return [{
      id: record.id,
      sourceType: record.sourceType,
      sourceId: String(raw["objectId"] || record.id),
      title,
      summary: truncate(`${artist}. ${period ? period + ". " : ""}${culture ? culture + ". " : ""}${medium || ""}`.trim(), 400),
      url: raw["objectURL"] as string || "",
      publishedAt: raw["objectDate"] as string || record.fetchedAt,
      fetchedAt: record.fetchedAt,
      tags,
      metadata: {
        objectId: raw["objectId"],
        artist,
        period,
        dynasty: raw["dynasty"] as string,
        culture,
        medium,
        department,
        classification: raw["classification"] as string,
        primaryImageSmall: raw["primaryImageSmall"] as string,
        dimensions: raw["dimensions"] as string,
        topics: tags,
      },
    }];
  },

  estimatedCallsPerRun() { return SEARCH_QUERIES.length * 2; },
  cacheTTLMs() { return 7 * 24 * 60 * 60 * 1000; }, // 7d
};

export default metCollectionAdapter;