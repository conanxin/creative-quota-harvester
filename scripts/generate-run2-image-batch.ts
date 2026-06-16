#!/usr/bin/env tsx
/**
 * Phase 6E-J · Run 2 Controlled Image Generation (2 images)
 *
 * Generates exactly 2 images for the human-approved Run 2 items:
 *   1. Q-6E-B-003 River AI (dev-community, 1:1, low risk)
 *   2. Q-6E-B-004 stabilityai/stable-video-diffusion-img2vid-xt (ai-ecosystem, 16:9, low risk)
 *
 * Hard limits:
 *   - max_count = 2 (Run 2 budget cap, no Run 3, no Run 1 reopen)
 *   - target_item_ids: Q-6E-B-003, Q-6E-B-004 ONLY
 *   - no Run 1 items (no regen, no reopen)
 *   - no Run 3 items (Q-6E-B-005 Penitence)
 *   - no video, no music
 *   - no X publish
 *   - no timer, no promote, no C5N
 *   - no overwrite of any existing image
 *   - model: image-01 (no downgrade)
 *   - aspect: 1:1 for Q-6E-B-003, 16:9 for Q-6E-B-004
 *   - watermark: true
 *
 * Usage:
 *   CQA_ALLOW_GENERATION=1 npx tsx scripts/generate-run2-image-batch.ts
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import * as crypto from 'crypto';

import { evaluateGeneration, GenerationRequest } from '../src/generators/generation-guard';
import { checkQuota, formatQuotaSummary } from '../src/generators/minimax-quota-guard';

const ASSET_REPO = process.env.CREATIVE_QUOTA_ASSETS_PATH
  || '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

const IMAGES_DIR = join(ASSET_REPO, 'images');
const METADATA_DIR = join(ASSET_REPO, 'metadata');
const DATE_STR = '2026-06-16';
const DATE_PATH = '2026/06/16';
const MODEL = 'image-01';

interface Run2Item {
  item_id: string;
  pack_id: string;
  title: string;
  source_type: string;
  risk_level: string;
  aspect_ratio: string;
  pack_dir: string;
  english_prompt: string;
  asset_id: string;
}

const RUN2_ITEMS: Run2Item[] = [
  {
    item_id: 'Q-6E-B-003',
    pack_id: 'brief-brief-mq8swsla-m-river-ai',
    title: 'River AI',
    source_type: 'dev-community',
    risk_level: 'low',
    aspect_ratio: '1:1',
    pack_dir: 'content-packs/2026/06/2026-06-11/brief-brief-mq8swsla-m-river-ai',
    english_prompt: 'A developer community discussion poster. topic "River AI" as a short hook at the top in rounded sans-serif. central visual: a stylized developer workspace with three monitors showing code, terminal, and chat. bottom one-liner summarizing the pain point in italics. style: editorial flat illustration, pastel pink and slate, soft shadows, minimal. no faces, no company logos',
    asset_id: 'cqa-2026-06-16-run2-001',
  },
  {
    item_id: 'Q-6E-B-004',
    pack_id: 'brief-brief-mq8tbqf4-s-stabilityai-stable-video-diffusion-img2vid-xt',
    title: 'stabilityai/stable-video-diffusion-img2vid-xt',
    source_type: 'ai-ecosystem',
    risk_level: 'low',
    aspect_ratio: '16:9',
    pack_dir: 'content-packs/2026/06/2026-06-11/brief-brief-mq8tbqf4-s-stabilityai-stable-video-diffusion-img2vid-xt',
    english_prompt: 'A polished AI model card visual. model name "stabilityai/stable-video-diffusion-img2vid-xt" shown as a large hero badge. central pipeline flow: input (icon) → model block with subtle inner layers → output (icon). task label "image-to-video" near the input. two or three monospaced metric tiles on the right: downloads, likes, library. style: Hugging Face inspired, dark slate background, amber-to-magenta gradient, soft glow. no human faces, no company logos',
    asset_id: 'cqa-2026-06-16-run2-002',
  },
];

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

function sha12(text: string): string {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);
}

interface GeneratedImage {
  item_id: string;
  pack_id: string;
  title: string;
  source_type: string;
  risk_level: string;
  aspect_ratio: string;
  asset_id: string;
  prompt: string;
  prompt_hash: string;
  output_hash: string;
  output_path: string;
  output_filename: string;
  file_size_bytes: number;
  generated_at: string;
  generation_elapsed_ms: number;
  quota_at_execution: {
    general_interval_percent: number;
    general_weekly_percent: number;
  };
}

async function generateOneImage(item: Run2Item, quota: any): Promise<GeneratedImage> {
  const outDir = join(IMAGES_DIR, DATE_PATH);
  mkdirSync(outDir, { recursive: true });
  const outPrefix = item.asset_id;
  const expectedFile = join(outDir, `${outPrefix}_001.jpg`);

  // Verify we are not overwriting any existing image (incl. Run 1)
  if (existsSync(expectedFile)) {
    throw new Error(`Output file already exists: ${expectedFile}. Refusing to overwrite.`);
  }

  console.log(`\n[Generate] ${item.item_id}: ${item.title}`);
  console.log(`  Source: ${item.source_type}`);
  console.log(`  Aspect: ${item.aspect_ratio}`);
  console.log(`  Output: ${expectedFile}`);
  console.log(`  Prompt: ${item.english_prompt.substring(0, 100)}...`);

  const mmxCmd =
    `mmx image generate ` +
    `--prompt "${item.english_prompt.replace(/"/g, '\\"')}" ` +
    `--model ${MODEL} ` +
    `--aspect-ratio ${item.aspect_ratio} ` +
    `--out-dir "${outDir}" ` +
    `--out-prefix ${outPrefix} ` +
    `--aigc-watermark ` +
    `--quiet`;

  const startTime = Date.now();
  const output = execMmx(mmxCmd);
  const elapsed = Date.now() - startTime;

  let parsed: any;
  try {
    parsed = JSON.parse(output);
  } catch (e) {
    throw new Error(`Failed to parse mmx output: ${output.substring(0, 500)}`);
  }

  if (!parsed.saved || parsed.saved.length === 0) {
    throw new Error(`No saved path in response: ${output.substring(0, 500)}`);
  }
  const savedPath = parsed.saved[0];
  const savedFilename = basename(savedPath);
  const savedStat = statSync(savedPath);
  console.log(`  Saved: ${savedPath} (${savedStat.size} bytes, ${elapsed}ms)`);

  // Compute hashes
  const promptHash = sha12(item.english_prompt);
  const outputBuffer = readFileSync(savedPath);
  const outputHash = crypto.createHash('sha1').update(outputBuffer).digest('hex').slice(0, 12);
  console.log(`  Prompt hash: ${promptHash}`);
  console.log(`  Output hash: ${outputHash}`);

  const relPath = savedPath.replace(ASSET_REPO + '/', '');

  return {
    item_id: item.item_id,
    pack_id: item.pack_id,
    title: item.title,
    source_type: item.source_type,
    risk_level: item.risk_level,
    aspect_ratio: item.aspect_ratio,
    asset_id: item.asset_id,
    prompt: item.english_prompt,
    prompt_hash: promptHash,
    output_hash: outputHash,
    output_path: relPath,
    output_filename: savedFilename,
    file_size_bytes: savedStat.size,
    generated_at: new Date().toISOString(),
    generation_elapsed_ms: elapsed,
    quota_at_execution: {
      general_interval_percent: quota.general_interval_percent,
      general_weekly_percent: quota.general_weekly_percent,
    },
  };
}

function writePerImageMetadata(img: GeneratedImage) {
  const perImageMetaPath = join(IMAGES_DIR, DATE_PATH, `${img.asset_id}_001.meta.json`);
  const perImageMeta = {
    asset_id: img.asset_id,
    item_id: img.item_id,
    title: img.title,
    source_type: img.source_type,
    risk_level: img.risk_level,
    aspect_ratio: img.aspect_ratio,
    model: MODEL,
    watermark: true,
    aigc_watermark: true,
    prompt: img.prompt,
    prompt_hash: img.prompt_hash,
    output_hash: img.output_hash,
    file_size_bytes: img.file_size_bytes,
    dimensions: img.aspect_ratio === '1:1' ? '1024x1024' : '1280x720',
    generated_at: img.generated_at,
    generation_elapsed_ms: img.generation_elapsed_ms,
    quota_at_execution: img.quota_at_execution,
    phase: '6E-J',
    run: 'run_2',
    run_order: img.item_id === 'Q-6E-B-003' ? 1 : 2,
  };
  writeFileSync(perImageMetaPath, JSON.stringify(perImageMeta, null, 2));
  console.log(`  Per-image meta: ${perImageMetaPath}`);
}

function updateGeneratedAssetsJson(images: GeneratedImage[]) {
  const metaPath = join(METADATA_DIR, 'generated-assets.json');
  let assets: any[] = [];
  if (existsSync(metaPath)) {
    try { assets = JSON.parse(readFileSync(metaPath, 'utf-8')); } catch { assets = []; }
  }
  const baselineCount = assets.length;
  for (const img of images) {
    assets.push({
      asset_id: img.asset_id,
      filename: img.output_filename,
      path: img.output_path,
      model: MODEL,
      prompt: img.prompt,
      aspect_ratio: img.aspect_ratio,
      content_pack: img.pack_id,
      source_type: img.source_type,
      generated_at: img.generated_at,
      watermark: true,
      file_size_kb: Math.round(img.file_size_bytes / 1024),
      prompt_hash: img.prompt_hash,
      output_hash: img.output_hash,
      run: 'run_2',
      phase: '6E-J',
      item_id: img.item_id,
    });
  }
  writeFileSync(metaPath, JSON.stringify(assets, null, 2));
  console.log(`\n[Metadata] generated-assets.json updated: ${baselineCount} -> ${assets.length} (+${images.length})`);
}

async function main() {
  console.log('=== Phase 6E-J · Run 2 Controlled Image Generation (2 images) ===\n');
  console.log(`Target items: ${RUN2_ITEMS.map(i => i.item_id).join(', ')}`);
  console.log(`Model: ${MODEL} (no downgrade)`);
  console.log(`Total images: 2 (within Run 2 budget cap)`);
  console.log(`Asset repo: ${ASSET_REPO}`);

  // Step 1: Generation guard
  const request: GenerationRequest = {
    media_type: 'image',
    max_count: 2,
    confirm_spend: true,
    dry_run: false,
    command_hint: 'Phase 6E-J: Run 2 Controlled Image Generation (Q-6E-B-003 River AI + Q-6E-B-004 stabilityai)',
  };
  const decision = evaluateGeneration(request);
  console.log(`\n[Generation Guard] ${decision.decision}: ${decision.reason}`);
  if (decision.decision !== 'ALLOW') {
    console.error('Generation guard denied. Aborting.');
    process.exit(1);
  }

  // Step 2: Quota guard
  console.log('\n[Quota Guard] Checking MiniMax quota...');
  const quota = await checkQuota();
  console.log(formatQuotaSummary(quota));
  if (quota.decision === 'BLOCK') {
    console.error('Quota below 50% threshold. Blocking per Hard Limit #15.');
    process.exit(1);
  }
  if (quota.decision === 'ERROR') {
    console.error('Quota check errored. Blocking by default.');
    process.exit(1);
  }
  console.log('[Quota Guard] PASSED.');

  // Step 3: Verify no existing image would be overwritten
  for (const item of RUN2_ITEMS) {
    const expectedFile = join(IMAGES_DIR, DATE_PATH, `${item.asset_id}_001.jpg`);
    if (existsSync(expectedFile)) {
      console.error(`\nFATAL: Output file already exists: ${expectedFile}. Aborting.`);
      process.exit(1);
    }
  }

  // Step 4: Generate the 2 images
  const results: GeneratedImage[] = [];
  for (let i = 0; i < RUN2_ITEMS.length; i++) {
    try {
      const img = await generateOneImage(RUN2_ITEMS[i], quota);
      results.push(img);
      writePerImageMetadata(img);
    } catch (err: any) {
      console.error(`\nFailed to generate image for ${RUN2_ITEMS[i].item_id}: ${err.message || err}`);
      // Per Hard Limit: do not extend to other items on partial failure
      console.error('Stopping. Partial failure - no further generation.');
      process.exit(1);
    }
  }

  // Step 5: Update generated-assets.json
  updateGeneratedAssetsJson(results);

  // Step 6: Write generation-result.json
  const resultPath = join(ASSET_REPO, 'generated/phase-6e/run2/generation-result.json');
  mkdirSync(join(ASSET_REPO, 'generated/phase-6e/run2'), { recursive: true });
  writeFileSync(resultPath, JSON.stringify({
    phase: '6E-J',
    run: 'run_2',
    generated_at: new Date().toISOString(),
    model: MODEL,
    approved_image_count_limit: 2,
    selected_items_count: 2,
    selected_items: results.map(r => ({
      item_id: r.item_id,
      asset_id: r.asset_id,
      title: r.title,
      source_type: r.source_type,
      risk_level: r.risk_level,
      aspect_ratio: r.aspect_ratio,
      output_path: r.output_path,
      output_filename: r.output_filename,
      file_size_bytes: r.file_size_bytes,
      prompt_hash: r.prompt_hash,
      output_hash: r.output_hash,
      generated_at: r.generated_at,
      generation_elapsed_ms: r.generation_elapsed_ms,
    })),
    quota_at_execution: {
      general_interval_percent: quota.general_interval_percent,
      general_weekly_percent: quota.general_weekly_percent,
      decision: quota.decision,
    },
    boundaries_enforced: {
      model_call_allowed: true,
      model_calls_made: 2,
      image_api_called: true,
      video_api_called: false,
      music_api_called: false,
      quota_checked_before_call: true,
      quota_bypassed: false,
      model_downgraded: false,
      image_fabricated: false,
      no_x_publish: true,
      no_timer: true,
      no_promote: true,
      no_c5n_change: true,
      no_secrets_read: true,
      no_run1_items: true,
      no_run3_items: true,
      no_penitence: true,
      no_samuraigpt: true,
      no_flaws_llm: true,
      no_existing_image_overwrite: true,
      no_run1_reopen: true,
      no_run1_final_closeout_modify: true,
      no_6d5_modify: true,
    },
  }, null, 2));
  console.log(`\n[Result] Wrote: ${resultPath}`);

  // Step 7: Summary
  console.log('\n=== Phase 6E-J Generation Complete ===');
  console.log(`Generated: 2 images, 0 music, 0 video`);
  for (const r of results) {
    console.log(`  - ${r.item_id}: ${r.title}`);
    console.log(`    asset_id: ${r.asset_id}`);
    console.log(`    path: ${r.output_path}`);
    console.log(`    size: ${r.file_size_bytes} bytes`);
    console.log(`    prompt_hash: ${r.prompt_hash}, output_hash: ${r.output_hash}`);
  }
  console.log(`\nQuota at execution: ${quota.general_interval_percent}% interval / ${quota.general_weekly_percent}% weekly`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
