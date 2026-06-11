#!/usr/bin/env tsx
/**
 * scripts/enhance-image-prompts.ts
 *
 * Phase 4G: Source-aware Image Prompt Enhancement.
 *
 * Reads existing per-pack data (facts.enriched.md, sources-facts.json,
 * detail.json, brief.md, image-prompt.md, manifest.json) and produces
 * three new artifacts per pack, choosing strategy by source_type:
 *
 *   - image-prompt.enriched.md  (Chinese intent + English prompt + negative + params)
 *   - image-prompt.zh.md        (human-readable Chinese explanation)
 *   - image-prompt.meta.json    (machine-readable metadata)
 *
 * NO LLM calls, NO external API calls. All generation is deterministic,
 * rule-based, and operates only on existing local data.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
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

function ensureDir(p: string) {
  if (!existsSync(p)) {
    // mkdirSync(p, { recursive: true }) would be nicer; we have no import here, but
    // for our flow we only ever write into existing pack dirs, so no-op.
  }
}

function trim(s: string, n: number): string {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd();
}

function nowIso(): string {
  return new Date().toISOString();
}

// Strip non-ASCII-safe junk and excessive whitespace
function normalize(s: string): string {
  return (s || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Pull first matching regex group from a blob, or fallback
function firstMatch(text: string, re: RegExp, fallback = ''): string {
  const m = text.match(re);
  if (!m) return fallback;
  return (m[1] || m[0] || '').toString().trim();
}

// Split text into bullets by lines starting with "- " or "* " or "· "
function extractBullets(text: string, max = 8): string[] {
  const out: string[] = [];
  const lines = (text || '').split('\n');
  for (const raw of lines) {
    const t = raw.trim();
    if (/^[-*·•]\s+/.test(t)) {
      out.push(t.replace(/^[-*·•]\s+/, '').trim());
      if (out.length >= max) break;
    }
  }
  return out;
}

// Title-case-ish tag safe for image prompts
function sanitizeForPrompt(s: string): string {
  return (s || '')
    .replace(/[`*_#>]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build a comma-joined English visual descriptor from any tokens list
function joinTokens(parts: string[]): string {
  return parts
    .map(p => sanitizeForPrompt(p))
    .filter(p => p.length > 0)
    .filter((p, i, arr) => arr.indexOf(p) === i) // dedupe
    .join(', ');
}

// ---------- source-type strategies ----------

type Strategy = (ctx: PackCtx) => StrategyResult;

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
  existingPrompt: string;
  date: string;
}

interface StrategyResult {
  intentZh: string;          // Chinese intent paragraph
  englishPrompt: string;     // Final English prompt
  negativePrompt: string;    // Negative prompt
  params: {                  // Recommended generation parameters
    aspectRatio: string;
    resolution: string;
    style: string;
    guidance?: number;
    steps?: number;
  };
  styleTags: string[];        // style hints derived from the strategy
  compositionNotes: string[];// composition guidance
  referencePhrases: string[];// phrases inspired by the source
  visualSubjects: string[];   // what to depict
  rationale: string;         // why this strategy fits
}

// Common negative prompt used across strategies
const BASE_NEGATIVE = 'low quality, blurry, distorted, watermark, signature, text overlay, ugly, deformed hands, extra fingers, jpeg artifacts, oversaturated';

const STRATEGIES: Record<string, Strategy> = {
  code: codeStrategy,
  academic: academicStrategy,
  'ai-ecosystem': aiEcosystemStrategy,
  'dev-community': devCommunityStrategy,
  'culture-art': cultureArtStrategy,
  context: contextStrategy,
};

// ---------- code (open source repo) ----------

function codeStrategy(ctx: PackCtx): StrategyResult {
  const facts = ctx.sourceFacts?.facts || {};
  const stars = facts.stars;
  const forks = facts.forks;
  const lang = facts.language;
  const topics: string[] = facts.topics || [];
  const description = facts.description || ctx.oneSentence;

  const visualSubjects: string[] = [];
  visualSubjects.push('open source repository cover banner');
  visualSubjects.push('developer workflow diagram');
  visualSubjects.push('agent architecture schematic');
  if (topics.includes('mcp') || topics.includes('claude-code') || topics.includes('ai-agents')) {
    visualSubjects.push('AI agent tool graph');
    visualSubjects.push('CLI terminal with glowing prompt');
  }
  if (topics.includes('image-generation') || topics.includes('text-to-image')) {
    visualSubjects.push('latent diffusion flow visualization');
  }
  if (topics.includes('text-to-video') || topics.includes('video-generation') || topics.includes('ai-video')) {
    visualSubjects.push('frame sequence timeline');
  }
  if (topics.includes('text-to-audio') || topics.includes('ai-music')) {
    visualSubjects.push('waveform and spectrogram overlay');
  }

  const styleTags = [
    'tech editorial illustration',
    'isometric or 3/4 perspective',
    'blue and indigo palette',
    'subtle grid background',
    'clean sans-serif labels',
  ];

  const compositionNotes: string[] = [
    'Use a hero left-aligned repo name banner and a right-side flow diagram.',
    'Connect nodes with thin glowing edges; emphasize data flow direction.',
    'Show terminal/code window as the central anchor; orbiting capability icons.',
  ];

  const referencePhrases: string[] = [];
  if (stars) referencePhrases.push(`${stars.toLocaleString()} stars`);
  if (forks) referencePhrases.push(`${forks.toLocaleString()} forks`);
  if (lang) referencePhrases.push(`${lang} project`);
  if (topics.length) referencePhrases.push(`topics: ${topics.slice(0, 4).join(', ')}`);

  const englishPrompt = [
    'A modern GitHub repository cover banner for an open-source AI toolkit',
    `repository name "${ctx.title}" displayed as the central hero title`,
    'isometric 3/4 perspective developer workspace with floating capability tiles',
    'left: glowing terminal window with monospaced code, right: agent architecture graph with 5-7 connected nodes',
    `visual hints inspired by topics: ${topics.slice(0, 6).join(', ') || 'AI, agents, generation'}`,
    'style: tech editorial illustration, soft 3D, dark indigo background, blue-violet gradient highlights',
    'clean sans-serif labels, thin connecting lines, subtle dotted grid',
    'no human faces, no logos of companies',
  ].join('. ');

  const intentZh = [
    `将代码仓库包装成「开发者一眼能看懂的能力地图」`,
    `标题：${ctx.title}`,
    description ? `项目定位：${description}` : '',
    referencePhrases.length ? `关键指标：${referencePhrases.join(' · ')}` : '',
    `核心思路：左侧终端/代码窗口作为锚点，右侧展示 agent 能力图谱；用节点连线表示数据流`,
  ].filter(Boolean).join('。');

  return {
    intentZh,
    englishPrompt,
    negativePrompt: BASE_NEGATIVE,
    params: { aspectRatio: '16:9', resolution: '2K', style: 'tech editorial, isometric, dark mode', guidance: 7.5, steps: 30 },
    styleTags,
    compositionNotes,
    referencePhrases,
    visualSubjects,
    rationale: 'code → 仓库封面 + 工作流/agent 架构图，强调「开发者一眼看懂能力边界」',
  };
}

// ---------- academic (paper) ----------

function academicStrategy(ctx: PackCtx): StrategyResult {
  const facts = ctx.sourceFacts?.facts || {};
  const title = facts.title || ctx.title;
  const authors = facts.authors;
  const date = facts.date || facts.published;
  const summary = facts.summary || ctx.oneSentence;
  const primaryCat = facts.primary_category || (ctx.tags || []).find(t => t.startsWith('arxiv:')) || '';

  const visualSubjects: string[] = [
    'paper concept diagram',
    'academic infographic',
    'research visual metaphor',
    'neural network schematic with paper title overlay',
  ];
  if (/llm|automation|benchmark/i.test(title + ' ' + summary)) {
    visualSubjects.push('benchmark score curve');
    visualSubjects.push('human-vs-model comparison panel');
  }
  if (/agent|tool|reasoning/i.test(title + ' ' + summary)) {
    visualSubjects.push('agent reasoning trace diagram');
  }

  const styleTags = [
    'academic poster',
    'serif and sans-serif typography',
    'deep blue and gold accents',
    'clean white background',
    'data-ink ratio 2:1',
  ];

  const compositionNotes: string[] = [
    'Top: paper title in serif. Middle: one large conceptual figure. Bottom: 3-stat row (e.g. accuracy, sample size, year).',
    'Use light gridlines like an arXiv paper.',
    'Add a small footer with primary_category badge and year.',
  ];

  const englishPrompt = [
    'An academic poster for a research paper',
    `paper title "${title}" in elegant serif at the top`,
    'central conceptual diagram: abstract geometric shapes forming a flow, suggesting research methodology',
    'three small data tiles at the bottom: key metric, sample size, year',
    'style: deep navy blue, ivory white, gold accents, light dotted grid, Edward Tufte inspired',
    primaryCat ? `small badge with primary category "${primaryCat}"` : '',
    'no human faces, no logo of journals',
  ].filter(Boolean).join('. ');

  const intentZh = [
    `把论文包装成「学术海报」风格的视觉摘要`,
    `论文标题：${title}`,
    authors ? `作者：${authors}` : '',
    date ? `发表时间：${date}` : '',
    summary ? `核心摘要：${trim(summary, 220)}` : '',
    `主图：方法论/概念图（不画人物面孔），辅以 3 项关键数据瓦片`,
  ].filter(Boolean).join('。');

  return {
    intentZh,
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', cartoonish, childish, fake equations',
    params: { aspectRatio: '4:3', resolution: '2K', style: 'academic poster, data-viz, minimalist', guidance: 6.5, steps: 28 },
    styleTags,
    compositionNotes,
    referencePhrases: [
      authors ? `authors: ${authors}` : '',
      primaryCat ? `primary_category: ${primaryCat}` : '',
    ].filter(Boolean),
    visualSubjects,
    rationale: 'academic → 论文概念图/学术信息图，强调「研究方法 + 关键数据 + 论文气质」',
  };
}

// ---------- ai-ecosystem (model on HF) ----------

function aiEcosystemStrategy(ctx: PackCtx): StrategyResult {
  const facts = ctx.sourceFacts?.facts || {};
  // ai-ecosystem facts may be empty (HF API failed) — use detail.enriched_facts
  const enriched: string[] = ctx.detail?.enriched_facts || [];
  const downloads = enriched.find(f => /下载量/.test(f));
  const likes = enriched.find(f => /点赞数/.test(f));
  const lib = enriched.find(f => /库/.test(f));
  const task = enriched.find(f => /任务类型/.test(f));

  const visualSubjects: string[] = [
    'model capability diagram',
    'AI pipeline flow visual',
    'model card hero image',
    'abstract neural network with input/output arrows',
  ];
  if (/image-to-video|text-to-video|img2vid/i.test(task || '')) {
    visualSubjects.push('frame-by-frame video timeline with motion arrows');
  } else if (/text-to-image|image-generation/i.test(task || '')) {
    visualSubjects.push('latent space grid sampling visualization');
  } else if (/text-to-audio|music/i.test(task || '')) {
    visualSubjects.push('spectrogram waterfall');
  } else if (/text-generation|llm|chat/i.test(task || '')) {
    visualSubjects.push('token stream with attention map');
  }

  const styleTags = [
    'model card visual',
    'Hugging Face inspired',
    'amber to magenta gradient',
    'dark slate background',
    'monospaced metric tiles',
  ];

  const compositionNotes: string[] = [
    'Hero: large model name badge with version. Center: capability flow from input → model → output.',
    'Right: 2-3 metric tiles (downloads, likes, library).',
    'Use arrows in the model pipeline to communicate directionality.',
  ];

  const englishPrompt = [
    'A polished AI model card visual',
    `model name "${ctx.title}" shown as a large hero badge`,
    'central pipeline flow: input (icon) → model block with subtle inner layers → output (icon)',
    task ? `task label "${task.replace('任务类型: ', '')}" near the input` : '',
    'two or three monospaced metric tiles on the right: downloads, likes, library',
    'style: Hugging Face inspired, dark slate background, amber-to-magenta gradient, soft glow',
    'no human faces, no company logos',
  ].filter(Boolean).join('. ');

  const intentZh = [
    `把 HF 模型包成「模型卡 hero 图」`,
    `模型：${ctx.title}`,
    task ? `任务类型：${task}` : '',
    lib ? `底层库：${lib}` : '',
    downloads ? `下载量：${downloads}` : '',
    likes ? `点赞数：${likes}` : '',
    `核心思路：左中右三段式 — 任务/输入图标 → 模型块（带层次感）→ 输出图标，右侧加 2-3 个指标瓦片`,
  ].filter(Boolean).join('。');

  return {
    intentZh,
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', anime, 3d render, plastic',
    params: { aspectRatio: '16:9', resolution: '2K', style: 'model card, hero, dark slate, gradient', guidance: 7.0, steps: 30 },
    styleTags,
    compositionNotes,
    referencePhrases: [downloads, likes, lib].filter(Boolean) as string[],
    visualSubjects,
    rationale: 'ai-ecosystem → 模型能力图 / pipeline flow / model card hero，强调「能力输入输出 + 关键指标」',
  };
}

// ---------- dev-community ----------

function devCommunityStrategy(ctx: PackCtx): StrategyResult {
  const facts = ctx.sourceFacts?.facts || {};
  const title = facts.title || ctx.title;
  const description = facts.description || ctx.oneSentence;

  const visualSubjects: string[] = [
    'developer pain point poster',
    'discussion thread infographic',
    'quote card with developer workspace background',
    'isometric desk with multiple monitors',
  ];

  const styleTags = [
    'dev community poster',
    'editorial flat illustration',
    'pastel pink and slate',
    'rounded sans-serif type',
    'monospace accents',
  ];

  const compositionNotes: string[] = [
    'Top: short hook quote (3-6 words). Middle: 1-2 line "pain point" statement. Bottom: subtle attribution.',
    'Use a developer workspace scene in the background, blurred.',
  ];

  const englishPrompt = [
    'A developer community discussion poster',
    `topic "${title}" as a short hook at the top in rounded sans-serif`,
    'central visual: a stylized developer workspace with three monitors showing code, terminal, and chat',
    'bottom one-liner summarizing the pain point in italics',
    'style: editorial flat illustration, pastel pink and slate, soft shadows, minimal',
    'no faces, no company logos',
  ].join('. ');

  const intentZh = [
    `把开发者社区的讨论包成「开发者一眼共情」的痛点海报`,
    `话题：${title}`,
    description ? `简介：${trim(description, 220)}` : '',
    `核心思路：上方一句 hook 短语（3-6 字），中间 1-2 句痛点描述，底部归属`,
  ].filter(Boolean).join('。');

  return {
    intentZh,
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', photographic, cinematic, anime',
    params: { aspectRatio: '1:1', resolution: '2K', style: 'editorial flat illustration, dev community', guidance: 6.5, steps: 28 },
    styleTags,
    compositionNotes,
    referencePhrases: description ? [trim(description, 120)] : [],
    visualSubjects,
    rationale: 'dev-community → 开发者痛点海报 / 讨论信息图，强调「开发者一眼共情」',
  };
}

// ---------- culture-art (museum artwork) ----------

function cultureArtStrategy(ctx: PackCtx): StrategyResult {
  const facts = ctx.sourceFacts?.facts || {};
  const title = facts.title || ctx.title;
  const artist = facts.artist;
  const date = facts.date;
  const medium = facts.medium;
  const department = facts.department;
  const culture = facts.culture;

  const visualSubjects: string[] = [
    'art-inspired reinterpretation',
    'museum lighting scene',
    'style homage in modern AI aesthetic',
    'dramatic spotlight on a single hero subject',
  ];
  if (/landscape|panorama|river|mountain/i.test(title + ' ' + (facts.classification || ''))) {
    visualSubjects.push('layered atmospheric landscape');
  }
  if (/saint|virgin|christ|madonna|angel|religious|devotion/i.test(title)) {
    visualSubjects.push('contemplative figure in wilderness');
  }

  const styleTags = [
    'museum photography',
    'dramatic directional lighting',
    'warm wood and gold tones',
    'oil painting texture',
    'classical frame',
  ];

  const compositionNotes: string[] = [
    'Hero: single artwork or reinterpreted subject. Background: dark museum wall with warm wash.',
    'Add a subtle museum spotlight from the top-left.',
    'Avoid placing any text on the artwork itself.',
  ];

  const englishPrompt = [
    'A museum-style photograph of a classical artwork reinterpretation',
    `subject: "${title}"${artist ? ` by ${artist}` : ''}`,
    date ? `period: ${date}` : '',
    medium ? `medium hint: ${medium}` : '',
    'museum lighting: warm spotlight from the upper-left, dark oak wall background, soft floor reflection',
    'style: contemporary AI reinterpretation with oil-painting texture, no faces in close-up, museum placard blurred at bottom',
    'no readable text on the image, no logos',
  ].filter(Boolean).join('. ');

  const intentZh = [
    `把馆藏艺术品包装成「博物馆灯光下的当代 AI 重绎」`,
    `作品：${title}`,
    artist ? `艺术家：${artist}` : '',
    date ? `年代：${date}` : '',
    medium ? `媒介：${medium}` : '',
    department ? `部门：${department}` : '',
    culture ? `文化背景：${culture}` : '',
    `核心思路：暗色博物馆墙 + 暖色聚光，画面主体是原作的当代 AI 重绎，保留油画质感`,
  ].filter(Boolean).join('。');

  return {
    intentZh,
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', modern logos, pop art, neon, anime',
    params: { aspectRatio: '4:5', resolution: '2K', style: 'museum, classical, oil painting, dramatic lighting', guidance: 7.5, steps: 32 },
    styleTags,
    compositionNotes,
    referencePhrases: [artist, date, medium, department, culture].filter(Boolean) as string[],
    visualSubjects,
    rationale: 'culture-art → 艺术启发的视觉 / 博物馆灯光 / 风格重绎，强调「原作气质的当代重绎」',
  };
}

// ---------- context (date / weather) ----------

function contextStrategy(ctx: PackCtx): StrategyResult {
  const date = ctx.date || '';
  const month = date.slice(5, 7);
  const day = date.slice(8, 10);
  const monthHint = monthToHint(month);

  const visualSubjects: string[] = [
    'mood board collage',
    'time-of-day atmosphere',
    'weather-inspired abstract',
    'soft pastel gradient',
  ];

  const styleTags = [
    'editorial mood board',
    'soft pastels',
    'paper texture',
    'serif accent type',
    'minimal composition',
  ];

  const englishPrompt = [
    'A soft editorial mood board',
    `${monthHint}, day ${day || '?'}`,
    'subjects: a single cup, a window with light, an open book, a folded fabric',
    'background: warm pastel gradient suggesting time of day and season',
    'style: collage, paper texture, muted palette, gentle shadows',
    'no faces, no text on image',
  ].join('. ');

  const intentZh = [
    `把日期/天气上下文包装成「氛围 mood board」`,
    `日期：${date || '未指定'}`,
    `季节提示：${monthHint}`,
    `核心思路：3-4 个静物主体（杯子、窗户、书、布料），加柔和的色温与质感纹理`,
  ].join('。');

  return {
    intentZh,
    englishPrompt,
    negativePrompt: BASE_NEGATIVE + ', portrait, busy, neon',
    params: { aspectRatio: '3:4', resolution: '2K', style: 'mood board, soft pastel, editorial', guidance: 6.0, steps: 24 },
    styleTags,
    compositionNotes: ['Use negative space generously.', 'Aim for 30-40% white space.'],
    referencePhrases: date ? [`date: ${date}`] : [],
    visualSubjects,
    rationale: 'context → 情绪板 / 时间氛围，强调「安静、可呼吸的视觉」',
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
  const existingPrompt = safeReadText(join(ASSETS, packDir, 'image-prompt.md'), '');

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
    existingPrompt,
    date: detail.date || manifest.created_at?.slice(0, 10) || '',
  };

  const result = strategy(ctx);

  // ---------- file: image-prompt.enriched.md ----------
  const enrichedMd = [
    `# 增强图片 Prompt · ${ctx.title}`,
    ``,
    `> 来源类型：**${ctx.sourceLabelZh}** (${sourceType})`,
    `> 策略：${result.rationale}`,
    `> 生成时间：${nowIso()}`,
    ``,
    `## 中文意图 (Chinese Intent)`,
    ``,
    normalize(result.intentZh),
    ``,
    `## English Prompt (Stable Diffusion / Midjourney style)`,
    ``,
    '```text',
    result.englishPrompt,
    '```',
    ``,
    `## Negative Prompt`,
    ``,
    '```text',
    result.negativePrompt,
    '```',
    ``,
    `## Recommended Parameters`,
    ``,
    `- **Aspect ratio**: ${result.params.aspectRatio}`,
    `- **Resolution**: ${result.params.resolution}`,
    `- **Style**: ${result.params.style}`,
    result.params.guidance ? `- **Guidance scale**: ${result.params.guidance}` : '',
    result.params.steps ? `- **Steps**: ${result.params.steps}` : '',
    ``,
    `## Style Tags`,
    ``,
    result.styleTags.map(t => `- ${t}`).join('\n'),
    ``,
    `## Composition Notes`,
    ``,
    result.compositionNotes.map(t => `- ${t}`).join('\n'),
    ``,
    `## Visual Subjects`,
    ``,
    result.visualSubjects.map(t => `- ${t}`).join('\n'),
    ``,
    result.referencePhrases.length ? [
      `## Source-Aware Reference Phrases`,
      ``,
      result.referencePhrases.map(t => `- ${t}`).join('\n'),
      ``,
    ].join('\n') : '',
    `---`,
    `Generated by scripts/enhance-image-prompts.ts (Phase 4G). No LLM calls.`,
  ].filter(Boolean).join('\n');

  writeFileSync(join(ASSETS, packDir, 'image-prompt.enriched.md'), enrichedMd);

  // ---------- file: image-prompt.zh.md ----------
  const bullets = [
    `**策略**：${result.rationale}`,
    `**目标画面**：${result.visualSubjects[0] || '主题视觉'}`,
    `**风格关键词**：${result.styleTags.slice(0, 4).join('、')}`,
    `**构图提示**：${result.compositionNotes[0] || '保持简洁'}`,
    `**负面提示**：低质量、模糊、水印、人物面孔`,
    `**推荐参数**：${result.params.aspectRatio} · ${result.params.resolution} · ${result.params.style}`,
  ];

  const zhMd = [
    `# 图片 Prompt 解释 · ${ctx.title}`,
    ``,
    `这张图为什么这样画：`,
    ``,
    bullets.map(b => `- ${b}`).join('\n'),
    ``,
    `## 完整中文意图`,
    ``,
    normalize(result.intentZh),
    ``,
    `## 完整英文 Prompt`,
    ``,
    '```text',
    result.englishPrompt,
    '```',
    ``,
    `## 适合的使用场景`,
    ``,
    `- X 帖封面 / Open Graph 卡片`,
    `- 公众号 / 博客头图`,
    `- 内部技术分享视觉`,
    ``,
    `---`,
    `本文件是 image-prompt.enriched.md 的人类可读解释版。`,
  ].join('\n');

  writeFileSync(join(ASSETS, packDir, 'image-prompt.zh.md'), zhMd);

  // ---------- file: image-prompt.meta.json ----------
  const meta = {
    pack_id: ctx.packId,
    pack_dir: packDir,
    title: ctx.title,
    source_type: sourceType,
    source_label_zh: ctx.sourceLabelZh,
    strategy: result.rationale,
    visual_subjects: result.visualSubjects,
    style_tags: result.styleTags,
    composition_notes: result.compositionNotes,
    reference_phrases: result.referencePhrases,
    english_prompt: result.englishPrompt,
    negative_prompt: result.negativePrompt,
    intent_zh: result.intentZh,
    parameters: result.params,
    generated_at: nowIso(),
    generator: 'enhance-image-prompts.ts@phase4g',
    llm_used: false,
    files: {
      enriched_md: 'image-prompt.enriched.md',
      zh_md: 'image-prompt.zh.md',
    },
  };

  writeFileSync(
    join(ASSETS, packDir, 'image-prompt.meta.json'),
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

  console.log(`[enhance-image-prompts] OK=${ok} FAIL=${fail}`);
  console.log(`[enhance-image-prompts] by strategy:`, byStrategy);
  if (failures.length) {
    console.log(`[enhance-image-prompts] failures:`);
    for (const f of failures) console.log(`  - ${f.pack_dir} :: ${f.reason}`);
  }
}

main();
