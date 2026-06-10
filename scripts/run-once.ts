/**
 * Creative Quota Harvester — Phase 0A Dry-Run (Updated)
 *
 * Executes the full pipeline using Phase 2A real adapters:
 *   collect-signals → create-briefs → create-asset-plans → export-content-packs
 *
 * NO real API calls. NO MiniMax generation. NO cron. NO systemd.
 * Uses signals already stored in SQLite from previous npm run collect.
 */

import * as path from "path";
import * as fs from "fs";
import createBriefsFromSignals from "../src/pipeline/create-briefs";
import { createAssetPlans } from "../src/pipeline/create-asset-plans";
import { exportContentPacks } from "../src/pipeline/export-content-packs";
import { updateGallery } from "./update-gallery";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const ASSET_REPO_DIR = path.resolve(HARVESTER_DIR, "..", "creative-quota-assets");
const DATA_DIR = path.join(HARVESTER_DIR, "data");

async function main() {
  console.log("=".repeat(60));
  console.log("🔮 Creative Quota Harvester — Phase 0A (Updated)");
  console.log("=".repeat(60));
  console.log("");

  // ── Stage 1: Select signals + Create briefs ─────────────
  console.log("[Pipeline] Stage 1-2: select-signals → create-briefs");
  const { briefs, selection } = createBriefsFromSignals({
    dbPath: path.join(DATA_DIR, "signals.db"),
    maxBriefs: 5,
    signalsPerBrief: 3,
  });
  console.log(`  → ${briefs.length} CreativeBriefs from ${selection.selected_signals.length} signals`);
  briefs.forEach(b => {
    console.log(`  [${b.id.slice(0, 16)}] ${b.title.slice(0, 60)} (score=${b.final_score.toFixed(3)})`);
  });
  console.log("");

  // ── Stage 2: Create asset plans ──────────────────────────
  console.log("[Pipeline] Stage 3: create-asset-plans");
  const plans = createAssetPlans(briefs);
  console.log(`  → ${plans.length} AssetPlans created`);
  plans.forEach(p => {
    const types = p.recommended_outputs.map(o => o.type).join(", ");
    console.log(`  [${p.brief_id.slice(0, 16)}] ${p.brief_title.slice(0, 50)} → ${types}`);
  });
  console.log("");

  // ── Stage 3: Export content packs ───────────────────────
  console.log("[Pipeline] Stage 4: export-content-packs");
  const dateStr = new Date().toISOString().slice(0, 10);
  const manifest = exportContentPacks({
    briefs,
    plans,
    assetRepoDir: ASSET_REPO_DIR,
    dateStr,
  });
  console.log(`  → ${manifest.pack_count} packs, ${manifest.total_files} files`);
  console.log("");

  // ── Stage 4: Update gallery ─────────────────────────────
  console.log("[Pipeline] Stage 5: update-gallery");
  updateGallery(manifest, ASSET_REPO_DIR);
  console.log("");

  // ── Summary ─────────────────────────────────────────────
  console.log("=".repeat(60));
  console.log("✅ Phase 0A (Updated) Complete");
  console.log("=".repeat(60));
  console.log("");
  console.log("📦 Outputs:");
  console.log(`  Content Packs: ${manifest.pack_count} briefs → creative-quota-assets/content-packs/`);
  console.log(`  Gallery: creative-quota-assets/gallery/assets.json`);
  console.log("");
  console.log("📊 Pipeline Stats:");
  console.log(`  Signals read: ${selection.total_candidates}`);
  console.log(`  Signals selected: ${selection.selected_signals.length}`);
  console.log(`  Creative briefs: ${briefs.length}`);
  console.log(`  Asset plans: ${plans.length}`);
  console.log("");
  console.log("⏭️  Next: Phase 2B — Real MiniMax generation with API key in .env");
  console.log("");
}

main().catch(err => {
  console.error("[ERROR] Phase 0A updated run failed:", err);
  process.exit(1);
});