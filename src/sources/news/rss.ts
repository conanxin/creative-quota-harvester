/**
 * RSS Feed Source Adapter
 * Phase: 0A (stub)
 */
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";
export const rssAdapter: SourceAdapter = {
  sourceType: "news", sourceName: "RSS Feeds",
  async fetch() { console.log("[rss] stub"); return []; },
  normalize(r) { return []; },
  estimatedCallsPerRun() { return 1; },
  cacheTTLMs() { return 60 * 60 * 1000; },
};
export default rssAdapter;