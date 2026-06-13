#!/usr/bin/env tsx
/**
 * scripts/build-gallery-from-dedup.ts
 *
 * Generates gallery/index.html from gallery-dedup-index.json.
 * Produces deduplicated cards with rich content.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

function safeReadJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; }
  catch { return fallback; }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

// Template question detector
const TEMPLATE_QUESTIONS = [
  /这个开源项目解决了什么开发痛点[？?]/,
  /研究方法有什么独特之处[？?]/,
  /这个模型\/数据集代表了哪类AI能力的新高度[？?]/,
  /有哪些实操经验值得分享[？?]/,
  /艺术品背后有什么文化故事[？?]/,
  /Content Angle[：:]/,
  /领域动态[：:]/,
];

function containsTemplateQuestion(text: string): boolean {
  if (!text) return false;
  return TEMPLATE_QUESTIONS.some(q => q.test(text));
}

function cleanWhy(text: string): string {
  if (!text) return '';
  if (containsTemplateQuestion(text)) return '';
  return text;
}

// Colors
const ST_COLORS: Record<string, string> = {
  code: '#5b5bd6', academic: '#22c55e', 'ai-ecosystem': '#f59e0b',
  'dev-community': '#ec4899', 'culture-art': '#f97316', context: '#6b7280', news: '#3b82f6',
};

const ST_LABELS: Record<string, string> = {
  code: '开源项目', academic: '学术研究', 'ai-ecosystem': 'AI模型生态',
  'dev-community': '开发者社区', 'culture-art': '文化艺术', context: '日期与天气', news: '新闻',
};

const USE_ICONS: Record<string, string> = {
  x_post: 'X帖', image: '图片', video: '视频', music: '音乐', webpage: '网页',
  brief: '简报', facts: '事实', x_post_zh: 'X帖', image_prompt: '图片', video_prompt: '视频',
  music_prompt: '音乐', webpage_outline: '网页', generated_images: '生成图',
};

interface DedupItem {
  canonical_key: string;
  title: string;
  source_type: string;
  source_label_zh: string;
  primary_pack_dir: string;
  version_count: number;
  versions: { pack_dir: string; title: string; date: string; score: number; source_type: string; detail_page_path: string }[];
  score: number;
  one_sentence_summary: string;
  why_it_matters: string;
  recommended_uses: string[];
  generated_images: any[];
  detail_page_path: string;
  tags: string[];
}

function main() {
  const dedup = safeReadJson<{ generated_at: string; total_packs: number; unique_topics: number; duplicates_collapsed: number; items: DedupItem[] }>(
    join(ASSETS, 'metadata', 'gallery-dedup-index.json'),
    { generated_at: '', total_packs: 0, unique_topics: 0, duplicates_collapsed: 0, items: [] }
  );

  const genAssets = safeReadJson<any[]>(join(ASSETS, 'metadata', 'generated-assets.json'), []);

  // Generate pack cards
  const packCards = dedup.items.map(item => {
    const st = item.source_type || 'unknown';
    const stLabel = item.source_label_zh || ST_LABELS[st] || st;
    const stColor = ST_COLORS[st] || '#5b5bd6';
    const score = item.score;
    const title = item.title;
    const oneSentence = item.one_sentence_summary || '';
    const why = cleanWhy(item.why_it_matters) || '';
    const tags = (item.tags || []).slice(0, 5).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const uses = (item.recommended_uses || []).slice(0, 3).map(u => {
      const label = USE_ICONS[u] || u;
      return `<span class="use-chip">${escapeHtml(label)}</span>`;
    }).join('');
    const versionBadge = item.version_count > 1 ? `<span class="version-badge">${item.version_count} 个版本</span>` : '';
    const genImageCount = item.generated_images?.length || 0;
    const genImageBadge = genImageCount > 0 ? `<span class="gen-badge">🖼️ ${genImageCount}</span>` : '';
    // Phase 4G: detect enhanced prompt on the primary pack
    const primaryDir = item.primary_pack_dir;
    const hasEnhanced = existsSync(join(ASSETS, primaryDir, 'image-prompt.enriched.md'));
    const enhancedBadge = hasEnhanced ? `<span class="enhanced-badge" title="Phase 4G: 来源感知图片 Prompt 增强">✨ 增强图片 Prompt 已就绪</span>` : '';
    // Phase 4H: detect enhanced video prompt on the primary pack
    const hasEnhancedVideo = existsSync(join(ASSETS, primaryDir, 'video-prompt.enriched.md'));
    const enhancedVideoBadge = hasEnhancedVideo ? `<span class="enhanced-badge enhanced-video-badge" title="Phase 4H: 来源感知视频 Prompt 增强">🎥 增强视频 Prompt 已就绪</span>` : '';

    const detailUrl = `https://conanxin.github.io/creative-quota-assets/${item.detail_page_path}`;
    const summaryUrl = `https://conanxin.github.io/creative-quota-assets/${item.primary_pack_dir}/content-summary.zh.md`;
    const detailJsonUrl = `https://conanxin.github.io/creative-quota-assets/${item.primary_pack_dir}/detail.json`;

    const whyShort = why ? `<div class="card-why">${escapeHtml(truncate(why, 200))}</div>` : '';

    // Phase 4H: enrich uses with video prompt tags
    let usesHtml = uses;
    if (hasEnhancedVideo) {
      // Add video-related uses to the card
      const videoUses = '<span class="use-chip">短视频</span><span class="use-chip">动态图形</span>';
      usesHtml = usesHtml + videoUses;
    }

    return `      <article class="asset-card pack-card" data-source-type="${escapeHtml(st)}" data-kind="content-pack">
  <div class="card-header">
    <span class="card-type" style="color:${stColor};background:${stColor}15">${escapeHtml(stLabel)}</span>
    ${versionBadge}
    ${genImageBadge}
    ${enhancedBadge}
    ${enhancedVideoBadge}
    <h3 class="card-title">${escapeHtml(title)}</h3>
    <div class="card-score">评分: ${score.toFixed(3)}</div>
  </div>
  ${oneSentence ? `<div class="card-one-sentence">${escapeHtml(truncate(oneSentence, 200))}</div>` : ''}
  ${whyShort}
  <div class="card-tags">${tags}</div>
  ${usesHtml ? `<div class="card-uses">${usesHtml}</div>` : ''}
  <div class="card-actions">
    <a class="btn-primary" href="${detailUrl}" target="_blank">📋 详情</a>
    <a class="btn-secondary" href="${summaryUrl}" target="_blank">📝 摘要原文</a>
    <a class="btn-secondary" href="${detailJsonUrl}" target="_blank">🔧 原始数据</a>
  </div>
</article>`;
  }).join('\n');

  // Generate image cards
  // Phase 3E: Load quality scores for image cards
  const qualityTable = safeReadJson<{ rows: any[] }>(join(ASSETS, 'metadata', 'asset-quality-scores.json'), { rows: [] });
  const QUALITY_LABELS_ZH: Record<string, string> = {
    excellent: '⭐ 优秀',
    good: '✅ 良好',
    fair: '⚠️ 一般',
    poor: '❌ 较差',
  };
  const QUALITY_COLORS: Record<string, string> = {
    excellent: '#22c55e',
    good: '#5b5bd6',
    fair: '#f59e0b',
    poor: '#ef4444',
  };

  const imageCards = genAssets.map((img: any) => {
    const title = img.title || img.filename || '';
    const date = (img.generated_at || '').slice(0, 10);
    // Use the actual path from generated-assets.json; fall back to filename
    const url = img.url || `https://conanxin.github.io/creative-quota-assets/${img.path || `images/${img.filename}`}`;
    const model = img.model || 'image-01';
    // Look up quality score
    const qs = qualityTable.rows.find((r: any) => r.filename === img.filename);
    const qualityLabel = qs?.quality_label ? QUALITY_LABELS_ZH[qs.quality_label] : '未评分';
    const qualityColor = qs?.quality_label ? QUALITY_COLORS[qs.quality_label] : '#6b7280';
    const scoreText = qs ? `${qs.score}/100` : '';
    const reviewUrl = qs?.review_md_url || '';
    const usesHtml = qs?.recommended_uses?.slice(0, 2).map((u: string) =>
      `<span class="use-chip">${escapeHtml(u)}</span>`).join('') || '';
    const qualityBadge = qs
      ? `<span class="quality-badge" style="color:${qualityColor};background:${qualityColor}15">${qualityLabel} · ${scoreText}</span>`
      : '';
    return `      <article class="asset-card image-card" data-source-type="${escapeHtml(img.source_type || 'code')}" data-kind="generated-image">
        <div class="image-frame">
          <img src="${escapeHtml(url)}" alt="${escapeHtml(title)}" loading="lazy">
        </div>
        <div class="image-body">
          <div class="image-header-row">${qualityBadge}</div>
          <div class="image-desc">${escapeHtml(title)}</div>
          <div class="image-meta">${escapeHtml(model)} · ${date} · ${escapeHtml(img.aspect_ratio || '')}</div>
          <div class="image-uses">${usesHtml}</div>
          <div class="image-actions">
            <a class="btn-secondary" href="${escapeHtml(url)}" target="_blank">查看原图</a>
            ${reviewUrl ? `<a class="btn-secondary" href="${escapeHtml(reviewUrl)}" target="_blank">📋 质量评审</a>` : ''}
          </div>
        </div>
      </article>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 创意素材库</title>
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
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem 1rem;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 2rem;
      padding: 1.5rem 1rem;
      background: linear-gradient(135deg, #f5f0e8 0%, #ebe5db 100%);
      border-radius: 16px;
      border: 1px solid var(--card-border);
    }
    .header h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem; }
    .header .subtitle { font-size: 0.9rem; color: var(--text-muted); }
    .header .status {
      display: inline-flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .header .status span {
      font-size: 0.7rem;
      background: var(--accent-dim);
      color: var(--accent);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 0.75rem;
      margin-bottom: 2rem;
    }
    .stat {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1rem;
      text-align: center;
    }
    .stat-number { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
    .stat-label { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }
    .stat-dedup { font-size: 0.65rem; color: var(--green); margin-top: 0.2rem; }
    .filters {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .filter-btn {
      font-size: 0.8rem;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      border: 1px solid var(--card-border);
      background: var(--card-bg);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover, .filter-btn.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .section-title .count {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 400;
    }
    .asset-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .image-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .image-card { padding: 0; overflow: hidden; }
    .image-frame {
      width: 100%;
      height: 160px;
      overflow: hidden;
      border-bottom: 1px solid var(--card-border);
    }
    .image-frame img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .image-body { padding: 1rem; }
    .image-header-row { display: flex; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0.3rem; }
    .quality-badge {
      font-size: 0.65rem; font-weight: 700;
      padding: 0.15rem 0.5rem; border-radius: 4px;
      display: inline-block;
    }
    .image-uses { display: flex; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
    .image-actions { display: flex; gap: 0.3rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .image-desc { font-size: 0.85rem; font-weight: 500; margin-bottom: 0.3rem; }
    .image-meta { font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.5rem; }
    .asset-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem;
      transition: box-shadow 0.2s;
      display: flex;
      flex-direction: column;
    }
    .asset-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .asset-card.hidden { display: none; }
    .card-header { margin-bottom: 0.75rem; }
    .card-type {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 0.5rem;
    }
    .version-badge {
      font-size: 0.65rem;
      background: var(--green);
      color: #fff;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      margin-left: 0.5rem;
      display: inline-block;
    }
    .gen-badge {
      font-size: 0.65rem;
      background: var(--accent-dim);
      color: var(--accent);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      margin-left: 0.5rem;
      display: inline-block;
    }
    .enhanced-badge {
      font-size: 0.65rem;
      background: linear-gradient(135deg, #5b5bd6 0%, #ec4899 100%);
      color: #fff;
      padding: 0.15rem 0.5rem;
      border-radius: 8px;
      margin-left: 0.5rem;
      display: inline-block;
      font-weight: 600;
    }
    .enhanced-video-badge {
      background: linear-gradient(135deg, #f59e0b 0%, #ec4899 100%);
    }
    .card-title { font-size: 1.1rem; font-weight: 600; line-height: 1.3; margin-bottom: 0.3rem; }
    .card-score { font-size: 0.8rem; color: var(--text-muted); }
    .card-one-sentence {
      font-size: 0.85rem;
      color: var(--text);
      line-height: 1.5;
      margin-bottom: 0.5rem;
      padding: 0.5rem;
      background: var(--accent-dim);
      border-radius: 6px;
      border-left: 3px solid var(--accent);
    }
    .card-why {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 0.5rem;
    }
    .card-tags {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
      margin-bottom: 0.5rem;
    }
    .tag {
      font-size: 0.65rem;
      background: var(--tag-bg);
      color: var(--tag-text);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }
    .card-uses {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
      margin-bottom: 0.75rem;
    }
    .use-chip {
      font-size: 0.7rem;
      background: var(--accent-dim);
      color: var(--accent);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      border: 1px solid var(--accent);
    }
    .card-actions {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      margin-top: auto;
    }
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      font-size: 0.75rem;
      color: #fff;
      background: var(--accent);
      text-decoration: none;
      padding: 0.3rem 0.7rem;
      border-radius: 6px;
      font-weight: 600;
    }
    .btn-primary:hover { background: #4a4ac0; }
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      font-size: 0.75rem;
      color: var(--accent);
      background: var(--accent-dim);
      text-decoration: none;
      padding: 0.3rem 0.7rem;
      border-radius: 6px;
      font-weight: 600;
      border: 1px solid var(--accent);
    }
    .btn-secondary:hover { background: rgba(91,91,214,0.15); }
    .footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.8rem;
      border-top: 1px solid var(--card-border);
      padding-top: 1.5rem;
      margin-top: 2rem;
    }
    .footer a { color: var(--accent); text-decoration: none; }
    .empty-state {
      text-align: center;
      padding: 2rem;
      color: var(--text-muted);
      display: none;
    }
    .empty-state.visible { display: block; }
    @media (max-width: 720px) {
      body { padding: 0.75rem; }
      .header h1 { font-size: 1.4rem; }
      .asset-grid { grid-template-columns: 1fr; }
      .filters { overflow-x: auto; flex-wrap: nowrap; }
      .stat { padding: 0.75rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AI 创意素材库</h1>
      <div class="subtitle">从真实信号生成的 Creative Brief 与素材</div>
      <div class="status">
        <span>✅ 已接入真实信号源</span>
        <span>✅ 已生成 Content Packs</span>
        <span>✅ 已包含 MiniMax 图片素材</span>
        <span>✨ Phase 4G 增强 Prompt</span>
      </div>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-number">${dedup.unique_topics}</div>
        <div class="stat-label">去重主题</div>
        <div class="stat-dedup">${dedup.total_packs} 原始 / ${dedup.duplicates_collapsed} 去重</div>
      </div>
      <div class="stat">
        <div class="stat-number">${genAssets.length}</div>
        <div class="stat-label">已生成图片</div>
      </div>
      <div class="stat">
        <div class="stat-number">${new Set(dedup.items.map(i => i.source_type)).size}</div>
        <div class="stat-label">信号来源</div>
      </div>
      <div class="stat">
        <div class="stat-number">${dedup.generated_at.slice(5, 10)}</div>
        <div class="stat-label">最后更新</div>
      </div>
    </div>
    <div class="filters">
      <button class="filter-btn active" data-filter="all">全部</button>
      <button class="filter-btn" data-filter="code">开源项目</button>
      <button class="filter-btn" data-filter="academic">学术研究</button>
      <button class="filter-btn" data-filter="ai-ecosystem">AI生态</button>
      <button class="filter-btn" data-filter="dev-community">开发者社区</button>
      <button class="filter-btn" data-filter="culture-art">文化艺术</button>
      <button class="filter-btn" data-filter="context">日期与天气</button>
    </div>
    <div class="section-title">
      📦 Content Packs
      <span class="count">${dedup.unique_topics} 个主题（${dedup.total_packs} 个原始包）</span>
    </div>
    <div class="asset-grid" id="pack-grid">
${packCards}
    </div>
    <div class="empty-state" id="empty-state">
      暂无匹配素材，请切换筛选条件。
    </div>
    <div class="section-title">
      🖼️ 已生成图片
      <span class="count">${genAssets.length} 张</span>
    </div>
    <div class="image-grid" id="image-grid">
${imageCards}
    </div>
    <div class="footer">
      <p>Creative Quota Assets · AI 创意素材库</p>
      <p>
        <a href="daily/">📅 每日归档</a> ·
        <a href="https://github.com/conanxin/creative-quota-assets">GitHub</a> ·
        提示协议 CC-BY 4.0 · 元数据 MIT
      </p>
    </div>
  </div>
  <script>
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        const cards = document.querySelectorAll('.asset-card');
        let visible = 0;
        cards.forEach(card => {
          if (filter === 'all' || card.dataset.sourceType === filter) {
            card.classList.remove('hidden');
            visible++;
          } else {
            card.classList.add('hidden');
          }
        });
        document.getElementById('empty-state').classList.toggle('visible', visible === 0);
      });
    });
  </script>
</body>
</html>`;

  writeFileSync(join(ASSETS, 'gallery', 'index.html'), html);
  console.log(`[build-gallery-from-dedup] ${dedup.unique_topics} unique topics, ${genAssets.length} images → gallery/index.html`);
}

main();
