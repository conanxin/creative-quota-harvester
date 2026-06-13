/**
 * collect-signals.ts — Phase 4C-4
 * Orchestrates all source adapters with per-source timeout and health tracking
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
  sourceHealth: SourceHealth[];
  overallStatus: "PASS" | "PARTIAL_PASS" | "WARN" | "FAIL";
}

export interface SourceResult {
  adapter: SourceAdapter;
  sourceRecords: SourceRecord[];
  signalRecords: SignalRecord[];
  error?: string;
  durationMs: number;
  success: boolean;
}

export interface SourceHealth {
  source_name: string;
  source_type: string;
  status: "success" | "partial" | "timeout" | "failed" | "skipped";
  signal_count: number;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  error_summary?: string;
  last_success_at?: string | null;
}

const PER_SOURCE_TIMEOUT_MS = 35000;
const OVERALL_TIMEOUT_MS = 240000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timeout after ${ms}ms`));
    }, ms);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
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
  const sourceHealth: SourceHealth[] = [];

  const overallTimer = setTimeout(() => {
    console.warn(`[collect] OVERALL TIMEOUT (${OVERALL_TIMEOUT_MS}ms) approaching — remaining sources may be skipped`);
  }, OVERALL_TIMEOUT_MS - 15000);

  for (const adapter of adapters) {
    const sourceStart = new Date().toISOString();
    const start = Date.now();
    let status: SourceHealth["status"] = "success";
    let errorSummary: string | undefined;
    let signalCount = 0;

    try {
      console.log(`[collect] Fetching from ${adapter.sourceName} (timeout: ${PER_SOURCE_TIMEOUT_MS}ms)...`);
      const sourceRecords = await withTimeout(adapter.fetch(after), PER_SOURCE_TIMEOUT_MS, adapter.sourceName);
      const signalRecords = sourceRecords
        .flatMap(record => adapter.normalize(record))
        .filter(s => s.title && s.summary);

      const durationMs = Date.now() - start;
      signalCount = signalRecords.length;
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
      errorSummary = error;
      if (error.includes("timeout")) {
        status = "timeout";
        console.warn(`[collect] ${adapter.sourceName} TIMEOUT after ${durationMs}ms`);
      } else {
        status = "failed";
        console.warn(`[collect] ${adapter.sourceName} FAILED: ${error} (${durationMs}ms)`);
      }
      sourceResults.push({
        adapter,
        sourceRecords: [],
        signalRecords: [],
        error,
        durationMs,
        success: false,
      });
    }

    const sourceEnd = new Date().toISOString();
    sourceHealth.push({
      source_name: adapter.sourceName,
      source_type: adapter.sourceType,
      status: signalCount > 0 ? "success" : status,
      signal_count: signalCount,
      started_at: sourceStart,
      ended_at: sourceEnd,
      duration_ms: Date.now() - start,
      error_summary: errorSummary,
      last_success_at: null,
    });
  }

  clearTimeout(overallTimer);
  const endedAt = new Date().toISOString();
  const totalSignals = sourceResults.reduce((sum, r) => sum + r.signalRecords.length, 0);
  const successCount = sourceResults.filter(r => r.success && r.signalRecords.length > 0).length;
  const failCount = sourceResults.filter(r => !r.success).length;
  const timeoutCount = sourceResults.filter(r => r.error?.includes("timeout")).length;

  let overallStatus: CollectResult["overallStatus"] = "FAIL";
  if (successCount >= 3) {
    overallStatus = failCount === 0 ? "PASS" : "PARTIAL_PASS";
  } else if (successCount > 0) {
    overallStatus = "PARTIAL_PASS";
  } else if (totalSignals > 0) {
    overallStatus = "WARN";
  } else {
    overallStatus = "FAIL";
  }

  return {
    runId,
    startedAt,
    endedAt,
    totalSignals,
    sourceResults,
    sourceHealth,
    overallStatus,
  };
}

export default collectSignals;
