#!/usr/bin/env tsx
/**
 * scripts/validate-video-prompt-enhancement.ts
 *
 * Validates Phase 4H video-prompt enhancement output.
 *
 * Checks per pack:
 *   - video-prompt.enriched.md exists, non-empty, contains 3 shots, English prompt
 *   - video-prompt.zh.md exists, non-empty
 *   - video-prompt.meta.json exists, valid JSON, required keys present
 *   - shots array length === 3, each shot has id/duration_s/description/camera/motion
 *   - english_prompt length in [120, 2400] chars
 *   - intent_zh length in [40, 1000] chars
 *   - parameters.modelFamily === 'hailuo'
 *   - parameters.duration in [6, 8] seconds
 *   - parameters.aspectRatio === '16:9'
 *   - parameters.generationMode === 'prompt-only'
 *   - priority in ['high', 'medium', 'low']
 *   - facts_used has at least 1 entry
 *   - strategy string is non-empty
 *   - llm_used === false, video_model_called === false, image_model_called === false,
 *     music_generated === false, new_media_generated === false
 *
 * Global:
 *   - 100% of packs have all three files
 *   - no LLM markers (MiniMax, gpt-4, claude) in generated files
 *   - no API keys / secrets in meta JSON
 *   - existing video-prompt.md is NOT overwritten (idempotency: original preserved)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

function safeReadJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; }
  catch { return fallback; }
}

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
let videoPromptPreserved = 0;
const sourcesByType: Record<string, number> = {};

for (const pack of idx.content_packs) {
  const packDir = pack.pack_dir;

  const enrichedPath = join(ASSETS, packDir, 'video-prompt.enriched.md');
  const zhPath = join(ASSETS, packDir, 'video-prompt.zh.md');
  const metaPath = join(ASSETS, packDir, 'video-prompt.meta.json');
  const originalPath = join(ASSETS, packDir, 'video-prompt.md');

  const enrichedExists = existsSync(enrichedPath);
  const zhExists = existsSync(zhPath);
  const metaExists = existsSync(metaPath);

  test(`enriched.md exists :: ${packDir}`, () => enrichedExists);
  test(`zh.md exists :: ${packDir}`, () => zhExists);
  test(`meta.json exists :: ${packDir}`, () => metaExists);

  if (!enrichedExists || !zhExists || !metaExists) continue;

  // enriched.md content
  const enriched = readFileSync(enrichedPath, 'utf8');
  test(`enriched.md has 中文创作意图 :: ${packDir}`, () =>
    enriched.includes('中文创作意图')
  );
  test(`enriched.md has 事实依据 :: ${packDir}`, () =>
    enriched.includes('事实依据')
  );
  test(`enriched.md has 镜头设计 with 3 shots :: ${packDir}`, () =>
    enriched.includes('镜头设计') &&
    /Shot 1\s*\(\s*3\s*s\s*\)/.test(enriched) &&
    /Shot 2\s*\(\s*3\s*s\s*\)/.test(enriched) &&
    /Shot 3\s*\(\s*2\s*s\s*\)/.test(enriched)
  );
  test(`enriched.md has 画面风格 :: ${packDir}`, () =>
    enriched.includes('画面风格')
  );
  test(`enriched.md has English prompt block :: ${packDir}`, () =>
    enriched.includes('Hailuo Video Prompt') && /```text[\s\S]+```/.test(enriched)
  );
  test(`enriched.md has Negative / Avoid :: ${packDir}`, () =>
    enriched.includes('Negative / Avoid')
  );
  test(`enriched.md has 推荐参数 with model_family :: ${packDir}`, () =>
    enriched.includes('推荐参数') &&
    enriched.includes('model_family') &&
    enriched.includes('hailuo')
  );
  test(`enriched.md has 不确定性说明 :: ${packDir}`, () =>
    enriched.includes('不确定性说明')
  );
  test(`enriched.md no LLM markers :: ${packDir}`, () =>
    !LLM_MARKERS.some(re => re.test(enriched))
  );
  if (
    enriched.includes('中文创作意图') &&
    enriched.includes('事实依据') &&
    enriched.includes('镜头设计') &&
    enriched.includes('Hailuo Video Prompt') &&
    enriched.includes('推荐参数')
  ) {
    enrichedMdOk++;
  }

  // zh.md content
  const zh = readFileSync(zhPath, 'utf8');
  test(`zh.md has 创作意图 :: ${packDir}`, () =>
    zh.includes('创作意图')
  );
  test(`zh.md has 镜头设计 3 段 :: ${packDir}`, () =>
    zh.includes('镜头设计') && /Shot 1/.test(zh) && /Shot 2/.test(zh) && /Shot 3/.test(zh)
  );
  test(`zh.md has 适合什么用途 :: ${packDir}`, () =>
    zh.includes('适合什么用途')
  );
  test(`zh.md has 与现有素材的关系 :: ${packDir}`, () =>
    zh.includes('与现有素材的关系')
  );
  test(`zh.md no LLM markers :: ${packDir}`, () =>
    !LLM_MARKERS.some(re => re.test(zh))
  );
  if (
    zh.includes('创作意图') &&
    zh.includes('镜头设计') &&
    zh.includes('适合什么用途')
  ) {
    zhMdOk++;
  }

  // meta.json content
  const meta = safeReadJson<any>(metaPath, {});
  test(`meta.json parses :: ${packDir}`, () =>
    typeof meta === 'object' && meta !== null && !Array.isArray(meta)
  );
  test(`meta.json has english_prompt :: ${packDir}`, () =>
    typeof meta.english_prompt === 'string'
  );
  test(`meta.json english_prompt length ok :: ${packDir}`, () => {
    const len = meta.english_prompt?.length || 0;
    return len >= 120 && len <= 2400;
  });
  test(`meta.json has intent_zh :: ${packDir}`, () => {
    const len = meta.intent_zh?.length || 0;
    return typeof meta.intent_zh === 'string' && len >= 40 && len <= 1000;
  });
  test(`meta.json shots length === 3 :: ${packDir}`, () =>
    Array.isArray(meta.shots) && meta.shots.length === 3
  );
  test(`meta.json each shot has all fields :: ${packDir}`, () => {
    if (!Array.isArray(meta.shots)) return false;
    return meta.shots.every((s: any) =>
      typeof s.id === 'number' &&
      typeof s.duration_s === 'number' &&
      typeof s.description === 'string' &&
      typeof s.camera === 'string' &&
      typeof s.motion === 'string' &&
      s.description.length > 5 &&
      s.camera.length > 2 &&
      s.motion.length > 2
    );
  });
  test(`meta.json facts_used >= 1 :: ${packDir}`, () =>
    Array.isArray(meta.facts_used) && meta.facts_used.length >= 1
  );
  test(`meta.json parameters.modelFamily === hailuo :: ${packDir}`, () =>
    meta.parameters?.modelFamily === 'hailuo'
  );
  test(`meta.json parameters.duration in [6,8] :: ${packDir}`, () => {
    const d = meta.parameters?.duration;
    return d === 6 || d === 8;
  });
  test(`meta.json parameters.aspectRatio === 16:9 :: ${packDir}`, () =>
    meta.parameters?.aspectRatio === '16:9'
  );
  test(`meta.json parameters.generationMode === prompt-only :: ${packDir}`, () =>
    meta.parameters?.generationMode === 'prompt-only'
  );
  test(`meta.json priority valid :: ${packDir}`, () =>
    ['high', 'medium', 'low'].includes(meta.parameters?.priority)
  );
  test(`meta.json strategy non-empty :: ${packDir}`, () =>
    typeof meta.strategy === 'string' && meta.strategy.length > 5
  );
  test(`meta.json no model calls :: ${packDir}`, () =>
    meta.llm_used === false &&
    meta.video_model_called === false &&
    meta.image_model_called === false &&
    meta.music_generated === false &&
    meta.new_media_generated === false
  );
  test(`meta.json no API keys :: ${packDir}`, () => {
    const s = JSON.stringify(meta);
    return !/API_KEY|api_key|sk-|hf_[A-Za-z0-9]{10,}/.test(s);
  });
  test(`meta.json no LLM markers :: ${packDir}`, () => {
    const s = JSON.stringify(meta);
    return !LLM_MARKERS.some(re => re.test(s));
  });
  test(`meta.json source_type known :: ${packDir}`, () => {
    const t = meta.source_type;
    return ['code', 'academic', 'ai-ecosystem', 'dev-community', 'culture-art', 'context'].includes(t);
  });

  if (meta.source_type) {
    sourcesByType[meta.source_type] = (sourcesByType[meta.source_type] || 0) + 1;
  }
  if (
    typeof meta.english_prompt === 'string' &&
    meta.english_prompt.length >= 120 &&
    Array.isArray(meta.shots) &&
    meta.shots.length === 3 &&
    Array.isArray(meta.facts_used) &&
    meta.facts_used.length >= 1
  ) {
    metaOk++;
  }

  // Original video-prompt.md preserved (idempotency: never overwrite)
  if (existsSync(originalPath)) {
    const orig = readFileSync(originalPath, 'utf8');
    test(`original video-prompt.md preserved :: ${packDir}`, () =>
      orig.length > 0 && !orig.startsWith('Shot 1') // not replaced by enriched
    );
    if (orig.length > 0) videoPromptPreserved++;
  }
}

// Global checks
test('all packs have enriched.md', () => enrichedMdOk === idx.content_packs.length);
test('all packs have zh.md', () => zhMdOk === idx.content_packs.length);
test('all packs have valid meta.json', () => metaOk === idx.content_packs.length);
test('source_type distribution non-empty', () => Object.keys(sourcesByType).length > 0);

run();

console.log(`[validate-video-prompts] ${pass}/${pass+fail} checks passed`);
console.log(`[validate-video-prompts] enriched.md: ${enrichedMdOk}/${idx.content_packs.length}`);
console.log(`[validate-video-prompts] zh.md: ${zhMdOk}/${idx.content_packs.length}`);
console.log(`[validate-video-prompts] meta.json: ${metaOk}/${idx.content_packs.length}`);
console.log(`[validate-video-prompts] original video-prompt.md preserved: ${videoPromptPreserved}/${idx.content_packs.length}`);
console.log(`[validate-video-prompts] by source_type:`, sourcesByType);

if (fail > 0) {
  console.log(`[validate-video-prompts] FAILURES (first 20):`);
  for (const f of fails.slice(0, 20)) console.log(`  - ${f}`);
  process.exit(1);
}
