#!/usr/bin/env tsx
/**
 * scripts/validate-content-pack-pages.ts
 *
 * Validates content pack detail pages.
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

// 1. content-pack-index.json has all required fields
const cpIndex = safeReadJson<{ content_packs: any[] }>(
  join(ASSETS, 'metadata', 'content-pack-index.json'),
  { content_packs: [] }
);

test('content-pack-index.json has content_packs', () => cpIndex.content_packs.length > 0);
test('content-pack-index.json has detail_page_path for each pack', () =>
  cpIndex.content_packs.every((p: any) => p.detail_page_path && p.detail_page_path.endsWith('/index.html'))
);
test('content-pack-index.json has detail_page_url for each pack', () =>
  cpIndex.content_packs.every((p: any) => p.detail_page_url && p.detail_page_url.includes('github.io'))
);
test('content-pack-index.json has summary_md_path for each pack', () =>
  cpIndex.content_packs.every((p: any) => p.summary_md_path && p.summary_md_path.endsWith('.md'))
);
test('content-pack-index.json has detail_json_path for each pack', () =>
  cpIndex.content_packs.every((p: any) => p.detail_json_path && p.detail_json_path.endsWith('.json'))
);

// 2. All detail_page_path files exist
for (const pack of cpIndex.content_packs) {
  const path = join(ASSETS, pack.detail_page_path);
  test(`detail page exists: ${pack.detail_page_path}`, () => existsSync(path));
}

// 3. All detail pages have required sections
for (const pack of cpIndex.content_packs) {
  const path = join(ASSETS, pack.detail_page_path);
  if (!existsSync(path)) continue;
  const html = readFileSync(path, 'utf8');
  
  test(`page has navigation: ${pack.title}`, () => html.includes('返回 Gallery') && html.includes('每日归档'));
  test(`page has title: ${pack.title}`, () => html.includes('<title>') && html.includes('</title>'));
  test(`page has source badge: ${pack.title}`, () => html.includes('source-badge'));
  test(`page has one-sentence: ${pack.title}`, () => html.includes('one-sentence') || html.includes('一句话'));
  test(`page has asset grid: ${pack.title}`, () => html.includes('asset-grid'));
  test(`page has developer files: ${pack.title}`, () => html.includes('开发者文件') || html.includes('Developer'));
  test(`page has no API keys: ${pack.title}`, () => !html.includes('API_KEY') && !html.includes('api_key'));
  test(`page has no .env: ${pack.title}`, () => !html.includes('.env'));
  test(`page has no secrets: ${pack.title}`, () => !html.includes('secret') && !html.includes('token'));
}

// 4. Gallery links point to index.html (not detail.json as primary)
const galleryPath = join(ASSETS, 'gallery', 'index.html');
if (existsSync(galleryPath)) {
  const galleryHtml = readFileSync(galleryPath, 'utf8');
  test('gallery has primary links to index.html', () => 
    galleryHtml.includes('/index.html') && galleryHtml.includes('btn-primary')
  );
  test('gallery has secondary links to summary.md', () => 
    galleryHtml.includes('content-summary.zh.md') && galleryHtml.includes('btn-secondary')
  );
  test('gallery detail.json is not primary link', () => {
    const primaryDetailJson = galleryHtml.match(/btn-primary[^>]*href="[^"]*detail\.json"/g);
    return !primaryDetailJson || primaryDetailJson.length === 0;
  });
}

// 5. Daily pages link to index.html
for (const date of ['2026-06-10', '2026-06-11']) {
  const dailyPath = join(ASSETS, 'daily', date.slice(0,4), date.slice(5,7), date, 'index.html');
  if (existsSync(dailyPath)) {
    const dailyHtml = readFileSync(dailyPath, 'utf8');
    test(`daily ${date} links to index.html`, () => dailyHtml.includes('/index.html'));
  }
}

run();

console.log(`\n[validate-content-pack-pages] ${pass}/${pass+fail} checks passed`);
if (fail > 0) process.exit(1);
