#!/usr/bin/env tsx
/**
 * scripts/build-content-pack-pages.ts
 *
 * Generates human-readable index.html pages for each Content Pack.
 * Reads detail.json, content-summary.zh.md, and other pack files.
 * Outputs index.html next to each pack's manifest.json.
 *
 * No LLM calls. No MiniMax. Pure static HTML generation.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

function safeReadJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch { return fallback; }
}

function safeReadText(path: string, fallback = ''): string {
  try {
    return readFileSync(path, 'utf8');
  } catch { return fallback; }
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

function mdToHtml(md: string): string {
  // Simple markdown-to-HTML conversion
  let html = escapeHtml(md);
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  return '<p>' + html + '</p>';
}

// Source type labels
const ST_LABELS: Record<string, string> = {
  code: '开源项目',
  academic: '学术研究',
  'ai-ecosystem': 'AI模型生态',
  'dev-community': '开发者社区',
  'culture-art': '文化艺术',
  context: '日期与天气',
  news: '新闻',
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
}

function generatePackPage(pack: PackData, detail: any, summaryMd: string): string {
  const st = pack.source_types[0] || 'unknown';
  const stLabel = ST_LABELS[st] || st;
  const stColor = st === 'code' ? '#5b5bd6' : st === 'academic' ? '#22c55e' : st === 'culture-art' ? '#f59e0b' : '#5b5bd6';
  
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
  const packDir = pack.pack_dir;
  const baseUrl = `https://conanxin.github.io/creative-quota-assets/${packDir}`;
  
  const assetLinks: string[] = [];
  if (availableAssets.brief) {
    assetLinks.push(`<a class="asset-link" href="${baseUrl}/brief.md" target="_blank">📋 brief.md</a>`);
  }
  if (availableAssets.facts) {
    assetLinks.push(`<a class="asset-link" href="${baseUrl}/facts.md" target="_blank">📊 facts.md</a>`);
  }
  if (availableAssets.x_post_zh) {
    assetLinks.push(`<a class="asset-link" href="${baseUrl}/x-post.zh.md" target="_blank">🐦 x-post.zh.md</a>`);
  }
  if (availableAssets.image_prompt) {
    assetLinks.push(`<a class="asset-link" href="${baseUrl}/image-prompt.md" target="_blank">🎨 image-prompt.md</a>`);
  }
  if (availableAssets.video_prompt) {
    assetLinks.push(`<a class="asset-link" href="${baseUrl}/video-prompt.md" target="_blank">🎬 video-prompt.md</a>`);
  }
  if (availableAssets.music_prompt) {
    assetLinks.push(`<a class="asset-link" href="${baseUrl}/music-prompt.md" target="_blank">🎵 music-prompt.md</a>`);
  }
  if (availableAssets.webpage_outline) {
    assetLinks.push(`<a class="asset-link" href="${baseUrl}/webpage-outline.md" target="_blank">🌐 webpage-outline.md</a>`);
  }
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
    // Try to find generated images for this pack
    genImagesHtml = '<div class="info-box">📸 该 Content Pack 关联了已生成图片（图片展示功能开发中）</div>';
  } else {
    genImagesHtml = '<div class="info-box">🎨 当前还没有生成图片，但 Prompt 已就绪。你可以使用上面的 Prompt 生成图片。</div>';
  }
  
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
    
    /* Navigation */
    .nav { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .nav a { color: var(--accent); text-decoration: none; font-size: 0.85rem; }
    .nav a:hover { text-decoration: underline; }
    
    /* Header */
    .header { margin-bottom: 2rem; }
    .source-badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${stColor};
      background: ${stColor}15;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    .title { font-size: 1.8rem; font-weight: 700; line-height: 1.3; margin-bottom: 0.5rem; }
    .meta { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .score { font-size: 0.85rem; color: var(--text-muted); }
    .date { font-size: 0.85rem; color: var(--text-muted); }
    .tags { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .tag { font-size: 0.65rem; background: var(--tag-bg); color: var(--tag-text); padding: 0.1rem 0.4rem; border-radius: 4px; }
    
    /* Sections */
    .section { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .section-title { font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--card-border); }
    .section-body { font-size: 0.9rem; color: var(--text); line-height: 1.7; }
    .section-body p { margin-bottom: 0.75rem; }
    .section-body h2, .section-body h3 { font-size: 1rem; font-weight: 600; margin: 1rem 0 0.5rem; }
    .section-body ul { margin-left: 1.2rem; margin-bottom: 0.75rem; }
    .section-body li { margin-bottom: 0.3rem; }
    .section-body strong { color: var(--accent); }
    
    /* One sentence */
    .one-sentence { font-size: 1.05rem; font-weight: 500; color: var(--text); background: var(--info-bg); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--accent); margin-bottom: 1.5rem; }
    
    /* Use list */
    .use-list { list-style: none; }
    .use-list li { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0; }
    .use-icon { font-size: 1.1rem; }
    
    /* Asset grid */
    .asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.5rem; }
    .asset-link {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.8rem;
      color: var(--accent);
      background: var(--accent-dim);
      text-decoration: none;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      border: 1px solid var(--accent);
    }
    .asset-link:hover { background: rgba(91,91,214,0.15); }
    
    /* Prompt cards */
    .prompt-card { background: var(--bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .prompt-card h4 { font-size: 0.9rem; font-weight: 600; margin-bottom: 0.5rem; }
    .prompt-preview {
      font-size: 0.78rem;
      color: var(--text-muted);
      background: #fff;
      border: 1px solid var(--card-border);
      border-radius: 4px;
      padding: 0.6rem;
      max-height: 200px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      margin-bottom: 0.5rem;
    }
    .prompt-link { font-size: 0.8rem; color: var(--accent); text-decoration: none; }
    .prompt-link:hover { text-decoration: underline; }
    
    /* Info box */
    .info-box { background: var(--info-bg); border: 1px solid var(--accent); border-radius: 8px; padding: 1rem; font-size: 0.9rem; color: var(--text); }
    
    /* Uncertainty */
    .uncertainty { font-size: 0.85rem; color: var(--text-muted); font-style: italic; }
    
    /* Footer */
    footer { text-align: center; color: var(--text-muted); font-size: 0.78rem; border-top: 1px solid var(--card-border); padding-top: 1.5rem; margin-top: 2rem; }
    footer a { color: var(--accent); text-decoration: none; }
    
    /* Mobile */
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
    </div>
    ` : ''}
    
    ${whyItMatters ? `
    <div class="section">
      <div class="section-title">💡 为什么值得关注</div>
      <div class="section-body">${escapeHtml(whyItMatters)}</div>
    </div>
    ` : ''}
    
    ${useItems ? `
    <div class="section">
      <div class="section-title">🎯 可以怎么用</div>
      <ul class="use-list section-body">
        ${useItems}
      </ul>
    </div>
    ` : ''}
    
    <div class="section">
      <div class="section-title">📁 已有素材</div>
      <div class="asset-grid">
        ${assetLinks.join('\n')}
      </div>
    </div>
    
    ${promptPreviews.length > 0 ? `
    <div class="section">
      <div class="section-title">📝 Prompt 预览</div>
      ${promptPreviews.join('\n')}
    </div>
    ` : ''}
    
    <div class="section">
      <div class="section-title">🖼️ 已生成图片</div>
      ${genImagesHtml}
    </div>
    
    ${uncertainty ? `
    <div class="section">
      <div class="section-title">⚠️ 不确定性说明</div>
      <div class="uncertainty">${escapeHtml(uncertainty)}</div>
    </div>
    ` : ''}
    
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
  
  let generated = 0;
  let updated = 0;
  
  for (const pack of cpIndex.content_packs) {
    const packDir = pack.pack_dir;
    const detailPath = join(ASSETS, packDir, 'detail.json');
    const summaryPath = join(ASSETS, packDir, 'content-summary.zh.md');
    const indexPath = join(ASSETS, packDir, 'index.html');
    
    const detail = safeReadJson<any>(detailPath, {});
    const summaryMd = safeReadText(summaryPath, '');
    
    const html = generatePackPage(pack, detail, summaryMd);
    
    writeFileSync(indexPath, html);
    generated++;
    
    // Update content-pack-index with new paths
    if (!pack.detail_page_path) {
      pack.detail_page_path = `${packDir}/index.html`;
      updated++;
    }
    if (!pack.summary_md_path) {
      pack.summary_md_path = `${packDir}/content-summary.zh.md`;
    }
    if (!pack.detail_json_path) {
      pack.detail_json_path = `${packDir}/detail.json`;
    }
  }
  
  // Write updated content-pack-index.json
  writeFileSync(
    join(ASSETS, 'metadata', 'content-pack-index.json'),
    JSON.stringify(cpIndex, null, 2) + '\n'
  );
  
  console.log(`[build-content-pack-pages] Generated ${generated} pages, updated ${updated} index entries`);
}

main();
