#!/usr/bin/env tsx
/**
 * scripts/build-daily-archive.ts — Phase 4E-1
 *
 * Builds the daily calendar archive with correct date attribution:
 * - Content Packs → grouped by pack date (created_at from manifest.json)
 * - Generated Images → grouped by image generation date (generated_at from metadata)
 *
 * Outputs:
 * - daily/calendar-index.json
 * - daily/index.html
 * - daily/YYYY/MM/YYYY-MM-DD/index.html
 * - daily/YYYY/MM/YYYY-MM-DD/daily-summary.json
 *
 * Idempotent: can be run multiple times.
 * No MiniMax calls. No external LLM.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';

const ASSETS    = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';
const DAILY_DIR = join(ASSETS, 'daily');

function safeReadJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return fallback; }
}
function ensureDir(path: string) {
  try { mkdirSync(path, { recursive: true }); } catch {}
}

// ── Data types ─────────────────────────────────────────
interface PackEntry {
  title: string;
  source_types: string[];
  score: number;
  tags: string[];
  detail_path: string;
  summary_path: string;
  recommended_assets: string[];
  created_at: string; // YYYY-MM-DD
}

interface ImageEntry {
  filename: string;
  url: string;
  title: string;
  model: string;
  description_zh: string;
  generated_at: string; // YYYY-MM-DD
  source_content_pack: string;
}

interface DayData {
  date: string;
  packs: PackEntry[];
  images: ImageEntry[];
}

// ── Parse image date from generated_at or filename ──────
function parseImageDate(img: any): string {
  // Priority1: generated_at field
  const genAt = img.generated_at || img.created_at || '';
  if (genAt) {
    const date = genAt.slice(0, 10); // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  }
  // Priority 2: filename like cqa-2026-06-11-canary-001_001.jpg
  const filename = img.filename || img.id || '';
  const m = filename.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  // Fallback: content pack date
  return '';
}

// ── Collect Content Packs by pack creation date ─────────
function collectPacksByDate(): Record<string, PackEntry[]> {
  const byDate: Record<string, PackEntry[]> = {};
  const cpIndex = safeReadJson<any>(join(ASSETS, 'metadata', 'content-pack-index.json'), {});
  for (const pack of (cpIndex.content_packs || [])) {
    const date = (pack.date || '').slice(0, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push({
      title: pack.title || '',
      source_types: pack.source_types || [],
      score: pack.score || 0,
      tags: pack.tags || [],
      detail_path: pack.detail_path || '',
      summary_path: pack.summary_path || '',
      recommended_assets: pack.recommended_assets || [],
      created_at: date,
    });
  }
  return byDate;
}

// ── Collect Images by generation date ──────────────────
function collectImagesByDate(): Record<string, ImageEntry[]> {
  const byDate: Record<string, ImageEntry[]> = {};
  const genAssets = safeReadJson<any[]>(join(ASSETS, 'metadata', 'generated-assets.json'), []);
  const genDescs  = safeReadJson<any[]>(join(ASSETS, 'metadata', 'generated-image-descriptions.json'), []);

  for (const img of genAssets) {
    const date = parseImageDate(img);
    if (!date) continue;
    if (!byDate[date]) byDate[date] = [];
    const desc = genDescs.find((d: any) =>
      d.filename === img.filename || d.asset_id === img.id
    );
    byDate[date].push({
      filename: img.filename || img.id || '',
      url: img.url || img.thumbnail || img.full || '',
      title: img.title || img.filename || '',
      model: img.model || 'image-01',
      description_zh: desc?.description_zh || desc?.prompt_summary_zh || '',
      generated_at: date,
      source_content_pack: img.content_pack || desc?.source_content_pack || '',
    });
  }
  return byDate;
}

// ── Build merged day data ────────────────────────────────
function buildDays(): Record<string, DayData> {
  const packsByDate = collectPacksByDate();
  const imagesByDate = collectImagesByDate();

  const allDates = new Set([
    ...Object.keys(packsByDate),
    ...Object.keys(imagesByDate),
  ]);

  const days: Record<string, DayData> = {};
  for (const date of allDates) {
    const packs = packsByDate[date] || [];
    const images = imagesByDate[date] || [];
    days[date] = { date, packs, images };
  }
  return days;
}

// ── Build calendar-index.json ───────────────────────────
function buildCalendarIndex(days: Record<string, DayData>) {
  const stLabels: Record<string, string> = {
    code: '开源', academic: '学术', 'ai-ecosystem': 'AI生态',
    'dev-community': '社区', 'culture-art': '艺术', context: '上下文',
  };

  const dayEntries = Object.keys(days).sort().reverse().map(date => {
    const day = days[date];
    const sourceTypes = [...new Set(day.packs.flatMap(p => p.source_types))];
    const topTitles = day.packs.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5).map(p => p.title);
    const [year, month] = date.split('-');
    return {
      date,
      content_pack_count: day.packs.length,
      generated_image_count: day.images.length,
      source_types: sourceTypes,
      source_labels_zh: sourceTypes.map(t => stLabels[t] || t),
      top_titles: topTitles.filter(Boolean),
      detail_url: `/creative-quota-assets/daily/${year}/${month}/${date}/`,
    };
  });

  const index = {
    generated_at: new Date().toISOString(),
    total_days: dayEntries.length,
    days: dayEntries,
  };

  ensureDir(DAILY_DIR);
  writeFileSync(join(DAILY_DIR, 'calendar-index.json'), JSON.stringify(index, null, 2), 'utf8');
  console.log(`[archive:daily] calendar-index.json: ${dayEntries.length} days`);
  return index;
}

// ── Build daily/index.html ───────────────────────────────
function buildCalendarHtml() {
  const stLabels: Record<string, string> = {
    code: '开源', academic: '学术', 'ai-ecosystem': 'AI生态',
    'dev-community': '社区', 'culture-art': '艺术', context: '上下文',
  };
  const days = Object.values(buildDays()).sort((a, b) => b.date.localeCompare(a.date));

  const dayCards = days.map(day => {
    const sourceTypes = [...new Set(day.packs.flatMap(p => p.source_types))];
    const stLabelsZh = sourceTypes.map(t => stLabels[t] || t);
    const [year, month] = day.date.split('-');
    return `
    <div class="day-card">
      <div class="day-header">
        <div class="day-date">${day.date}</div>
        <div class="day-counts">
          <span class="count-badge">${day.packs.length} Content Packs</span>
          ${day.images.length > 0 ? `<span class="count-badge img">${day.images.length} 图片</span>` : ''}
        </div>
      </div>
      ${stLabelsZh.length > 0 ? `<div class="day-sources">${stLabelsZh.join(' · ')}</div>` : ''}
      <div class="day-note">${day.images.length > 0 && day.packs.length === 0 ? '📅 图片生成日' : ''}</div>
      <a class="day-link" href="/creative-quota-assets/daily/${year}/${month}/${day.date}/">查看当日内容 →</a>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>每日创意归档</title>
  <style>
    :root { --bg: #f7f4ef; --card-bg: #fff; --card-border: #e8e4dd; --text: #2c2c2c; --text-muted: #7a7570; --accent: #5b5bd6; --accent-dim: rgba(91,91,214,0.08); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; padding: 2rem 1rem; }
    .container { max-width: 1100px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 2.5rem; }
    header h1 { font-size: 2rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem; }
    header h1 span { color: var(--accent); }
    header p { color: var(--text-muted); font-size: 0.9rem; max-width: 600px; margin: 0 auto; }
    .date-legend { display: flex; gap: 1.5rem; justify-content: center; margin-top: 0.75rem; font-size: 0.78rem; color: var(--text-muted); }
    .legend-item { display: flex; align-items: center; gap: 0.3rem; }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
    .legend-dot.pack { background: var(--accent); }
    .legend-dot.img { background: #22c55e; }
    .nav-links { display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; }
    .nav-links a { color: var(--accent); text-decoration: none; font-size: 0.85rem; }
    .nav-links a:hover { text-decoration: underline; }
    .day-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
    .day-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 1rem; }
    .day-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
    .day-date { font-size: 1.1rem; font-weight: 700; color: var(--text); }
    .day-counts { display: flex; gap: 0.3rem; }
    .count-badge { font-size: 0.65rem; background: var(--accent-dim); color: var(--accent); padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid var(--accent); }
    .count-badge.img { background: rgba(34,197,94,0.08); border-color: #22c55e; color: #22c55e; }
    .day-sources { font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.4rem; }
    .day-note { font-size: 0.72rem; color: #22c55e; margin-bottom: 0.3rem; }
    .day-link { display: block; text-align: right; font-size: 0.78rem; color: var(--accent); text-decoration: none; }
    .day-link:hover { text-decoration: underline; }
    footer { max-width: 1100px; margin: 3rem auto 0; text-align: center; border-top: 1px solid var(--card-border); padding-top: 1.5rem; color: var(--text-muted); font-size: 0.78rem; }
    footer a { color: var(--accent); text-decoration: none; }
    footer a:hover { text-decoration: underline; }

    /* ── Mobile Responsive (max-width: 720px) ───────────────────── */
    @media (max-width: 720px) {
      body { padding: 0.75rem; }
      header { margin-bottom: 1.5rem; }
      header h1 { font-size: 1.4rem; }
      header p { font-size: 0.78rem; }
      .date-legend { flex-direction: column; gap: 0.4rem; align-items: center; }
      .day-grid { grid-template-columns: 1fr; gap: 0.75rem; }
      .day-card { padding: 0.9rem; }
      .day-date { font-size: 1rem; }
      .count-badge { font-size: 0.6rem; }
      .day-sources { font-size: 0.68rem; }
      .day-link { font-size: 0.75rem; }
      .nav-links a { font-size: 0.78rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span>📅</span> 每日创意归档</h1>
      <p>按日期浏览 Creative Quota Assets 每日采集的信号、Content Packs 和已生成内容</p>
      <div class="date-legend">
        <div class="legend-item"><div class="legend-dot pack"></div>Content Pack 日期（内容包创建日期）</div>
        <div class="legend-item"><div class="legend-dot img"></div>生成图片日期（实际图片生成日期）</div>
      </div>
      <div class="nav-links">
        <a href="/creative-quota-assets/gallery/">← 返回 Gallery</a>
        <a href="https://github.com/conanxin/creative-quota-assets">GitHub</a>
      </div>
    </header>
    <div class="day-grid">
      ${dayCards || '<div class="empty">暂无归档数据。</div>'}
    </div>
    <footer>
      <p>Creative Quota Assets · <a href="https://github.com/conanxin/creative-quota-assets">GitHub</a></p>
      <p>提示协议：CC-BY 4.0 · 元数据：MIT · 生成媒体：CC-BY-NC 4.0</p>
    </footer>
  </div>
</body>
</html>`;

  writeFileSync(join(DAILY_DIR, 'index.html'), html, 'utf8');
  console.log(`[archive:daily] daily/index.html written`);
}

// ── Build daily detail page ──────────────────────────────
function buildDayDetailPage(day: DayData) {
  const [year, month] = day.date.split('-');
  const dayDir = join(DAILY_DIR, year, month, day.date);
  ensureDir(dayDir);

  const stLabels: Record<string, string> = {
    code: '开源项目', academic: '学术研究', 'ai-ecosystem': 'AI 模型生态',
    'dev-community': '开发者社区', 'culture-art': '文化艺术', context: '日期与天气',
  };
  const useLabels: Record<string, string> = {
    'x-post': '🐦 X帖', 'image': '🎨 图片', 'video-prompt': '🎬 视频',
    'music': '🎵 音乐', 'webpage': '🌐 网页',
  };

  const sourceTypes = [...new Set(day.packs.flatMap(p => p.source_types))];

  const packCards = day.packs.sort((a, b) => (b.score || 0) - (a.score || 0)).map(pack => {
    const relPath = pack.detail_path
           ? pack.detail_path.replace(/\/[^/]+\/?$/, '/')
      : '';
    const hrefPrefix = relPath ? `../../../../${relPath}` : '';
    const useChips = pack.recommended_assets.map(u =>
      `<span class="use-chip">${useLabels[u] || u}</span>`
    ).join('');
    return `
    <div class="pack-card">
      <div class="pack-header">
        <span class="pack-type">${stLabels[(pack.source_types || [])[0]] || (pack.source_types || [])[0]}</span>
        <div class="pack-title">${pack.title}</div>
        ${pack.score > 0 ? `<div class="pack-score">评分: ${pack.score.toFixed(3)}</div>` : ''}
      </div>
      ${useChips ? `<div class="pack-uses">${useChips}</div>` : ''}
      <div class="pack-links">
        ${pack.detail_path ? `<a class="pack-link" href="${hrefPrefix}detail.json" target="_blank">📋 详情</a>` : ''}
        ${pack.summary_path ? `<a class="pack-link" href="${hrefPrefix}content-summary.zh.md" target="_blank">📝 摘要</a>` : ''}
      </div>
    </div>`;
  }).join('');

  const imageCards = day.images.map(img => {
    const cpShort = (img.source_content_pack || '').replace(/_/g, ' ').replace('brief-brief-', '').replace('brief-', '').slice(0, 50);
    return `
    <div class="img-card">
      <img src="${img.url}" alt="${img.title}" loading="lazy"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2200 400 200%22><rect fill=%22%23e5e7eb%22 width=%22400%22 height=%22200%22/><text x=%22200%22 y=%22100%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%239ca3af%22 font-size=%2214%22>Image unavailable</text></svg>'">
      <div class="img-info">
        <div class="img-name">${img.title || img.filename}</div>
        <div class="img-model">${img.model}</div>
        ${cpShort ? `<div class="img-source">来源: ${cpShort}</div>` : ''}
        ${img.description_zh ? `<div class="img-desc">${img.description_zh.slice(0, 100)}</div>` : ''}
        ${img.url.startsWith('http') ? `<a class="img-link" href="${img.url}" target="_blank">🔗 查看原图</a>` : ''}
      </div>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${day.date} 创意档案</title>
  <style>
    :root { --bg: #f7f4ef; --card-bg: #fff; --card-border: #e8e4dd; --text: #2c2c2c; --text-muted: #7a7570; --accent: #5b5bd6; --accent-dim: rgba(91,91,214,0.08); --green: #22c55e; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; padding: 2rem 1rem; }
    .container { max-width: 1100px; margin: 0 auto; }
    header { margin-bottom: 2rem; }
    header h1 { font-size: 1.8rem; font-weight: 700; color: var(--text); margin-bottom: 0.3rem; }
    header h1 span { color: var(--accent); }
    .nav-links { display: flex; gap: 1rem; margin-top: 0.75rem; }
    .nav-links a { color: var(--accent); text-decoration: none; font-size: 0.85rem; }
    .nav-links a:hover { text-decoration: underline; }
    .stats-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem; margin-bottom: 2rem; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 0.85rem 1rem; text-align: center; }
    .stat-val { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
    .stat-val.green { color: var(--green); }
    .stat-lbl { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem; }
    .section { margin-bottom: 2.5rem; }
    .section h2 { font-size: 1rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.75rem; border-bottom: 1px solid var(--card-border); padding-bottom: 0.5rem; }
    .pack-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .pack-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 1rem; }
    .pack-header { margin-bottom: 0.5rem; }
    .pack-type { display: inline-block; font-size: 0.65rem; font-weight: 700; color: var(--accent); background: var(--accent-dim); padding: 0.1rem 0.4rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.3rem; }
    .pack-title { font-size: 0.88rem; font-weight: 600; color: var(--text); }
    .pack-score { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem; }
    .pack-uses { display: flex; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
    .use-chip { font-size: 0.65rem; color: var(--accent); background: var(--accent-dim); border: 1px solid var(--accent); padding: 0.1rem 0.4rem; border-radius: 4px; }
    .pack-links { display: flex; gap: 0.5rem; }
    .pack-link { font-size: 0.72rem; color: var(--text-muted); text-decoration: none; }
    .pack-link:hover { color: var(--accent); }
    .img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .img-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; overflow: hidden; }
    .img-card img { width: 100%; height: 140px; object-fit: cover; display: block; }
    .img-info { padding: 0.6rem; }
    .img-name { font-size: 0.8rem; font-weight: 600; }
    .img-model { font-size: 0.68rem; color: var(--text-muted); }
    .img-source { font-size: 0.68rem; color: var(--green); margin-top: 0.2rem; }
    .img-desc { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.3rem; }
    .img-link { display: inline-block; font-size: 0.72rem; color: var(--accent); margin-top: 0.3rem; text-decoration: none; }
    .note { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem; padding: 0.6rem; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 8px; }
    footer { max-width: 1100px; margin: 3rem auto 0; text-align: center; border-top: 1px solid var(--card-border); padding-top: 1.5rem; color: var(--text-muted); font-size: 0.78rem; }
    footer a { color: var(--accent); text-decoration: none; }

    /* ── Mobile Responsive (max-width: 720px) ───────────────────── */
    @media (max-width: 720px) {
      body { padding: 0.75rem; }
      header h1 { font-size: 1.4rem; }
      .nav-links a { font-size: 0.78rem; }
      .stats-bar { grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 1.5rem; }
      .stat-card { padding: 0.6rem 0.4rem; }
      .stat-val { font-size: 1.2rem; }
      .stat-lbl { font-size: 0.6rem; }
      .pack-grid { grid-template-columns: 1fr; gap: 0.75rem; }
      .pack-card { padding: 0.85rem; }
      .pack-title { font-size: 0.85rem; }
      .img-grid { grid-template-columns: 1fr 1fr; }
      .img-card img { height: 120px; }
      .section h2 { font-size: 0.9rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span>📅</span> ${day.date} 创意档案</h1>
      <div class="nav-links">
        <a href="../../../">← 返回日历</a>
        <a href="/creative-quota-assets/gallery/">← Gallery</a>
      </div>
    </header>
    <div class="stats-bar">
      <div class="stat-card"><div class="stat-val">${day.packs.length}</div><div class="stat-lbl">Content Packs（当日创建）</div></div>
      <div class="stat-card"><div class="stat-val green">${day.images.length}</div><div class="stat-lbl">生成图片（当日生成）</div></div>
      <div class="stat-card"><div class="stat-val">${sourceTypes.length}</div><div class="stat-lbl">来源类型</div></div>
    </div>
    ${sourceTypes.length > 0 ? `
    <div class="section">
      <h2>来源类型</h2>
      <div>${sourceTypes.map(t => `<span class="use-chip">${stLabels[t] || t}</span>`).join(' ')}</div>
    </div>` : ''}
    ${day.packs.length > 0 ? `
    <div class="section">
      <h2>Content Packs（${day.packs.length}，创建于 ${day.date}）</h2>
      <div class="pack-grid">${packCards}</div>
    </div>` : ''}
    ${day.images.length > 0 ? `
    <div class="section">
      <h2>生成图片（${day.images.length}，生成于 ${day.date}）</h2>
      <div class="note">📅 图片可能来自更早创建的 Content Pack，已在下方标注来源</div>
      <div class="img-grid">${imageCards}</div>
    </div>` : ''}
    ${day.packs.length === 0 && day.images.length === 0 ? '<div class="note">当日暂无归档数据。</div>' : ''}
    <footer>
      <p>Creative Quota Assets · <a href="https://github.com/conanxin/creative-quota-assets">GitHub</a></p>
    </footer>
  </div>
</body>
</html>`;

  writeFileSync(join(dayDir, 'index.html'), html, 'utf8');

  const summary = {
    date: day.date,
    content_pack_count: day.packs.length,
    generated_image_count: day.images.length,
    source_types: sourceTypes,
    source_labels_zh: sourceTypes.map(t => stLabels[t] || t),
    top_packs: day.packs.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10).map(p => ({
      title: p.title, score: p.score, source_types: p.source_types,
    })),
    images: day.images.map(i => ({
      filename: i.filename,
      title: i.title,
      model: i.model,
      generated_at: i.generated_at,
      source_content_pack: i.source_content_pack,
    })),
    generated_at: new Date().toISOString(),
  };
  writeFileSync(join(dayDir, 'daily-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(`[archive:daily] ${day.date}/ written (${day.packs.length} packs, ${day.images.length} images)`);
}

// ── Main ─────────────────────────────────────────────────
function main() {
  console.log('[archive:daily] Starting Phase 4E-1 (date attribution fix)...');
  ensureDir(DAILY_DIR);

  const days = buildDays();
  console.log(`[archive:daily] Found ${Object.keys(days).length} days with content`);

  const index = buildCalendarIndex(days);
  buildCalendarHtml();

  for (const day of Object.values(days) as DayData[]) {
    if (day.packs.length > 0 || day.images.length > 0) {
      buildDayDetailPage(day);
    }
  }

  console.log('[archive:daily] Done.');
  process.exit(0);
}

main();