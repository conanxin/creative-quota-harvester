/**
 * collect-signals.ts — Phase 1 Real Implementation
 * Orchestrates all source adapters and returns SignalRecord[]
 */
import type { SourceRecord, SignalRecord, SourceAdapter } from "../sources/types";

// Import real adapters
import { arxivAiAdapter } from "../sources/academic/arxiv-ai";
import { githubOpenSourceRadarAdapter } from "../sources/code/github-open-source-radar";
import { hackernewsAdapter } from "../sources/dev-community/hackernews";
import { gdeltAdapter } from "../sources/news/gdelt";
import { huggingfaceHubAdapter } from "../sources/ai-ecosystem/huggingface-hub";
import { openMeteoAdapter } from "../sources/context/open-meteo";
import { dateContextAdapter } from "../sources/context/date-context";
import { solarTermsAdapter } from "../sources/context/solar-terms";
import { metCollectionAdapter } from "../sources/culture-art/met-collection";

export interface CollectResult {
  runId: string;
  startedAt: string;
  endedAt: string;
  totalSignals: number;
  sourceResults: SourceResult[];
}

export interface SourceResult {
  adapter: SourceAdapter;
  sourceRecords: SourceRecord[];
  signalRecords: SignalRecord[];
  error?: string;
  durationMs: number;
  success: boolean;
}

export async function collectSignals(after?: Date): Promise<CollectResult> {
  const runId = `run-${Date.now().toString(36)}`;
  const startedAt = new Date().toISOString();

  const adapters: SourceAdapter[] = [
    arxivAiAdapter,
    githubOpenSourceRadarAdapter,
    hackernewsAdapter,
    gdeltAdapter,
    huggingfaceHubAdapter,
    openMeteoAdapter,
    dateContextAdapter,
    solarTermsAdapter,
    metCollectionAdapter,
  ];

  const sourceResults: SourceResult[] = [];

  for (const adapter of adapters) {
    const start = Date.now();
    try {
      console.log(`[collect] Fetching from ${adapter.sourceName}...`);
      const sourceRecords = await adapter.fetch(after);
      const signalRecords = sourceRecords
        .flatMap(record => adapter.normalize(record))
        .filter(s => s.title && s.summary);

      const durationMs = Date.now() - start;
      sourceResults.push({
        adapter,
        sourceRecords,
        signalRecords,
        durationMs,
        success: true,
      });
      console.log(`[collect] ${adapter.sourceName}: ${signalRecords.length} signals (${durationMs}ms)`);
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const error = (err as Error).message;
      console.warn(`[collect] ${adapter.sourceName} failed: ${error}`);
      sourceResults.push({
        adapter,
        sourceRecords: [],
        signalRecords: [],
        error,
        durationMs,
        success: false,
      });
    }
  }

  const endedAt = new Date().toISOString();
  const totalSignals = sourceResults.reduce((sum, r) => sum + r.signalRecords.length, 0);

  return {
    runId,
    startedAt,
    endedAt,
    totalSignals,
    sourceResults,
  };
}

export default collectSignals;