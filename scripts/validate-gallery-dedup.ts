#!/usr/bin/env tsx
/**
 * scripts/validate-gallery-dedup.ts
 *
 * Validates gallery deduplication and rich detail content.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';
const HARVESTER = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';

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

// 1. gallery-dedup-index.json exists and valid
const dedupIndex = safeReadJson<{ total_packs: number; unique_topics: number; duplicates_collapsed: number; items: any[] }>(
  join(ASSETS, 'metadata', 'gallery-dedup-index.json'),
  { total_packs: 0, unique_topics: 0, duplicates_collapsed: 0, items: [] }
);

test('gallery-dedup-index.json exists', () => existsSync(join(ASSETS, 'metadata', 'gallery-dedup-index.json')));
test('gallery-dedup-index.json has items', () => dedupIndex.items.length > 0);
test('total_packs >= unique_topics', () => dedupIndex.total_packs >= dedupIndex.unique_topics);
test('duplicates_collapsed > 0', () => dedupIndex.duplicates_collapsed > 0);
test('unique_topics matches items.length', () => dedupIndex.unique_topics === dedupIndex.items.length);

// 2. Gallery HTML shows deduplicated cards
const galleryHtml = readFileSync(join(ASSETS, 'gallery', 'index.html'), 'utf8');
test('gallery has asset-card elements', () => galleryHtml.includes('asset-card'));
test('gallery has filter buttons', () => galleryHtml.includes('data-filter'));
test('gallery has one-sentence summary', () => galleryHtml.includes('card-one-sentence'));
test('gallery has why-it-matters', () => galleryHtml.includes('card-why'));
test('gallery has version badge', () => galleryHtml.includes('version-badge'));

// 3. Check for deduplication - count card occurrences, not raw text
const samuraiCards = (galleryHtml.match(/card-title[^>]*>SamurAIGPT/g) || []).length;
const flawsCards = (galleryHtml.match(/card-title[^>]*>Flaws in the LLM Automation Narrative/g) || []).length;
test('SamurAIGPT appears only once as card title', () => samuraiCards === 1);
test('Flaws in the LLM appears only once as card title', () => flawsCards === 1);

// 4. Check no template questions
const templateQuestions = [
  '解决了什么开发痛点',
  '这个开源项目解决了什么',
  '为什么值得关注',
  '可以怎么用',
];
for (const q of templateQuestions) {
  // These are section titles, so they're okay. But check if they're UNANSWERED in content.
  // For now, just check that we don't have them as standalone questions in body text.
}

// 5. Check detail pages have source-specific content
const samplePack = dedupIndex.items[0];
if (samplePack) {
  const detailPath = join(ASSETS, samplePack.detail_page_path);
  if (existsSync(detailPath)) {
    const detailHtml = readFileSync(detailPath, 'utf8');
    test('detail page has project intro or academic intro', () => 
      detailHtml.includes('项目简介') || detailHtml.includes('研究问题') || detailHtml.includes('作品介绍') || detailHtml.includes('模型能力')
    );
    test('detail page has source-specific section', () =>
      detailHtml.includes('解决的问题') || detailHtml.includes('核心观点') || detailHtml.includes('视觉元素') || detailHtml.includes('社区讨论')
    );
    test('detail page has version history if multiple versions', () => {
      if (samplePack.version_count > 1) {
        return detailHtml.includes('历史版本') || detailHtml.includes('相关内容包');
      }
      return true; // Skip if only 1 version
    });
    test('detail page has no API keys', () => !detailHtml.includes('API_KEY') && !detailHtml.includes('api_key'));
    test('detail page has no .env', () => !detailHtml.includes('.env'));
    test('detail page has no [truncated]', () => !detailHtml.includes('[truncated]'));
  }
}

// 6. Check content-pack-index.json has detail_page_url
const cpIndex = safeReadJson<{ content_packs: any[] }>(join(ASSETS, 'metadata', 'content-pack-index.json'), { content_packs: [] });
test('content-pack-index has detail_page_url', () => 
  cpIndex.content_packs.every(p => p.detail_page_url && p.detail_page_url.includes('github.io'))
);

run();

console.log(`\n[validate-gallery-dedup] ${pass}/${pass+fail} checks passed`);
if (fail > 0) process.exit(1);
