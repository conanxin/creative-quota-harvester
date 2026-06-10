#!/usr/bin/env npx ts-node
/**
 * MiniMax Image Canary Generator — Phase 3A
 * 
 * Generates a single test image from a content pack's image-prompt.md
 * using the MiniMax Token Plan via mmx CLI.
 * 
 * Usage:
 *   npm run generate:image:canary
 * 
 * Prerequisites:
 *   - MINIMAX_API_KEY in .env
 *   - mmx CLI installed and authenticated
 *   - Content pack with image-prompt.md
 * 
 * Output:
 *   - Image saved to creative-quota-assets/images/YYYY/MM/
 *   - metadata/generated-assets.json updated
 *   - gallery/assets.json updated
 *   - asset-index.json updated
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { load } from 'js-yaml';

const ASSET_REPO = process.env.CREATIVE_QUOTA_ASSETS_PATH 
  || join(__dirname, '../../creative-quota-assets');

const CONTENT_PACKS_DIR = join(ASSET_REPO, 'content-packs');
const IMAGES_DIR = join(ASSET_REPO, 'images');
const METADATA_DIR = join(ASSET_REPO, 'metadata');

interface ContentPack {
  manifest: {
    pack_id: string;
    source_type: string;
    score?: number;
  };
  imagePrompt?: string;
}

function execMmx(cmd: string): string {
  // mmx CLI needs proxy vars unset
  const env = { ...process.env };
  delete env.https_proxy;
  delete env.http_proxy;
  delete env.all_proxy;
  delete env.no_proxy;
  return execSync(cmd, { 
    env, 
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024
  });
}

function findContentPacks(): string[] {
  try {
    const result = execSync(
      `find "${CONTENT_PACKS_DIR}" -name "image-prompt.md" -type f 2>/dev/null | head -20`,
      { encoding: 'utf-8' }
    );
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function loadContentPack(imagePromptPath: string): { packDir: string; prompt: string } {
  const packDir = dirname(imagePromptPath);
  const prompt = readFileSync(imagePromptPath, 'utf-8').trim();
  return { packDir, prompt };
}

function loadManifest(packDir: string): Record<string, unknown> {
  const manifestPath = join(packDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    return JSON.parse(readFileSync(manifestPath, 'utf-8'));
  }
  return {};
}

function generateImage(prompt: string, outputPath: string): { success: boolean; savedPath?: string; error?: string } {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/');
  const prefix = `cqa-${date.toISOString().split('T')[0]}-canary-001`;
  
  const dir = join(IMAGES_DIR, dateStr);
  mkdirSync(dir, { recursive: true });

  try {
    const output = execMmx(
      `mmx image generate ` +
      `--prompt "${prompt.replace(/"/g, '\\"')}" ` +
      `--model image-01 ` +
      `--aspect-ratio 16:9 ` +
      `--out-dir "${dir}" ` +
      `--out-prefix ${prefix} ` +
      `--aigc-watermark ` +
      `--quiet`
    );
    
    const parsed = JSON.parse(output);
    if (parsed.saved && parsed.saved.length > 0) {
      return { success: true, savedPath: parsed.saved[0] };
    }
    return { success: false, error: 'No saved path in response' };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

function updateGeneratedAssets(assetPath: string, prompt: string, packDir: string): void {
  const metaPath = join(METADATA_DIR, 'generated-assets.json');
  let assets: Record<string, unknown>[] = [];
  
  if (existsSync(metaPath)) {
    try {
      assets = JSON.parse(readFileSync(metaPath, 'utf-8'));
    } catch {
      assets = [];
    }
  }
  
  const filename = basename(assetPath);
  const assetId = `cqa-${new Date().toISOString().split('T')[0]}-canary-001`;
  
  assets.push({
    asset_id: assetId,
    filename,
    path: assetPath.replace(ASSET_REPO + '/', ''),
    model: 'image-01',
    prompt,
    aspect_ratio: '16:9',
    content_pack: basename(packDir),
    generated_at: new Date().toISOString(),
    watermark: true,
  });
  
  writeFileSync(metaPath, JSON.stringify(assets, null, 2));
}

async function main() {
  console.log('=== MiniMax Image Canary Generator ===');
  console.log(`Asset repo: ${ASSET_REPO}`);
  
  // Find content packs with image prompts
  const imagePrompts = findContentPacks();
  if (imagePrompts.length === 0) {
    console.error('No content packs with image-prompt.md found');
    process.exit(1);
  }
  
  // Pick first pack (or could sort by score)
  const selectedPrompt = imagePrompts[0];
  console.log(`Selected: ${selectedPrompt}`);
  
  const { packDir, prompt } = loadContentPack(selectedPrompt);
  const manifest = loadManifest(packDir);
  
  console.log(`Pack: ${basename(packDir)}`);
  console.log(`Source: ${manifest.source_type || 'unknown'}`);
  console.log(`Prompt: ${prompt.substring(0, 80)}...`);
  
  // Generate image
  console.log('\nGenerating image...');
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/');
  const outputDir = join(IMAGES_DIR, dateStr);
  const prefix = `cqa-${date.toISOString().split('T')[0]}-canary-001`;
  const outputPath = join(outputDir, `${prefix}_001.jpg`);
  
  const result = generateImage(prompt, outputPath);
  
  if (!result.success || !result.savedPath) {
    console.error('Generation failed:', result.error);
    process.exit(1);
  }
  
  console.log(`Saved: ${result.savedPath}`);
  
  // Update metadata
  updateGeneratedAssets(result.savedPath, prompt, packDir);
  console.log('Updated metadata/generated-assets.json');
  
  console.log('\nDone!');
  console.log(`Image: ${result.savedPath}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
