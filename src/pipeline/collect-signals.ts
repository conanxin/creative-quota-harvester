/**
 * collect-signals.ts — Phase 4C-5
 * Orchestrates all source adapters with per-source timeout, profile-aware
 * budgets, and per-source health tracking.
 */
import * as fs from "fs";
import * as path from "path";
import type { SourceRecord, SignalRecord, SourceAdapter } from "../sources/types";
import {
  loadSourceBudgets,
  getActiveProfile,
  getCooldown,
  type CollectProfile,
} from "../sources/profile";

// Import real adapters
import { arxivAiAdapter } from "../sources/academic/arxiv-ai";
import { githubOpenSourceRadarAdapter } from "../sources/code/github-open-source-radar";
import { hackernewsAdapter } from "../sources/dev-community/hackernews";
import { gdeltAdapter, getLastRunInfo as getGdeltRunInfo } from "../sources/news/gdelt";
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
  profile: CollectProfile;
}

export interface SourceResult {
  adapter: SourceAdapter;
  sourceRecords: SourceRecord[];
  signalRecords: SignalRecord[];
  error?: string;
  durationMs: number;
  success: boolean;
  skippedCooldown?: boolean;
  cooldownReason?: string;
  cooldownUntil?: string;
}

export interface SourceHealth {
  source_name: string;
  source_type: string;
  status: "success" | "partial" | "timeout" | "failed" | "skipped" | "skipped_cooldown";
  signal_count: number;
  query_count: number;
  success_count: number;
  partial_count: number;
  timeout_count: number;
  failed_count: number;
  skipped_cooldown_count: number;
  duration_ms: number;
  error_summary?: string;
  last_success_at?: string | null;
  next_allowed_at?: string | null;
  profile: CollectProfile;
}

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

  const profile: CollectProfile = getActiveProfile();
  const { budgets } = loadSourceBudgets();
  const PER_SOURCE_TIMEOUT_MS = budgets.default_source_timeout_ms;
  const OVERALL_TIMEOUT_MS = budgets.overall_collect_warning_ms;

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
    console.warn(`[collect] OVERALL TIMEOUT WARNING (${OVERALL_TIMEOUT_MS}ms) — remaining sources may be skipped`);
  }, OVERALL_TIMEOUT_MS - 15000);

  for (const adapter of adapters) {
    const sourceStart = new Date().toISOString();
    const start = Date.now();
    let status: SourceHealth["status"] = "success";
    let errorSummary: string | undefined;
    let signalCount = 0;
    let skippedCooldown = false;
    let cooldownReason: string | undefined;
    let cooldownUntil: string | undefined;
    let nextAllowedAt: string | null = null;

    // Pre-check cooldown for GDELT
    if (adapter.sourceType === "news" && adapter.sourceName === "GDELT") {
      const cd = await getCooldown("gdelt");
      if (cd && profile === "fast") {
        skippedCooldown = true;
        status = "skipped_cooldown";
        cooldownReason = cd.reason;
        cooldownUntil = cd.cooldown_until;
        nextAllowedAt = cd.cooldown_until;
        const durationMs = Date.now() - start;
        sourceResults.push({
          adapter,
          sourceRecords: [],
          signalRecords: [],
          error: `cooldown active: ${cd.reason}`,
          durationMs,
          success: false,
          skippedCooldown: true,
          cooldownReason: cd.reason,
          cooldownUntil: cd.cooldown_until,
        });
        sourceHealth.push({
          source_name: adapter.sourceName,
          source_type: adapter.sourceType,
          status: "skipped_cooldown",
          signal_count: 0,
          query_count: 0,
          success_count: 0,
          partial_count: 0,
          timeout_count: 0,
          failed_count: 0,
          skipped_cooldown_count: 1,
          duration_ms: durationMs,
          error_summary: `cooldown until ${cd.cooldown_until} (${cd.reason})`,
          last_success_at: null,
          next_allowed_at: cd.cooldown_until,
          profile,
        });
        console.log(`[collect] ${adapter.sourceName} SKIPPED cooldown until ${cd.cooldown_until}`);
        continue;
      }
    }

    try {
      console.log(`[collect] Fetching from ${adapter.sourceName} (profile=${profile}, timeout=${PER_SOURCE_TIMEOUT_MS}ms)...`);
      const sourceRecords = await withTimeout(adapter.fetch(after), PER_SOURCE_TIMEOUT_MS, adapter.sourceName);
      const signalRecords = sourceRecords
        .flatMap(record => adapter.normalize(record))
        .filter(s => s.title && s.summary);

      const durationMs = Date.now() - start;
      signalCount = signalRecords.length;

      // Build per-source health details from GDELT run info when applicable
      let queryCount = 0;
      let successCount = 0;
      let partialCount = 0;
      if (adapter.sourceName === "GDELT") {
        const gdInfo = getGdeltRunInfo();
        queryCount = gdInfo?.httpCallsMade || 0;
        successCount = gdInfo?.recordsCollected ? 1 : 0;
        partialCount = gdInfo?.cooldownSkipped ? 0 : (gdInfo?.recordsCollected === 0 ? 1 : 0);
        if (gdInfo?.cooldownSet) {
          nextAllowedAt = gdInfo.cooldownSet.until;
        }
      } else {
        // Approximate from records
        queryCount = sourceRecords.length > 0 ? 1 : 0;
        successCount = signalCount > 0 ? 1 : 0;
        partialCount = signalCount === 0 ? 1 : 0;
      }

      sourceResults.push({
        adapter,
        sourceRecords,
        signalRecords,
        durationMs,
        success: true,
      });
      console.log(`[collect] ${adapter.sourceName}: ${signalRecords.length} signals (${durationMs}ms)`);

      sourceHealth.push({
        source_name: adapter.sourceName,
        source_type: adapter.sourceType,
        status: signalCount > 0 ? "success" : "partial",
        signal_count: signalCount,
        query_count: queryCount,
        success_count: successCount,
        partial_count: partialCount,
        timeout_count: 0,
        failed_count: 0,
        skipped_cooldown_count: 0,
        duration_ms: durationMs,
        last_success_at: sourceStart,
        next_allowed_at: nextAllowedAt,
        profile,
      });
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const error = (err as Error).message;
      errorSummary = error;
      const isTimeout = error.includes("timeout");

      if (isTimeout) {
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
      sourceHealth.push({
        source_name: adapter.sourceName,
        source_type: adapter.sourceType,
        status,
        signal_count: 0,
        query_count: 0,
        success_count: 0,
        partial_count: 0,
        timeout_count: isTimeout ? 1 : 0,
        failed_count: isTimeout ? 0 : 1,
        skipped_cooldown_count: 0,
        duration_ms: durationMs,
        error_summary: errorSummary,
        last_success_at: null,
        next_allowed_at: nextAllowedAt,
        profile,
      });
    }
  }

  clearTimeout(overallTimer);
  const endedAt = new Date().toISOString();
  const totalSignals = sourceResults.reduce((sum, r) => sum + r.signalRecords.length, 0);
  const successCount = sourceResults.filter(r => r.success && r.signalRecords.length > 0).length;
  const failCount = sourceResults.filter(r => !r.success && !r.skippedCooldown).length;
  const timeoutCount = sourceResults.filter(r => r.error?.includes("timeout")).length;
  const skippedCount = sourceResults.filter(r => r.skippedCooldown).length;

  let overallStatus: CollectResult["overallStatus"] = "FAIL";
  const effective = successCount + skippedCount;
  if (effective >= 3 && failCount === 0) {
    overallStatus = "PASS";
  } else if (effective >= 3) {
    overallStatus = "PARTIAL_PASS";
  } else if (successCount > 0 || skippedCount > 0) {
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
    profile,
  };
}

export default collectSignals;
