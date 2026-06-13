#!/usr/bin/env tsx
/**
 * scripts/enhance-music-prompts.ts
 *
 * Phase 4I: Source-aware Music Prompt Enhancement.
 *
 * Reads existing per-pack data (music-prompt.md, facts.enriched.md,
 * sources-facts.json, detail.json, brief.md, image-prompt.enriched.md,
 * video-prompt.enriched.md, manifest.json) and produces three new
 * artifacts per pack, choosing music direction by source_type:
 *
 *   - music-prompt.enriched.md   (Chinese intent + music direction + EN prompt + negative + params)
 *   - music-prompt.zh.md         (human-readable Chinese explanation)
 *   - music-prompt.meta.json     (machine-readable metadata with spec-required top-level fields)
 *
 * NO LLM calls, NO external API calls, NO music/image/video model calls.
 * All generation is deterministic, rule-based, and operates only on
 * existing local data. Idempotent: re-run produces same result.
 *
 * Defaults:
 *   - instrumental: true (no vocals, no lyrics)
 *   - duration: "60-90s"
 *   - model_family: "minimax-music"
 *   - generation_mode: "prompt-only"
 *   - no living artist imitation, no copyrighted melodies, no famous song refs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

// ---------- helpers ----------

function safeReadJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; }
  catch { return fallback; }
}

function safeReadText(path: string, fallback = ''): string {
  try { return readFileSync(path, 'utf8'); }
  catch { return fallback; }
}

function trim(s: string, n: number): string {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd();
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalize(s: string): string {
  return (s || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeForPrompt(s: string): string {
  return (s || '')
    .replace(/[`*_#>]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- shared types ----------

interface MusicAttributes {
  mood: string;            // e.g. "calm, focused"
  genre: string;           // e.g. "lo-fi electronic"
  tempo: string;           // e.g. "75 BPM, relaxed"
  instrumentation: string; // e.g. "soft synth pads, gentle piano, light percussion"
  texture: string;         // e.g. "warm, soft attack, sustained tails"
  energy: string;          // e.g. "low, steady, non-distracting"
  loopability: string;     // e.g. "loopable, gentle fade-in/out"
}

interface PackCtx {
  packDir: string;
  packId: string;
  title: string;
  sourceType: string;
  sourceLabelZh: string;
  oneSentence: string;
  background: string;
  whyItMatters: string;
  tags: string[];
  brief: string;
  facts: string;
  factsEnriched: string;
  sourceFacts: any;
  detail: any;
  manifest: any;
  imagePromptEnriched: string;
  videoPromptEnriched: string;
  existingMusicPrompt: string;
  date: string;
}

interface MusicResult {
  intentZh: string;          // Chinese intent paragraph
  factsUsed: string[];       // Public facts cited
  attributes: MusicAttributes;
  englishPrompt: string;     // Final English prompt
  negativePrompt: string;    // Negative prompt
  params: {
    modelFamily: string;
    duration: string;
    instrumental: boolean;
    lyrics: string;
    priority: 'high' | 'medium' | 'low';
    generationMode: string;
  };
  uncertaintyNotes: string[];
  rationale: string;         // Why this music direction fits
  recommendedUse: string[];  // top-level recommended_use
}

const BASE_NEGATIVE = [
  'no lyrics',
  'no vocals',
  'no imitation of living artists',
  'no copyrighted melodies',
  'no famous song references',
  'no recognizable tune hooks',
  'no harsh noise',
  'no abrupt ending',
  'no sudden tempo change',
  'no clipping',
  'no busy mix',
  'no low quality mp3 artifacts',
].join(', ');

const DEFAULT_PARAMS = {
  modelFamily: 'minimax-music',
  duration: '60-90s',
  instrumental: true,
  lyrics: 'none',
  priority: 'medium' as const,
  generationMode: 'prompt-only',
};

const STRATEGIES: Record<string, (ctx: PackCtx) => MusicResult> = {
  code: codeMusicStrategy,
  academic: academicMusicStrategy,
  'ai-ecosystem': aiEcosystemMusicStrategy,
  'dev-community': devCommunityMusicStrategy,
  'culture-art': cultureArtMusicStrategy,
  context: contextMusicStrategy,
};

const RECOMMENDED_USE_MAP: Record<string, string[]> = {
  'code': ['background-music', 'short-video', 'project-intro', 'coding-session'],
  'academic': ['background-music', 'paper-explainer', 'podcast-intro', 'conference-talk'],
  'ai-ecosystem': ['background-music', 'model-demo', 'short-video', 'product-card'],
  'dev-community': ['background-music', 'discussion-clip', 'x-post', 'short-video'],
  'culture-art': ['background-music', 'museum-clip', 'gallery-loop', 'short-video'],
  'context': ['background-music', 'mood-clip', 'morning-ambience', 'social'],
};

// ---------- code (GitHub repo) ----------

function codeMusicStrategy(ctx: PackCtx): MusicResult {
  const facts = ctx.sourceFacts?.facts || {};
  const topics: string[] = facts.topics || [];
  const description = facts.description || ctx.oneSentence;

  const isAgent = /agent|mcp|claude|automation|skill/i.test(topics.join(' ') + ' ' + description);
  const isGenMedia = /text-to-image|text-to-video|ai-art|ai-music|generative-ai|muapi|kling|veo|suno/i.test(topics.join(' ') + ' ' + description);
  const isInfra = /rag|knowledge|vector|embedding|llm|chat/i.test(topics.join(' ') + ' ' + description);

  const directionZh = isAgent ? 'agent workflow pulse'
    : isGenMedia ? 'minimal electronic'
    : isInfra ? 'tech editorial background'
    : 'focus coding lo-fi';

  const factsUsed: string[] = [];
  if (topics.length) factsUsed.push(`topics: ${topics.slice(0, 4).join(', ')}`);
  if (description) factsUsed.push(`description: ${trim(description, 100)}`);
  if (facts.language) factsUsed.push(`language: ${facts.language}`);

  const attributes: MusicAttributes = {
    mood: 'focused, calm, lightly energised',
    genre: isAgent ? 'minimal electronic' : isGenMedia ? 'lo-fi electronic' : 'lo-fi hip-hop',
    tempo: '70-85 BPM, relaxed but moving',
    instrumentation: isAgent
      ? 'soft synth arpeggios, light pulse kick, gentle hi-hats'
      : 'muted piano keys, soft synth pads, vinyl crackle, brushed snare',
    texture: 'warm, soft attack, mid-range focus, gentle sidechain',
    energy: 'low-to-medium, never distracting, supports concentration',
    loopability: 'seamlessly loopable, gentle 4-bar ending tail',
  };

  const englishPrompt = [
    'An instrumental coding-session background track',
    `${attributes.genre}, ${attributes.tempo}`,
    `mood: ${attributes.mood}`,
    `instrumentation: ${attributes.instrumentation}`,
    `texture: ${attributes.texture}`,
    `energy: ${attributes.energy}`,
    'style references: ambient lo-fi, minimal downtempo, no vocals, no lyrics',
    'suitable for a 60-90 second background loop under a developer project explainer',
    'gentle fade-in at 0s, gentle fade-out at the end',
    'no melody that competes with voiceover',
  ].join('. ');

  return {
    intentZh: [
      `音乐方向：${directionZh}`,
      `项目：${ctx.title}`,
      description ? `项目定位：${trim(description, 100)}` : '',
      `核心思路：60-90 秒纯器乐，可循环，节奏舒缓不抢人声；适合项目演示、介绍视频背景`,
    ].filter(Boolean).join('。'),
    factsUsed,
    attributes,
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', trap hi-hats at high tempo, dubstep drops, anime opening energy',
    params: { ...DEFAULT_PARAMS, priority: 'high' },
    uncertaintyNotes: [
      topics.length ? '' : 'topics missing from source facts',
    ].filter(Boolean),
    rationale: 'code → focus coding lo-fi / agent workflow pulse，强调「可循环 + 不抢人声 + 项目气质」',
    recommendedUse: RECOMMENDED_USE_MAP['code'],
  };
}

// ---------- academic (arXiv paper) ----------

function academicMusicStrategy(ctx: PackCtx): MusicResult {
  const facts = ctx.sourceFacts?.facts || {};
  const title = facts.title || ctx.title;
  const authors = facts.authors;
  const summary = facts.summary || ctx.oneSentence;
  const primaryCat = facts.primary_category || '';

  const isLlm = /llm|automation|benchmark/i.test(title + ' ' + summary);
  const isVision = /vision|video|multimodal|diffusion/i.test(title + ' ' + summary);
  const isTheory = /theorem|proof|complexity|bound/i.test(title + ' ' + summary);

  const directionZh = isTheory ? 'quiet research atmosphere (gentle piano, sustained pads)'
    : isLlm ? 'calm analytical ambient'
    : isVision ? 'subtle piano / soft synth'
    : 'academic explanation background';

  const factsUsed: string[] = [];
  factsUsed.push(`title: ${title}`);
  if (authors) factsUsed.push(`authors: ${trim(authors, 60)}`);
  if (primaryCat) factsUsed.push(`primary_category: ${primaryCat}`);
  if (summary) factsUsed.push(`summary: ${trim(summary, 80)}`);

  const attributes: MusicAttributes = {
    mood: 'contemplative, scholarly, calm',
    genre: isTheory ? 'chamber ambient' : 'analytical ambient',
    tempo: '55-70 BPM, slow and reflective',
    instrumentation: isTheory
      ? 'felt piano, low strings, occasional sub-bass pulses'
      : 'soft synth pads, sparse piano notes, light bell accents',
    texture: 'spacious, air-filled, high-frequency restraint',
    energy: 'very low, never rises to interrupt narration',
    loopability: 'long-form loopable, gentle drift between sections',
  };

  const englishPrompt = [
    'An instrumental academic background track',
    `${attributes.genre}, ${attributes.tempo}`,
    `mood: ${attributes.mood}`,
    `instrumentation: ${attributes.instrumentation}`,
    `texture: ${attributes.texture}`,
    `energy: ${attributes.energy}`,
    'style references: ambient paper-reading background, museum audio, no vocals',
    'suitable for a 60-90 second loop under a paper explainer video',
    'gentle fade-in and gentle fade-out, no dramatic crescendos',
  ].join('. ');

  return {
    intentZh: [
      `音乐方向：${directionZh}`,
      `论文：${title}`,
      authors ? `作者：${trim(authors, 60)}` : '',
      `核心思路：60-90 秒学术氛围纯器乐，节奏慢、留白多；适合论文讲解视频背景`,
    ].filter(Boolean).join('。'),
    factsUsed,
    attributes,
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', rock drums, electric guitar, EDM, dubstep, orchestral hit',
    params: { ...DEFAULT_PARAMS, priority: 'medium' },
    uncertaintyNotes: [
      authors ? '' : 'authors missing',
    ].filter(Boolean),
    rationale: 'academic → 学术氛围 / 安静分析型 / 极弱节奏，强调「不抢人声 + 留白 + 思考气质」',
    recommendedUse: RECOMMENDED_USE_MAP['academic'],
  };
}

// ---------- ai-ecosystem (HF model) ----------

function aiEcosystemMusicStrategy(ctx: PackCtx): MusicResult {
  const facts = ctx.sourceFacts?.facts || {};
  const enriched: string[] = ctx.detail?.enriched_facts || [];
  const downloads = enriched.find(f => /下载量/.test(f));
  const task = enriched.find(f => /任务类型/.test(f));

  const isVideoTask = /image-to-video|text-to-video|img2vid|video/i.test(task || '');
  const isImageTask = /text-to-image|image-generation|diffusion|stable/i.test(task || '');
  const isAudioTask = /text-to-audio|music|asr|tts|speech/i.test(task || '');
  const isTextTask = /text-generation|llm|chat|completion/i.test(task || '');

  const directionZh = isVideoTask ? 'futuristic model flow (light pulse + soft synth)'
    : isImageTask ? 'data stream ambience (textural synth)'
    : isAudioTask ? 'clean synthetic texture (waveform-like rhythm)'
    : isTextTask ? 'light electronic pulse (token-stream tempo)'
    : 'futuristic model flow';

  const factsUsed: string[] = [];
  factsUsed.push(`model: ${ctx.title}`);
  if (task) factsUsed.push(`task: ${task}`);
  if (downloads) factsUsed.push(downloads);

  const attributes: MusicAttributes = {
    mood: 'clean, modern, slightly forward-looking',
    genre: isVideoTask ? 'light electronic pulse' : 'minimal synthwave-lite',
    tempo: '90-110 BPM, gentle forward motion',
    instrumentation: isAudioTask
      ? 'soft modular synth, light glitchy plucks, no percussion'
      : 'soft analog synth pads, gentle pulse bass, sparse high-end plucks',
    texture: 'clean, polished, slight sidechain pumping',
    energy: 'medium-low, supportive, never dominates',
    loopability: '4-bar motif loop, gentle transitions',
  };

  const englishPrompt = [
    'An instrumental futuristic model-demo background track',
    `${attributes.genre}, ${attributes.tempo}`,
    `mood: ${attributes.mood}`,
    `instrumentation: ${attributes.instrumentation}`,
    `texture: ${attributes.texture}`,
    `energy: ${attributes.energy}`,
    'style references: clean modern synth background, model card demo ambience, no vocals',
    'suitable for a 60-90 second loop under an AI model capability demo',
    'gentle fade-in, gentle fade-out, no drops',
  ].join('. ');

  return {
    intentZh: [
      `音乐方向：${directionZh}`,
      `模型：${ctx.title}`,
      task ? `任务类型：${task}` : '',
      `核心思路：60-90 秒干净现代的合成器背景，节奏轻盈；适合模型能力演示视频`,
    ].filter(Boolean).join('。'),
    factsUsed,
    attributes,
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', trap hi-hats, dubstep, country, jazz fusion',
    params: { ...DEFAULT_PARAMS, priority: 'high' },
    uncertaintyNotes: [
      task ? '' : 'task type missing',
      downloads ? '' : 'downloads missing',
    ].filter(Boolean),
    rationale: 'ai-ecosystem → 干净合成器 / 轻电子脉冲，强调「现代 + 不抢人声 + 模型演示气质」',
    recommendedUse: RECOMMENDED_USE_MAP['ai-ecosystem'],
  };
}

// ---------- dev-community ----------

function devCommunityMusicStrategy(ctx: PackCtx): MusicResult {
  const facts = ctx.sourceFacts?.facts || {};
  const title = facts.title || ctx.title;
  const description = facts.description || ctx.oneSentence;

  const isCritical = /automation|flaw|narrative|critique|pain|rant/i.test(title + ' ' + description);
  const directionZh = isCritical ? 'developer community energy (light indie electronic)'
    : 'waiting-for-agent coding vibe';

  const factsUsed: string[] = [];
  factsUsed.push(`title: ${title}`);
  if (description) factsUsed.push(`description: ${trim(description, 80)}`);

  const attributes: MusicAttributes = {
    mood: isCritical ? 'thoughtful, slightly skeptical' : 'patient, ambient',
    genre: 'indie electronic / lo-fi',
    tempo: '75-90 BPM, conversational pacing',
    instrumentation: 'soft synth chords, light electric piano, brushed snare hits',
    texture: 'casual, room-y, mid-range focus',
    energy: 'low-medium, never urgent',
    loopability: '8-bar loop with quiet variation',
  };

  const englishPrompt = [
    'An instrumental developer-community discussion background track',
    `${attributes.genre}, ${attributes.tempo}`,
    `mood: ${attributes.mood}`,
    `instrumentation: ${attributes.instrumentation}`,
    `texture: ${attributes.texture}`,
    `energy: ${attributes.energy}`,
    'style references: indie electronic, soft chiptune-lite (no lead melody), no vocals',
    'suitable for a 60-90 second loop under a Hacker News / dev discussion clip',
  ].join('. ');

  return {
    intentZh: [
      `音乐方向：${directionZh}`,
      `话题：${title}`,
      description ? `简介：${trim(description, 80)}` : '',
      `核心思路：60-90 秒独立电子 / 轻 lo-fi，节奏接近对话速度；适合讨论片段背景`,
    ].filter(Boolean).join('。'),
    factsUsed,
    attributes,
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', punk, metal, dubstep, hardstyle',
    params: { ...DEFAULT_PARAMS, priority: 'medium' },
    uncertaintyNotes: [
      description ? '' : 'description missing — intent based on title only',
    ].filter(Boolean),
    rationale: 'dev-community → 独立电子 / 等待 agent vibe，强调「对话节奏 + 社区感」',
    recommendedUse: RECOMMENDED_USE_MAP['dev-community'],
  };
}

// ---------- culture-art (Met museum) ----------

function cultureArtMusicStrategy(ctx: PackCtx): MusicResult {
  const facts = ctx.sourceFacts?.facts || {};
  const title = facts.title || ctx.title;
  const artist = facts.artist;
  const date = facts.date;
  const medium = facts.medium;
  const department = facts.department;

  const isReligious = /saint|virgin|christ|madonna|angel|religious|devotion|jerome/i.test(title);
  const isLandscape = /landscape|panorama|river|mountain/i.test(title + ' ' + (facts.classification || ''));
  const isPortrait = /portrait|man|woman|figure/i.test(title);

  const directionZh = isReligious ? 'museum ambience (chamber texture, contemplative)'
    : isLandscape ? 'warm classical-inspired instrumental (slow reflective mood)'
    : isPortrait ? 'museum ambience (intimate chamber)'
    : 'museum ambience (chamber texture)';

  const factsUsed: string[] = [];
  factsUsed.push(`title: ${title}`);
  if (artist) factsUsed.push(`artist: ${artist}`);
  if (date) factsUsed.push(`date: ${date}`);
  if (medium) factsUsed.push(`medium: ${medium}`);
  if (department) factsUsed.push(`department: ${department}`);

  const attributes: MusicAttributes = {
    mood: 'reflective, museum-quiet, intimate',
    genre: 'chamber ambient / warm classical-inspired instrumental',
    tempo: '45-60 BPM, very slow and deliberate',
    instrumentation: 'felt piano, soft strings, occasional solo cello long tones, breath of flute',
    texture: 'warm wood-and-resin, soft attack, long sustained tails',
    energy: 'very low, contemplative',
    loopability: 'evolving texture, gentle cadence, no abrupt end',
  };

  const englishPrompt = [
    'An instrumental museum ambience track',
    `${attributes.genre}, ${attributes.tempo}`,
    `mood: ${attributes.mood}`,
    `instrumentation: ${attributes.instrumentation}`,
    `texture: ${attributes.texture}`,
    `energy: ${attributes.energy}`,
    'style references: warm chamber ambient, modern classical without imitation of specific composers, no vocals',
    'suitable for a 60-90 second loop under a slow pan across a classical artwork',
    'gentle fade-in, gentle fade-out, room tone in the background',
  ].join('. ');

  return {
    intentZh: [
      `音乐方向：${directionZh}`,
      `作品：${title}`,
      artist ? `艺术家：${artist}` : '',
      date ? `年代：${date}` : '',
      medium ? `媒介：${medium}` : '',
      `核心思路：60-90 秒室内乐氛围 / 暖色古典启发式纯器乐；不模仿具体作曲家；适合博物馆慢推视频背景`,
    ].filter(Boolean).join('。'),
    factsUsed,
    attributes,
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', imitation of specific living composers, recognizable classical motifs, hip-hop, EDM, anime OST',
    params: { ...DEFAULT_PARAMS, priority: 'medium' },
    uncertaintyNotes: [
      artist ? '' : 'artist missing',
    ].filter(Boolean),
    rationale: 'culture-art → 博物馆氛围 / 室内乐质感，强调「暖色古典 + 不模仿具体作曲家 + 留白」',
    recommendedUse: RECOMMENDED_USE_MAP['culture-art'],
  };
}

// ---------- context (date / weather) ----------

function contextMusicStrategy(ctx: PackCtx): MusicResult {
  const date = ctx.date || '';
  const month = date.slice(5, 7);
  const day = date.slice(8, 10);
  const monthHint = monthToHint(month);

  const directionZh = 'weather mood / 季节 lo-fi';

  const factsUsed: string[] = [];
  if (date) factsUsed.push(`date: ${date}`);
  if (month) factsUsed.push(`season: ${monthHint}`);

  const attributes: MusicAttributes = {
    mood: 'peaceful, ambient, time-of-day aware',
    genre: 'seasonal lo-fi / ambient',
    tempo: '60-75 BPM, breathing pace',
    instrumentation: 'soft piano, light synth pads, gentle vinyl crackle, brushed hi-hats',
    texture: 'warm, paper-textured, mid-range soft',
    energy: 'very low, ambient',
    loopability: 'long-form ambient loop, gentle drift',
  };

  const englishPrompt = [
    'An instrumental seasonal lo-fi ambient track',
    `${attributes.genre}, ${attributes.tempo}`,
    `mood: ${attributes.mood}`,
    `season hint: ${monthHint}`,
    `instrumentation: ${attributes.instrumentation}`,
    `texture: ${attributes.texture}`,
    `energy: ${attributes.energy}`,
    'style references: cozy morning lo-fi, seasonal ambient, no vocals',
    'suitable for a 60-90 second loop under a daily mood or weather clip',
  ].join('. ');

  return {
    intentZh: [
      `音乐方向：${directionZh}`,
      `日期：${date || '未指定'}`,
      `季节提示：${monthHint}`,
      `核心思路：60-90 秒季节感 lo-fi，节奏慢、留白多；适合日常氛围短视频`,
    ].filter(Boolean).join('。'),
    factsUsed,
    attributes,
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', holiday jingle, festive bells, party energy',
    params: { ...DEFAULT_PARAMS, priority: 'low' },
    uncertaintyNotes: [
      date ? '' : 'date missing — defaulting to neutral ambient',
    ].filter(Boolean),
    rationale: 'context → 季节 lo-fi / 时间氛围，强调「安静 + 可循环 + 季节感」',
    recommendedUse: RECOMMENDED_USE_MAP['context'],
  };
}

function monthToHint(m: string): string {
  const map: Record<string, string> = {
    '01': 'January, winter, cool blue', '02': 'February, late winter',
    '03': 'March, early spring', '04': 'April, spring bloom',
    '05': 'May, fresh green', '06': 'June, early summer, warm',
    '07': 'July, midsummer', '08': 'August, late summer',
    '09': 'September, early autumn', '10': 'October, autumn foliage',
    '11': 'November, late autumn', '12': 'December, winter',
  };
  return map[m] || 'seasonal mood';
}

// ---------- main per-pack processing ----------

function processPack(packDir: string): { ok: boolean; meta?: any; reason?: string } {
  const detail = safeReadJson<any>(join(ASSETS, packDir, 'detail.json'), {});
  const manifest = safeReadJson<any>(join(ASSETS, packDir, 'manifest.json'), {});
  const sourceFacts = safeReadJson<any>(join(ASSETS, packDir, 'sources-facts.json'), {});
  const factsEnriched = safeReadText(join(ASSETS, packDir, 'facts.enriched.md'), '');
  const factsMd = safeReadText(join(ASSETS, packDir, 'facts.md'), '');
  const brief = safeReadText(join(ASSETS, packDir, 'brief.md'), '');
  const imagePromptEnriched = safeReadText(join(ASSETS, packDir, 'image-prompt.enriched.md'), '');
  const videoPromptEnriched = safeReadText(join(ASSETS, packDir, 'video-prompt.enriched.md'), '');
  const existingMusicPrompt = safeReadText(join(ASSETS, packDir, 'music-prompt.md'), '');

  if (!detail || Object.keys(detail).length === 0) {
    return { ok: false, reason: 'missing detail.json' };
  }

  const sourceType = (detail.source_type || manifest.source_types?.[0] || 'unknown').toString();
  const strategy = STRATEGIES[sourceType] || STRATEGIES['context'];

  const ctx: PackCtx = {
    packDir,
    packId: manifest.id || detail.id || packDir.split('/').pop() || 'unknown',
    title: detail.title || manifest.title || packDir,
    sourceType,
    sourceLabelZh: detail.source_label_zh || sourceType,
    oneSentence: detail.one_sentence_summary || '',
    background: detail.background || '',
    whyItMatters: detail.why_it_matters || '',
    tags: detail.tags || manifest.tags || [],
    brief,
    facts: factsMd,
    factsEnriched,
    sourceFacts,
    detail,
    manifest,
    imagePromptEnriched,
    videoPromptEnriched,
    existingMusicPrompt,
    date: detail.date || manifest.created_at?.slice(0, 10) || '',
  };

  const result = strategy(ctx);

  // ---------- file: music-prompt.enriched.md ----------
  const enrichedMd = [
    `# 增强音乐 Prompt · ${ctx.title}`,
    ``,
    `> 来源类型：**${ctx.sourceLabelZh}** (${sourceType})`,
    `> 策略：${result.rationale}`,
    `> 音乐方向：${result.intentZh.split('。')[0] || ''}`,
    `> 生成时间：${nowIso()}`,
    ``,
    `## 中文创作意图 (Chinese Intent)`,
    ``,
    normalize(result.intentZh),
    ``,
    `## 事实依据`,
    ``,
    result.factsUsed.length ? result.factsUsed.map(t => `- ${t}`).join('\n') : '- (无可用事实)',
    ``,
    `## 音乐方向`,
    ``,
    `- **mood**: ${result.attributes.mood}`,
    `- **genre**: ${result.attributes.genre}`,
    `- **tempo**: ${result.attributes.tempo}`,
    `- **instrumentation**: ${result.attributes.instrumentation}`,
    `- **texture**: ${result.attributes.texture}`,
    `- **energy**: ${result.attributes.energy}`,
    `- **loopability**: ${result.attributes.loopability}`,
    ``,
    `## MiniMax Music Prompt`,
    ``,
    '```text',
    result.englishPrompt,
    '```',
    ``,
    `## Negative / Avoid`,
    ``,
    '```text',
    result.negativePrompt,
    '```',
    ``,
    `## 推荐参数`,
    ``,
    `- **model_family**: ${result.params.modelFamily}`,
    `- **duration**: ${result.params.duration}`,
    `- **instrumental**: ${result.params.instrumental}`,
    `- **lyrics**: ${result.params.lyrics}`,
    `- **priority**: ${result.params.priority}`,
    `- **generation_mode**: ${result.params.generationMode}`,
    ``,
    `## 不确定性说明`,
    ``,
    result.uncertaintyNotes.length ? result.uncertaintyNotes.map(t => `- ${t}`).join('\n') : '- 全部事实已使用，无明显不确定项',
    ``,
    `---`,
    `Generated by scripts/enhance-music-prompts.ts (Phase 4I). No LLM. No music model. No new media.`,
  ].join('\n');

  writeFileSync(join(ASSETS, packDir, 'music-prompt.enriched.md'), enrichedMd);

  // ---------- file: music-prompt.zh.md ----------
  const bullets = [
    `**这段音乐想表现什么？** ${result.intentZh.split('。')[0] || '主题氛围音乐'}`,
    `**基于哪些事实？** ${result.factsUsed.slice(0, 3).join('；') || '基于现有素材'}`,
    `**适合什么用途？** ${result.recommendedUse.map(u => USE_LABELS[u] || u).join('、')}`,
    `**推荐节奏 / 乐器 / 情绪**：${result.attributes.tempo} · ${result.attributes.instrumentation} · ${result.attributes.mood}`,
    `**是否适合后续真实生成？** 是，但当前为 prompt-only，未调用音乐模型；推荐参数：${result.params.duration} · ${result.params.modelFamily} · instrumental=${result.params.instrumental}`,
  ];

  const zhMd = [
    `# 音乐 Prompt 解释 · ${ctx.title}`,
    ``,
    bullets.map(b => `- ${b}`).join('\n'),
    ``,
    `## 完整创作意图`,
    ``,
    normalize(result.intentZh),
    ``,
    `## 音乐属性`,
    ``,
    `- **mood**: ${result.attributes.mood}`,
    `- **genre**: ${result.attributes.genre}`,
    `- **tempo**: ${result.attributes.tempo}`,
    `- **instrumentation**: ${result.attributes.instrumentation}`,
    `- **texture**: ${result.attributes.texture}`,
    `- **energy**: ${result.attributes.energy}`,
    `- **loopability**: ${result.attributes.loopability}`,
    ``,
    `## 适合的使用场景`,
    ``,
    result.recommendedUse.map(u => `- ${USE_LABELS[u] || u}`).join('\n'),
    ``,
    `## 与现有素材的关系`,
    ``,
    `- 原始 music-prompt.md：保留为兑底短语，不被覆盖`,
    `- video-prompt.enriched.md：音乐可作为视频背景音，节奏与镜头长度匹配（默认 60-90s vs 8s 视频，可以拼接循环）`,
    `- image-prompt.enriched.md：图片与音乐气质可同源（同一 source_type 策略）`,
    ``,
    `---`,
    `本文件是 music-prompt.enriched.md 的人类可读解释版。`,
  ].join('\n');

  writeFileSync(join(ASSETS, packDir, 'music-prompt.zh.md'), zhMd);

  // ---------- file: music-prompt.meta.json ----------
  const meta = {
    // Spec-required top-level fields
    title: ctx.title,
    source_type: sourceType,
    source_label_zh: ctx.sourceLabelZh,
    prompt_strategy: result.rationale,
    model_family: result.params.modelFamily,
    duration: result.params.duration,
    instrumental: result.params.instrumental,
    lyrics: result.params.lyrics,
    priority: result.params.priority,
    recommended_use: result.recommendedUse,
    facts_used: result.factsUsed,
    original_prompt_path: 'music-prompt.md',
    enriched_prompt_path: 'music-prompt.enriched.md',
    zh_prompt_path: 'music-prompt.zh.md',
    generation_mode: result.params.generationMode,
    uncertainty_notes: result.uncertaintyNotes,
    // Additional metadata
    pack_id: ctx.packId,
    pack_dir: packDir,
    direction: result.intentZh.split('。')[0] || '',
    attributes: result.attributes,
    english_prompt: result.englishPrompt,
    negative_prompt: result.negativePrompt,
    intent_zh: result.intentZh,
    parameters: result.params,
    generated_at: nowIso(),
    generator: 'enhance-music-prompts.ts@phase4i',
    llm_used: false,
    music_model_called: false,
    image_model_called: false,
    video_model_called: false,
    audio_generated: false,
    new_media_generated: false,
    files: {
      enriched_md: 'music-prompt.enriched.md',
      zh_md: 'music-prompt.zh.md',
    },
  };

  writeFileSync(
    join(ASSETS, packDir, 'music-prompt.meta.json'),
    JSON.stringify(meta, null, 2) + '\n'
  );

  return { ok: true, meta };
}

const USE_LABELS: Record<string, string> = {
  'background-music': '背景音乐',
  'short-video': '短视频',
  'project-intro': '项目介绍',
  'coding-session': '编程背景',
  'paper-explainer': '论文讲解',
  'podcast-intro': '播客开场',
  'conference-talk': '会议演讲',
  'model-demo': '模型演示',
  'product-card': '产品卡片',
  'discussion-clip': '讨论片段',
  'x-post': 'X 帖',
  'museum-clip': '博物馆片段',
  'gallery-loop': '画廊循环',
  'mood-clip': '氛围短视频',
  'morning-ambience': '早晨氛围',
  'social': '社媒',
};

// ---------- entry ----------

function main() {
  const idx = safeReadJson<{ content_packs: { pack_dir: string }[] }>(
    join(ASSETS, 'metadata', 'content-pack-index.json'),
    { content_packs: [] }
  );

  let ok = 0;
  let fail = 0;
  const failures: { pack_dir: string; reason: string }[] = [];
  const byStrategy: Record<string, number> = {};

  for (const pack of idx.content_packs) {
    const result = processPack(pack.pack_dir);
    if (result.ok) {
      ok++;
      const st = result.meta.source_type;
      byStrategy[st] = (byStrategy[st] || 0) + 1;
    } else {
      fail++;
      failures.push({ pack_dir: pack.pack_dir, reason: result.reason || 'unknown' });
    }
  }

  console.log(`[enhance-music-prompts] OK=${ok} FAIL=${fail}`);
  console.log(`[enhance-music-prompts] by strategy:`, byStrategy);
  if (failures.length) {
    console.log(`[enhance-music-prompts] failures:`);
    for (const f of failures) console.log(`  - ${f.pack_dir} :: ${f.reason}`);
  }
}

main();
