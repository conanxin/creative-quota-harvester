#!/usr/bin/env tsx
/**
 * scripts/validate-image-reviews.ts
 *
 * Validates Phase 3E image review artifacts.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

function safeReadJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; }
  catch { return fallback; }
}

function safeReadText(path: string, fallback = ''): string {
  try { return readFileSync(path, 'utf8'); }
  catch { return fallback; }
}

const checks: { name: string; check: () => boolean; detail?: () => string }[] = [];
let pass = 0, fail = 0;

function test(name: string, fn: () => boolean, detail?: () => string) {
  checks.push({ name, check: fn, detail });
}

function run() {
  for (const c of checks) {
    try {
      const ok = c.check();
      if (ok) { pass++; console.log(`  PASS: ${c.name}`); }
      else { fail++; console.log(`  FAIL: ${c.name}${c.detail ? ` (${c.detail()})` : ''}`); }
    } catch (e) {
      fail++; console.log(`  FAIL: ${c.name} (${e})`);
    }
  }
}

// 1. Top-level metadata files exist
const reviewIndexPath = join(ASSETS, 'metadata', 'generated-assets-review.json');
const qualityTablePath = join(ASSETS, 'metadata', 'asset-quality-scores.json');
test('generated-assets-review.json exists', () => existsSync(reviewIndexPath));
test('asset-quality-scores.json exists', () => existsSync(qualityTablePath));

const reviewIndex = safeReadJson<any>(reviewIndexPath, {});
const qualityTable = safeReadJson<any>(qualityTablePath, {});

// 2. Top-level fields
test('generated-assets-review.json has total_images > 0', () => reviewIndex.total_images > 0);
test('generated-assets-review.json has phase = 3E', () => reviewIndex.phase === '3E');
test('generated-assets-review.json has average_score', () => typeof reviewIndex.average_score === 'number');
test('generated-assets-review.json has quality_distribution', () => {
  const d = reviewIndex.quality_distribution;
  return d && typeof d.excellent === 'number' && typeof d.good === 'number'
    && typeof d.fair === 'number' && typeof d.poor === 'number';
});
test('generated-assets-review.json has source_type_distribution', () => {
  const d = reviewIndex.source_type_distribution || {};
  return Object.keys(d).length > 0;
});
test('generated-assets-review.json has images array', () => Array.isArray(reviewIndex.images) && reviewIndex.images.length === reviewIndex.total_images);

test('asset-quality-scores.json has rows array', () => Array.isArray(qualityTable.rows) && qualityTable.rows.length > 0);
test('asset-quality-scores.json rows match images count', () => qualityTable.rows.length === reviewIndex.images.length);

// 3. Each image review is well-formed
const images = reviewIndex.images || [];
for (const img of images) {
  test(`image has filename: ${img.filename}`, () => !!img.filename);
  test(`image has total_score: ${img.filename}`, () => typeof img.total_score === 'number' && img.total_score >= 0 && img.total_score <= 100);
  test(`image has quality_label: ${img.filename}`, () =>
    ['excellent', 'good', 'fair', 'poor'].includes(img.quality_label));
  test(`image has 5 dimension scores: ${img.filename}`, () => {
    const s = img.scores || {};
    return ['technical_validity', 'prompt_alignment', 'source_relevance', 'usability', 'diversity_and_coverage']
      .every(k => typeof s[k] === 'number' && s[k] >= 0 && s[k] <= 20);
  });
  test(`image sum matches: ${img.filename}`, () => {
    const s = img.scores || {};
    return img.total_score === (s.technical_validity + s.prompt_alignment + s.source_relevance + s.usability + s.diversity_and_coverage);
  });
  test(`image has review_md_path: ${img.filename}`, () => !!img.review_md_path && img.review_md_path.endsWith('.review.zh.md'));
  test(`image has review_md_url: ${img.filename}`, () => !!img.review_md_url && img.review_md_url.includes('github.io'));
  test(`image review file exists: ${img.filename}`, () => existsSync(join(ASSETS, img.review_md_path)));
  test(`image review file non-empty: ${img.filename}`, () => {
    const p = join(ASSETS, img.review_md_path);
    return existsSync(p) && statSync(p).size > 100;
  });

  // Check that the .review.zh.md is in the same dir as the image
  test(`review .zh.md is in image dir: ${img.filename}`, () => {
    const imgDir = img.path.split('/').slice(0, -1).join('/');
    const reviewDir = img.review_md_path.split('/').slice(0, -1).join('/');
    return imgDir === reviewDir;
  });
}

// 4. Review .zh.md content checks
for (const img of images) {
  const p = join(ASSETS, img.review_md_path);
  if (!existsSync(p)) continue;
  const text = safeReadText(p, '');
  test(`review md has 总分: ${img.filename}`, () => text.includes('总分'));
  test(`review md has 维度评分: ${img.filename}`, () => text.includes('维度评分'));
  test(`review md has 推荐用途: ${img.filename}`, () => text.includes('推荐用途'));
  test(`review md has Phase 3E mention: ${img.filename}`, () => text.includes('Phase 3E'));
  test(`review md has quality label: ${img.filename}`, () =>
    text.includes('优秀') || text.includes('良好') || text.includes('一般') || text.includes('较差'));
  test(`review md has 5 dimension names: ${img.filename}`, () =>
    text.includes('technical_validity') && text.includes('prompt_alignment') &&
    text.includes('source_relevance') && text.includes('usability') &&
    text.includes('diversity_and_coverage'));
  test(`review md has no API keys: ${img.filename}`, () =>
    !text.includes('API_KEY') && !text.includes('api_key') && !text.includes('MINIMAX_API_KEY'));
  test(`review md has no .env: ${img.filename}`, () => !text.includes('.env'));
  test(`review md has no secrets: ${img.filename}`, () =>
    !text.includes('sk-cp-') && !text.includes('sk-'));
}

// 5. asset-quality-scores.json row consistency
const rows = qualityTable.rows || [];
test('asset-quality-scores rows count matches generated-assets-review', () =>
  rows.length === images.length);
for (const row of rows) {
  test(`row has filename: ${row.filename}`, () => !!row.filename);
  test(`row has score/pct: ${row.filename}`, () =>
    typeof row.score === 'number' && typeof row.pct === 'number');
  test(`row pct is integer 0-100: ${row.filename}`, () =>
    Number.isInteger(row.pct) && row.pct >= 0 && row.pct <= 100);
  test(`row has quality_label: ${row.filename}`, () =>
    ['excellent', 'good', 'fair', 'poor'].includes(row.quality_label));
  test(`row has 5 dimensions: ${row.filename}`, () => {
    const d = row.dimensions || {};
    return ['technical_validity', 'prompt_alignment', 'source_relevance', 'usability', 'diversity_and_coverage']
      .every(k => typeof d[k] === 'number');
  });
  test(`row has recommended_uses: ${row.filename}`, () =>
    Array.isArray(row.recommended_uses) && row.recommended_uses.length > 0);
  test(`row has review_md_url: ${row.filename}`, () =>
    !!row.review_md_url && row.review_md_url.includes('github.io'));
}

// 6. Cross-check: image file exists
for (const img of images) {
  test(`image file exists: ${img.filename}`, () => existsSync(join(ASSETS, img.path)));
}

// 7. Quality distribution sums to total
const d = reviewIndex.quality_distribution || {};
const sum = (d.excellent || 0) + (d.good || 0) + (d.fair || 0) + (d.poor || 0);
test('quality_distribution sums to total_images', () => sum === reviewIndex.total_images);

run();

// Write report
const report = {
  generated_at: new Date().toISOString(),
  phase: '3E',
  total_checks: pass + fail,
  passed: pass,
  failed: fail,
  pass_rate: pass + fail > 0 ? Math.round((pass / (pass + fail)) * 100) : 0,
};
writeFileSync(join(ASSETS, 'metadata', 'image-reviews-validation.json'), JSON.stringify(report, null, 2));

console.log(`\n[validate-image-reviews] ${pass}/${pass+fail} checks passed (${report.pass_rate}%)`);
if (fail > 0) process.exit(1);
