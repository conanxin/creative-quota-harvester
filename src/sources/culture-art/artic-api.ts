/**
 * Art Institute of Chicago Source Adapter
 * Phase: 0A (stub)
 */
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";
export const articApiAdapter: SourceAdapter = {
  sourceType: "culture-art", sourceName: "Art Institute of Chicago",
  async fetch() { console.log("[artic-api] stub"); return []; },
  normalize(r) { return []; },
  estimatedCallsPerRun() { return 4; },
  cacheTTLMs() { return 7 * 24 * 60 * 60 * 1000; },
};
export default articApiAdapter;