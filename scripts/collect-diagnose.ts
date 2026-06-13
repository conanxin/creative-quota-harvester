#!/usr/bin/env npx ts-node
/**
 * scripts/collect-diagnose.ts — Phase 4C-4
 * Lightweight connectivity check for each source.
 * Does NOT write to SQLite or generate full reports.
 */
import { arxivAiAdapter } from "../src/sources/academic/arxiv-ai";
import { githubOpenSourceRadarAdapter } from "../src/sources/code/github-open-source-radar";
import { hackernewsAdapter } from "../src/sources/dev-community/hackernews";
import { gdeltAdapter } from "../src/sources/news/gdelt";
import { huggingfaceHubAdapter } from "../src/sources/ai-ecosystem/huggingface-hub";
import { openMeteoAdapter } from "../src/sources/context/open-meteo";
import { dateContextAdapter } from "../src/sources/context/date-context";
import { solarTermsAdapter } from "../src/sources/context/solar-terms";
import { metCollectionAdapter } from "../src/sources/culture-art/met-collection";
import { fetchWithRetry } from "../src/utils/fetch-with-retry";
import * as fs from "fs";
import * as path from "path";

const REPORTS_DIR = path.join(__dirname, "..", "reports");

const DIAGNOSE_TARGETS = [
  { name: "arXiv API", url: "https://export.arxiv.org/api/query?search_query=cat:cs.AI&max_results=1", adapter: arxivAiAdapter },
  { name: "GitHub API", url: "https://api.github.com/search/repositories?q=topic:ai-agent+stars:>300&per_page=1", adapter: githubOpenSourceRadarAdapter },
  { name: "Hacker News", url: "https://hacker-news.firebaseio.com/v0/topstories.json", adapter: hackernewsAdapter },
  { name: "GDELT", url: "https://api.gdeltproject.org/api/v2/doc/doc?format=json&mode=ArtList&maxrecords=1&query=AI", adapter: gdeltAdapter },
  { name: "Hugging Face", url: "https://huggingface.co/api/models?filter=text-generation&limit=1", adapter: huggingfaceHubAdapter },
  { name: "Open-Meteo", url: "https://api.open-meteo.com/v1/forecast?latitude=31.2&longitude=121.5&current_weather=true", adapter: openMeteoAdapter },
  { name: "Met Collection", url: "https://collectionapi.metmuseum.org/public/collection/v1/search?q=landscape&hasImages=true&isPublicDomain=true", adapter: metCollectionAdapter },
];

async function main() {
  console.log("=== Source Connectivity Diagnosis ===");
  const results: Array<{
    source: string;
    type: string;
    reachable: boolean;
    status: number | null;
    durationMs: number;
    error: string | null;
    curlFallback: boolean;
  }> = [];

  for (const target of DIAGNOSE_TARGETS) {
    const start = Date.now();
    try {
      const result = await fetchWithRetry({ url: target.url, timeoutMs: 15000, retries: 1 });
      const durationMs = Date.now() - start;
      results.push({
        source: target.adapter.sourceName,
        type: target.adapter.sourceType,
        reachable: result.ok,
        status: result.status,
        durationMs,
        error: result.error || null,
        curlFallback: result.usedCurlFallback,
      });
      console.log(`[diagnose] ${target.adapter.sourceName}: ${result.ok ? "OK" : "FAIL"} HTTP ${result.status} (${durationMs}ms, curl=${result.usedCurlFallback})`);
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      results.push({
        source: target.adapter.sourceName,
        type: target.adapter.sourceType,
        reachable: false,
        status: null,
        durationMs,
        error: (err as Error).message,
        curlFallback: false,
      });
      console.log(`[diagnose] ${target.adapter.sourceName}: ERROR ${(err as Error).message} (${durationMs}ms)`);
    }
  }

  // Context sources are local, always reachable
  for (const adapter of [dateContextAdapter, solarTermsAdapter]) {
    const start = Date.now();
    try {
      const records = await adapter.fetch();
      const durationMs = Date.now() - start;
      results.push({
        source: adapter.sourceName,
        type: adapter.sourceType,
        reachable: true,
        status: 200,
        durationMs,
        error: null,
        curlFallback: false,
      });
      console.log(`[diagnose] ${adapter.sourceName}: OK local (${durationMs}ms, ${records.length} records)`);
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      results.push({
        source: adapter.sourceName,
        type: adapter.sourceType,
        reachable: false,
        status: null,
        durationMs,
        error: (err as Error).message,
        curlFallback: false,
      });
      console.log(`[diagnose] ${adapter.sourceName}: ERROR ${(err as Error).message} (${durationMs}ms)`);
    }
  }

  const jsonPath = path.join(REPORTS_DIR, "source-diagnostics.json");
  const mdPath = path.join(REPORTS_DIR, "source-diagnostics.md");
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  fs.writeFileSync(jsonPath, JSON.stringify({ generated_at: new Date().toISOString(), sources: results }, null, 2), "utf-8");

  const mdLines = [
    "# Source Diagnostics Report",
    `**Generated:** ${new Date().toISOString()}`,
    "",
    "| Source | Type | Reachable | Status | Duration | Error |",
    "|--------|------|-----------|--------|----------|-------|",
    ...results.map(r => `| ${r.source} | ${r.type} | ${r.reachable ? "✅" : "❌"} | ${r.status ?? "N/A"} | ${r.durationMs}ms | ${r.error || ""} |`),
    "",
  ];
  fs.writeFileSync(mdPath, mdLines.join("\n"), "utf-8");

  console.log(`\n=== Diagnosis Complete ===`);
  const reachable = results.filter(r => r.reachable).length;
  console.log(`Reachable: ${reachable}/${results.length}`);
  console.log(`Reports: ${jsonPath}, ${mdPath}`);
}

main().catch(err => {
  console.error("[ERROR] Diagnosis failed:", err);
  process.exit(1);
});
