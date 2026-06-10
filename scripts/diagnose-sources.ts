/**
 * scripts/diagnose-sources.ts — Phase 1R Source Diagnostics
 * npm run diagnose:sources
 *
 * Tests connectivity for each source adapter without writing to SQLite.
 */
import * as fs from "fs";
import * as path from "path";
import { diagnoseUrl } from "../src/utils/fetch-with-retry";

const REPORTS_DIR = path.resolve(__dirname, "..", "reports");
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

interface DiagnosticResult {
  source: string;
  endpoint: string;
  reachable: boolean;
  status: number | null;
  error: string | null;
  durationMs: number;
  usedCurl: boolean;
  recommendation: string;
}

const DIAGNOSTICS: Array<{
  source: string;
  endpoints: Array<{ label: string; url: string }>;
  recommendation: string;
}> = [
  {
    source: "arXiv AI",
    endpoints: [
      { label: "arXiv HTTPS API", url: "https://export.arxiv.org/api/query?search_query=cat:cs.AI&max_results=1" },
      { label: "arXiv HTTP API", url: "http://export.arxiv.org/api/query?search_query=cat:cs.AI&max_results=1" },
      { label: "arXiv RSS (fallback)", url: "https://arxiv.org/rss/cs.AI" },
    ],
    recommendation: "If HTTPS fails, fallback to HTTP. If both fail, RSS works as last resort.",
  },
  {
    source: "GitHub Open Source Radar",
    endpoints: [
      { label: "GitHub Search API", url: "https://api.github.com/search/repositories?q=topic:ai-agent+stars:>300+NOT+user:conanxin&per_page=1" },
    ],
    recommendation: "If ECONNRESET, retry with backoff. curl fallback if native fetch fails. conanxin/* is HARD-CODED excluded.",
  },
  {
    source: "Hacker News",
    endpoints: [
      { label: "HN Top Stories", url: "https://hacker-news.firebaseio.com/v0/topstories.json" },
      { label: "HN Item", url: "https://hacker-news.firebaseio.com/v0/item/1.json" },
    ],
    recommendation: "HN Firebase API should work reliably.",
  },
  {
    source: "GDELT",
    endpoints: [
      { label: "GDELT v2 DOC API (correct)", url: "https://api.gdeltproject.org/api/v2/doc/doc?format=json&mode=ArtList&maxrecords=5&query=(AI+OR+robotics)&sort=DateDesc" },
    ],
    recommendation: "Use v2 DOC API. v1 endpoint returns 404. If v2 fails, pipeline continues gracefully.",
  },
  {
    source: "Hugging Face Hub",
    endpoints: [
      { label: "HF Models API", url: "https://huggingface.co/api/models?filter=text-generation&sort=likes&direction=-1&limit=1" },
      { label: "HF Datasets API", url: "https://huggingface.co/api/datasets?filter=rag&sort=likes&direction=-1&limit=1" },
    ],
    recommendation: "If network blocked, curl fallback kicks in automatically.",
  },
  {
    source: "Open-Meteo",
    endpoints: [
      { label: "Open-Meteo API", url: "https://api.open-meteo.com/v1/forecast?latitude=39.9&longitude=116.4&daily=weather_code,temperature_2m_max&forecast_days=1" },
    ],
    recommendation: "Free API, no key. Should work reliably.",
  },
  {
    source: "The Met Collection",
    endpoints: [
      { label: "Met Search API", url: "https://collectionapi.metmuseum.org/public/collection/v1/search?q=landscape&hasImages=true&isPublicDomain=true" },
    ],
    recommendation: "Public API, no key. Should work reliably.",
  },
];

async function runDiagnostics() {
  console.log("=".repeat(60));
  console.log("🔮 Creative Quota Harvester — Phase 1R Source Diagnostics");
  console.log("=".repeat(60));
  console.log("");

  const results: DiagnosticResult[] = [];

  for (const group of DIAGNOSTICS) {
    console.log(`\n[Diagnosing] ${group.source}`);
    console.log("-".repeat(40));

    for (const ep of group.endpoints) {
      const diag = await diagnoseUrl(ep.url, ep.label);
      const result: DiagnosticResult = {
        source: group.source,
        endpoint: ep.url,
        reachable: diag.reachable,
        status: diag.status,
        error: diag.error,
        durationMs: diag.durationMs,
        usedCurl: diag.usedCurl,
        recommendation: group.recommendation,
      };
      results.push(result);

      const statusIcon = diag.reachable ? "✅" : "❌";
      const curlNote = diag.usedCurl ? " (curl fallback)" : "";
      console.log(`  ${statusIcon} [${diag.status || "N/A"}] ${ep.label}${curlNote} (${diag.durationMs}ms)`);
      if (!diag.reachable && diag.error) {
        console.log(`     Error: ${diag.error}`);
      }
    }
  }

  // Write diagnostic report
  const reportMd = generateDiagnosticReport(results);
  const reportPath = path.join(REPORTS_DIR, "source-diagnostics.md");
  fs.writeFileSync(reportPath, reportMd, "utf-8");
  console.log(`\n\n📄 Diagnostic report: ${reportPath}`);
}

function generateDiagnosticReport(results: DiagnosticResult[]): string {
  const lines: string[] = [];
  const s = (txt: string) => lines.push(txt);

  s("# Source Diagnostics Report — Phase 1R");
  s("");
  s("**Generated:** " + new Date().toISOString());
  s("**Purpose:** Network connectivity check without writing to SQLite");
  s("");
  s("---");
  s("");

  // Summary table
  s("## SUMMARY");
  s("");
  s("| Source | Status | Duration | Curl Fallback |");
  s("|--------|--------|----------|---------------|");
  const bySource = new Map<string, DiagnosticResult[]>();
  for (const r of results) {
    if (!bySource.has(r.source)) bySource.set(r.source, []);
    bySource.get(r.source)!.push(r);
  }
  for (const [source, resList] of bySource) {
    const anyOk = resList.some(r => r.reachable);
    const allOk = resList.every(r => r.reachable);
    const totalMs = resList.reduce((sum, r) => sum + r.durationMs, 0);
    const curlUsed = resList.some(r => r.usedCurl);
    const statusStr = allOk ? "✅ All OK" : anyOk ? "⚠️ Partial" : "❌ Failed";
    s("| " + source + " | " + statusStr + " | " + totalMs + "ms | " + (curlUsed ? "✅" : "❌") + " |");
  }
  s("");

  // Network-level failures
  s("## NETWORK_LEVEL_FAILURES");
  s("");
  const networkFailures = results.filter(r => !r.reachable && (
    (r.error || "").includes("ECONNRESET") ||
    (r.error || "").includes("fetch failed") ||
    (r.error || "").includes("timeout") ||
    (r.error || "").includes("network")
  ));
  if (networkFailures.length === 0) {
    s("No network-level failures detected.");
  } else {
    for (const f of networkFailures) {
      s("- **" + f.source + "**: " + (f.error || "unknown error"));
    }
  }
  s("");

  // Phase 2 readiness
  s("## PHASE_2_READINESS");
  s("");
  const reachableSources = new Set(results.filter(r => r.reachable).map(r => r.source));
  s("**Reachable sources (" + reachableSources.size + "/" + DIAGNOSTICS.length + "):** " + [...reachableSources].join(", ") || "none");
  s("");
  s("| Core Coverage Area | Required Source | Status |");
  s("|-------------------|-----------------|--------|");

  const checkRow = (area: string, src: string) => {
    const ok = reachableSources.has(src);
    return "| " + area + " | " + src + " | " + (ok ? "✅" : "⚠️") + " |";
  };

  s(checkRow("research", "arXiv AI"));
  s(checkRow("open_source", "GitHub Open Source Radar"));
  s(checkRow("dev_community", "Hacker News"));
  s(checkRow("ai_ecosystem", "Hugging Face Hub"));
  s(checkRow("news", "GDELT"));
  s(checkRow("context", "Open-Meteo"));
  s(checkRow("culture_art", "The Met Collection"));
  s("");

  const conclusion = reachableSources.size >= 4
    ? "✅ Phase 2 can proceed with working sources"
    : "⚠️ Some core sources unavailable — Phase 2 may be limited";
  s("**Conclusion:** " + conclusion);
  s("");

  return lines.join("\n");
}

main().catch(err => {
  console.error("[ERROR] Diagnostics failed:", err);
  process.exit(1);
});

async function main() {
  await runDiagnostics();
}