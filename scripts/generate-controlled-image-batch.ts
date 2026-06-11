#!/usr/bin/env tsx
/**
 * Phase 3D: Controlled Image Batch with Guard
 * 
 * Generates exactly 2 images from content packs using
 * Phase 4G enhanced prompts (image-prompt.enriched.md).
 * 
 * Requirements:
 *   - confirm_spend must be true
 *   - max_count = 2
 *   - quota guard must pass
 *   - Only generates images, no music/video
 *   - Uses image-prompt.enriched.md (not plain image-prompt.md)
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';

import { evaluateGeneration, checkEnvFlag, GenerationRequest } from '../src/generators/generation-guard';
import { checkQuota, formatQuotaSummary } from '../src/generators/minimax-quota-guard';

const ASSET_REPO = process.env.CREATIVE_QUOTA_ASSETS_PATH
  || join(__dirname, '../../creative-quota-assets');

const CONTENT_PACKS_DIR = join(ASSET_REPO, 'content-packs');
const IMAGES_DIR = join(ASSET_REPO, 'images');
const METADATA_DIR = join(ASSET_REPO, 'metadata');

interface PackSelection {
  packDir: string;
  packDirRelative: string;
  sourceType: string;
  title: string;
  enrichedPrompt: string;
  aspectRatio: string;
}

function execMmx(cmd: string): string {
  const env = { ...process.env };
  delete env.https_proxy;
  delete env.http_proxy;
  delete env.all_proxy;
  delete env.no_proxy;
  return execSync(cmd, {
    env,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });
}

function findContentPacks(): string[] {
  const packs: string[] = [];
  const years = readdirSync(CONTENT_PACKS_DIR).filter(y => statSync(join(CONTENT_PACKS_DIR, y)).isDirectory());
  for (const year of years) {
    const months = readdirSync(join(CONTENT_PACKS_DIR, year)).filter(m => statSync(join(CONTENT_PACKS_DIR, year, m)).isDirectory());
    for (const month of months) {
      const days = readdirSync(join(CONTENT_PACKS_DIR, year, month)).filter(d => statSync(join(CONTENT_PACKS_DIR, year, month, d)).isDirectory());
      for (const day of days) {
        const packsDir = join(CONTENT_PACKS_DIR, year, month, day);
        const items = readdirSync(packsDir).filter(i => statSync(join(packsDir, i)).isDirectory());
        for (const item of items) {
          packs.push(join(packsDir, item));
        }
      }
    }
  }
  return packs;
}

function hasGeneratedImage(packDir: string): boolean {
  // Check if this pack already has a generated image in generated-assets.json
  const metaPath = join(METADATA_DIR, 'generated-assets.json');
  if (!existsSync(metaPath)) return false;
  try {
    const assets = JSON.parse(readFileSync(metaPath, 'utf-8'));
    return assets.some((a: any) => a.content_pack === basename(packDir));
  } catch { return false; }
}

function getPackInfo(packDir: string): { sourceType: string; title: string; priority: string } {
  const metaPath = join(packDir, 'image-prompt.meta.json');
  if (!existsSync(metaPath)) {
    // Fallback to detail.json
    const detailPath = join(packDir, 'detail.json');
    if (existsSync(detailPath)) {
      try {
        const detail = JSON.parse(readFileSync(detailPath, 'utf-8'));
        return {
          sourceType: detail.source_type || 'unknown',
          title: detail.title || basename(packDir),
          priority: 'medium',
        };
      } catch { }
    }
    return { sourceType: 'unknown', title: basename(packDir), priority: 'medium' };
  }
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    return {
      sourceType: meta.source_type || 'unknown',
      title: meta.title || basename(packDir),
      priority: meta.priority || 'medium',
    };
  } catch {
    return { sourceType: 'unknown', title: basename(packDir), priority: 'medium' };
  }
}

function selectPacks(): PackSelection[] {
  const allPacks = findContentPacks();
  const candidates: PackSelection[] = [];

  for (const packDir of allPacks) {
    if (hasGeneratedImage(packDir)) continue;
    const enrichedPath = join(packDir, 'image-prompt.enriched.md');
    if (!existsSync(enrichedPath)) continue;
    
    const enrichedContent = readFileSync(enrichedPath, 'utf-8');
    // Extract English prompt
    const promptMatch = enrichedContent.match(/```text\n([\s\S]*?)```/);
    if (!promptMatch) continue;
    
    const info = getPackInfo(packDir);
    const aspectMatch = enrichedContent.match(/Aspect ratio[\s\S]*?\*\*[\s]*([^\n]+)/);
    const aspectRatio = aspectMatch ? aspectMatch[1].trim() : '16:9';
    
    candidates.push({
      packDir,
      packDirRelative: packDir.replace(ASSET_REPO + '/', ''),
      sourceType: info.sourceType,
      title: info.title,
      enrichedPrompt: promptMatch[1].trim(),
      aspectRatio,
    });
  }

  // Group by source type
  const byType: Record<string, PackSelection[]> = {};
  for (const c of candidates) {
    if (!byType[c.sourceType]) byType[c.sourceType] = [];
    byType[c.sourceType].push(c);
  }

  // Select 2 different source types
  const selected: PackSelection[] = [];
  const types = Object.keys(byType).sort((a, b) => byType[b].length - byType[a].length);
  
  // Prioritize types not yet generated: dev-community, ai-ecosystem
  const typePriority = ['dev-community', 'ai-ecosystem', 'academic', 'code', 'culture-art'];
  for (const t of typePriority) {
    if (byType[t] && byType[t].length > 0) {
      selected.push(byType[t][0]);
      if (selected.length >= 2) break;
    }
  }
  // If still not 2, fill with any available
  if (selected.length < 2) {
    for (const t of types) {
      if (selected.length >= 2) break;
      if (!selected.find(s => s.sourceType === t)) {
        selected.push(byType[t][0]);
      }
    }
  }

  return selected;
}

async function runQuotaGuard(): Promise<boolean> {
  console.log('\n[Quota Guard] Checking MiniMax quota...');
  const quota = await checkQuota();
  console.log(formatQuotaSummary(quota));
  if (quota.decision === 'BLOCK') {
    console.log('[Quota Guard] BLOCKED: Quota below 50% threshold.');
    return false;
  }
  if (quota.decision === 'ERROR') {
    console.log('[Quota Guard] BLOCKED: Could not verify quota (error). Blocking by default.');
    return false;
  }
  console.log('[Quota Guard] PASSED.');
  return true;
}

function runGenerationGuard(params: {
  media_type: string;
  max_count: number;
  confirm_spend: boolean;
  dry_run: boolean;
  command_hint?: string;
}): { allowed: boolean; reason: string; isDryRun: boolean } {
  const request: GenerationRequest = {
    media_type: params.media_type as 'image' | 'music' | 'video' | null,
    max_count: params.max_count,
    confirm_spend: params.confirm_spend,
    dry_run: params.dry_run,
    command_hint: params.command_hint,
  };
  const decision = evaluateGeneration(request);
  console.log(`[Generation Guard] ${decision.decision}: ${decision.reason}`);
  return {
    allowed: decision.decision === 'ALLOW' || decision.decision === 'ALLOW_DRY_RUN',
    reason: decision.reason,
    isDryRun: decision.decision === 'ALLOW_DRY_RUN',
  };
}

function generateImage(pack: PackSelection, index: number): { path: string; assetId: string; filename: string } {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  const datePath = dateStr.replace(/-/g, '/');
  const prefix = `cqa-${dateStr}-gen-${String(4 + index).padStart(3, '0')}`; // Continue from 004
  const dir = join(IMAGES_DIR, datePath);
  mkdirSync(dir, { recursive: true });

  const aspectRatio = pack.aspectRatio === '4:3' ? '4:3' : pack.aspectRatio === '4:5' ? '4:5' : '16:9';
  
  console.log(`\n[Generate] ${index + 1}/2: ${pack.title}`);
  console.log(`  Source: ${pack.sourceType}`);
  console.log(`  Prompt: ${pack.enrichedPrompt.substring(0, 80)}...`);
  console.log(`  Aspect: ${aspectRatio}`);
  console.log(`  Output: ${dir}/${prefix}_001.jpg`);

  try {
    const output = execMmx(
      `mmx image generate ` +
      `--prompt "${pack.enrichedPrompt.replace(/"/g, '\\"')}" ` +
      `--model image-01 ` +
      `--aspect-ratio ${aspectRatio} ` +
      `--out-dir "${dir}" ` +
      `--out-prefix ${prefix} ` +
      `--aigc-watermark ` +
      `--quiet`
    );

    const parsed = JSON.parse(output);
    if (parsed.saved && parsed.saved.length > 0) {
      const savedPath = parsed.saved[0];
      const filename = basename(savedPath);
      const assetId = prefix;
      console.log(`  Saved: ${savedPath}`);
      return { path: savedPath.replace(ASSET_REPO + '/', ''), assetId, filename };
    } else {
      throw new Error('No saved path in response: ' + output);
    }
  } catch (err: any) {
    console.error(`  Generation failed: ${err.message || err}`);
    throw err;
  }
}

function updateMetadata(pack: PackSelection, result: { path: string; assetId: string; filename: string }) {
  const metaPath = join(METADATA_DIR, 'generated-assets.json');
  let assets: Record<string, any>[] = [];
  if (existsSync(metaPath)) {
    try { assets = JSON.parse(readFileSync(metaPath, 'utf-8')); } catch { assets = []; }
  }
  
  const date = new Date();
  const stat = statSync(join(ASSET_REPO, result.path));
  const fileSizeKb = Math.round(stat.size / 1024);
  
  assets.push({
    asset_id: result.assetId,
    filename: result.filename,
    path: result.path,
    model: 'image-01',
    prompt: pack.enrichedPrompt,
    aspect_ratio: pack.aspectRatio,
    content_pack: basename(pack.packDir),
    source_type: pack.sourceType,
    generated_at: date.toISOString(),
    watermark: true,
    file_size_kb: fileSizeKb,
  });
  
  writeFileSync(metaPath, JSON.stringify(assets, null, 2));
  console.log(`  Updated metadata/generated-assets.json (${assets.length} assets)`);
}

function updateGalleryJson() {
  // Update gallery/assets.json
  const galleryJsonPath = join(ASSET_REPO, 'gallery/assets.json');
  let galleryAssets: any[] = [];
  if (existsSync(galleryJsonPath)) {
    try { galleryAssets = JSON.parse(readFileSync(galleryJsonPath, 'utf-8')); } catch { galleryAssets = []; }
  }
  
  const metaPath = join(METADATA_DIR, 'generated-assets.json');
  if (!existsSync(metaPath)) return;
  const assets = JSON.parse(readFileSync(metaPath, 'utf-8'));
  
  // Rebuild gallery assets from generated-assets.json
  const newGalleryAssets = assets.map((a: any) => ({
    asset_id: a.asset_id,
    filename: a.filename,
    path: a.path,
    source_type: a.source_type,
    content_pack: a.content_pack,
    generated_at: a.generated_at,
    thumbnail_hint: a.aspect_ratio,
  }));
  
  writeFileSync(galleryJsonPath, JSON.stringify(newGalleryAssets, null, 2));
  console.log(`  Updated gallery/assets.json (${newGalleryAssets.length} items)`);
}

async function main() {
  console.log('=== Phase 3D: Controlled Image Batch with Guard ===');
  console.log('Target: 2 images, 0 music, 0 video');
  console.log(`Asset repo: ${ASSET_REPO}`);

  // Step 1: Select packs
  const selectedPacks = selectPacks();
  console.log(`\n[Selection] Found ${selectedPacks.length} candidate packs`);
  for (const p of selectedPacks) {
    console.log(`  - ${p.title} (${p.sourceType})`);
  }

  if (selectedPacks.length < 2) {
    console.error('ERROR: Not enough candidate packs (need 2)');
    process.exit(1);
  }

  // Step 2: Run Generation Guard
  const guardResult = runGenerationGuard({
    media_type: 'image',
    max_count: 2,
    confirm_spend: true,
    dry_run: false,
    command_hint: 'generate 2 images for selected content packs',
  });

  if (!guardResult.allowed) {
    console.log('\n[Generation Guard] DENIED. Exiting.');
    process.exit(1);
  }

  if (guardResult.isDryRun) {
    console.log('\n[Dry-Run] Would generate:');
    for (const p of selectedPacks) {
      console.log(`  - ${p.title}: ${p.enrichedPrompt.substring(0, 60)}...`);
    }
    console.log('Dry-run complete. No images generated.');
    process.exit(0);
  }

  // Step 3: Run Quota Guard
  const quotaOk = await runQuotaGuard();
  if (!quotaOk) {
    console.log('\n[Quota Guard] DENIED. Exiting.');
    process.exit(1);
  }

  // Step 4: Generate 2 images
  const results: { pack: PackSelection; result: { path: string; assetId: string; filename: string } }[] = [];
  for (let i = 0; i < 2; i++) {
    try {
      const result = generateImage(selectedPacks[i], i);
      results.push({ pack: selectedPacks[i], result });
      updateMetadata(selectedPacks[i], result);
    } catch (err) {
      console.error(`\nFailed to generate image ${i + 1}: ${err}`);
      process.exit(1);
    }
  }

  // Step 5: Update gallery
  updateGalleryJson();

  // Summary
  console.log('\n=== Phase 3D Complete ===');
  for (const r of results) {
    console.log(`\n✅ ${r.pack.title}`);
    console.log(`   File: ${r.result.path}`);
    console.log(`   Asset: ${r.result.assetId}`);
  }
  console.log(`\nGenerated: 2 images, 0 music, 0 video`);
  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
