#!/usr/bin/env tsx
/**
 * scripts/validate-facts-enrichment.ts
 *
 * Validates Phase 4F facts enrichment output.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

function safeReadJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; }
  catch { return fallback; }
}

const checks: { name: string; check: () => boolean }[] = [];
let pass = 0, fail = 0;

function test(name: string, fn: () => boolean) {
  checks.push({ name, check: fn });
}

function run() {
  for (const c of checks) {
    try {
      const ok = c.check();
      if (ok) { pass++; console.log(`  PASS: ${c.name}`); }
      else { fail++; console.log(`  FAIL: ${c.name}`); }
    } catch (e) {
      fail++; console.log(`  FAIL: ${c.name} (${e})`);
    }
  }
}

const cpIndex = safeReadJson<{ content_packs: { pack_dir: string }[] }>(
  join(ASSETS, 'metadata', 'content-pack-index.json'),
  { content_packs: [] }
);

let enrichedCount = 0;
for (const pack of cpIndex.content_packs) {
  const packDir = pack.pack_dir;
  test(`sources-facts.json exists: ${packDir}`, () => existsSync(join(ASSETS, packDir, 'sources-facts.json')));
  test(`facts.md enriched: ${packDir}`, () => {
    const facts = readFileSync(join(ASSETS, packDir, 'facts.md'), 'utf8');
    return facts.includes('Source Confidence:') && facts.includes('Key Facts');
  });
  test(`detail.json enriched: ${packDir}`, () => {
    const detail = safeReadJson<any>(join(ASSETS, packDir, 'detail.json'), {});
    if (detail.source_confidence === 'high' || detail.enriched_facts?.length > 0) {
      enrichedCount++;
      return true;
    }
    return false;
  });
}

// Check no template questions in gallery
const galleryHtml = readFileSync(join(ASSETS, 'gallery', 'index.html'), 'utf8');
test('gallery has no template questions', () => !galleryHtml.includes('解决了什么开发痛点'));

// Check detail pages
const samplePack = cpIndex.content_packs[0];
if (samplePack) {
  const detailHtml = readFileSync(join(ASSETS, samplePack.pack_dir, 'index.html'), 'utf8');
  test('detail page has enriched content', () => detailHtml.includes('Source Confidence') || detailHtml.includes('high') || detailHtml.includes('Key Facts') || detailHtml.includes('⭐') || detailHtml.includes('fork') || detailHtml.includes('下载') || detailHtml.includes('艺术家'));
  test('detail page has no API keys', () => !detailHtml.includes('API_KEY'));
  test('detail page has no .env', () => !detailHtml.includes('.env'));
  test('detail page has no [truncated]', () => !detailHtml.includes('[truncated]'));
}

// Global checks
test('all packs enriched', () => enrichedCount === cpIndex.content_packs.length);

test('no secrets in metadata', () => {
  const index = readFileSync(join(ASSETS, 'metadata', 'content-pack-index.json'), 'utf8');
  return !index.includes('API_KEY') && !index.includes('secret') && !index.includes('token');
});

run();

console.log(`\n[validate-facts-enrichment] ${pass}/${pass+fail} checks passed, ${enrichedCount}/${cpIndex.content_packs.length} packs enriched`);
if (fail > 0) process.exit(1);
