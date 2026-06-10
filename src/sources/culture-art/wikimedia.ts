/**
 * Wikimedia Source Adapter
 * Phase: 0A (stub)
 */
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";
export const wikimediaAdapter: SourceAdapter = {
  sourceType: "culture-art", sourceName: "Wikimedia",
  async fetch() { console.log("[wikimedia] stub"); return []; },
  normalize(r) { return []; },
  estimatedCallsPerRun() { return 4; },
  cacheTTLMs() { return 7 * 24 * 60 * 60 * 1000; },
};
export default wikimediaAdapter;