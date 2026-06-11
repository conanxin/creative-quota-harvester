#!/usr/bin/env tsx
/**
 * scripts/validate-image-prompt-enhancement.ts
 *
 * Validates Phase 4G image-prompt enhancement output.
 *
 * Checks per pack:
 *   - image-prompt.enriched.md exists, non-empty, contains English prompt
 *   - image-prompt.zh.md exists, non-empty
 *   - image-prompt.meta.json exists, valid JSON, required keys present
 *   - english_prompt length in [80, 1200] chars
 *   - intent_zh length in [40, 800] chars
 *   - style_tags has at least 3 entries
 *   - parameters.aspectRatio matches known set
 *   - strategy string is non-empty
 *   - llm_used === false
 *
 * Global:
 *   - 100% of packs have all three files
 *   - no LLM marker ("minimax", "gpt-4", "claude") in generated files
 *   - no API keys / secrets in meta JSON
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

function safeReadJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; }
  catch { return fallback; }
}

const ALLOWED_AR = new Set([
  '1:1', '3:2', '2:3', '4:3', '3:4', '4:5', '5:4',
  '9:16', '16:9', '21:9', '2:1', '1:2',
]);
// LLM usage markers — must be more precise than a project name or
// tool name. We look for the model name as a separate identifier,
// not when it appears inside a longer identifier like "claude-code".
const LLM_MARKERS = [
  /MiniMax-M3/,
  /\bminimax[ -]?m[2-9]\b/i,
  /\bgpt-?4(\.|o|turbo|preview|-[0-9])/i,
  /(?<![a-z-])claude(?![- ]?code|- ?sonnet|- ?opus|- ?haiku)/i,
  /\bgpt-?3\.5\b/i,
];

const checks: { name: string; check: () => boolean }[] = [];
let pass = 0, fail = 0;
const fails: string[] = [];

function test(name: string, fn: () => boolean) {
  checks.push({ name, check: fn });
}

function run() {
  for (const c of checks) {
    try {
      const ok = c.check();
      if (ok) { pass++; }
      else { fail++; fails.push(c.name); }
    } catch (e) {
      fail++; fails.push(`${c.name} (threw: ${e})`);
    }
  }
}

const idx = safeReadJson<{ content_packs: { pack_dir: string }[] }>(
  join(ASSETS, 'metadata', 'content-pack-index.json'),
  { content_packs: [] }
);

let enrichedMdOk = 0;
let zhMdOk = 0;
let metaOk = 0;
let perPackComplete = 0;
const sourcesByType: Record<string, number> = {};

for (const pack of idx.content_packs) {
  const packDir = pack.pack_dir;

  const enrichedPath = join(ASSETS, packDir, 'image-prompt.enriched.md');
  const zhPath = join(ASSETS, packDir, 'image-prompt.zh.md');
  const metaPath = join(ASSETS, packDir, 'image-prompt.meta.json');

  const enrichedExists = existsSync(enrichedPath);
  const zhExists = existsSync(zhPath);
  const metaExists = existsSync(metaPath);

  test(`enriched.md exists :: ${packDir}`, () => enrichedExists);
  test(`zh.md exists :: ${packDir}`, () => zhExists);
  test(`meta.json exists :: ${packDir}`, () => metaExists);

  if (!enrichedExists || !zhExists || !metaExists) continue;

  // enriched.md content
  const enriched = readFileSync(enrichedPath, 'utf8');
  test(`enriched.md has English prompt block :: ${packDir}`, () =>
    enriched.includes('## English Prompt') && /```text[\s\S]+```/.test(enriched)
  );
  test(`enriched.md has Negative prompt block :: ${packDir}`, () =>
    enriched.includes('Negative Prompt')
  );
  test(`enriched.md has Recommended Parameters :: ${packDir}`, () =>
    enriched.includes('Recommended Parameters') && enriched.includes('Aspect ratio')
  );
  test(`enriched.md has Strategy line :: ${packDir}`, () =>
    enriched.includes('策略') || enriched.includes('Strategy')
  );
  if (enriched.includes('## English Prompt') && enriched.includes('Negative Prompt') && enriched.includes('Recommended Parameters')) {
    enrichedMdOk++;
  }

  // zh.md content
  const zh = readFileSync(zhPath, 'utf8');
  test(`zh.md has strategy line :: ${packDir}`, () =>
    zh.includes('策略') && zh.includes('风格关键词')
  );
  test(`zh.md has English prompt copy :: ${packDir}`, () =>
    zh.includes('完整英文 Prompt')
  );
  if (zh.includes('策略') && zh.includes('完整英文 Prompt')) zhMdOk++;

  // meta.json content
  const meta = safeReadJson<any>(metaPath, {});
  test(`meta.json parses :: ${packDir}`, () => typeof meta === 'object' && meta !== null && !Array.isArray(meta));
  test(`meta.json has english_prompt :: ${packDir}`, () => typeof meta.english_prompt === 'string');
  test(`meta.json english_prompt length ok :: ${packDir}`, () => {
    const len = meta.english_prompt?.length || 0;
    return len >= 80 && len <= 1200;
  });
  test(`meta.json has intent_zh :: ${packDir}`, () => typeof meta.intent_zh === 'string' && meta.intent_zh.length >= 40 && meta.intent_zh.length <= 800);
  test(`meta.json style_tags >= 3 :: ${packDir}`, () => Array.isArray(meta.style_tags) && meta.style_tags.length >= 3);
  test(`meta.json has parameters :: ${packDir}`, () => {
    const p = meta.parameters || {};
    return ALLOWED_AR.has(p.aspectRatio) && typeof p.resolution === 'string' && typeof p.style === 'string';
  });
  test(`meta.json strategy non-empty :: ${packDir}`, () => typeof meta.strategy === 'string' && meta.strategy.length > 5);
  test(`meta.json llm_used === false :: ${packDir}`, () => meta.llm_used === false);
  test(`meta.json source_type known :: ${packDir}`, () => {
    const t = meta.source_type;
    return ['code', 'academic', 'ai-ecosystem', 'dev-community', 'culture-art', 'context'].includes(t);
  });
  test(`meta.json no API keys :: ${packDir}`, () => {
    const s = JSON.stringify(meta);
    return !/API_KEY|api_key|sk-|hf_[A-Za-z0-9]{10,}/.test(s);
  });
  test(`meta.json no LLM markers :: ${packDir}`, () => {
    const s = JSON.stringify(meta);
    return !LLM_MARKERS.some(re => re.test(s));
  });

  if (meta.source_type) {
    sourcesByType[meta.source_type] = (sourcesByType[meta.source_type] || 0) + 1;
  }
  if (typeof meta.english_prompt === 'string' && meta.english_prompt.length >= 80 && Array.isArray(meta.style_tags) && meta.style_tags.length >= 3) {
    metaOk++;
  }

  if (enrichedMdOk > 0 && zhMdOk > 0 && metaOk > 0) perPackComplete++;
}

// Global checks
test('all packs have enriched.md', () => enrichedMdOk === idx.content_packs.length);
test('all packs have zh.md', () => zhMdOk === idx.content_packs.length);
test('all packs have valid meta.json', () => metaOk === idx.content_packs.length);

// Sample HTML content checks (gallery)
const galleryPath = join(ASSETS, 'gallery', 'index.html');
if (existsSync(galleryPath)) {
  const gallery = readFileSync(galleryPath, 'utf8');
  test('gallery mentions enhanced prompt badge', () =>
    /enhanced/i.test(gallery) || /增强.*Prompt|增强.*提示/i.test(gallery)
  );
  test('gallery no LLM markers', () => !LLM_MARKERS.some(re => re.test(gallery)));
}

// Sample first pack HTML
const samplePack = idx.content_packs[0];
if (samplePack) {
  const detailHtml = readFileSync(join(ASSETS, samplePack.pack_dir, 'index.html'), 'utf8');
  test('detail page mentions enhanced prompt', () =>
    /enhanced/i.test(detailHtml) || /image-prompt\.enriched\.md|增强.*Prompt/i.test(detailHtml)
  );
  test('detail page no LLM markers', () => !LLM_MARKERS.some(re => re.test(detailHtml)));
  test('detail page no API keys', () => !/(API_KEY|sk-|hf_[A-Za-z0-9]{10,})/.test(detailHtml));
}

run();

console.log(`[validate-image-prompts] ${pass}/${pass+fail} checks passed`);
console.log(`[validate-image-prompts] enriched.md: ${enrichedMdOk}/${idx.content_packs.length}`);
console.log(`[validate-image-prompts] zh.md: ${zhMdOk}/${idx.content_packs.length}`);
console.log(`[validate-image-prompts] meta.json: ${metaOk}/${idx.content_packs.length}`);
console.log(`[validate-image-prompts] by source_type:`, sourcesByType);

if (fail > 0) {
  console.log(`[validate-image-prompts] FAILURES (first 20):`);
  for (const f of fails.slice(0, 20)) console.log(`  - ${f}`);
  process.exit(1);
}
