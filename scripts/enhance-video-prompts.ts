#!/usr/bin/env tsx
/**
 * scripts/enhance-video-prompts.ts
 *
 * Phase 4H: Source-aware Video Prompt Enhancement.
 *
 * Reads existing per-pack data (video-prompt.md, facts.enriched.md,
 * sources-facts.json, detail.json, brief.md, image-prompt.enriched.md,
 * image-prompt.meta.json, manifest.json, generated-image-descriptions.json
 * if present) and produces three new artifacts per pack, choosing shot
 * design strategy by source_type:
 *
 *   - video-prompt.enriched.md   (Chinese intent + shot design + EN prompt + negative + params)
 *   - video-prompt.zh.md         (human-readable Chinese explanation)
 *   - video-prompt.meta.json     (machine-readable metadata)
 *
 * NO LLM calls, NO external API calls, NO video model calls, NO image model
 * calls, NO music generation, NO new media. All generation is deterministic,
 * rule-based, and operates only on existing local data. Idempotent: can be
 * re-run safely (overwrites only the three new files).
 *
 * Default video targets:
 *   - duration: 6s or 8s (clamped to 8s — short clips)
 *   - aspect_ratio: 16:9
 *   - model_family: hailuo (MiniMax video family) — prompt-only, no real gen
 *   - generation_mode: prompt-only
 *   - no logos, no tiny text, no copyrighted characters, no distorted hands
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

function firstNonEmpty(...vals: any[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
}

// ---------- shared types ----------

interface Shot {
  id: number;
  duration_s: number;
  description: string;        // English shot description
  camera: string;             // e.g. "slow push-in", "static wide", "pan L→R"
  motion: string;             // e.g. "subtle drift", "soft particles", "no movement"
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
  imagePromptMeta: any;
  existingVideoPrompt: string;
  generatedImageDescriptions: any; // generated-image-descriptions.json if any
  date: string;
}

interface VideoResult {
  intentZh: string;          // Chinese intent paragraph
  factsUsed: string[];       // Public facts cited
  shots: Shot[];             // 3 shots for 6-8s total
  styleDescription: string;  // Color, composition, motion, pacing
  englishPrompt: string;     // Final English prompt (multi-shot)
  negativePrompt: string;    // Negative prompt (richer than image)
  params: {
    modelFamily: string;
    duration: number;
    aspectRatio: string;
    priority: 'high' | 'medium' | 'low';
    generationMode: string;
  };
  uncertaintyNotes: string[];
  rationale: string;         // Why this shot strategy fits
}

// Base negative prompt — strong no-go list for video models
const BASE_NEGATIVE = [
  'fake company logos',
  'real product branding',
  'tiny on-screen text',
  'unreadable UI overlays',
  'copyrighted characters',
  'real person likeness',
  'distorted hands',
  'extra fingers',
  'rapid shaky camera',
  'rapid cuts',
  'low resolution',
  'motion blur on text',
  'jittery frame interpolation',
  'watermark',
  'signature',
].join(', ');

const DEFAULT_PARAMS = {
  modelFamily: 'hailuo',
  duration: 8,
  aspectRatio: '16:9',
  priority: 'medium' as const,
  generationMode: 'prompt-only',
};

const STRATEGIES: Record<string, (ctx: PackCtx) => VideoResult> = {
  code: codeVideoStrategy,
  academic: academicVideoStrategy,
  'ai-ecosystem': aiEcosystemVideoStrategy,
  'dev-community': devCommunityVideoStrategy,
  'culture-art': cultureArtVideoStrategy,
  context: contextVideoStrategy,
};

// ---------- code (GitHub repo) ----------

function codeVideoStrategy(ctx: PackCtx): VideoResult {
  const facts = ctx.sourceFacts?.facts || {};
  const stars = facts.stars;
  const forks = facts.forks;
  const lang = facts.language;
  const topics: string[] = facts.topics || [];
  const description = facts.description || ctx.oneSentence;
  const readme = facts.readme_content || '';

  // Pick video direction based on topics
  const hasAgent = /agent|mcp|claude|automation|skill/i.test(topics.join(' ') + ' ' + description);
  const hasGenMedia = /text-to-image|text-to-video|ai-art|ai-music|ai-video|generative-ai|flux|midjourney|muapi|suno|kling|veo/i.test(topics.join(' ') + ' ' + description);
  const hasRag = /rag|knowledge|vector|embedding/i.test(topics.join(' ') + ' ' + description);
  const hasLLM = /llm|chat|openai|claude|gpt/i.test(topics.join(' ') + ' ' + description);

  let directionZh = 'AI 工具工作流短视频';
  if (hasAgent) directionZh = 'Agent pipeline 节点动画';
  else if (hasGenMedia) directionZh = 'open-source project launch clip';
  else if (hasRag) directionZh = 'data cards / 节点 / 任务流';
  else if (hasLLM) directionZh = '数据流 / 提示词流动画';

  const factsUsed: string[] = [];
  if (stars) factsUsed.push(`${stars.toLocaleString()} stars (GitHub)`);
  if (forks) factsUsed.push(`${forks.toLocaleString()} forks`);
  if (lang) factsUsed.push(`primary language: ${lang}`);
  if (topics.length) factsUsed.push(`topics: ${topics.slice(0, 4).join(', ')}`);
  if (description) factsUsed.push(`description: ${trim(description, 100)}`);
  if (facts.license) factsUsed.push(`license: ${facts.license}`);

  const shots: Shot[] = [];

  if (hasAgent) {
    // Agent pipeline: nodes animating in sequence
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a clean dark navy workspace, a single node labeled with the project name lights up in the center',
      camera: 'static medium',
      motion: 'subtle glow on the node, no camera movement',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'thin lines connect the central node to 4-5 smaller capability icons orbiting around it (chat, image, video, audio, code)',
      camera: 'slow push-in',
      motion: 'connection lines draw in sequence, icons float gently',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'a final cluster of stars and forks counter tiles in monospaced font appears, all icons settle into a calm orbit',
      camera: 'slow pull-back to wide',
      motion: 'soft particle drift, tiles fade in',
    });
  } else if (hasGenMedia) {
    // Open-source project launch clip
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'abstract glowing concept orbs (image, video, audio, code) drift into frame on a deep slate background',
      camera: 'static wide',
      motion: 'orbs float in from off-screen, slow drift',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'orbs converge toward the center, the project name appears in clean monospaced type',
      camera: 'slow push-in',
      motion: 'orbs converge smoothly, type fades in',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'a horizontal strip of capability icons (image, video, audio) slides in at the bottom edge',
      camera: 'static medium',
      motion: 'icon strip slides up, no camera movement',
    });
  } else if (hasRag) {
    // Data cards / nodes / task automation flow
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a single document card floats in the lower-left, glows softly',
      camera: 'static medium',
      motion: 'soft document pulse glow',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'thin arrow flows from the document to a vector node, then branches to three retrieval results',
      camera: 'slow pan L→R',
      motion: 'arrows draw in sequence, results fade in',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'a small chat bubble with a context-aware reply appears at the right, gentle closing composition',
      camera: 'static',
      motion: 'bubble fades in, calm end frame',
    });
  } else {
    // Generic code workflow
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a glowing terminal window opens on a dark indigo background, a blinking cursor waits',
      camera: 'static medium',
      motion: 'terminal fade in, cursor blink',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'inside the terminal, code scrolls smoothly while a parallel pipeline diagram on the right lights up node by node',
      camera: 'slow push-in',
      motion: 'code scrolls, nodes light in sequence',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'a small monospaced tile with the star and fork counters appears at the bottom-right corner',
      camera: 'static',
      motion: 'tile fades in, no camera movement',
    });
  }

  const englishPrompt = shots.map((s, i) =>
    `Shot ${i + 1} (${s.duration_s}s): ${s.description} Camera: ${s.camera}. Motion: ${s.motion}.`
  ).join(' ');

  return {
    intentZh: [
      `视频方向：${directionZh}`,
      `项目：${ctx.title}`,
      description ? `项目定位：${trim(description, 120)}` : '',
      `核心思路：8 秒 3 镜头 — 节点出现 → 连线/流式动画 → 指标瓦片收尾，全程使用镜头语言（不画人物、不出现 logo）`,
    ].filter(Boolean).join('。'),
    factsUsed,
    shots,
    styleDescription: '深色靛蓝 / 板岩灰背景；琥珀色或青蓝色高光；细线条、低对比度；镜头推进与拉远节奏舒缓；末端稳定收束，无快速剪辑。',
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', photorealistic human, fake CLI names, fake project splash screen',
    params: { ...DEFAULT_PARAMS, priority: 'high' },
    uncertaintyNotes: [
      facts.stars ? '' : 'star count missing from source facts',
      description ? '' : 'description missing — intent is based on title only',
    ].filter(Boolean),
    rationale: 'code → Agent 节点动画 / launch clip / data flow，强调「节点、连线、指标瓦片」镜头语言',
  };
}

// ---------- academic (arXiv paper) ----------

function academicVideoStrategy(ctx: PackCtx): VideoResult {
  const facts = ctx.sourceFacts?.facts || {};
  const title = facts.title || ctx.title;
  const authors = facts.authors;
  const date = facts.date || facts.published;
  const summary = facts.summary || ctx.oneSentence;
  const primaryCat = facts.primary_category || '';
  const categories: string[] = facts.categories || [];

  const factsUsed: string[] = [];
  factsUsed.push(`title: ${title}`);
  if (authors) factsUsed.push(`authors: ${trim(authors, 80)}`);
  if (date) factsUsed.push(`date: ${date}`);
  if (primaryCat) factsUsed.push(`primary_category: ${primaryCat}`);
  if (summary) factsUsed.push(`summary: ${trim(summary, 120)}`);

  // Pick direction based on title/summary keywords
  const isLlm = /llm|automation|benchmark/i.test(title + ' ' + summary);
  const isAgent = /agent|tool|reasoning/i.test(title + ' ' + summary);
  const isVision = /vision|video|multimodal|diffusion/i.test(title + ' ' + summary);
  const isTheory = /theorem|proof|complexity|bound/i.test(title + ' ' + summary);

  const directionZh = isLlm ? '论文概念动画 / 基准曲线'
    : isAgent ? '研究问题视觉隐喻'
    : isVision ? 'abstract idea motion graphic'
    : isTheory ? 'concept network animation'
    : '论文概念动画';

  const shots: Shot[] = [];

  if (isLlm) {
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a curve climbs on a dark grid, with two reference lines (human baseline, prior SOTA) marked in muted blue',
      camera: 'static medium',
      motion: 'curve draws smoothly from left to right',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'a small bar chart of category scores appears below the curve, with the leading bar in warm gold',
      camera: 'slow push-in',
      motion: 'bars rise in sequence',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'a small elegant serif title appears at the top, with a tiny arXiv-style id badge',
      camera: 'static',
      motion: 'title fades in, badge slides in',
    });
  } else if (isAgent) {
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a single paper card icon floats in from the left, expanding to show three reasoning steps connected by arrows',
      camera: 'slow pan L→R',
      motion: 'card enters, arrows draw in sequence',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'each step pulses softly, a thin glow travels along the arrow path indicating flow direction',
      camera: 'static',
      motion: 'pulse and glow travel along path',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'a small output bubble appears at the right, holding a final answer hint (text glyph, not real text)',
      camera: 'static',
      motion: 'bubble fades in, calm end',
    });
  } else if (isVision) {
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'an abstract grid of small image cells starts to blur and morph, suggesting latent space',
      camera: 'static wide',
      motion: 'cells morph smoothly',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'a sample image at the center emerges from the grid, sharpened',
      camera: 'slow push-in',
      motion: 'center image sharpens, periphery softens',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'three small capability tiles (text, image, video) appear around the central image',
      camera: 'static',
      motion: 'tiles fade in',
    });
  } else {
    // Theory / generic
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a clean serif paper title at the top, a small abstract dot pattern below, on ivory background',
      camera: 'static medium',
      motion: 'title fades in, dots emerge',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'dots connect into a network graph with thin gold lines, three central nodes highlighted',
      camera: 'slow push-in',
      motion: 'edges draw, central nodes glow',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'a tiny badge with the primary category appears at the bottom-left',
      camera: 'static',
      motion: 'badge fades in',
    });
  }

  const englishPrompt = shots.map((s, i) =>
    `Shot ${i + 1} (${s.duration_s}s): ${s.description} Camera: ${s.camera}. Motion: ${s.motion}.`
  ).join(' ');

  return {
    intentZh: [
      `视频方向：${directionZh}`,
      `论文：${title}`,
      authors ? `作者：${trim(authors, 80)}` : '',
      date ? `发表时间：${date}` : '',
      `核心思路：8 秒 3 镜头 — 概念图/数据曲线 → 推导/连线 → 论文气质收尾，不画人脸，不出现虚假论文页截图`,
    ].filter(Boolean).join('。'),
    factsUsed,
    shots,
    styleDescription: '深蓝 + 米白 + 金色点缀；衬线标题 + 无衬线小字；arXiv 学术海报气质；节奏舒缓；末端稳定收束。',
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', fake equations, fake arXiv watermark, fake author photo',
    params: { ...DEFAULT_PARAMS, priority: 'medium' },
    uncertaintyNotes: [
      authors ? '' : 'authors missing',
      date ? '' : 'date missing',
    ].filter(Boolean),
    rationale: 'academic → 论文概念动画 / 视觉隐喻 / 概念网络，强调「研究方法 + 关键数据 + 论文气质」',
  };
}

// ---------- ai-ecosystem (HF model/dataset) ----------

function aiEcosystemVideoStrategy(ctx: PackCtx): VideoResult {
  const facts = ctx.sourceFacts?.facts || {};
  const enriched: string[] = ctx.detail?.enriched_facts || [];
  const downloads = enriched.find(f => /下载量/.test(f));
  const likes = enriched.find(f => /点赞数/.test(f));
  const lib = enriched.find(f => /库/.test(f));
  const task = enriched.find(f => /任务类型/.test(f));

  const factsUsed: string[] = [];
  factsUsed.push(`model: ${ctx.title}`);
  if (task) factsUsed.push(`task: ${task}`);
  if (lib) factsUsed.push(`library: ${lib}`);
  if (downloads) factsUsed.push(downloads);
  if (likes) factsUsed.push(likes);
  if (facts.pipeline_tag) factsUsed.push(`pipeline_tag: ${facts.pipeline_tag}`);

  const isVideoTask = /image-to-video|text-to-video|img2vid|video/i.test(task || '');
  const isImageTask = /text-to-image|image-generation|diffusion|stable/i.test(task || '');
  const isAudioTask = /text-to-audio|music|asr|tts|speech/i.test(task || '');
  const isTextTask = /text-generation|llm|chat|completion/i.test(task || '');

  const directionZh = isVideoTask ? 'model pipeline flow (input image → motion → video)'
    : isImageTask ? 'model card cinematic visual'
    : isAudioTask ? 'AI model capability demo abstraction (waveform)'
    : isTextTask ? 'token stream + attention map animation'
    : 'model pipeline flow';

  const shots: Shot[] = [];

  if (isVideoTask) {
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a single still image card floats in the lower-left, glowing softly, on dark slate background',
      camera: 'static medium',
      motion: 'image pulses gently',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'frame-by-frame strip emerges to the right, each frame 1/4 step further along the motion timeline, subtle blur indicating motion',
      camera: 'slow pan L→R',
      motion: 'frames appear in sequence, motion arrows between them',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'final frame holds, a monospaced metric tile (downloads/likes) fades in below',
      camera: 'static',
      motion: 'final frame stabilizes, tile fades in',
    });
  } else if (isImageTask) {
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a noise grid on the left, slowly resolving into a sharp image on the right',
      camera: 'static wide',
      motion: 'noise → image morph, smooth',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'the resolved image gains subtle depth as a soft cinematic glow blooms behind it',
      camera: 'slow push-in',
      motion: 'glow blooms, image gains depth',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'two small metric tiles (downloads, likes) slide in at the bottom-right',
      camera: 'static',
      motion: 'tiles slide in',
    });
  } else if (isAudioTask) {
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a flat horizontal line morphs into a flowing waveform on dark background',
      camera: 'static wide',
      motion: 'waveform emerges, amplitude pulses',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'the waveform transitions into a small spectrogram waterfall (frequency over time)',
      camera: 'slow push-in',
      motion: 'spectrogram rows reveal sequentially',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'metric tiles slide in at the bottom-right, waveform eases to silence',
      camera: 'static',
      motion: 'tiles slide in, amplitude decays',
    });
  } else if (isTextTask) {
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a single input prompt text-block (no real readable text) sits in the upper-left, prompt arrow points to a model block',
      camera: 'static medium',
      motion: 'arrow draws, model block lights up',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'inside the model block, a stream of small token chips flow rightward with soft glow on each, suggesting generation',
      camera: 'slow pan L→R',
      motion: 'tokens flow, glow pulses',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'output token stream settles, metric tiles fade in below',
      camera: 'static',
      motion: 'tokens stop, tiles fade in',
    });
  } else {
    // Generic model card
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a clean dark model card with the model name as a hero title, a subtle input icon on the left',
      camera: 'static medium',
      motion: 'card fade in, icon glow',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'an arrow flows from input icon through a layered model block to an output icon on the right',
      camera: 'slow push-in',
      motion: 'arrow flows, layers subtly highlight',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'metric tiles (downloads, likes) appear at bottom, calm end frame',
      camera: 'static',
      motion: 'tiles fade in',
    });
  }

  const englishPrompt = shots.map((s, i) =>
    `Shot ${i + 1} (${s.duration_s}s): ${s.description} Camera: ${s.camera}. Motion: ${s.motion}.`
  ).join(' ');

  return {
    intentZh: [
      `视频方向：${directionZh}`,
      `模型：${ctx.title}`,
      task ? `任务类型：${task}` : '',
      lib ? `底层库：${lib}` : '',
      downloads ? `下载量：${downloads}` : '',
      likes ? `点赞数：${likes}` : '',
      `核心思路：8 秒 3 镜头 — 输入 → 模型处理 → 输出；末尾显示关键指标瓦片`,
    ].filter(Boolean).join('。'),
    factsUsed,
    shots,
    styleDescription: '深色板岩背景；琥珀 → 紫红渐变高光；monospaced 指标瓦片；HF 风格；节奏舒缓，无快速剪辑。',
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', anime, 3d plastic render, fake HF card, fake company logo',
    params: { ...DEFAULT_PARAMS, priority: 'high' },
    uncertaintyNotes: [
      task ? '' : 'task type missing from enriched_facts',
      downloads ? '' : 'downloads missing',
    ].filter(Boolean),
    rationale: 'ai-ecosystem → pipeline flow / model card cinematic，强调「输入 → 模型 → 输出」镜头叙事',
  };
}

// ---------- dev-community ----------

function devCommunityVideoStrategy(ctx: PackCtx): VideoResult {
  const facts = ctx.sourceFacts?.facts || {};
  const title = facts.title || ctx.title;
  const description = facts.description || ctx.oneSentence;
  const text = facts.text || '';

  const factsUsed: string[] = [];
  factsUsed.push(`title: ${title}`);
  if (description) factsUsed.push(`description: ${trim(description, 100)}`);
  if (text) factsUsed.push(`text excerpt: ${trim(text, 80)}`);

  const directionZh = /automation|flaw|narrative|critique|pain/i.test(title + ' ' + description)
    ? 'developer pain point short clip'
    : 'discussion map / forum energy visual';

  const shots: Shot[] = [];

  if (/automation|flaw|narrative|critique|pain/i.test(title + ' ' + description)) {
    // Pain point clip
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a single line of code (no real text, just shape) sits still on a dim editor background, cursor blinks slowly',
      camera: 'static medium',
      motion: 'cursor blink, soft editor glow',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'multiple parallel editor windows open up around the central line, suggesting context switching and overload',
      camera: 'slow push-in',
      motion: 'windows pop up in sequence',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'all windows blur slightly as a calm dark background reasserts, leaving a single isolated cursor',
      camera: 'slow pull-back',
      motion: 'windows blur out, calm end',
    });
  } else {
    // Discussion / forum energy
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'three discussion bubbles float in a soft cluster, edges glowing, on a dark dev-poster background',
      camera: 'static wide',
      motion: 'bubbles pulse gently',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'a connecting line draws between the three bubbles, indicating community thread structure',
      camera: 'slow push-in',
      motion: 'line draws in sequence',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'a small upvote counter chip appears, calm end frame',
      camera: 'static',
      motion: 'chip fades in',
    });
  }

  const englishPrompt = shots.map((s, i) =>
    `Shot ${i + 1} (${s.duration_s}s): ${s.description} Camera: ${s.camera}. Motion: ${s.motion}.`
  ).join(' ');

  return {
    intentZh: [
      `视频方向：${directionZh}`,
      `话题：${title}`,
      description ? `简介：${trim(description, 100)}` : '',
      `核心思路：8 秒 3 镜头 — 工作场景/讨论场景 → 上下文压力/连接动画 → 收尾`,
    ].filter(Boolean).join('。'),
    factsUsed,
    shots,
    styleDescription: '粉紫 + 板岩灰配色；圆角无衬线小字；柔和阴影；节奏舒缓；末端稳定收束。',
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', photographic portrait, anime, neon, fake upvote animation',
    params: { ...DEFAULT_PARAMS, priority: 'medium' },
    uncertaintyNotes: [
      description ? '' : 'description missing — intent based on title only',
    ].filter(Boolean),
    rationale: 'dev-community → 痛点短视频 / 讨论地图，强调「开发者场景 + 上下文压力」',
  };
}

// ---------- culture-art (Met museum) ----------

function cultureArtVideoStrategy(ctx: PackCtx): VideoResult {
  const facts = ctx.sourceFacts?.facts || {};
  const title = facts.title || ctx.title;
  const artist = facts.artist;
  const date = facts.date;
  const medium = facts.medium;
  const department = facts.department;
  const culture = facts.culture;

  const factsUsed: string[] = [];
  factsUsed.push(`title: ${title}`);
  if (artist) factsUsed.push(`artist: ${artist}`);
  if (date) factsUsed.push(`date: ${date}`);
  if (medium) factsUsed.push(`medium: ${medium}`);
  if (department) factsUsed.push(`department: ${department}`);
  if (culture) factsUsed.push(`culture: ${culture}`);

  const directionZh = /landscape|panorama/i.test(title + ' ' + (facts.classification || ''))
    ? 'slow pan over symbolic landscape composition'
    : /saint|virgin|religious|devotion|angel/i.test(title)
      ? 'contemplative figure slow pan'
      : 'museum lighting cinematic shot';

  const shots: Shot[] = [];

  // Determine compositional flavor
  const isLandscape = /landscape|panorama|river|mountain|valley/i.test(title + ' ' + (facts.classification || ''));
  const isReligious = /saint|virgin|christ|madonna|angel|religious|devotion|jerome/i.test(title);

  if (isLandscape) {
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a slow horizontal pan across an atmospheric landscape: distant mountains, a soft river, golden hour light',
      camera: 'slow pan L→R',
      motion: 'pan only, no camera shake',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'mid-ground detail emerges: tiny figures, a winding path, gentle depth-of-field shift',
      camera: 'slow push-in',
      motion: 'depth shift, atmospheric haze',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'a final calm wide shot of the full landscape, warm light from the upper-left',
      camera: 'static wide',
      motion: 'calm end frame',
    });
  } else if (isReligious) {
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a single contemplative figure in a wilderness scene, soft warm key light from the upper-left',
      camera: 'static medium',
      motion: 'figure barely moves, atmospheric dust drift',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'slow push-in on the figure, background darkens slightly, the figure remains still',
      camera: 'slow push-in',
      motion: 'background darkens, figure centered',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'final close composition with strong chiaroscuro, calm end',
      camera: 'static',
      motion: 'calm end frame',
    });
  } else {
    // Generic museum lighting shot
    shots.push({
      id: 1,
      duration_s: 3,
      description: 'a museum spotlight slowly brightens on a single artwork on a dark oak wall',
      camera: 'static medium',
      motion: 'spotlight intensity ramps up smoothly',
    });
    shots.push({
      id: 2,
      duration_s: 3,
      description: 'a slow push-in toward the artwork, surface texture (oil brushstrokes) becomes visible',
      camera: 'slow push-in',
      motion: 'texture emerges',
    });
    shots.push({
      id: 3,
      duration_s: 2,
      description: 'final frame holds, a soft museum placard at the bottom (no readable text)',
      camera: 'static',
      motion: 'placard fades in',
    });
  }

  const englishPrompt = shots.map((s, i) =>
    `Shot ${i + 1} (${s.duration_s}s): ${s.description} Camera: ${s.camera}. Motion: ${s.motion}.`
  ).join(' ');

  return {
    intentZh: [
      `视频方向：${directionZh}`,
      `作品：${title}`,
      artist ? `艺术家：${artist}` : '',
      date ? `年代：${date}` : '',
      medium ? `媒介：${medium}` : '',
      department ? `部门：${department}` : '',
      culture ? `文化背景：${culture}` : '',
      `核心思路：8 秒 3 镜头 — 博物馆聚光 → 慢推到细节 → 收尾；保留油画质感，不出现人物面孔特写`,
    ].filter(Boolean).join('。'),
    factsUsed,
    shots,
    styleDescription: '博物馆聚光；暖色调；油画笔触质感；缓慢推进；末端稳定收束。',
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', anime, pop art, neon, fake museum text, modern logos',
    params: { ...DEFAULT_PARAMS, duration: 8, priority: 'medium' },
    uncertaintyNotes: [
      artist ? '' : 'artist missing',
      date ? '' : 'date missing',
    ].filter(Boolean),
    rationale: 'culture-art → 博物馆灯光 / 古典重绎 / 慢推，强调「原作气质的电影感」',
  };
}

// ---------- context (date / weather) ----------

function contextVideoStrategy(ctx: PackCtx): VideoResult {
  const date = ctx.date || '';
  const month = date.slice(5, 7);
  const day = date.slice(8, 10);
  const monthHint = monthToHint(month);

  const factsUsed: string[] = [];
  if (date) factsUsed.push(`date: ${date}`);
  if (month) factsUsed.push(`season: ${monthHint}`);

  const directionZh = 'daily mood clip / 时间氛围';

  const shots: Shot[] = [
    {
      id: 1,
      duration_s: 3,
      description: 'a soft warm gradient sky, the day emerges from a slight haze',
      camera: 'static wide',
      motion: 'haze drifts, color temperature shifts',
    },
    {
      id: 2,
      duration_s: 3,
      description: 'a single still-life: a cup, an open book, a folded fabric, all bathed in the same warm light',
      camera: 'slow push-in',
      motion: 'soft light shift, no object movement',
    },
    {
      id: 3,
      duration_s: 2,
      description: 'gentle pull-back, scene settles into calm, ambient end frame',
      camera: 'slow pull-back',
      motion: 'calm end',
    },
  ];

  const englishPrompt = shots.map((s, i) =>
    `Shot ${i + 1} (${s.duration_s}s): ${s.description} Camera: ${s.camera}. Motion: ${s.motion}.`
  ).join(' ');

  return {
    intentZh: [
      `视频方向：${directionZh}`,
      `日期：${date || '未指定'}`,
      `季节提示：${monthHint}`,
      `核心思路：8 秒 3 镜头 — 氛围天空 → 静物 → 收尾；色调温和，节奏舒缓，无文字`,
    ].filter(Boolean).join('。'),
    factsUsed,
    shots,
    styleDescription: '柔和暖色渐变；纸质纹理；负空间充足；节奏舒缓；末端稳定收束。',
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', portrait, busy composition, neon, text overlay',
    params: { ...DEFAULT_PARAMS, priority: 'low' },
    uncertaintyNotes: [
      date ? '' : 'date missing — defaulting to neutral ambient',
    ].filter(Boolean),
    rationale: 'context → 情绪 / 时间氛围短视频，强调「安静、可呼吸的画面」',
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
  const imagePromptMeta = safeReadJson<any>(join(ASSETS, packDir, 'image-prompt.meta.json'), {});
  const existingVideoPrompt = safeReadText(join(ASSETS, packDir, 'video-prompt.md'), '');
  const generatedImageDescriptions = safeReadJson<any>(
    join(ASSETS, packDir, 'generated-image-descriptions.json'),
    null
  );

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
    imagePromptMeta,
    existingVideoPrompt,
    generatedImageDescriptions,
    date: detail.date || manifest.created_at?.slice(0, 10) || '',
  };

  const result = strategy(ctx);

  // ---------- file: video-prompt.enriched.md ----------
  const shotsMd = result.shots.map(s =>
    `### Shot ${s.id} (${s.duration_s}s)\n- **画面**: ${s.description}\n- **镜头**: ${s.camera}\n- **运动**: ${s.motion}`
  ).join('\n\n');

  const enrichedMd = [
    `# 增强视频 Prompt · ${ctx.title}`,
    ``,
    `> 来源类型：**${ctx.sourceLabelZh}** (${sourceType})`,
    `> 策略：${result.rationale}`,
    `> 视频方向：${result.intentZh.split('。')[0] || ''}`,
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
    `## 镜头设计`,
    ``,
    shotsMd,
    ``,
    `## 画面风格`,
    ``,
    normalize(result.styleDescription),
    ``,
    `## MiniMax / Hailuo Video Prompt`,
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
    `- **duration**: ${result.params.duration}s`,
    `- **aspect_ratio**: ${result.params.aspectRatio}`,
    `- **priority**: ${result.params.priority}`,
    `- **generation_mode**: ${result.params.generationMode}`,
    ``,
    `## 不确定性说明`,
    ``,
    result.uncertaintyNotes.length ? result.uncertaintyNotes.map(t => `- ${t}`).join('\n') : '- 全部事实已使用，无明显不确定项',
    ``,
    `---`,
    `Generated by scripts/enhance-video-prompts.ts (Phase 4H). No LLM. No video model. No new media.`,
  ].join('\n');

  writeFileSync(join(ASSETS, packDir, 'video-prompt.enriched.md'), enrichedMd);

  // ---------- file: video-prompt.zh.md ----------
  const bullets = [
    `**这个视频想表现什么？** ${result.intentZh.split('。')[0] || '主题视频'}`,
    `**它基于哪些事实？** ${result.factsUsed.slice(0, 3).join('；') || '基于现有素材'}`,
    `**适合什么用途？** 短视频（X 帖 / 公众号 / 内部分享 / 模型演示）`,
    `**生成时要注意什么？** ${result.styleDescription}`,
    `**是否适合后续真实生成？** 是，但当前为 prompt-only，未调用视频模型；推荐参数：${result.params.duration}s · ${result.params.aspectRatio} · ${result.params.modelFamily}`,
  ];

  const zhMd = [
    `# 视频 Prompt 解释 · ${ctx.title}`,
    ``,
    bullets.map(b => `- ${b}`).join('\n'),
    ``,
    `## 完整创作意图`,
    ``,
    normalize(result.intentZh),
    ``,
    `## 镜头设计 3 段`,
    ``,
    result.shots.map(s => `- **Shot ${s.id}** (${s.duration_s}s): ${s.description}（${s.camera} / ${s.motion}）`).join('\n'),
    ``,
    `## 适合的使用场景`,
    ``,
    `- X 帖短视频（≤8s）`,
    `- 公众号 / 博客头图视频化`,
    `- 内部技术分享 / 路演开场`,
    `- AI 模型能力演示`,
    ``,
    `## 与现有素材的关系`,
    ``,
    `- 原始 video-prompt.md：保留为兜底短语，不被覆盖`,
    `- image-prompt.enriched.md：图片视觉可作为首帧参考（本 prompt 不强制图生视频，可独立运行）`,
    ``,
    `---`,
    `本文件是 video-prompt.enriched.md 的人类可读解释版。`,
  ].join('\n');

  writeFileSync(join(ASSETS, packDir, 'video-prompt.zh.md'), zhMd);

  // ---------- file: video-prompt.meta.json ----------
  const meta = {
    pack_id: ctx.packId,
    pack_dir: packDir,
    title: ctx.title,
    source_type: sourceType,
    source_label_zh: ctx.sourceLabelZh,
    strategy: result.rationale,
    direction: result.intentZh.split('。')[0] || '',
    facts_used: result.factsUsed,
    shots: result.shots,
    style_description: result.styleDescription,
    english_prompt: result.englishPrompt,
    negative_prompt: result.negativePrompt,
    intent_zh: result.intentZh,
    parameters: result.params,
    uncertainty_notes: result.uncertaintyNotes,
    generated_at: nowIso(),
    generator: 'enhance-video-prompts.ts@phase4h',
    llm_used: false,
    video_model_called: false,
    image_model_called: false,
    music_generated: false,
    new_media_generated: false,
    files: {
      enriched_md: 'video-prompt.enriched.md',
      zh_md: 'video-prompt.zh.md',
    },
  };

  writeFileSync(
    join(ASSETS, packDir, 'video-prompt.meta.json'),
    JSON.stringify(meta, null, 2) + '\n'
  );

  return { ok: true, meta };
}

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

  console.log(`[enhance-video-prompts] OK=${ok} FAIL=${fail}`);
  console.log(`[enhance-video-prompts] by strategy:`, byStrategy);
  if (failures.length) {
    console.log(`[enhance-video-prompts] failures:`);
    for (const f of failures) console.log(`  - ${f.pack_dir} :: ${f.reason}`);
  }
}

main();
