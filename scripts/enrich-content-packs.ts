#!/usr/bin/env tsx
/**
 * scripts/enrich-content-packs.ts
 *
 * Enriches each Content Pack with:
 * - content-summary.zh.md  (Chinese summary)
 * - detail.json            (structured metadata)
 *
 * Idempotent: can be run multiple times safely.
 * No MiniMax calls. No external LLM calls.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

// Hardcoded absolute paths — more reliable across different runtime contexts
const HARVESTER = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const ASSETS    = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';
const PACK_DIR  = join(ASSETS, 'content-packs');

const SOURCE_TYPE_LABELS_ZH: Record<string, string> = {
  'code':          '开源项目',
  'academic': '学术研究',
  'ai-ecosystem':  'AI 模型生态',
  'dev-community': '开发者社区',
  'culture-art':   '文化艺术',
  'context':       '日期与天气',
  'news':          '新闻',
};

const SOURCE_TYPE_BACKGROUND: Record<string, string> = {
  'code':          '来自 GitHub Open Source Radar 检测到的热门开源项目，反映当前开发者社区的技术热点。',
  'academic':       '来自 arXiv学术论文平台，反映 AI / NLP 领域的最新研究动态。',
  'ai-ecosystem':  '来自 Hugging Face Hub，反映 AI 模型生态中的热门模型和数据集。',
  'dev-community': '来自 Hacker News，反映科技行业从业者关注的热点话题。',
  'culture-art':   '来自 The Met Collection / Smithsonian 等文化艺术机构 API，反映经典艺术与文物。',
  'context':       '来自日期上下文、节假日、天气等信号，用于时效性内容创作。',
  'news':          '来自 GDELT 全球新闻数据库，反映全球热点新闻事件。',
};

const RECOMMENDED_USE_LABELS: Record<string, string[]> = {
  'x-post':     ['X 帖', 'Twitter / 社交媒体发帖', '适合快速传播的短资讯'],
  'image':      ['图片生成', 'AI 作画 / 信息图', '适合视觉化呈现学术概念'],
  'video-prompt': ['视频 Prompt', '视频脚本生成', '适合深度内容展开'],
  'music':      ['音乐 Prompt', 'AI 音乐生成', '适合配合视觉内容的背景音乐'],
  'webpage':    ['网页介绍', '博客 / Landing Page', '适合深度阅读的长文内容'],
};

// ── File helpers ────────────────────────────────────────────────────
function tryRead(path: string, fallback = ''): string {
  try { return readFileSync(path, 'utf8').trim(); } catch { return fallback; }
}

function safeReadJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return fallback; }
}

function fileExists(path: string): boolean {
  try { statSync(path); return true; } catch { return false; }
}

function listPacks(): string[] {
  const dirs: string[] = [];
  try {
    for (const yearEntry of readdirSync(PACK_DIR)) {
      const yearPath = join(PACK_DIR, yearEntry);
      if (!statSync(yearPath).isDirectory()) continue;
      for (const monthEntry of readdirSync(yearPath)) {
        const monthPath = join(yearPath, monthEntry);
        if (!statSync(monthPath).isDirectory()) continue;
        for (const dateEntry of readdirSync(monthPath)) {
          const datePath = join(monthPath, dateEntry);
          if (!statSync(datePath).isDirectory()) continue;
          for (const packEntry of readdirSync(datePath)) {
            const packPath = join(datePath, packEntry);
            if (!statSync(packPath).isDirectory()) continue;
            if (fileExists(join(packPath, 'manifest.json'))) dirs.push(packPath);
          }
        }
      }
    }
  } catch (e) { console.error('listPacks error:', e); }
  return dirs.sort();
}

// ── Read all pack files ────────────────────────────────────────────
interface PackFiles {
  packDir: string;
  manifest: any;
  source: any;
  signal: any;
  brief: string;
  facts: string;
  imagePrompt: string;
  videoPrompt: string;
  musicPrompt: string;
  webpageOutline: string;
  assetPlan: any;
  xPostZh: string;
}

function readPackFiles(packDir: string): PackFiles {
  const manifest   = safeReadJson<any>(join(packDir, 'manifest.json'), null);
  const source = safeReadJson<any>(join(packDir, 'source.json'), {});
  const signal    = safeReadJson<any>(join(packDir, 'signal.json'), {});
  const assetPlan = safeReadJson<any>(join(packDir, 'asset-plan.json'), {});
  return {
    packDir,
    manifest,
    source,
    signal,
    brief:           tryRead(join(packDir, 'brief.md')),
    facts:           tryRead(join(packDir, 'facts.md')),
    imagePrompt:     tryRead(join(packDir, 'image-prompt.md')),
    videoPrompt:     tryRead(join(packDir, 'video-prompt.md')),
    musicPrompt:     tryRead(join(packDir, 'music-prompt.md')),
    webpageOutline:  tryRead(join(packDir, 'webpage-outline.md')),
    assetPlan,
    xPostZh:         tryRead(join(packDir, 'x-post.zh.md')),
  };
}

// ── Extract from brief.md ──────────────────────────────────────────
function extractFromBrief(brief: string): { summary: string; whyItMatters: string; targetAudience: string } {
  const lines = brief.split('\n').map(l => l.trim()).filter(Boolean);
  let summary = '';
  let whyItMatters = '';
  let targetAudience = '';

  for (const line of lines) {
    if (line.startsWith('## Summary') || line.startsWith('## summary')) {
      summary = line.replace(/^##\s*(Summary|summary)\s*/, '').trim();
      // Get following lines
      const idx = lines.indexOf(line);
      const nextLines = lines.slice(idx + 1).filter(l => !l.startsWith('##')).join(' ');
      if (nextLines) summary += ' ' + nextLines.slice(0, 300);
    }
    if (line.startsWith('## Why It Matters') || line.startsWith('## Why it matters')) {
      whyItMatters = line.replace(/^##\s*Why It Matters\s*/i, '').trim();
      const idx = lines.indexOf(line);
      const nextLines = lines.slice(idx + 1).filter(l => !l.startsWith('##')).join(' ');
      if (nextLines) whyItMatters += ' ' + nextLines.slice(0, 200);
    }
    if (line.startsWith('## Target Audience')) {
      targetAudience = line.replace(/^##\s*Target Audience\s*/i, '').trim();
      const idx = lines.indexOf(line);
      const nextLines = lines.slice(idx + 1).filter(l => !l.startsWith('##')).join(' ');
      if (nextLines) targetAudience += ' ' + nextLines.slice(0, 100);
    }
  }

  return { summary, whyItMatters, targetAudience };
}

// ── Extract from facts.md ───────────────────────────────────────────
function extractFromFacts(facts: string): { keyFacts: string; sourceConfidence: string } {
  const lines = facts.split('\n').map(l => l.trim()).filter(Boolean);
  let keyFacts = '';
  let sourceConfidence = 'unknown';

  for (const line of lines) {
    if (line.toLowerCase().includes('source confidence')) {
      sourceConfidence = line.split(':').slice(1).join(':').trim();
    }
    // Collect list items
    if (/^\d+\./.test(line) || line.startsWith('- ')) {
      keyFacts += line + '\n';
    }
  }

  return { keyFacts: keyFacts.trim(), sourceConfidence };
}

// ── Generate one_sentence_summary from existing text ───────────────
function makeOneSentenceSummary(brief: string, facts: string): string {
  // Try to extract from brief Summary section
  const briefData = extractFromBrief(brief);
  if (briefData.summary) {
    // Truncate to ~80 chars
    return briefData.summary.slice(0, 120).trim() + (briefData.summary.length > 120 ? '...' : '');
  }
  // Fallback: first line of facts
  const factsLines = facts.split('\n').filter(l => l.trim());
  for (const line of factsLines) {
    if (line.length > 30 && line.length < 200) return line.slice(0, 120);
  }
  return '信息不足，等待后续信号补充。';
}

// ── Generate content-summary.zh.md ────────────────────────────────
function generateContentSummary(pf: PackFiles): string {
  const { manifest, source, signal, brief, facts, imagePrompt, videoPrompt, musicPrompt, webpageOutline, xPostZh } = pf;
  const title = manifest?.title || signal?.title || basename(pf.packDir);
  const sourceTypes: string[] = manifest?.source_types || source?.source_types || [];
  const score: number = manifest?.final_score || 0;
  const date = (manifest?.created_at || signal?.created_at || '').slice(0, 10);

  const briefData = extractFromBrief(brief);
  const factsData = extractFromFacts(facts);
  const oneSentence = makeOneSentenceSummary(brief, facts);

  // Background
  const bgParts = sourceTypes.map(t => SOURCE_TYPE_BACKGROUND[t] || `来自 ${t} 信号源。`).join(' ');
  const bg = bgParts || '来自信号采集系统，具体来源待确认。';

  // Why it matters
  const whyMatters = briefData.whyItMatters ||
    (sourceTypes.includes('academic') ? '这篇论文揭示了 AI领域的某个前沿问题，具有较高的学术和实践价值。' :
     sourceTypes.includes('code') ? '这是一个活跃的开源项目，反映了当前开发者社区的技术热点。' :
     '这是一个值得关注的信号源内容。');

  // Recommended uses
  const recAssets: string[] = manifest?.recommended_assets || [];
  const useLines = recAssets.map(k => {
    const labels = RECOMMENDED_USE_LABELS[k] || [k];
    return `- ${labels[0]}：${labels.slice(1).join(' / ')}`;
  });

  // Available assets
  const available: string[] = [];
  if (brief) available.push('- brief.md（创意简报）');
  if (facts) available.push('- facts.md（事实依据）');
  if (xPostZh) available.push('- x-post.zh.md（X 帖草稿）');
  if (imagePrompt) available.push('- image-prompt.md（图片 Prompt）');
  if (videoPrompt) available.push('- video-prompt.md（视频 Prompt）');
  if (musicPrompt) available.push('- music-prompt.md（音乐 Prompt）');
  if (webpageOutline) available.push('- webpage-outline.md（网页大纲）');

  // Uncertainty notes
  const uncertainty = !brief && !facts
    ?'⚠️ 信息不足：brief.md 和 facts.md 均为空，内容基于信号元数据自动生成，可能不完整，建议人工复核。'
    : !brief
    ? '⚠️ brief.md 为空，摘要内容基于 facts.md 和信号元数据生成，建议补充 brief。'
    : '✅ 内容基于 brief.md、facts.md 和信号元数据生成。';

  const lines: string[] = [
    `# ${title}`,
    '',
    '## 一句话介绍',
    oneSentence,
    '',
    '## 背景与来源',
    bg,
    '',
    '## 为什么值得关注',
    whyMatters,
    '',
    '## 可以怎么用',
    useLines.length > 0 ? useLines.join('\n') : '-暂无推荐用途，等待后续信号补充。',
    '',
    '## 已有素材',
    available.length > 0 ? available.join('\n') : '- 暂无素材文件。',
    '',
    '## 不确定性说明',
    uncertainty,
    '',
    `---`,
    `**标题：** ${title}`,
    `**来源类型：** ${sourceTypes.map(t => SOURCE_TYPE_LABELS_ZH[t] || t).join(' / ')}`,
    `**日期：** ${date}`,
    `**评分：** ${score > 0 ? score.toFixed(3) : '无评分数据'}`,
  ];

  return lines.join('\n');
}

// ── Generate detail.json ───────────────────────────────────────────
function generateDetailJson(pf: PackFiles): object {
  const { manifest, source, signal, brief, facts, imagePrompt, videoPrompt, musicPrompt, webpageOutline, xPostZh, packDir } = pf;
  const title = manifest?.title || signal?.title || basename(packDir);
  const sourceTypes: string[] = manifest?.source_types || source?.source_types || [];
  const primaryType = sourceTypes[0] || 'unknown';
  const score: number = manifest?.final_score || 0;
  const date = (manifest?.created_at || signal?.created_at || '').slice(0, 10);
  const recAssets: string[] = manifest?.recommended_assets || [];
  const tags: string[] = (manifest?.tags || []).filter(t => typeof t === 'string');

  const briefData = extractFromBrief(brief);
  const factsData = extractFromFacts(facts);
  const oneSentence = makeOneSentenceSummary(brief, facts);

  // Background
  const bg = sourceTypes.map(t => SOURCE_TYPE_BACKGROUND[t] || `来自 ${t} 信号源。`).join(' ') || null;

  // Recommended uses
  const recUses = recAssets.filter(k =>
    ['x-post', 'image', 'video-prompt', 'music', 'webpage'].includes(k)
  );

  // Generated images (check by packDir name matching)
  const genImages: string[] = [];
  const genAssetsPath = join(ASSETS, 'metadata', 'generated-assets.json');
  try {
    const genAssets: any[] = JSON.parse(readFileSync(genAssetsPath, 'utf8'));
    for (const ga of genAssets) {
      const cp = (ga as any).content_pack || '';
      if (cp.includes(basename(packDir))) {
        genImages.push(ga.filename || ga.id);
      }
    }
  } catch {}

  const uncertaintyNotes = !brief && !facts
    ? '⚠️ brief.md 和 facts.md 均为空，内容可能不完整，建议人工复核。'
    : !brief
    ? '⚠️ brief.md 为空，部分内容基于 facts.md 和信号元数据生成。'
    : '✅ 内容基于现有素材生成，信息基本完整。';

  return {
    title,
    source_type: primaryType,
    source_label_zh: SOURCE_TYPE_LABELS_ZH[primaryType] || primaryType,
    one_sentence_summary: oneSentence,
    background: bg,
    why_it_matters: briefData.whyItMatters || (bg ? bg.slice(0, 100) : null),
    recommended_uses: recUses,
    available_assets: {
      brief:          !!brief,
      facts:          !!facts,
      x_post_zh:     !!xPostZh,
      image_prompt:   !!imagePrompt,
      video_prompt:   !!videoPrompt,
      music_prompt:   !!musicPrompt,
      webpage_outline: !!webpageOutline,
      generated_images: genImages,
    },
    tags,
    score: score > 0 ? score : null,
    date,
    uncertainty_notes: uncertaintyNotes,
  };
}

// ── Main ────────────────────────────────────────────────────────────
function main() {
  const packs = listPacks();
  console.log(`[enrich-content-packs] Found ${packs.length} content packs`);

  const results: { pack: string; detail_written: boolean; summary_written: boolean }[] = [];

  for (const packDir of packs) {
    const pf = readPackFiles(packDir);

    // Generate detail.json
    const detailPath = join(packDir, 'detail.json');
    const detail = generateDetailJson(pf);
    try {
      writeFileSync(detailPath, JSON.stringify(detail, null, 2), 'utf8');
    } catch (e: any) {
      console.error(`[ERROR] Could not write detail.json for ${packDir}: ${e.message}`);
    }

    // Generate content-summary.zh.md
    const summaryPath = join(packDir, 'content-summary.zh.md');
    const summary = generateContentSummary(pf);
    try {
      writeFileSync(summaryPath, summary, 'utf8');
    } catch (e: any) {
      console.error(`[ERROR] Could not write content-summary.zh.md for ${packDir}: ${e.message}`);
    }

    results.push({
      pack: basename(packDir),
      detail_written: fileExists(detailPath),
      summary_written: fileExists(summaryPath),
    });
  }

  console.log(`[enrich-content-packs] Done. ${results.filter(r => r.summary_written).length}/${packs.length} packs enriched.`);
  process.exit(0);
}

main();