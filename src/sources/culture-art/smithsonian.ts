/**
 * Smithsonian Open Access Source Adapter
 * Phase: 0A (stub)
 */
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";
export const smithsonianAdapter: SourceAdapter = {
  sourceType: "culture-art", sourceName: "Smithsonian",
  async fetch() { console.log("[smithsonian] stub"); return []; },
  normalize(r) { return []; },
  estimatedCallsPerRun() { return 4; },
  cacheTTLMs() { return 7 * 24 * 60 * 60 * 1000; },
};
export default smithsonianAdapter;