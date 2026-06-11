#!/usr/bin/env tsx
/**
 * scripts/build-static-gallery.ts
 *
 * Pre-renders gallery/index.html with embedded content (stats, content packs, generated images).
 * Ensures page displays content even if JS fetch fails.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

function safeReadJson<T>(path: string, fallback: T): T {
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

interface PackEntry {
  title: string;
  source_types: string[];
  score?: number;
  tags: string[];
  pack_dir: string;
  detail_path?: string;
  summary_path?: string;
  one_sentence_summary?: string;
  recommended_assets?: string[];
  date?: string;
}

interface ImageEntry {
  filename: string;
  title: string;
  url: string;
  thumbnail?: string;
  full?: string;
  model?: string;
  generated_at?: string;
  description_zh?: string;
  prompt_summary_zh?: string;
  recommended_use_zh?: string;
  source_content_pack?: string;
}

interface GenAsset {
  id?: string;
  filename?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  full?: string;
  model?: string;
  generated_at?: string;
  content_pack?: string;
}

interface GenDesc {
  filename?: string;
  asset_id?: string;
  description_zh?: string;
  prompt_summary_zh?: string;
  recommended_use_zh?: string;
  source_content_pack?: string;
  title?: string;
}

interface GalleryAsset {
  id?: string;
  filename?: string;
  title?: string;
  type?: string;
  url?: string;
  thumbnail?: string;
  full?: string;
  model?: string;
  generated_at?: string;
  content_pack_dir?: string;
  content_pack?: string;
  description_zh?: string;
  prompt_summary_zh?: string;
  recommended_use_zh?: string;
  source_content_pack?: string;
  one_sentence_summary?: string;
  recommended_uses?: string[];
  source_types?: string[];
  score?: number;
  tags?: string[];
  detail_path?: string;
  summary_path?: string;
}

// Load all data
const cpIndex = safeReadJson<{ content_packs: PackEntry[] }>(
  join(ASSETS, 'metadata', 'content-pack-index.json'), { content_packs: [] }
);
const genAssets = safeReadJson<GenAsset[]>(
  join(ASSETS, 'metadata', 'generated-assets.json'), []);
const genDescs = safeReadJson<GenDesc[]>(
  join(ASSETS, 'metadata', 'generated-image-descriptions.json'), []);
const oldAssets = safeReadJson<{ assets: GalleryAsset[] }>(
  join(ASSETS, 'gallery', 'assets.json'), { assets: [] });

// Build image lookup by filename/id
const descByFilename: Record<string, GenDesc> = {};
for (const d of genDescs) {
  const key = d.filename || d.asset_id || '';
  if (key) descByFilename[key] = d;
}

// Build old assets lookup
const oldByFilename: Record<string, GalleryAsset> = {};
for (const a of oldAssets.assets) {
  const key = a.filename || a.id || '';
  if (key) oldByFilename[key] = a;
}

// Stats
const packs = cpIndex.content_packs;
const packDirs = new Set(packs.map(p => p.pack_dir));
const srcSet = new Set(packs.flatMap(p => p.source_types || []));

// All dates for "last updated"
const allItems = [
  ...packs.map(p => p.date || ''),
  ...genAssets.map(g => g.generated_at || ''),
].filter(Boolean).sort().reverse();
const lastDate = allItems[0] || '';

// Generated images
const genImages: GalleryAsset[] = genAssets.map(ga => {
  const fname = ga.filename || ga.id || '';
  const desc = descByFilename[fname] || {};
  const existing = oldByFilename[fname] || {};
  return {
    id: ga.id || fname,
    filename: fname,
    title: ga.title || desc.title || fname,
    type: 'image',
    url: ga.url || '',
    thumbnail: existing.thumbnail || existing.url || '',
    full: existing.full || existing.url || '',
    model: ga.model || 'image-01',
    generated_at: ga.generated_at || '',
    content_pack_dir: ga.content_pack || '',
    description_zh: desc.description_zh || '',
    prompt_summary_zh: desc.prompt_summary_zh || '',
    recommended_use_zh: desc.recommended_use_zh || '',
    source_content_pack: desc.source_content_pack || '',
  };
});

// Content pack cards (for embedding in HTML)
const stLabels: Record<string, string> = {
  code: '开源', academic: '学术', 'ai-ecosystem': 'AI生态',
  'dev-community': '社区', 'culture-art': '艺术', context: '上下文',
  news: '新闻', 'culture-art': '艺术',
};

const useLabels: Record<string, string> = {
  brief: '📋 Brief', facts: '📊 Facts', x_post_zh: '🐦推文',
  image_prompt: '🎨 图片', video_prompt: '🎬 视频',
  music_prompt: '🎵 音乐', webpage_outline: '🌐 网页',
  generated_images: '🖼️ 生成图',
};

const packCardsHtml = packs.sort((a, b) => (b.score || 0) - (a.score || 0)).map(pack => {
  const stLabel = stLabels[(pack.source_types || [])[0]] || (pack.source_types || [])[0] || '—';
  const score = pack.score ? `评分: ${pack.score.toFixed(3)}` : '';
  const tags = (pack.tags || []).slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('');
  const uses = (pack.recommended_assets || []).map(u =>
    `<span class="use-chip">${useLabels[u] || u}</span>`
  ).join('');
  const summary = pack.one_sentence_summary || '';

  // Detail path: convert "content-packs/.../detail.json" to GitHub Pages URL
  const detailPath = pack.detail_path
    ? `https://conanxin.github.io/creative-quota-assets/${pack.detail_path}`
    : '';
  const summaryPath = pack.summary_path
    ? `https://conanxin.github.io/creative-quota-assets/${pack.summary_path}`
    : '';

  return ` <div class="pack-card">
    <div class="pack-header">
      <span class="pack-type">${stLabel}</span>
      <div class="pack-title">${pack.title}</div>
      ${score ? `<div class="pack-score">${score}</div>` : ''}
    </div>
    ${summary ? `<div class="pack-summary">${summary}</div>` : ''}
    ${tags ? `<div class="pack-tags">${tags}</div>` : ''}
    ${uses ? `<div class="pack-uses">${uses}</div>` : ''}
    <div class="pack-links">
      ${detailPath ? `<a class="pack-link" href="${detailPath}" target="_blank">📋 详情</a>` : ''}
      ${summaryPath ? `<a class="pack-link" href="${summaryPath}" target="_blank">📝 摘要</a>` : ''}
    </div>
  </div>`;
}).join('\n');

// Generated image cards
const genImagesHtml = genImages.length > 0 ? genImages.map(img => {
  const imgTitle = img.title || img.filename || '';
  const imgDate = (img.generated_at || '').slice(0, 10);
  const desc = img.description_zh || img.prompt_summary_zh || '';
  const recommendedUse = img.recommended_use_zh || '';
  const sourceCp = img.source_content_pack || '';
  const imgUrl = img.url || img.thumbnail || '';
  const thumbUrl = img.thumbnail || img.url || '';

  return `  <div class="gen-img-card">
    ${imgUrl ? `<a href="${imgUrl}" target="_blank"><img src="${thumbUrl}" alt="${imgTitle}" loading="lazy"></a>` : ''}
    <div class="gen-img-info">
      <div class="gen-img-title">${imgTitle}</div>
      ${imgDate ? `<div class="gen-img-date">${imgDate}</div>` : ''}
      ${desc ? `<div class="gen-img-desc">${desc}</div>` : ''}
      ${recommendedUse ? `<div class="gen-img-use">${recommendedUse}</div>` : ''}
      ${sourceCp ? `<div class="gen-img-source">来源: ${sourceCp}</div>` : ''}
    </div>
  </div>`;
}).join('\n') : '  <div class="empty-note">暂无生成图片</div>';

// Load existing gallery HTML to preserve structure/style
const existingHtml = existsSync(join(ASSETS, 'gallery', 'index.html'))
  ? readFileSync(join(ASSETS, 'gallery', 'index.html'), 'utf8')
  : '';

// Extract key parts from existing HTML
function extract(html: string, start: string, end: string): string {
  const s = html.indexOf(start);
  if (s < 0) return '';
  const e = html.indexOf(end, s + start.length);
  if (e < 0) return '';
  return html.slice(s + start.length, e);
}

// Build new HTML - preserve existing structure, replace content area
let newHtml = existingHtml;

// Replace stats
newHtml = newHtml.replace(
  /<div class="stat-val" id="statPacks">—<\/div>/,
  `<div class="stat-val" id="statPacks">${packDirs.size}</div>`
);
newHtml = newHtml.replace(
  /<div class="stat-val" id="statImages">—<\/div>/,
  `<div class="stat-val" id="statImages">${genImages.length}</div>`
);
newHtml = newHtml.replace(
  /<div class="stat-val" id="statSources">—<\/div>/,
  `<div class="stat-val" id="statSources">${srcSet.size}</div>`
);
newHtml = newHtml.replace(
  /<div class="stat-val" id="statUpdated">—<\/div>/,
  `<div class="stat-val" id="statUpdated">${lastDate ? lastDate.slice(5) : '—'}</div>`
);

// Show generated images section if we have images
if (genImages.length > 0) {
  newHtml = newHtml.replace(
    /<div class="gen-images" id="genImagesSection" style="display:none">/,
    `<div class="gen-images" id="genImagesSection" style="display:block">`
  );
}

// Pre-render pack grid (embed in HTML as fallback)
// The JS will still load and render, but initial HTML has content
// We mark the pre-rendered section so JS can skip it
const PRE_RENDERED_MARKER = '<!-- PRE-RENDERED-CONTENT -->';
const preRenderedPacks = `<div id="pre-rendered-packs" style="display:none">\n${packCardsHtml}\n</div>`;

if (!newHtml.includes(PRE_RENDERED_MARKER)) {
  // Inject pre-rendered content before the grid div
  newHtml = newHtml.replace(
    /(<div id="grid"[^>]*>)/,
    `$1\n${PRE_RENDERED_MARKER}\n${preRenderedPacks}`
  );
}

// Update the loading state check - if pre-rendered content exists, don't show loading
newHtml = newHtml.replace(
  /<div class="loading">正在加载素材…<\/div>/,
  `<div class="loading" id="loading-indicator">正在加载素材…</div>`
);

// Write updated HTML
writeFileSync(join(ASSETS, 'gallery', 'index.html'), newHtml);

// Also write a standalone static version for reference
const staticOnly = `<!-- Static gallery - no JS required to view content -->
<!DOCTYPE HTML>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI 创意素材库 - Creative Quota Assets</title>
<style>
:root { --bg: #f7f4ef; --card: #fff; --accent: #c84b31; --text: #2d2d2d; --muted: #777; }
body { font-family: -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 0; }
.container { max-width: 1100px; margin: 0 auto; padding: 1rem; }
.header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; flex-wrap: wrap; gap: 0.5rem; }
.title { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
.badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: var(--accent); color: white; font-size: 0.8rem; text-decoration: none; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
.stat-card { background: var(--card); border-radius: 12px; padding: 1rem; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.stat-val { font-size: 1.75rem; font-weight: 700; color: var(--accent); }
.stat-lbl { font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem; }
.section-title { font-size: 1.1rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
.pack-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.pack-card { background: var(--card); border-radius: 12px; padding: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.pack-header { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; }
.pack-type { font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: var(--accent); color: white; white-space: nowrap; }
.pack-title { font-weight: 600; font-size: 0.95rem; flex: 1; }
.pack-score { font-size: 0.75rem; color: var(--muted); }
.pack-summary { font-size: 0.85rem; color: var(--text); margin-bottom: 0.5rem; line-height: 1.4; }
.pack-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.5rem; }
.tag { font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 4px; background: #f0ede8; color: var(--muted); }
.pack-uses { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.5rem; }
.use-chip { font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: #e8f5e9; color: #2e7d32; }
.pack-links { display: flex; gap: 0.5rem; font-size: 0.8rem; }
.pack-link { color: var(--accent); text-decoration: none; }
.pack-link:hover { text-decoration: underline; }
.footer { text-align: center; padding: 2rem 0; color: var(--muted); font-size: 0.8rem; }
.nav-links { display: flex; gap: 1rem; font-size: 0.85rem; }
.nav-links a { color: var(--accent); text-decoration: none; }
.nav-links a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="title">📚 AI 创意素材库</div>
    <div class="nav-links">
      <a href="/creative-quota-assets/daily/">📅 每日归档</a>
    </div>
  </div>

  <div class="stats">
    <div class="stat-card"><div class="stat-val">${packDirs.size}</div><div class="stat-lbl">Content Packs</div></div>
    <div class="stat-card"><div class="stat-val">${genImages.length}</div><div class="stat-lbl">已生成图片</div></div>
    <div class="stat-card"><div class="stat-val">${srcSet.size}</div><div class="stat-lbl">信号来源</div></div>
    <div class="stat-card"><div class="stat-val">${lastDate ? lastDate.slice(5) : '—'}</div><div class="stat-lbl">最后更新</div></div>
  </div>

  <div class="section-title">📦 Content Packs（${packs.length}）</div>
  <div class="pack-grid">
${packs.sort((a, b) => (b.score || 0) - (a.score || 0)).map(pack => {
  const stLabel = stLabels[(pack.source_types || [])[0]] || (pack.source_types || [])[0] || '—';
  const score = pack.score ? `评分: ${pack.score.toFixed(3)}` : '';
  const tags = (pack.tags || []).slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('');
  const uses = (pack.recommended_assets || []).map(u => `<span class="use-chip">${useLabels[u] || u}</span>`).join('');
  const summary = pack.one_sentence_summary || '';
  const detailPath = pack.detail_path ? `https://conanxin.github.io/creative-quota-assets/${pack.detail_path}` : '';
  const summaryPath = pack.summary_path ? `https://conanxin.github.io/creative-quota-assets/${pack.summary_path}` : '';
  return `<div class="pack-card">
    <div class="pack-header">
      <span class="pack-type">${stLabel}</span>
      <div class="pack-title">${pack.title}</div>
    </div>
    ${score ? `<div class="pack-score">${score}</div>` : ''}
    ${summary ? `<div class="pack-summary">${summary}</div>` : ''}
    ${tags ? `<div class="pack-tags">${tags}</div>` : ''}
    ${uses ? `<div class="pack-uses">${uses}</div>` : ''}
    <div class="pack-links">
      ${detailPath ? `<a class="pack-link" href="${detailPath}" target="_blank">📋 详情</a>` : ''}
      ${summaryPath ? `<a class="pack-link" href="${summaryPath}" target="_blank">📝 摘要</a>` : ''}
    </div>
  </div>`;
}).join('\n')}
  </div>

  ${genImages.length > 0 ? `
  <div class="section-title">🖼️ 已生成图片（${genImages.length}）</div>
  <div class="pack-grid">
${genImages.map(img => {
  const imgTitle = img.title || img.filename || '';
  const imgDate = (img.generated_at || '').slice(0, 10);
  const desc = img.description_zh || img.prompt_summary_zh || '';
  const recommendedUse = img.recommended_use_zh || '';
  const imgUrl = img.url || img.thumbnail || '';
  const thumbUrl = img.thumbnail || img.url || '';
  return `<div class="pack-card">
    ${imgUrl ? `<a href="${imgUrl}" target="_blank" style="display:block;text-align:center"><img src="${thumbUrl}" alt="${imgTitle}" style="max-width:100%;max-height:200px;border-radius:8px;"></a>` : ''}
    <div style="margin-top:0.5rem">
      <div class="pack-title">${imgTitle}</div>
      ${imgDate ? `<div class="pack-score">${imgDate}</div>` : ''}
      ${desc ? `<div class="pack-summary">${desc}</div>` : ''}
      ${recommendedUse ? `<div class="pack-uses"><span class="use-chip">${recommendedUse}</span></div>` : ''}
    </div>
  </div>`;
}).join('\n')}
  </div>` : ''}

  <div class="footer">
    <p>由<a href="https://github.com/conanxin/creative-quota-assets">Creative Quota Harvester</a> 自动生成</p>
    <p>最后更新: ${lastDate || '—'}</p>
  </div>
</div>
</body>
</html>`;

writeFileSync(join(ASSETS, 'gallery', 'static.html'), staticOnly);

console.log(`Static gallery built:`);
console.log(`  - ${packs.length} Content Packs embedded`);
console.log(`  - ${genImages.length} Generated images embedded`);
console.log(`  - Stats: ${packDirs.size} packs, ${genImages.length} images, ${srcSet.size} sources`);
console.log(`  - Last updated: ${lastDate || '—'}`);
console.log(`  - Output: gallery/index.html (enhanced)`);
console.log(`  - Static: gallery/static.html (standalone, no JS required)`);