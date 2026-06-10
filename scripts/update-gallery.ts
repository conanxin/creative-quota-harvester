/**
 * scripts/update-gallery.ts — Update creative-quota-assets gallery indices
 * Phase 2A
 */
import * as fs from "fs";
import * as path from "path";
import type { ExportManifest } from "../src/pipeline/export-content-packs";

interface GalleryAsset {
  id: string;
  title: string;
  source_types: string[];
  recommended_assets: string[];
  tags: string[];
  final_score: number;
  created_at: string;
  content_pack_dir: string;
}

interface SourceIndex {
  [key: string]: string[]; // source_type -> pack ids
}

interface DailyIndex {
  [date: string]: string[]; // date -> pack ids
}

export function updateGallery(manifest: ExportManifest, assetRepoDir: string) {
  const galleryDir = path.join(assetRepoDir, "gallery");
  const metaDir = path.join(assetRepoDir, "metadata");

  // --- Gallery assets.json ---
  const galleryPath = path.join(galleryDir, "assets.json");
  let galleryAssets: GalleryAsset[] = [];
  if (fs.existsSync(galleryPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(galleryPath, "utf-8"));
      // Handle legacy format { assets: [...], version, ... }
      if (Array.isArray(parsed)) {
        galleryAssets = parsed;
      } else if (Array.isArray(parsed.assets)) {
        galleryAssets = parsed.assets;
      }
    } catch { /* ignore */ }
  }

  const newAssets: GalleryAsset[] = manifest.briefs.map(b => ({
    id: b.id,
    title: b.title,
    source_types: b.source_types,
    recommended_assets: [],
    tags: [],
    final_score: b.final_score,
    created_at: manifest.exported_at,
    content_pack_dir: b.pack_dir,
  }));

  // Merge, avoid duplicates by id
  const existingIds = new Set(galleryAssets.map(a => a.id));
  for (const asset of newAssets) {
    if (!existingIds.has(asset.id)) galleryAssets.push(asset);
  }
  galleryAssets.sort((a, b) => b.final_score - a.final_score);

  // Write back as legacy format with version envelope
  const output = {
    version: "0.2.0",
    updatedAt: new Date().toISOString(),
    totalAssets: galleryAssets.length,
    assets: galleryAssets,
  };
  fs.writeFileSync(path.join(galleryDir, "assets.json"), JSON.stringify(output, null, 2), "utf-8");
  console.log("  Updated gallery/assets.json (" + galleryAssets.length + " total assets)");

  // --- Source index ---
  const sourceIndexPath = path.join(metaDir, "source-index.json");
  let sourceIndex: SourceIndex = {};
  if (fs.existsSync(sourceIndexPath)) {
    try { sourceIndex = JSON.parse(fs.readFileSync(sourceIndexPath, "utf-8")); } catch { /* ignore */ }
  }

  for (const brief of manifest.briefs) {
    for (const st of brief.source_types) {
      if (!sourceIndex[st]) sourceIndex[st] = [];
      if (!sourceIndex[st].includes(brief.id)) sourceIndex[st].push(brief.id);
    }
  }
  fs.writeFileSync(sourceIndexPath, JSON.stringify(sourceIndex, null, 2), "utf-8");
  console.log("  Updated metadata/source-index.json");

  // --- Daily index ---
  const dailyIndexPath = path.join(metaDir, "daily-index.json");
  let dailyIndex: DailyIndex = {};
  if (fs.existsSync(dailyIndexPath)) {
    try { dailyIndex = JSON.parse(fs.readFileSync(dailyIndexPath, "utf-8")); } catch { /* ignore */ }
  }

  const today = manifest.exported_at.slice(0, 10);
  if (!dailyIndex[today]) dailyIndex[today] = [];
  for (const brief of manifest.briefs) {
    if (!dailyIndex[today].includes(brief.id)) dailyIndex[today].push(brief.id);
  }
  fs.writeFileSync(dailyIndexPath, JSON.stringify(dailyIndex, null, 2), "utf-8");
  console.log("  Updated metadata/daily-index.json");

  // --- Asset index ---
  const assetIndexPath = path.join(metaDir, "asset-index.json");
  let assetIndex: GalleryAsset[] = [];
  if (fs.existsSync(assetIndexPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(assetIndexPath, "utf-8"));
      assetIndex = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.assets) ? parsed.assets : []);
    } catch { assetIndex = []; }
  }

  const existingAssetIds = new Set(assetIndex.map(a => a.id));
  for (const asset of newAssets) {
    if (!existingAssetIds.has(asset.id)) assetIndex.push(asset);
  }
  assetIndex.sort((a, b) => b.final_score - a.final_score);
  const assetOutput = {
    version: "0.2.0",
    generatedAt: new Date().toISOString(),
    totalAssets: assetIndex.length,
    assets: assetIndex,
  };
  fs.writeFileSync(assetIndexPath, JSON.stringify(assetOutput, null, 2), "utf-8");
  console.log("  Updated metadata/asset-index.json (" + assetIndex.length + " total)");
}