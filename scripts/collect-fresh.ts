#!/usr/bin/env npx ts-node
/**
 * scripts/collect-fresh.ts — Phase 4C-4
 * Force signal collection, ignoring any freshness checks.
 * This is the same as collect.ts but with the --force flag semantics.
 */
import * as path from "path";
import * as fs from "fs";
import collectSignals from "../src/pipeline/collect-signals";
import normalizeSignals from "../src/pipeline/normalize-signals";
import scoreSignals from "../src/pipeline/score-signals";
import { SQLiteStore } from "../src/storage/sqlite";
import type { ScoredSignal } from "../src/pipeline/score-signals";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(HARVESTER_DIR, "data");
const DB_PATH = path.join(DATA_DIR, "signals.db");
const REPORTS_DIR = path.join(HARVESTER_DIR, "reports");

async function main() {
  console.log("=".repeat(60));
  console.log("🔮 Creative Quota Harvester — Phase 4C-4 Force Fresh Collect");
  console.log("=".repeat(60));
  console.log("");

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const store = new SQLiteStore(DB_PATH);
  await store.init();

  console.log("[collect:fresh] Force collecting signals from all sources...");
  const collectResult = await collectSignals();
  const { runId, startedAt, endedAt, totalSignals, sourceResults, overallStatus } = collectResult;

  console.log(`[collect:fresh] Collected ${totalSignals} total signals from ${sourceResults.length} sources`);
  console.log(`[collect:fresh] Overall Status: ${overallStatus}`);
  console.log("");

  console.log("[collect:fresh] Normalizing...");
  const allSignals = sourceResults.flatMap(r => r.signalRecords);
  const normalized = await normalizeSignals(allSignals);
  console.log(`[collect:fresh] ${normalized.length} normalized`);
  console.log("");

  console.log("[collect:fresh] Scoring...");
  const scored = await scoreSignals(normalized);
  console.log(`[collect:fresh] ${scored.length} scored`);
  console.log("");

  console.log("[collect:fresh] Writing to SQLite...");
  store.insertRun(runId);

  for (const result of sourceResults) {
    const adapter = result.adapter;
    const count = result.signalRecords.length;
    store.upsertSource({
      id: adapter.sourceType,
      source_type: adapter.sourceType,
      source_name: adapter.sourceName,
      adapter_file: `${adapter.sourceType}.ts`,
      status: result.success ? "active" : "failed",
      note: result.error || undefined,
    });
    if (count > 0) store.updateSourceStats(adapter.sourceType, count);
  }

  for (const signal of scored) {
    store.insertSignal({
      ...signal,
      run_id: runId,
      freshness_score: signal.freshnessScore,
      relevance_score: signal.relevanceScore,
      visual_potential: signal.visualPotential,
      x_post_potential: signal.xPostPotential,
      creative_asset_potential: signal.creativeAssetPotential,
      final_score: signal.finalScore,
    } as Parameters<typeof store.insertSignal>[0]);
  }

  const successCount = sourceResults.filter(r => r.success).length;
  const failCount = sourceResults.filter(r => !r.success).length;
  store.finishRun(runId, {
    total: scored.length,
    attempted: sourceResults.length,
    succeeded: successCount,
    failed: failCount,
    status: scored.length > 0 ? (overallStatus === "PASS" ? "completed" : "partial") : "no_signals",
  });

  const finalCount = store.getTotalSignalCount(runId);
  store.close();
  console.log(`[collect:fresh] SQLite: ${finalCount} signals for run ${runId}`);
  console.log("");

  // Write source health
  const healthEntries = sourceResults.map(r => ({
    source_name: r.adapter.sourceName,
    source_type: r.adapter.sourceType,
    status: r.success ? (r.signalRecords.length > 0 ? "success" : "partial") : (r.error?.includes("timeout") ? "timeout" : "failed"),
    signal_count: r.signalRecords.length,
    started_at: startedAt,
    ended_at: endedAt,
    duration_ms: r.durationMs,
    error_summary: r.error || undefined,
    last_success_at: r.success ? endedAt : null,
  }));

  fs.writeFileSync(path.join(REPORTS_DIR, "source-health.json"), JSON.stringify({
    run_id: runId,
    generated_at: endedAt,
    overall_status: overallStatus,
    sources: healthEntries,
  }, null, 2), "utf-8");

  const healthMdLines = [
    "# Source Health Report",
    `**Run ID:** ${runId}`,
    `**Generated:** ${endedAt}`,
    `**Overall Status:** ${overallStatus}`,
    "",
    "| Source | Type | Status | Signals | Duration | Error |",
    "|--------|------|--------|---------|----------|-------|",
    ...healthEntries.map((h: any) => `| ${h.source_name} | ${h.source_type} | ${h.status} | ${h.signal_count} | ${h.duration_ms}ms | ${h.error_summary || ""} |`),
    "",
  ];
  fs.writeFileSync(path.join(REPORTS_DIR, "source-health.md"), healthMdLines.join("\n"), "utf-8");

  // Write brief report
  const reportLines = [
    "# Force Fresh Collect Report",
    `**Run ID:** ${runId}`,
    `**Overall Status:** ${overallStatus}`,
    `**Signals:** ${scored.length}`,
    `**Sources:** ${successCount} success, ${failCount} failed`,
    "",
    "## Source Health",
    ...healthEntries.map(h => `- ${h.source_name}: ${h.status} (${h.signal_count} signals, ${h.duration_ms}ms)`),
    "",
    `**Report:** reports/source-health.json`,
  ];
  fs.writeFileSync(path.join(REPORTS_DIR, "collect-fresh-report.md"), reportLines.join("\n"), "utf-8");

  console.log("=".repeat(60));
  console.log("✅ Force Fresh Collect Complete");
  console.log("=".repeat(60));
  console.log(`Run ID: ${runId}`);
  console.log(`Overall: ${overallStatus}`);
  console.log(`Signals: ${scored.length}`);
  console.log(`Success: ${successCount}/${sourceResults.length}`);
  console.log("");
}

main().catch(err => {
  console.error("[ERROR] Force fresh collect failed:", err);
  process.exit(1);
});
