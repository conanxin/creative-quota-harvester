/**
 * export-content-pack.ts — Pipeline Stage 6: Export Content Pack
 * Phase: 0A (dry-run)
 */
import type { ContentPackManifest, AssetRecord, CreativeBrief, SignalRecord } from "../sources/types";
import * as fs from "fs";
import * as path from "path";

export interface ContentPackExportInput {
  packId: string;
  name: string;
  description: string;
  tags: string[];
  assets: AssetRecord[];
  briefs: CreativeBrief[];
  signals: SignalRecord[];
  quotaConsumed: { tokens: number; generationCount: number };
  outputDir: string;
}

export async function exportContentPack(input: ContentPackExportInput): Promise<ContentPackManifest> {
  console.log(`[export-content-pack] Phase 0A dry-run: creating content pack ${input.packId}`);

  const manifest: ContentPackManifest = {
    id: `cqh-manifest-${input.packId}`,
    packId: input.packId,
    name: input.name,
    description: input.description,
    version: "0.1.0",
    createdAt: new Date().toISOString(),
    tags: input.tags,
    assets: input.assets.map(a => ({
      assetId: a.id,
      type: a.type,
      filePath: a.filePath,
      thumbnailPath: a.thumbnailPath,
      metadata: a.metadata,
    })),
    briefs: input.briefs.map(b => ({
      id: b.id,
      signalId: b.signalId,
      title: b.title,
      concept: b.concept,
      keywords: b.keywords,
      narrative: b.narrative,
      visualDirection: b.visualDirection,
      tone: b.tone,
      audience: b.audience,
      createdAt: b.createdAt,
      cached: b.cached,
    })),
    signals: input.signals.map(s => ({
      id: s.id,
      title: s.title,
      sourceType: s.sourceType,
      url: s.url,
      metadata: s.metadata,
    })),
    quotaConsumed: input.quotaConsumed,
  };

  // Write to creative-quota-assets/content-packs/
  const packPath = path.join(input.outputDir, "content-packs", `${input.packId}.json`);
  const contentPacksDir = path.dirname(packPath);
  if (!fs.existsSync(contentPacksDir)) {
    fs.mkdirSync(contentPacksDir, { recursive: true });
  }
  fs.writeFileSync(packPath, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`[export-content-pack] Written: ${packPath}`);

  return manifest;
}

export default exportContentPack;