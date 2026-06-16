#!/usr/bin/env tsx
/**
 * Phase 6E-G · Regenerate Q-6E-B-002 (1 image)
 *
 * Generates exactly 1 replacement image for Q-6E-B-002 (Flaws in the LLM
 * Automation Narrative) using mmx CLI. The previous run produced a
 * pseudo-academic poster with severe text artifacts (overall_score=43.3,
 * needs_regen). This regen uses a clean academic cover concept with
 * minimal text to avoid the failure mode.
 *
 * Hard limits:
 *   - max_count = 1
 *   - target_item_id = Q-6E-B-002 ONLY
 *   - no Run 2 items
 *   - no Run 3 items
 *   - no video, no music
 *   - no X publish
 *   - no timer, no promote, no C5N
 *   - no overwrite of original failed image
 *   - model: image-01 (no downgrade)
 *   - aspect: 16:9
 *   - watermark: true
 *
 * Usage:
 *   CQA_ALLOW_GENERATION=1 npx tsx scripts/regenerate-q6eb002.ts
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

const TARGET_ITEM_ID = 'Q-6E-B-002';
const TARGET_ASSET_ID = 'cqa-2026-06-16-run1-002-regen1';
const DATE_STR = '2026-06-16';
const DATE_PATH = '2026/06/16';
const ASPECT = '16:9';
const MODEL = 'image-01';

// Clean academic cover prompt — minimises text generation
// (the previous run failed because image-01 produced fake arxiv badges,
//  fake journal seals, and unreadable body text)
const REGEN_PROMPT = [
  'A clean minimal 16:9 academic research cover.',
  'Background: deep dark navy with subtle warm off-white panel in the center.',
  'Composition: a single abstract conceptual diagram in the center.',
  'Diagram: a horizontal pipeline of three rounded nodes connected by clean lines flowing from left to right.',
  'The pipeline visually narrows or fragments near the right side, suggesting a reliability gap.',
  'On the far right, a small faceless geometric human silhouette stands observing, representing a human oversight layer.',
  'Three small readable sans-serif text labels connected by thin lines to the diagram elements: "Automation Limits", "Reliability Gap", "Human Oversight".',
  'Color palette: deep navy blue, warm off-white, muted gold accents.',
  'Style: modern minimalist information design, Edward Tufte inspired data-ink ratio, generous whitespace.',
  'No fake arxiv badge, no journal seal, no fake equations, no paragraphs of body text, no fake logo, no page header/footer.',
  'No human face, no recognizable person, no photographic elements.',
  'Soft ambient lighting, no harsh shadows, no text overlay clutter.',
  'Title at the top in elegant serif: "Flaws in the LLM Automation Narrative" (single line, clear, readable).',
].join(' ');

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

async function main() {
  console.log('=== Phase 6E-G · Regenerate Q-6E-B-002 (1 image) ===\n');
  console.log(`Target: ${TARGET_ITEM_ID}`);
  console.log(`Asset ID: ${TARGET_ASSET_ID}`);
  console.log(`Model: ${MODEL} (no downgrade)`);
  console.log(`Aspect: ${ASPECT}`);
  console.log(`Watermark: true`);
  console.log(`Prompt length: ${REGEN_PROMPT.length} chars`);

  // Step 1: Pre-flight: ensure original failed image still exists
  const originalPath = join(IMAGES_DIR, DATE_PATH, 'cqa-2026-06-16-run1-002_001.jpg');
  if (!existsSync(originalPath)) {
    console.error(`\n❌ Original failed image does not exist: ${originalPath}`);
    process.exit(1);
  }
  const originalStat = statSync(originalPath);
  console.log(`\n[Pre-flight] Original failed image exists: ${originalPath} (${originalStat.size} bytes)`);

  // Step 2: Generation guard
  const request: GenerationRequest = {
    media_type: 'image',
    max_count: 1,
    confirm_spend: true,
    dry_run: false,
    command_hint: 'Phase 6E-G: Regenerate Q-6E-B-002 (1 image, human-approved regen)',
  };
  const decision = evaluateGeneration(request);
  console.log(`\n[Generation Guard] ${decision.decision}: ${decision.reason}`);
  if (decision.decision !== 'ALLOW') {
    console.error('Generation guard denied. Aborting.');
    process.exit(1);
  }

  // Step 3: Quota guard
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

  // Step 4: Generate the image
  const outDir = join(IMAGES_DIR, DATE_PATH);
  mkdirSync(outDir, { recursive: true });
  const outPrefix = TARGET_ASSET_ID;
  const expectedFile = join(outDir, `${outPrefix}_001.jpg`);

  // Verify we are not overwriting the original
  if (expectedFile === originalPath) {
    console.error(`\n❌ FATAL: regen path collides with original path. Aborting.`);
    process.exit(1);
  }

  console.log(`\n[Generate] mmx image generate`);
  console.log(`  Output: ${expectedFile}`);
  console.log(`  Prompt: ${REGEN_PROMPT.substring(0, 100)}...`);

  const mmxCmd =
    `mmx image generate ` +
    `--prompt "${REGEN_PROMPT.replace(/"/g, '\\"')}" ` +
    `--model ${MODEL} ` +
    `--aspect-ratio ${ASPECT} ` +
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
    console.error(`Failed to parse mmx output: ${output.substring(0, 500)}`);
    throw e;
  }

  if (!parsed.saved || parsed.saved.length === 0) {
    console.error(`No saved path in response: ${output.substring(0, 500)}`);
    process.exit(1);
  }
  const savedPath = parsed.saved[0];
  const savedFilename = basename(savedPath);
  const savedStat = statSync(savedPath);
  console.log(`  Saved: ${savedPath} (${savedStat.size} bytes, ${elapsed}ms)`);

  // Step 5: Compute hashes
  const promptHash = sha12(REGEN_PROMPT);
  const outputBuffer = readFileSync(savedPath);
  const outputHash = crypto.createHash('sha1').update(outputBuffer).digest('hex').slice(0, 12);
  console.log(`  Prompt hash: ${promptHash}`);
  console.log(`  Output hash: ${outputHash}`);

  // Step 6: Update metadata/generated-assets.json (add 1 entry, 7 -> 8)
  const metaPath = join(METADATA_DIR, 'generated-assets.json');
  let assets: any[] = [];
  if (existsSync(metaPath)) {
    try { assets = JSON.parse(readFileSync(metaPath, 'utf-8')); } catch { assets = []; }
  }
  const relPath = savedPath.replace(ASSET_REPO + '/', '');
  const regenEntry = {
    asset_id: TARGET_ASSET_ID,
    filename: savedFilename,
    path: relPath,
    model: MODEL,
    prompt: REGEN_PROMPT,
    aspect_ratio: ASPECT,
    content_pack: 'brief-brief-mq8tbqf4-j-flaws-in-the-llm-automation-narrative',
    source_type: 'academic',
    generated_at: new Date().toISOString(),
    watermark: true,
    file_size_kb: Math.round(savedStat.size / 1024),
    regen_of: 'cqa-2026-06-16-run1-002',
    regen_phase: '6E-G',
    parent_decision: 'needs_regen',
    parent_score: 43.3,
    prompt_hash: promptHash,
    output_hash: outputHash,
  };
  assets.push(regenEntry);
  writeFileSync(metaPath, JSON.stringify(assets, null, 2));
  console.log(`\n[Metadata] Updated metadata/generated-assets.json (${assets.length} assets)`);

  // Step 7: Write per-image metadata
  const perImageMetaPath = join(outDir, `${TARGET_ASSET_ID}_001.meta.json`);
  writeFileSync(perImageMetaPath, JSON.stringify({
    asset_id: TARGET_ASSET_ID,
    item_id: TARGET_ITEM_ID,
    title: 'Flaws in the LLM Automation Narrative',
    source_type: 'academic',
    risk_level: 'low',
    aspect_ratio: ASPECT,
    model: MODEL,
    watermark: true,
    aigc_watermark: true,
    prompt: REGEN_PROMPT,
    prompt_hash: promptHash,
    output_hash: outputHash,
    file_size_bytes: savedStat.size,
    dimensions: '1280x720',
    generated_at: new Date().toISOString(),
    regen_of: 'cqa-2026-06-16-run1-002',
    regen_phase: '6E-G',
    parent_decision: 'needs_regen',
    parent_score: 43.3,
    generation_elapsed_ms: elapsed,
    quota_at_execution: {
      general_interval_percent: quota.general_interval_percent,
      general_weekly_percent: quota.general_weekly_percent,
    },
  }, null, 2));
  console.log(`[Metadata] Wrote per-image metadata: ${perImageMetaPath}`);

  // Step 8: Summary
  console.log('\n=== Phase 6E-G Generation Complete ===');
  console.log(`Generated: 1 image, 0 music, 0 video`);
  console.log(`Asset: ${TARGET_ASSET_ID}`);
  console.log(`Path: ${relPath}`);
  console.log(`File size: ${savedStat.size} bytes`);
  console.log(`Prompt hash: ${promptHash}`);
  console.log(`Output hash: ${outputHash}`);
  console.log(`Quota at execution: ${quota.general_interval_percent}% interval / ${quota.general_weekly_percent}% weekly`);

  // Write a generation result file for the manifest
  const resultPath = join(ASSET_REPO, 'generated/phase-6e/run1/regen/q-6e-b-002/generation-result.json');
  mkdirSync(join(ASSET_REPO, 'generated/phase-6e/run1/regen/q-6e-b-002'), { recursive: true });
  writeFileSync(resultPath, JSON.stringify({
    target_item_id: TARGET_ITEM_ID,
    asset_id: TARGET_ASSET_ID,
    title: 'Flaws in the LLM Automation Narrative',
    source_type: 'academic',
    risk_level: 'low',
    aspect_ratio: ASPECT,
    model: MODEL,
    watermark: true,
    aigc_watermark: true,
    prompt: REGEN_PROMPT,
    prompt_hash: promptHash,
    output_hash: outputHash,
    output_path: relPath,
    output_filename: savedFilename,
    file_size_bytes: savedStat.size,
    dimensions: '1280x720',
    generated_at: new Date().toISOString(),
    generation_elapsed_ms: elapsed,
    parent_image_path: 'images/2026/06/16/cqa-2026-06-16-run1-002_001.jpg',
    parent_decision: 'needs_regen',
    parent_score: 43.3,
    quota_at_execution: {
      general_interval_percent: quota.general_interval_percent,
      general_weekly_percent: quota.general_weekly_percent,
      decision: quota.decision,
    },
    boundaries_enforced: {
      model_call_allowed: true,
      model_calls_made: 1,
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
      no_run2_items: true,
      no_run3_items: true,
      no_samuraigpt_regen: true,
      no_river_ai: true,
      no_stabilityai: true,
      no_penitence: true,
      original_image_not_overwritten: true,
    },
  }, null, 2));
  console.log(`[Result] Wrote: ${resultPath}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
