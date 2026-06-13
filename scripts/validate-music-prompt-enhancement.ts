#!/usr/bin/env tsx
/**
 * scripts/validate-music-prompt-enhancement.ts
 *
 * Validates Phase 4I music-prompt enhancement output.
 *
 * Per-pack checks:
 *   - music-prompt.enriched.md exists, non-empty, contains Chinese intent, music direction,
 *     MiniMax Music Prompt, Negative/Avoid, parameters
 *   - music-prompt.zh.md exists, non-empty
 *   - music-prompt.meta.json exists, valid JSON
 *   - meta.json has spec-required top-level fields:
 *     title, source_type, source_label_zh, prompt_strategy, model_family: "minimax-music",
 *     duration: "60-90s", instrumental: true, lyrics: "none", priority in [high,medium,low],
 *     recommended_use[], facts_used[], original_prompt_path, enriched_prompt_path,
 *     zh_prompt_path, generation_mode: "prompt-only", uncertainty_notes[]
 *   - llm_used === false, music_model_called === false, image_model_called === false,
 *     video_model_called === false, audio_generated === false, new_media_generated === false
 *   - No LLM markers (MiniMax, gpt-4, claude) in any output
 *   - No API keys / secrets / [truncated] markers
 *
 * Global:
 *   - 100% of packs have all three files
 *   - Original music-prompt.md preserved (never overwritten)
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
let musicPromptPreserved = 0;
const sourcesByType: Record<string, number> = {};

for (const pack of idx.content_packs) {
  const packDir = pack.pack_dir;

  const enrichedPath = join(ASSETS, packDir, 'music-prompt.enriched.md');
  const zhPath = join(ASSETS, packDir, 'music-prompt.zh.md');
  const metaPath = join(ASSETS, packDir, 'music-prompt.meta.json');
  const originalPath = join(ASSETS, packDir, 'music-prompt.md');

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
  test(`enriched.md has 音乐方向 with attributes :: ${packDir}`, () =>
    enriched.includes('音乐方向') &&
    enriched.includes('**mood**') &&
    enriched.includes('**genre**') &&
    enriched.includes('**tempo**') &&
    enriched.includes('**instrumentation**') &&
    enriched.includes('**texture**') &&
    enriched.includes('**energy**') &&
    enriched.includes('**loopability**')
  );
  test(`enriched.md has MiniMax Music Prompt :: ${packDir}`, () =>
    enriched.includes('MiniMax Music Prompt') && /```text[\s\S]+```/.test(enriched)
  );
  test(`enriched.md has Negative / Avoid :: ${packDir}`, () =>
    enriched.includes('Negative / Avoid')
  );
  test(`enriched.md has 推荐参数 with model_family :: ${packDir}`, () =>
    enriched.includes('推荐参数') &&
    enriched.includes('model_family') &&
    enriched.includes('minimax-music')
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
    enriched.includes('音乐方向') &&
    enriched.includes('MiniMax Music Prompt') &&
    enriched.includes('推荐参数')
  ) {
    enrichedMdOk++;
  }

  // zh.md content
  const zh = readFileSync(zhPath, 'utf8');
  test(`zh.md has 创作意图 :: ${packDir}`, () =>
    zh.includes('创作意图')
  );
  test(`zh.md has 音乐属性 :: ${packDir}`, () =>
    zh.includes('音乐属性')
  );
  test(`zh.md has 适合的使用场景 :: ${packDir}`, () =>
    zh.includes('适合的使用场景')
  );
  test(`zh.md has 与现有素材的关系 :: ${packDir}`, () =>
    zh.includes('与现有素材的关系')
  );
  test(`zh.md no LLM markers :: ${packDir}`, () =>
    !LLM_MARKERS.some(re => re.test(zh))
  );
  if (
    zh.includes('创作意图') &&
    zh.includes('音乐属性') &&
    zh.includes('适合的使用场景')
  ) {
    zhMdOk++;
  }

  // meta.json content
  const meta = safeReadJson<any>(metaPath, {});
  test(`meta.json parses :: ${packDir}`, () =>
    typeof meta === 'object' && meta !== null && !Array.isArray(meta)
  );
  // Spec-required top-level fields
  test(`meta.json top-level title :: ${packDir}`, () =>
    typeof meta.title === 'string' && meta.title.length > 0
  );
  test(`meta.json top-level source_type :: ${packDir}`, () =>
    typeof meta.source_type === 'string' && meta.source_type.length > 0
  );
  test(`meta.json top-level source_label_zh :: ${packDir}`, () =>
    typeof meta.source_label_zh === 'string' && meta.source_label_zh.length > 0
  );
  test(`meta.json top-level prompt_strategy non-empty :: ${packDir}`, () =>
    typeof meta.prompt_strategy === 'string' && meta.prompt_strategy.length > 5
  );
  test(`meta.json top-level model_family === minimax-music :: ${packDir}`, () =>
    meta.model_family === 'minimax-music'
  );
  test(`meta.json top-level duration === 60-90s :: ${packDir}`, () =>
    meta.duration === '60-90s'
  );
  test(`meta.json top-level instrumental === true :: ${packDir}`, () =>
    meta.instrumental === true
  );
  test(`meta.json top-level lyrics === none :: ${packDir}`, () =>
    meta.lyrics === 'none'
  );
  test(`meta.json top-level priority valid :: ${packDir}`, () =>
    ['high', 'medium', 'low'].includes(meta.priority)
  );
  test(`meta.json top-level recommended_use is array :: ${packDir}`, () =>
    Array.isArray(meta.recommended_use) && meta.recommended_use.length >= 1
  );
  test(`meta.json top-level facts_used is array :: ${packDir}`, () =>
    Array.isArray(meta.facts_used)
  );
  test(`meta.json top-level original_prompt_path :: ${packDir}`, () =>
    meta.original_prompt_path === 'music-prompt.md'
  );
  test(`meta.json top-level enriched_prompt_path :: ${packDir}`, () =>
    meta.enriched_prompt_path === 'music-prompt.enriched.md'
  );
  test(`meta.json top-level zh_prompt_path :: ${packDir}`, () =>
    meta.zh_prompt_path === 'music-prompt.zh.md'
  );
  test(`meta.json top-level generation_mode === prompt-only :: ${packDir}`, () =>
    meta.generation_mode === 'prompt-only'
  );
  test(`meta.json top-level uncertainty_notes is array :: ${packDir}`, () =>
    Array.isArray(meta.uncertainty_notes)
  );
  // Hard rules
  test(`meta.json no model calls :: ${packDir}`, () =>
    meta.llm_used === false &&
    meta.music_model_called === false &&
    meta.image_model_called === false &&
    meta.video_model_called === false &&
    meta.audio_generated === false &&
    meta.new_media_generated === false
  );
  test(`meta.json no API keys :: ${packDir}`, () => {
    const s = JSON.stringify(meta);
    return !/API_KEY|api_key|sk-|hf_[A-Za-z0-9]{10,}|TELEGRAM_BOT_TOKEN|bot_token/i.test(s);
  });
  test(`meta.json no LLM markers :: ${packDir}`, () => {
    const s = JSON.stringify(meta);
    return !LLM_MARKERS.some(re => re.test(s));
  });
  test(`meta.json no [truncated] marker :: ${packDir}`, () => {
    const s = JSON.stringify(meta);
    return !/\[truncated\]/i.test(s);
  });
  test(`meta.json source_type known :: ${packDir}`, () => {
    const t = meta.source_type;
    return ['code', 'academic', 'ai-ecosystem', 'dev-community', 'culture-art', 'context'].includes(t);
  });
  test(`meta.json english_prompt present :: ${packDir}`, () =>
    typeof meta.english_prompt === 'string' && meta.english_prompt.length >= 80
  );
  test(`meta.json attributes present :: ${packDir}`, () => {
    const a = meta.attributes || {};
    return typeof a.mood === 'string' &&
      typeof a.genre === 'string' &&
      typeof a.tempo === 'string' &&
      typeof a.instrumentation === 'string' &&
      typeof a.texture === 'string' &&
      typeof a.energy === 'string' &&
      typeof a.loopability === 'string';
  });

  if (meta.source_type) {
    sourcesByType[meta.source_type] = (sourcesByType[meta.source_type] || 0) + 1;
  }
  if (
    meta.model_family === 'minimax-music' &&
    meta.duration === '60-90s' &&
    meta.instrumental === true &&
    meta.generation_mode === 'prompt-only' &&
    Array.isArray(meta.recommended_use) &&
    meta.recommended_use.length >= 1
  ) {
    metaOk++;
  }

  // Original music-prompt.md preserved if it exists (idempotency)
  if (existsSync(originalPath)) {
    const orig = readFileSync(originalPath, 'utf8');
    test(`original music-prompt.md preserved :: ${packDir}`, () =>
      orig.length > 0 && !orig.startsWith('# 增强音乐 Prompt')
    );
    if (orig.length > 0) musicPromptPreserved++;
  }
}

// Global checks
test('all packs have enriched.md', () => enrichedMdOk === idx.content_packs.length);
test('all packs have zh.md', () => zhMdOk === idx.content_packs.length);
test('all packs have valid meta.json', () => metaOk === idx.content_packs.length);
test('source_type distribution non-empty', () => Object.keys(sourcesByType).length > 0);

run();

console.log(`[validate-music-prompts] ${pass}/${pass+fail} checks passed`);
console.log(`[validate-music-prompts] enriched.md: ${enrichedMdOk}/${idx.content_packs.length}`);
console.log(`[validate-music-prompts] zh.md: ${zhMdOk}/${idx.content_packs.length}`);
console.log(`[validate-music-prompts] meta.json: ${metaOk}/${idx.content_packs.length}`);
console.log(`[validate-music-prompts] original music-prompt.md preserved: ${musicPromptPreserved}/${idx.content_packs.length}`);
console.log(`[validate-music-prompts] by source_type:`, sourcesByType);

if (fail > 0) {
  console.log(`[validate-music-prompts] FAILURES (first 20):`);
  for (const f of fails.slice(0, 20)) console.log(`  - ${f}`);
  process.exit(1);
}
