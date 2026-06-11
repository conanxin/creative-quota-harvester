#!/usr/bin/env npx ts-node
/**
 * MiniMax Image Canary Generator — Phase 3C (integrated guard)
 * 
 * Generates a single test image from a content pack's image-prompt.md
 * using the MiniMax Token Plan via mmx CLI.
 * 
 * IMPORTANT: Phase 3C integration
 * This script now enforces the generation guard. Real generation
 * requires: confirm_spend=true, media_type=image, max_count <= 2,
 * and quota guard must pass.
 * 
 * Usage:
 *   npm run generate:image:canary          # legacy (dry-run mode)
 *   npm run generate:image:dry-run         # explicit dry-run
 *   npm run generate:image:confirmed       # real generation (requires CQA_ALLOW_GENERATION=1)
 * 
 * Prerequisites:
 *   - mmx CLI installed and authenticated
 *   - Content pack with image-prompt.md
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';

import { evaluateGeneration, checkEnvFlag, GenerationRequest } from './generation-guard';
import { checkQuota, formatQuotaSummary } from './minimax-quota-guard';

const ASSET_REPO = process.env.CREATIVE_QUOTA_ASSETS_PATH
  || join(__dirname, '../../../creative-quota-assets');

const CONTENT_PACKS_DIR = join(ASSET_REPO, 'content-packs');
const IMAGES_DIR = join(ASSET_REPO, 'images');
const METADATA_DIR = join(ASSET_REPO, 'metadata');

interface ContentPack {
  packDir: string;
  prompt: string;
  manifest: Record<string, unknown>;
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
  try {
    const result = execSync(
      `find "${CONTENT_PACKS_DIR}" -name "image-prompt.md" -type f 2>/dev/null | sort`,
      { encoding: 'utf-8' }
    );
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function loadContentPack(imagePromptPath: string): ContentPack {
  const packDir = dirname(imagePromptPath);
  const prompt = readFileSync(imagePromptPath, 'utf-8').trim();
  const manifestPath = join(packDir, 'manifest.json');
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf-8'))
    : {};
  return { packDir, prompt, manifest };
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
}): { allowed: boolean; reason: string } {
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
  };
}

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  const isConfirmed = args.includes('--confirm-spend') || args.includes('-y');
  const envFlag = checkEnvFlag();

  // Detect if this is a real generation request
  const isLegacyCanary = process.argv[1]?.includes('minimax-image-canary') && !isDryRun && !isConfirmed;
  const isRealGeneration = (isConfirmed || envFlag) && !isDryRun;

  // Determine guard parameters
  const mediaType = 'image';
  const maxCount = 1; // canary generates 1 image
  const confirmSpend = isConfirmed || envFlag;
  const commandHint = process.argv.join(' ');

  console.log('=== MiniMax Image Canary Generator (Phase 3C Guard) ===');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN' : isRealGeneration ? 'REAL GENERATION' : 'LEGACY CANARY (dry-run)'}`);
  console.log(`Asset repo: ${ASSET_REPO}`);

  // Step 1: Run Generation Guard
  const guardResult = runGenerationGuard({
    media_type: mediaType,
    max_count: maxCount,
    confirm_spend: confirmSpend,
    dry_run: isDryRun || isLegacyCanary,
    command_hint: commandHint,
  });

  if (!guardResult.allowed) {
    console.log('\n[Generation Guard] DENIED. Exiting.');
    console.log(`Reason: ${guardResult.reason}`);
    if (isRealGeneration) {
      console.log('No image generated. Use --dry-run for planning, or provide explicit confirm_spend.');
    }
    process.exit(isRealGeneration ? 1 : 0);
  }

  // Step 2: For real generation, run quota guard
  if (isRealGeneration) {
    const quotaOk = await runQuotaGuard();
    if (!quotaOk) {
      console.log('\n[Quota Guard] DENIED. Exiting.');
      process.exit(1);
    }
  } else {
    console.log('\n[Quota Guard] SKIPPED (dry-run / legacy canary mode).');
    // Still check quota for informational purposes
    const quota = await checkQuota();
    console.log(formatQuotaSummary(quota));
  }

  // Step 3: Find content packs
  const imagePrompts = findContentPacks();
  if (imagePrompts.length === 0) {
    console.error('No content packs with image-prompt.md found');
    process.exit(1);
  }

  // Pick first pack
  const selectedPrompt = imagePrompts[0];
  const { packDir, prompt, manifest } = loadContentPack(selectedPrompt);

  console.log(`\nSelected pack: ${basename(packDir)}`);
  const sourceVal = (manifest.source_types || manifest.source_type || 'unknown') as string | string[];
  const sourceStr = Array.isArray(sourceVal) ? sourceVal.join(', ') : sourceVal;
  console.log(`Source: ${sourceStr}`);
  console.log(`Prompt: ${prompt.substring(0, 80)}...`);

  if (isDryRun || isLegacyCanary) {
    console.log('\n[Dry-Run] Would generate:');
    console.log(`  1 image: ${prompt.substring(0, 60)}...`);
    console.log(`  Content pack: ${basename(packDir)}`);
    console.log(`  Output: ${IMAGES_DIR}/YYYY/MM/cqa-YYYY-MM-DD-canary-001_001.jpg`);
    console.log('\nDry-run complete. No image generated.');
    process.exit(0);
  }

  // Step 4: Real generation
  console.log('\n[Real Generation] Generating image...');
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
      const savedPath = parsed.saved[0];
      console.log(`Saved: ${savedPath}`);

      // Update metadata
      const metaPath = join(METADATA_DIR, 'generated-assets.json');
      let assets: Record<string, unknown>[] = [];
      if (existsSync(metaPath)) {
        try { assets = JSON.parse(readFileSync(metaPath, 'utf-8')); } catch { assets = []; }
      }
      assets.push({
        asset_id: `cqa-${date.toISOString().split('T')[0]}-canary-001`,
        filename: basename(savedPath),
        path: savedPath.replace(ASSET_REPO + '/', ''),
        model: 'image-01',
        prompt,
        aspect_ratio: '16:9',
        content_pack: basename(packDir),
        generated_at: date.toISOString(),
        watermark: true,
      });
      writeFileSync(metaPath, JSON.stringify(assets, null, 2));
      console.log('Updated metadata/generated-assets.json');
      console.log('\nDone!');
    } else {
      console.error('Generation failed: no saved path in response');
      process.exit(1);
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('Generation failed:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
