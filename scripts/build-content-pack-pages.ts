#!/usr/bin/env tsx
/**
 * scripts/build-content-pack-pages.ts
 *
 * Generates human-readable index.html pages for each Content Pack.
 * Enhanced for Phase 4D-2: richer content per source type, version history.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

function safeReadJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; }
  catch { return fallback; }
}

function safeReadText(path: string, fallback = ''): string {
  try { return readFileSync(path, 'utf8'); }
  catch { return fallback; }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Source type labels
const ST_LABELS: Record<string, string> = {
  code: '开源项目', academic: '学术研究', 'ai-ecosystem': 'AI模型生态',
  'dev-community': '开发者社区', 'culture-art': '文化艺术', context: '日期与天气', news: '新闻',
};

const ST_COLORS: Record<string, string> = {
  code: '#5b5bd6', academic: '#22c55e', 'ai-ecosystem': '#f59e0b',
  'dev-community': '#ec4899', 'culture-art': '#f97316', context: '#6b7280', news: '#3b82f6',
};

// Use labels
const USE_LABELS: Record<string, { label: string; icon: string }> = {
  brief: { label: '创意简报', icon: '📋' },
  facts: { label: '事实依据', icon: '📊' },
  x_post_zh: { label: 'X帖草稿', icon: '🐦' },
  image_prompt: { label: '图片Prompt', icon: '🎨' },
  video_prompt: { label: '视频Prompt', icon: '🎬' },
  music_prompt: { label: '音乐Prompt', icon: '🎵' },
  webpage_outline: { label: '网页大纲', icon: '🌐' },
  generated_images: { label: '已生成图片', icon: '🖼️' },
};

interface PackData {
  pack_dir: string;
  title: string;
  date: string;
  source_types: string[];
  score: number;
  tags: string[];
  recommended_assets: string[];
  detail_path: string;
  summary_path: string;
  has_generated_image: boolean;
  detail_page_path?: string;
  detail_page_url?: string;
  summary_md_path?: string;
  detail_json_path?: string;
}

interface DedupItem {
  canonical_key: string;
  title: string;
  source_type: string;
  primary_pack_dir: string;
  version_count: number;
  versions: { pack_dir: string; title: string; date: string; score: number; source_type: string; detail_page_path: string }[];
}

function extractFirstParagraph(text: string): string {
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('-'));
  return lines[0]?.trim() || '';
}

function extractFacts(text: string): string[] {
  const facts: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      facts.push(trimmed.replace(/^[-*]\s+/, ''));
    }
  }
  return facts.slice(0, 5);
}

function generateSourceSpecificSection(st: string, brief: string, facts: string[], xpost: string, signal: any, source: any): string {
  const sections: string[] = [];

  if (st === 'code') {
    const factsHtml = facts.length > 0
      ? `<ul>${facts.map(f => `<li>${escapeHtml(truncate(f, 200))}</li>`).join('')}</ul>`
      : '<p>暂无详细事实数据。</p>';
    sections.push(`
    <div class="section">
      <div class="section-title">🚀 项目简介</div>
      <div class="section-body">${brief ? escapeHtml(truncate(extractFirstParagraph(brief), 400)) : '<p>暂无项目简介。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">💡 解决的问题</div>
      <div class="section-body">${factsHtml}</div>
    </div>
    <div class="section">
      <div class="section-title">👥 适合的用户</div>
      <div class="section-body">${xpost ? escapeHtml(truncate(extractFirstParagraph(xpost), 300)) : '<p>开发者、技术创业者、开源爱好者。</p>'}</div>
    </div>
    `);
  } else if (st === 'academic') {
    const factsHtml = facts.length > 0
      ? `<ul>${facts.map(f => `<li>${escapeHtml(truncate(f, 200))}</li>`).join('')}</ul>`
      : '<p>暂无论文核心观点。</p>';
    sections.push(`
    <div class="section">
      <div class="section-title">📚 研究问题</div>
      <div class="section-body">${brief ? escapeHtml(truncate(extractFirstParagraph(brief), 400)) : '<p>暂无研究问题描述。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">🔬 核心观点</div>
      <div class="section-body">${factsHtml}</div>
    </div>
    <div class="section">
      <div class="section-title">🎯 可转化内容</div>
      <div class="section-body">
        <ul>
          <li>X 线程：提炼论文核心观点，制作通俗科普帖</li>
          <li>信息图：将论文数据或框架可视化</li>
          <li>图片 Prompt：生成与论文主题相关的概念图</li>
          <li>网页解读：深度解读论文对 AI 行业的启示</li>
        </ul>
      </div>
    </div>
    `);
  } else if (st === 'culture-art') {
    sections.push(`
    <div class="section">
      <div class="section-title">🎨 作品介绍</div>
      <div class="section-body">${brief ? escapeHtml(truncate(extractFirstParagraph(brief), 400)) : '<p>暂无作品介绍。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">👁️ 视觉元素</div>
      <div class="section-body">${facts.length > 0 ? `<ul>${facts.map(f => `<li>${escapeHtml(truncate(f, 200))}</li>`).join('')}</ul>` : '<p>暂无视觉元素描述。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">🎭 风格特征</div>
      <div class="section-body"><p>${signal?.style || signal?.period || '艺术风格信息待补充。'}</p></div>
    </div>
    `);
  } else if (st === 'ai-ecosystem') {
    sections.push(`
    <div class="section">
      <div class="section-title">🤖 模型能力</div>
      <div class="section-body">${brief ? escapeHtml(truncate(extractFirstParagraph(brief), 400)) : '<p>暂无模型能力描述。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">📥 输入输出</div>
      <div class="section-body">${facts.length > 0 ? `<ul>${facts.map(f => `<li>${escapeHtml(truncate(f, 200))}</li>`).join('')}</ul>` : '<p>暂无输入输出说明。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">🎯 适合场景</div>
      <div class="section-body"><p>AI 内容生成、模型评测、创意素材库扩展。</p></div>
    </div>
    `);
  } else if (st === 'dev-community') {
    sections.push(`
    <div class="section">
      <div class="section-title">💬 社区讨论</div>
      <div class="section-body">${brief ? escapeHtml(truncate(extractFirstParagraph(brief), 400)) : '<p>暂无社区讨论摘要。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">😤 开发者痛点</div>
      <div class="section-body">${facts.length > 0 ? `<ul>${facts.map(f => `<li>${escapeHtml(truncate(f, 200))}</li>`).join('')}</ul>` : '<p>暂无痛点分析。</p>'}</div>
    </div>
    `);
  } else {
    // Default / context
    sections.push(`
    <div class="section">
      <div class="section-title">📖 背景信息</div>
      <div class="section-body">${brief ? escapeHtml(truncate(extractFirstParagraph(brief), 400)) : '<p>暂无背景信息。</p>'}</div>
    </div>
    `);
  }

  return sections.join('\n');
}

function generatePackPage(pack: PackData, detail: any, dedupItem: DedupItem | null): string {
  const st = pack.source_types[0] || 'unknown';
  const stLabel = ST_LABELS[st] || st;
  const stColor = ST_COLORS[st] || '#5b5bd6';

  const title = detail.title || pack.title || '未命名';
  const oneSentence = detail.one_sentence_summary || '';
  const background = detail.background || '';
  const whyItMatters = detail.why_it_matters || '';
  const recommendedUses = detail.recommended_uses || pack.recommended_assets || [];
  const availableAssets = detail.available_assets || {};
  const tags = detail.tags || pack.tags || [];
  const score = detail.score || pack.score || 0;
  const date = detail.date || pack.date || '';
  const uncertainty = detail.uncertainty_notes || '';

  // Read richer source files
  const packDir = pack.pack_dir;
  const briefText = safeReadText(join(ASSETS, packDir, 'brief.md'), '');
  const factsText = safeReadText(join(ASSETS, packDir, 'facts.md'), '');
  const xpostText = safeReadText(join(ASSETS, packDir, 'x-post.zh.md'), '');
  const signalJson = safeReadJson<any>(join(ASSETS, packDir, 'signal.json'), {});
  const sourceJson = safeReadJson<any>(join(ASSETS, packDir, 'source.json'), {});
  const facts = extractFacts(factsText);

  // Build use items
  const useItems = recommendedUses.map((use: string) => {
    const info = USE_LABELS[use] || { label: use, icon: '•' };
    return `<li><span class="use-icon">${info.icon}</span> ${info.label}</li>`;
  }).join('\n');

  // Build tag pills
  const tagPills = tags.slice(0, 8).map((t: string) =>
    `<span class="tag">${escapeHtml(t)}</span>`
  ).join('');

  // Asset links
  const baseUrl = `https://conanxin.github.io/creative-quota-assets/${packDir}`;

  const assetLinks: string[] = [];
  if (availableAssets.brief) assetLinks.push(`<a class="asset-link" href="${baseUrl}/brief.md" target="_blank">📋 brief.md</a>`);
  if (availableAssets.facts) assetLinks.push(`<a class="asset-link" href="${baseUrl}/facts.md" target="_blank">📊 facts.md</a>`);
  if (availableAssets.x_post_zh) assetLinks.push(`<a class="asset-link" href="${baseUrl}/x-post.zh.md" target="_blank">🐦 x-post.zh.md</a>`);
  if (availableAssets.image_prompt) assetLinks.push(`<a class="asset-link" href="${baseUrl}/image-prompt.md" target="_blank">🎨 image-prompt.md</a>`);
  if (availableAssets.video_prompt) assetLinks.push(`<a class="asset-link" href="${baseUrl}/video-prompt.md" target="_blank">🎬 video-prompt.md</a>`);
  if (availableAssets.music_prompt) assetLinks.push(`<a class="asset-link" href="${baseUrl}/music-prompt.md" target="_blank">🎵 music-prompt.md</a>`);
  if (availableAssets.webpage_outline) assetLinks.push(`<a class="asset-link" href="${baseUrl}/webpage-outline.md" target="_blank">🌐 webpage-outline.md</a>`);
  assetLinks.push(`<a class="asset-link" href="${baseUrl}/content-summary.zh.md" target="_blank">📝 content-summary.zh.md</a>`);
  assetLinks.push(`<a class="asset-link" href="${baseUrl}/detail.json" target="_blank">🔧 detail.json</a>`);

  // Prompt previews
  const promptPreviews: string[] = [];
  const imagePrompt = safeReadText(join(ASSETS, packDir, 'image-prompt.md'), '');
  if (imagePrompt) {
    promptPreviews.push(`
      <div class="prompt-card">
        <h4>🎨 图片 Prompt</h4>
        <pre class="prompt-preview">${escapeHtml(truncate(imagePrompt, 600))}</pre>
        <a class="prompt-link" href="${baseUrl}/image-prompt.md" target="_blank">查看完整文件 →</a>
      </div>
    `);
  }
  const videoPrompt = safeReadText(join(ASSETS, packDir, 'video-prompt.md'), '');
  if (videoPrompt) {
    promptPreviews.push(`
      <div class="prompt-card">
        <h4>🎬 视频 Prompt</h4>
        <pre class="prompt-preview">${escapeHtml(truncate(videoPrompt, 600))}</pre>
        <a class="prompt-link" href="${baseUrl}/video-prompt.md" target="_blank">查看完整文件 →</a>
      </div>
    `);
  }
  const musicPrompt = safeReadText(join(ASSETS, packDir, 'music-prompt.md'), '');
  if (musicPrompt) {
    promptPreviews.push(`
      <div class="prompt-card">
        <h4>🎵 音乐 Prompt</h4>
        <pre class="prompt-preview">${escapeHtml(truncate(musicPrompt, 600))}</pre>
        <a class="prompt-link" href="${baseUrl}/music-prompt.md" target="_blank">查看完整文件 →</a>
      </div>
    `);
  }

  // Generated images section
  let genImagesHtml = '';
  if (pack.has_generated_image) {
    genImagesHtml = '<div class="info-box">📸 该 Content Pack 关联了已生成图片（图片展示功能开发中）</div>';
  } else {
    genImagesHtml = '<div class="info-box">🎨 当前还没有生成图片，但 Prompt 已就绪。你可以使用上面的 Prompt 生成图片。</div>';
  }

  // Version history
  let versionHtml = '';
  if (dedupItem && dedupItem.version_count > 1) {
    const versionLinks = dedupItem.versions.map(v => {
      const vUrl = `https://conanxin.github.io/creative-quota-assets/${v.detail_page_path}`;
      return `<li><a href="${vUrl}" target="_blank">${escapeHtml(v.title)}</a> · 📅 ${v.date} · ⭐ ${v.score.toFixed(3)} · ${ST_LABELS[v.source_type] || v.source_type}</li>`;
    }).join('\n');
    versionHtml = `
    <div class="section">
      <div class="section-title">📚 历史版本 / 相关内容包（${dedupItem.version_count} 个）</div>
      <ul class="version-list">
        ${versionLinks}
      </ul>
    </div>
    `;
  }

  // Source-specific section
  const sourceSpecific = generateSourceSpecificSection(st, briefText, facts, xpostText, signalJson, sourceJson);

  // Navigation
  const dateParts = date.split('-');
  const year = dateParts[0] || '2026';
  const month = dateParts[1] || '06';
  const dailyUrl = `/creative-quota-assets/daily/${year}/${month}/${date}/`;

  return `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — AI 创意素材库</title>
  <style>
    :root {
      --bg: #f7f4ef;
      --card-bg: #ffffff;
      --card-border: #e8e4dd;
      --text: #2c2c2c;
      --text-muted: #7a7570;
      --accent: #5b5bd6;
      --accent-dim: rgba(91,91,214,0.08);
      --tag-bg: rgba(91,91,214,0.08);
      --tag-text: #5b5bd6;
      --green: #22c55e;
      --info-bg: #f0f4ff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem 1rem;
      line-height: 1.6;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .nav { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .nav a { color: var(--accent); text-decoration: none; font-size: 0.85rem; }
    .nav a:hover { text-decoration: underline; }
    .header { margin-bottom: 2rem; }
    .source-badge {
      display: inline-block; font-size: 0.7rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.05em;
      color: ${stColor}; background: ${stColor}15;
      padding: 0.2rem 0.6rem; border-radius: 4px; margin-bottom: 0.5rem;
    }
    .title { font-size: 1.8rem; font-weight: 700; line-height: 1.3; margin-bottom: 0.5rem; }
    .meta { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .score { font-size: 0.85rem; color: var(--text-muted); }
    .date { font-size: 0.85rem; color: var(--text-muted); }
    .tags { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .tag { font-size: 0.65rem; background: var(--tag-bg); color: var(--tag-text); padding: 0.1rem 0.4rem; border-radius: 4px; }
    .section { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .section-title { font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--card-border); }
    .section-body { font-size: 0.9rem; color: var(--text); line-height: 1.7; }
    .section-body p { margin-bottom: 0.75rem; }
    .section-body ul { margin-left: 1.2rem; margin-bottom: 0.75rem; }
    .section-body li { margin-bottom: 0.3rem; }
    .one-sentence { font-size: 1.05rem; font-weight: 500; color: var(--text); background: var(--info-bg); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--accent); margin-bottom: 1.5rem; }
    .use-list { list-style: none; }
    .use-list li { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0; }
    .use-icon { font-size: 1.1rem; }
    .asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.5rem; }
    .asset-link {
      display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem;
      color: var(--accent); background: var(--accent-dim); text-decoration: none;
      padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid var(--accent);
    }
    .asset-link:hover { background: rgba(91,91,214,0.15); }
    .prompt-card { background: var(--bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .prompt-card h4 { font-size: 0.9rem; font-weight: 600; margin-bottom: 0.5rem; }
    .prompt-preview {
      font-size: 0.78rem; color: var(--text-muted); background: #fff; border: 1px solid var(--card-border);
      border-radius: 4px; padding: 0.6rem; max-height: 200px; overflow: auto;
      white-space: pre-wrap; word-break: break-word; margin-bottom: 0.5rem;
    }
    .prompt-link { font-size: 0.8rem; color: var(--accent); text-decoration: none; }
    .prompt-link:hover { text-decoration: underline; }
    .info-box { background: var(--info-bg); border: 1px solid var(--accent); border-radius: 8px; padding: 1rem; font-size: 0.9rem; color: var(--text); }
    .uncertainty { font-size: 0.85rem; color: var(--text-muted); font-style: italic; }
    .version-list { list-style: none; }
    .version-list li { padding: 0.3rem 0; font-size: 0.85rem; }
    .version-list a { color: var(--accent); text-decoration: none; }
    .version-list a:hover { text-decoration: underline; }
    footer { text-align: center; color: var(--text-muted); font-size: 0.78rem; border-top: 1px solid var(--card-border); padding-top: 1.5rem; margin-top: 2rem; }
    footer a { color: var(--accent); text-decoration: none; }
    @media (max-width: 720px) {
      body { padding: 0.75rem; }
      .title { font-size: 1.4rem; }
      .section { padding: 1rem; }
      .asset-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/creative-quota-assets/gallery/">← 返回 Gallery</a>
      <a href="/creative-quota-assets/daily/">📅 每日归档</a>
      ${date ? `<a href="${dailyUrl}">📅 ${date} 当天</a>` : ''}
      <a href="https://github.com/conanxin/creative-quota-assets">GitHub</a>
    </div>
    <div class="header">
      <div class="source-badge">${stLabel}</div>
      <h1 class="title">${escapeHtml(title)}</h1>
      <div class="meta">
        ${score ? `<span class="score">评分: ${score.toFixed(3)}</span>` : ''}
        ${date ? `<span class="date">📅 ${date}</span>` : ''}
      </div>
      <div class="tags">${tagPills}</div>
    </div>
    ${oneSentence ? `<div class="one-sentence">${escapeHtml(oneSentence)}</div>` : ''}
    ${background ? `
    <div class="section">
      <div class="section-title">📖 背景与来源</div>
      <div class="section-body">${escapeHtml(background)}</div>
    </div>` : ''}
    ${sourceSpecific}
    ${whyItMatters ? `
    <div class="section">
      <div class="section-title">💡 为什么值得关注</div>
      <div class="section-body">${escapeHtml(whyItMatters)}</div>
    </div>` : ''}
    ${useItems ? `
    <div class="section">
      <div class="section-title">🎯 可以怎么用</div>
      <ul class="use-list section-body">${useItems}</ul>
    </div>` : ''}
    <div class="section">
      <div class="section-title">📁 已有素材</div>
      <div class="asset-grid">${assetLinks.join('\n')}</div>
    </div>
    ${promptPreviews.length > 0 ? `
    <div class="section">
      <div class="section-title">📝 Prompt 预览</div>
      ${promptPreviews.join('\n')}
    </div>` : ''}
    <div class="section">
      <div class="section-title">🖼️ 已生成图片</div>
      ${genImagesHtml}
    </div>
    ${versionHtml}
    ${uncertainty ? `
    <div class="section">
      <div class="section-title">⚠️ 不确定性说明</div>
      <div class="uncertainty">${escapeHtml(uncertainty)}</div>
    </div>` : ''}
    <div class="section">
      <div class="section-title">🔧 开发者文件</div>
      <div class="asset-grid">
        <a class="asset-link" href="${baseUrl}/manifest.json" target="_blank">📄 manifest.json</a>
        <a class="asset-link" href="${baseUrl}/detail.json" target="_blank">📄 detail.json</a>
        <a class="asset-link" href="${baseUrl}/signal.json" target="_blank">📄 signal.json</a>
        <a class="asset-link" href="${baseUrl}/source.json" target="_blank">📄 source.json</a>
        <a class="asset-link" href="${baseUrl}/asset-plan.json" target="_blank">📄 asset-plan.json</a>
      </div>
    </div>
    <footer>
      <p>Creative Quota Assets · AI 创意素材库</p>
      <p>提示协议：CC-BY 4.0 · 元数据：MIT</p>
    </footer>
  </div>
</body>
</html>`;
}

function main() {
  const cpIndex = safeReadJson<{ content_packs: PackData[] }>(
    join(ASSETS, 'metadata', 'content-pack-index.json'),
    { content_packs: [] }
  );

  // Read dedup index for version history
  const dedupIndex = safeReadJson<{ items: DedupItem[] }>(
    join(ASSETS, 'metadata', 'gallery-dedup-index.json'),
    { items: [] }
  );

  // Build map from pack_dir to dedup item
  const dedupMap: Record<string, DedupItem> = {};
  for (const item of dedupIndex.items) {
    for (const v of item.versions) {
      dedupMap[v.pack_dir] = item;
    }
  }

  let generated = 0;
  for (const pack of cpIndex.content_packs) {
    const packDir = pack.pack_dir;
    const detailPath = join(ASSETS, packDir, 'detail.json');
    const detail = safeReadJson<any>(detailPath, {});
    const dedupItem = dedupMap[packDir] || null;

    const html = generatePackPage(pack, detail, dedupItem);
    writeFileSync(join(ASSETS, packDir, 'index.html'), html);
    generated++;
  }

  console.log(`[build-content-pack-pages] Generated ${generated} enriched pages`);
}

main();
