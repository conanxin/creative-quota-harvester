/**
 * scripts/collect.ts — Phase 1 Main Collection Script
 * npm run collect
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
  console.log("🔮 Creative Quota Harvester — Phase 1 Signal Collection");
  console.log("=".repeat(60));
  console.log("");

  // Ensure directories exist
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const store = new SQLiteStore(DB_PATH);
  await store.init();

  // ── Stage 1: Collect signals from all adapters ──────────
  console.log("[Stage 1] Collecting signals from all sources...");
  const collectResult = await collectSignals();
  const { runId, startedAt, endedAt, totalSignals, sourceResults, overallStatus, profile } = collectResult;
  console.log(`[Stage 1] Active profile: ${profile}`);

  console.log(`[Stage 1] Collected ${totalSignals} total signals from ${sourceResults.length} sources`);
  console.log("");

  // ── Stage 2: Normalize signals ─────────────────────────
  console.log("[Stage 2] Normalizing signals...");
  const allSignals = sourceResults.flatMap(r => r.signalRecords);
  const normalized = await normalizeSignals(allSignals);
  console.log(`[Stage 2] ${normalized.length} signals normalized`);
  console.log("");

  // ── Stage 3: Score signals ───────────────────────────────
  console.log("[Stage 3] Scoring signals...");
  const scored = await scoreSignals(normalized);
  console.log(`[Stage 3] ${scored.length} signals scored`);
  console.log("");

  // ── Stage 4: Write to SQLite ────────────────────────────
  console.log("[Stage 4] Writing to SQLite...");
  store.insertRun(runId);

  // Insert source stats and health
  const healthEntries: any[] = [];
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
    if (count > 0) {
      store.updateSourceStats(adapter.sourceType, count);
    }
    const healthStatus = result.skippedCooldown
      ? "skipped_cooldown"
      : result.success
        ? (count > 0 ? "success" : "partial")
        : (result.error?.includes("timeout") ? "timeout" : "failed");
    healthEntries.push({
      source_name: adapter.sourceName,
      source_type: adapter.sourceType,
      status: healthStatus,
      signal_count: count,
      query_count: result.skippedCooldown ? 0 : (result.success ? Math.max(1, result.sourceRecords.length > 0 ? 1 : 0) : 0),
      success_count: result.success && count > 0 ? 1 : 0,
      partial_count: result.success && count === 0 ? 1 : 0,
      timeout_count: result.error?.includes("timeout") ? 1 : 0,
      failed_count: !result.success && !result.skippedCooldown && !result.error?.includes("timeout") ? 1 : 0,
      skipped_cooldown_count: result.skippedCooldown ? 1 : 0,
      duration_ms: result.durationMs,
      error_summary: result.skippedCooldown
        ? `cooldown until ${result.cooldownUntil} (${result.cooldownReason})`
        : (result.error || undefined),
      last_success_at: result.success && count > 0 ? endedAt : null,
      next_allowed_at: result.cooldownUntil || null,
      profile,
    });
  }

  // Write source health JSON
  const healthPath = path.join(REPORTS_DIR, "source-health.json");
  fs.writeFileSync(healthPath, JSON.stringify({
    run_id: runId,
    generated_at: endedAt,
    overall_status: collectResult.overallStatus,
    profile,
    sources: healthEntries,
  }, null, 2), "utf-8");

  // Write source health MD
  const healthMdPath = path.join(REPORTS_DIR, "source-health.md");
  const healthMdLines = [
    "# Source Health Report",
    `**Run ID:** ${runId}`,
    `**Generated:** ${endedAt}`,
    `**Profile:** ${profile}`,
    `**Overall Status:** ${collectResult.overallStatus}`,
    "",
    "| Source | Type | Profile | Status | Signals | Q | S | P | T | F | Sk | Duration | Error / Cooldown |",
    "|--------|------|---------|--------|---------|---|---|---|---|---|---|----------|-----------------|",
    ...healthEntries.map((h: any) =>
      `| ${h.source_name} | ${h.source_type} | ${h.profile} | ${h.status} | ${h.signal_count} | ${h.query_count} | ${h.success_count} | ${h.partial_count} | ${h.timeout_count} | ${h.failed_count} | ${h.skipped_cooldown_count} | ${h.duration_ms}ms | ${h.error_summary || ""} |`
    ),
    "",
    "Legend: Q=query_count, S=success_count, P=partial_count, T=timeout_count, F=failed_count, Sk=skipped_cooldown_count",
  ];
  fs.writeFileSync(healthMdPath, healthMdLines.join("\n"), "utf-8");

  console.log(`[Stage 4] Source health written: ${healthPath}`);

  // Insert all scored signals
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

  // Finish run
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

  console.log(`[Stage 4] SQLite write complete: ${finalCount} signals for run ${runId}`);
  console.log("");

  // ── Stage 5: Generate report ───────────────────────────
  console.log("[Stage 5] Generating report...");

  const top10 = scored.slice(0, 10);
  const bySource = sourceResults.map(r => ({
    source: r.adapter.sourceName,
    sourceType: r.adapter.sourceType,
    signals: r.signalRecords.length,
    success: r.success,
    error: r.error || null,
    durationMs: r.durationMs,
  }));

  const succeededSources = bySource.filter(s => s.signals > 0).map(s => s.source);
  const failedSources = bySource.filter(s => !s.success).map(s => `${s.source} (${s.error})`);
  const noDataSources = bySource.filter(s => s.success && s.signals === 0).map(s => s.source);

  const reportMd = generateReport({
    runId,
    startedAt,
    endedAt,
    totalSignals: scored.length,
    topSignals: top10,
    bySource,
    succeededSources,
    failedSources,
    noDataSources,
    dbPath: DB_PATH,
  });

  const reportPath = path.join(REPORTS_DIR, "latest-signals.md");
  fs.writeFileSync(reportPath, reportMd, "utf-8");
  console.log(`[Stage 5] Report written: ${reportPath}`);

  // Also write JSON summary
  const reportJson = {
    runId,
    startedAt,
    endedAt,
    totalSignals: scored.length,
    succeededSources,
    failedSources,
    bySource,
    topSignals: top10.map(s => ({
      id: s.id,
      sourceType: s.sourceType,
      title: s.title,
      summary: s.summary.slice(0, 200),
      url: s.url,
      finalScore: s.finalScore,
      tags: s.tags,
    })),
  };
  const jsonPath = path.join(REPORTS_DIR, "latest-signals.json");
  fs.writeFileSync(jsonPath, JSON.stringify(reportJson, null, 2), "utf-8");

  // ── Summary ────────────────────────────────────────────
  console.log("");
  console.log("=".repeat(60));
  console.log("✅ Phase 1 Signal Collection Complete");
  console.log("=".repeat(60));
  console.log("");
  console.log(`📊 Run ID: ${runId}`);
  console.log(`📦 Total signals: ${scored.length}`);
  console.log(`✅ Successful sources (${succeededSources.length}): ${succeededSources.join(", ") || "none"}`);
  if (failedSources.length > 0) {
    console.log(`❌ Failed sources (${failedSources.length}): ${failedSources.join("; ")}`);
  }
  if (noDataSources.length > 0) {
   console.log(`⚠️  No data (${noDataSources.length}): ${noDataSources.join(", ")}`);
  }
  console.log(`📄 Report: ${reportPath}`);
  console.log(`🗄️  SQLite: ${DB_PATH}`);
  console.log("");
}

interface ReportParams {
  runId: string;
  startedAt: string;
  endedAt: string;
  totalSignals: number;
  topSignals: ScoredSignal[];
  bySource: Array<{ source: string; sourceType: string; signals: number; success: boolean; error: string | null; durationMs: number }>;
  succeededSources: string[];
  failedSources: string[];
  noDataSources: string[];
  dbPath: string;
}

function generateReport(p: ReportParams): string {
  const lines: string[] = [];
  const s = (txt: string, depth = 0) => lines.push("  ".repeat(depth) + txt);

  lines.push("# Signal Collection Report");
  lines.push("");
  lines.push("**Generated by:** Creative Quota Harvester Phase 1");
  lines.push(`**Run ID:** ${p.runId}`);
  lines.push(`**Status:** ${p.totalSignals > 0 ? "COMPLETE" : "NO_SIGNALS"}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## STATUS");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Signals | ${p.totalSignals} |`);
  lines.push(`| Successful Sources | ${p.succeededSources.length} |`);
  lines.push(`| Failed Sources | ${p.failedSources.length} |`);
  lines.push(`| No-Data Sources | ${p.noDataSources.length} |`);
  lines.push("");

  lines.push("## RUN_ID");
  lines.push("");
  lines.push(`\`${p.runId}\``);
  lines.push("");

  lines.push("## START_TIME / END_TIME");
  lines.push("");
  lines.push(`- **Started:** ${p.startedAt}`);
  lines.push(`- **Ended:** ${p.endedAt}`);
  lines.push("");

  lines.push("## SOURCE_SUMMARY");
  lines.push("");
  lines.push(`| Source | Type | Signals | Status | Duration |`);
  lines.push(`|--------|------|---------|--------|----------|`);
  for (const src of p.bySource) {
    const status = src.success ? (src.signals > 0 ? "✅ success" : "⚠️ no data") : "❌ failed";
    const error = src.error ? ` (${src.error.slice(0, 60)})` : "";
    lines.push(`| ${src.source} | ${src.sourceType} | ${src.signals} | ${status}${error} | ${src.durationMs}ms |`);
  }
  lines.push("");

  lines.push("## TOTAL_SIGNALS");
  lines.push("");
  lines.push(`${p.totalSignals} signals collected across all sources.`);
  lines.push("");

  lines.push("## TOP_10_SIGNALS");
  lines.push("");
  if (p.topSignals.length === 0) {
    lines.push("*No signals collected.*");
  } else {
    for (let i = 0; i < p.topSignals.length; i++) {
      const sig = p.topSignals[i];
      lines.push(`### ${i + 1}. ${sig.title.slice(0, 80)}`);
      lines.push("");
      lines.push(`- **ID:** ${sig.id}`);
      lines.push(`- **Source:** ${sig.sourceType}`);
      lines.push(`- **Score:** ${sig.finalScore.toFixed(3)}`);
      lines.push(`  - freshness: ${sig.freshnessScore.toFixed(3)}`);
      lines.push(`  - relevance: ${sig.relevanceScore.toFixed(3)}`);
      lines.push(`  - visual: ${sig.visualPotential.toFixed(3)}`);
      lines.push(`  - x-post: ${sig.xPostPotential.toFixed(3)}`);
      lines.push(`  - creative: ${sig.creativeAssetPotential.toFixed(3)}`);
      lines.push(`- **Summary:** ${sig.summary.slice(0, 150)}${sig.summary.length > 150 ? "…" : ""}`);
      lines.push(`- **URL:** ${sig.url || "(no URL)"}`);
      lines.push(`- **Tags:** ${sig.tags.join(", ")}`);
      lines.push(`- **Published:** ${sig.publishedAt}`);
      lines.push("");
    }
  }

  lines.push("## SOURCE_FAILURES");
  lines.push("");
  if (p.failedSources.length === 0) {
    lines.push("*No source failures.*");
  } else {
    for (const fail of p.failedSources) {
      lines.push(`- ${fail}`);
    }
  }
  lines.push("");

  lines.push("## SQLITE_PATH");
  lines.push("");
  lines.push(`\`${p.dbPath}\``);
  lines.push("");
  lines.push("Query signals for this run:");
  lines.push("```sql");
  lines.push(`SELECT * FROM signals WHERE run_id = '${p.runId}' ORDER BY final_score DESC LIMIT 20;`);
  lines.push("```");
  lines.push("");

  lines.push("## RATE_LIMIT_NOTES");
  lines.push("");
  lines.push("- **arXiv:** 1 request per 3 seconds (4 categories × 1 req)");
  lines.push("- **GitHub Radar:** 10 req/min (authenticated), 6s gap between calls");
  lines.push("- **Hacker News:** 1 req per item,120ms gap");
  lines.push("- **GDELT:** 1 request per run, graceful fallback on failure");
  lines.push("- **Hugging Face:** 1 req per 10 seconds, 1 req per dataset filter");
  lines.push("- **Open-Meteo:** 1 request per day, free API no key required");
  lines.push("- **Met Collection:** 1 request per 3 seconds, 7-day cache recommended");
  lines.push("");

  lines.push("## VALIDATION");
  lines.push("");
  lines.push(`- [ ] ${p.totalSignals >= 10 ? "✅" : "❌"} Total signals >= 10 (actual: ${p.totalSignals})`);
  lines.push(`- [ ] ${p.succeededSources.length >= 3 ? "✅" : "❌"} >= 3 successful sources (actual: ${p.succeededSources.length})`);
  lines.push(`- [ ] SQLite signals table queryable`);
  lines.push(`- [ ] Report generated at reports/latest-signals.md`);
  lines.push(`- [ ] No conanxin/* repos in results`);
  lines.push("");

  lines.push("## LIMITATIONS");
  lines.push("");
  lines.push("- arXiv may be rate-limited if run too frequently");
  lines.push("- GitHub Radar unauthenticated mode has 10 req/min limit");
  lines.push("- GDELT API may return empty results for niche queries");
  lines.push("- Met Collection API limited to public domain objects");
  lines.push("- No cron/systemd in Phase 1 — manual execution only");
  lines.push("- Phase 1 is experimental — expect adapter changes");
  lines.push("");

  lines.push("## NEXT_PHASE_PROPOSAL");
  lines.push("");
  lines.push("**Phase 2 — Creative Brief Engine:**");
  lines.push("- LLM-powered CreativeBrief generation from real signals");
  lines.push("- Quota-aware AssetPlan scheduling");
  lines.push("- MiniMax image/music/video generation integration");
  lines.push("- Telegram daily digest reports");
  lines.push("");

  return lines.join("\n");
}

main().catch(err => {
  console.error("[ERROR] Collection failed:", err);
  process.exit(1);
});