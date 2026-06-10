/**
 * scripts/generate-briefs.ts — Phase 2A Creative Brief Engine
 * npm run briefs
 *
 * Reads signals from SQLite → generates Creative Briefs + Asset Plans → exports Content Packs
 */
import * as path from "path";
import * as fs from "fs";
import { createBriefsFromSignals } from "../src/pipeline/create-briefs";
import { createAssetPlans } from "../src/pipeline/create-asset-plans";
import { exportContentPacks } from "../src/pipeline/export-content-packs";
import { updateGallery } from "./update-gallery";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const ASSET_REPO_DIR = path.resolve(HARVESTER_DIR, "..", "creative-quota-assets");
const REPORTS_DIR = path.resolve(HARVESTER_DIR, "reports");
const DATA_DIR = path.resolve(HARVESTER_DIR, "data");

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

async function main() {
  console.log("=".repeat(60));
  console.log("🔮 Creative Quota Harvester — Phase 2A Creative Brief Engine");
  console.log("=".repeat(60));
  console.log("");

  // Step 1: Generate briefs from signals
  console.log("[Step 1] Selecting top signals from SQLite...");
  const { briefs, selection } = createBriefsFromSignals({
    dbPath: path.join(DATA_DIR, "signals.db"),
    maxBriefs: 5,
    signalsPerBrief: 3,
  });
  console.log(`  Selected ${selection.selected_signals.length} signals (from ${selection.total_candidates} total)`);
  console.log("  Coverage:", JSON.stringify(selection.coverage_report));
  console.log("");

  if (briefs.length === 0) {
    console.error("[ERROR] No briefs generated. Check signal database.");
    process.exit(1);
  }

  console.log(`[Step 2] Generating ${briefs.length} Creative Briefs...`);
  for (const brief of briefs) {
    console.log(`  [${brief.id}] ${brief.title.slice(0, 60)} (score=${brief.final_score.toFixed(3)})`);
    console.log(`    types: ${brief.source_types.join(", ")} | assets: ${brief.recommended_assets.join(", ")}`);
  }
  console.log("");

  // Step 2: Generate asset plans
  console.log("[Step 3] Generating Asset Plans...");
  const plans = createAssetPlans(briefs);
  console.log(`  Generated ${plans.length} asset plans`);
  console.log("");

  // Step 3: Export content packs
  console.log("[Step 4] Exporting Content Packs to creative-quota-assets...");
  const dateStr = new Date().toISOString().slice(0, 10);
  const manifest = exportContentPacks({
    briefs,
    plans,
    assetRepoDir: ASSET_REPO_DIR,
    dateStr,
  });
  console.log(`  Exported ${manifest.pack_count} packs, ${manifest.total_files} files total`);
  console.log("");

  // Step 4: Update gallery index
  console.log("[Step 5] Updating gallery index...");
  updateGallery(manifest, ASSET_REPO_DIR);
  console.log("");

  // Step 5: Write reports
  const briefsReportMd = generateBriefsReport(briefs, plans, selection);
  fs.writeFileSync(path.join(REPORTS_DIR, "latest-briefs.md"), briefsReportMd, "utf-8");
  console.log(`[Step 6] Written: reports/latest-briefs.md`);

  const cpReportMd = generateContentPacksReport(manifest);
  fs.writeFileSync(path.join(REPORTS_DIR, "latest-content-packs.md"), cpReportMd, "utf-8");
  console.log(`[Step 7] Written: reports/latest-content-packs.md`);

  console.log("");
  console.log("=".repeat(60));
  console.log("✅ Phase 2A COMPLETE");
  console.log(` Briefs: ${briefs.length} | Content Packs: ${manifest.pack_count}`);
  console.log(`   Assets repo: ${ASSET_REPO_DIR}`);
  console.log("=".repeat(60));
}

function generateBriefsReport(briefs: ReturnType<typeof createBriefsFromSignals>["briefs"], plans: ReturnType<typeof createAssetPlans>, selection: ReturnType<typeof createBriefsFromSignals>["selection"]) {
  const lines: string[] = [];
  const s = (txt: string) => lines.push(txt);

  s("# Creative Briefs Report — Phase 2A");
  s("");
  s("**Generated:** " + new Date().toISOString());
  s("**Purpose:** Transform signals into Creative Briefs + Asset Plans (no MiniMax call)");
  s("");
  s("---");
  s("");

  s("## STATUS");
  s("");
  s("| Metric | Value |");
  s("|--------|-------|");
  s("| Total Briefs | " + briefs.length + " |");
  s("| Total Asset Plans | " + plans.length + " |");
  s("| Input Signals | " + selection.total_candidates + " |");
  s("| Deduplicated | " + selection.deduplicated_count + " |");
  s("| Coverage | " + JSON.stringify(selection.coverage_report) + " |");
  s("| MiniMax Called | ❌ No |");
  s("");

  s("## BRIEFS_CREATED");
  s("");
  s("| # | ID | Title | Score | Source Types | Assets |");
  s("|---|-----|-------|-------|-------------|--------|");
  briefs.forEach((b, i) => {
    s("| " + (i+1) + " | " + b.id + " | " + b.title.slice(0, 50) + " | " + b.final_score.toFixed(3) + " | " + b.source_types.join(", ") + " | " + b.recommended_assets.join(", ") + " |");
  });
  s("");

  s("## BRIEF_DETAILS");
  s("");
  briefs.forEach((brief, i) => {
    s("### " + (i+1) + ". " + brief.title);
    s("");
    s("**ID:** `" + brief.id + "`");
    s("**Score:** " + brief.final_score.toFixed(3));
    s("**Types:** " + brief.source_types.join(", "));
    s("**Audience:** " + brief.target_audience);
    s("");
    s("**Summary:** " + brief.summary.slice(0, 200));
    s("");
    s("**Why It Matters:** " + brief.why_it_matters);
    s("");
    s("**Content Angle:** " + brief.content_angle);
    s("");
    s("**Recommended Assets:** " + brief.recommended_assets.join(", "));
    s("");
    s("**Tags:** " + brief.tags.join(", "));
    s("");
    s("**Uncertainty Notes:**");
    brief.uncertainty_notes.forEach(n => s("- " + n));
    s("");
    s("**Sources:**");
    brief.source_urls.forEach((url, si) => {
      s("- [" + brief.source_titles[si] + "](" + url + ")");
    });
    s("");
    s("---");
    s("");
  });

  return lines.join("\n");
}

function generateContentPacksReport(manifest: ReturnType<typeof exportContentPacks>) {
  const lines: string[] = [];
  const s = (txt: string) => lines.push(txt);

  s("# Content Packs Export Report — Phase 2A");
  s("");
  s("**Generated:** " + new Date().toISOString());
  s("**Total Packs:** " + manifest.pack_count);
  s("**Total Files:** " + manifest.total_files);
  s("");
  s("---");
  s("");

  s("## EXPORTED_PACKS");
  s("");
  s("| # | Title | Pack Dir | Files |");
  s("|---|-------|---------|-------|");
  manifest.briefs.forEach((b, i) => {
    s("| " + (i+1) + " | " + b.title.slice(0, 50) + " | " + b.pack_dir.split("/").slice(-2).join("/") + " | " + manifest.pack_count + " files |");
  });
  s("");

  s("## FILE_STRUCTURE");
  s("");
  s("Each content pack directory contains:");
  s("- `manifest.json` — pack metadata");
  s("- `source.json` — source signal references");
  s("- `signal.json` — signal data");
  s("- `brief.md` — full creative brief");
  s("- `facts.md` — factual basis");
  s("- `x-post.zh.md` — Chinese X (Twitter) post");
  s("- `image-prompt.md` — image generation prompt");
  s("- `video-prompt.md` — video generation prompt");
  s("- `music-prompt.md` — music generation prompt");
  s("- `webpage-outline.md` — webpage outline");
  s("- `asset-plan.json` — full asset plan");
  s("");

  return lines.join("\n");
}

main().catch(err => {
  console.error("[ERROR] Phase 2A failed:", err);
  process.exit(1);
});