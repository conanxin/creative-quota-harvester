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
  content_pack_slug?: string;
}

interface DedupItem {
  canonical_key: string;
  title: string;
  source_type: string;
  primary_pack_dir: string;
  version_count: number;
  versions: { pack_dir: string; title: string; date: string; score: number; source_type: string; detail_page_path: string }[];
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

// Template questions to filter out
const TEMPLATE_QUESTIONS = [
  /这个开源项目解决了什么开发痛点[？?]/,
  /研究方法有什么独特之处[？?]/,
  /这个模型\/数据集代表了哪类AI能力的新高度[？?]/,
  /有哪些实操经验值得分享[？?]/,
  /艺术品背后有什么文化故事[？?]/,
  /Content Angle[：:]/,
  /Target Audience[：:]/,
  /领域动态[：:]/,
];

function containsTemplateQuestion(text: string): boolean {
  if (!text) return false;
  return TEMPLATE_QUESTIONS.some(q => q.test(text));
}

function cleanWhyItMatters(text: string): string {
  if (!text) return '';
  // If the text is mostly a template question, return empty so we can use a fallback
  if (containsTemplateQuestion(text)) return '';
  return text;
}

function extractMeaningfulContent(text: string): string {
  if (!text) return '';
  const lines = text.split('\n').filter(l => l.trim());
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('---')) continue;
    if (trimmed.startsWith('**ID:**')) continue;
    if (trimmed.startsWith('**Score:**')) continue;
    if (trimmed.startsWith('**Created:**')) continue;
    if (trimmed.startsWith('**Title:**')) continue;
    if (trimmed.startsWith('**来源类型：**')) continue;
    if (trimmed.startsWith('**日期：**')) continue;
    if (trimmed.startsWith('**评分：**')) continue;
    if (containsTemplateQuestion(trimmed)) continue;
    if (trimmed.length < 10) continue; // Skip very short lines
    return trimmed;
  }
  return '';
}

function extractBriefSummary(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  let inSummary = false;
  const summaryLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^#{1,3}\s*Summary/i)) { inSummary = true; continue; }
    if (trimmed.match(/^#{1,3}\s*Why/i)) { inSummary = false; continue; }
    if (trimmed.match(/^#{1,3}\s*Content/i)) { inSummary = false; continue; }
    if (trimmed.match(/^#{1,3}\s*Target/i)) { inSummary = false; continue; }
    if (trimmed.match(/^#{1,3}\s*Recommended/i)) { inSummary = false; continue; }
    if (trimmed.match(/^#{1,3}\s*Tags/i)) { inSummary = false; continue; }
    if (trimmed.match(/^#{1,3}\s*Uncertainty/i)) { inSummary = false; continue; }
    if (trimmed.match(/^#{1,3}\s*Source/i)) { inSummary = false; continue; }
    if (inSummary && trimmed && !trimmed.startsWith('#')) {
      summaryLines.push(trimmed);
    }
  }
  return summaryLines.join(' ').slice(0, 400);
}

function extractBriefBackground(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  let inBackground = false;
  const bgLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^#{1,3}\s*Background/i)) { inBackground = true; continue; }
    if (trimmed.match(/^#{1,3}\s*Why/i)) { inBackground = false; continue; }
    if (trimmed.match(/^#{1,3}\s*Content/i)) { inBackground = false; continue; }
    if (trimmed.match(/^#{1,3}\s*Summary/i)) { inBackground = false; continue; }
    if (inBackground && trimmed && !trimmed.startsWith('#')) {
      bgLines.push(trimmed);
    }
  }
  return bgLines.join(' ').slice(0, 400);
}

function extractXPostContent(text: string): string {
  if (!text) return '';
  const lines = text.split('\n').filter(l => {
    const t = l.trim();
    if (!t) return false;
    if (t.startsWith('#')) return false;
    if (t.startsWith('📌')) return false;
    if (containsTemplateQuestion(t)) return false;
    return true;
  });
  return lines.slice(0, 3).join(' ').slice(0, 300);
}

function extractSummaryBackground(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  let inBackground = false;
  const bgLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^#{1,3}\s*背景与来源/i)) { inBackground = true; continue; }
    if (trimmed.match(/^#{1,3}\s*为什么值得关注/i)) { inBackground = false; continue; }
    if (trimmed.match(/^#{1,3}\s*可以怎么用/i)) { inBackground = false; continue; }
    if (trimmed.match(/^#{1,3}\s*已有素材/i)) { inBackground = false; continue; }
    if (trimmed.match(/^#{1,3}\s*不确定性/i)) { inBackground = false; continue; }
    if (inBackground && trimmed && !trimmed.startsWith('#')) {
      bgLines.push(trimmed);
    }
  }
  return bgLines.join(' ').slice(0, 400);
}

function extractSummaryWhyMatters(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  let inWhy = false;
  const whyLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^#{1,3}\s*为什么值得关注/i)) { inWhy = true; continue; }
    if (trimmed.match(/^#{1,3}\s*可以怎么用/i)) { inWhy = false; continue; }
    if (trimmed.match(/^#{1,3}\s*已有素材/i)) { inWhy = false; continue; }
    if (trimmed.match(/^#{1,3}\s*不确定性/i)) { inWhy = false; continue; }
    if (inWhy && trimmed && !trimmed.startsWith('#')) {
      if (containsTemplateQuestion(trimmed)) continue;
      whyLines.push(trimmed);
    }
  }
  return whyLines.join(' ').slice(0, 400);
}

function generateSourceSpecificSection(st: string, brief: string, facts: string[], xpost: string, signal: any, source: any, summaryMd: string, factsText: string): string {
  const sections: string[] = [];

  // Use signal summary as primary content if available
  const signalSummary = signal?.summary || '';
  const briefSummary = extractBriefSummary(brief) || extractMeaningfulContent(brief);
  const primarySummary = signalSummary || briefSummary || extractSummaryBackground(summaryMd) || '';

  // Extract facts from facts.md, filtering out links-only entries
  const meaningfulFacts = facts.filter(f => {
    if (f.includes('github.com/') && f.length < 60) return false; // Skip bare links
    if (containsTemplateQuestion(f)) return false;
    return f.length > 10;
  }).slice(0, 5);

  const factsHtml = meaningfulFacts.length > 0
    ? `<ul>${meaningfulFacts.map(f => `<li>${escapeHtml(truncate(f, 250))}</li>`).join('')}</ul>`
    : '<p>现有信号不足，无法判断具体事实。可从上方已有素材中进一步挖掘。</p>';

  // Clean xpost content
  const cleanXpost = extractXPostContent(xpost) || extractSummaryWhyMatters(summaryMd) || '现有信号不足，无法判断具体受众。';

  // GitHub / source URL
  const sourceUrl = source?.source_urls?.[0] || '';
  const sourceUrlHtml = sourceUrl ? `<p><a href="${escapeHtml(sourceUrl)}" target="_blank">${escapeHtml(sourceUrl)}</a></p>` : '';

  if (st === 'code') {
    sections.push(`
    <div class="section">
      <div class="section-title">🚀 项目简介</div>
      <div class="section-body">${primarySummary ? escapeHtml(truncate(primarySummary, 400)) : '<p>现有信号不足，无法提供项目简介。</p>'}${sourceUrlHtml}</div>
    </div>
    <div class="section">
      <div class="section-title">💡 解决的问题</div>
      <div class="section-body">${factsHtml}</div>
    </div>
    <div class="section">
      <div class="section-title">👥 适合的用户</div>
      <div class="section-body">${cleanXpost ? escapeHtml(truncate(cleanXpost, 300)) : '<p>现有信号不足，无法判断具体受众。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">🔗 与 AI 内容生产的关系</div>
      <div class="section-body"><p>该项目涉及 AI 生成媒体技能（图像、视频、音频），与 Creative Quota 的创意素材库高度相关。可作为生成工具链或内容灵感来源。</p></div>
    </div>
    <div class="section">
      <div class="section-title">✨ 可生成内容建议</div>
      <div class="section-body">
        <ul>
          <li>X 线程：介绍项目核心能力与使用场景</li>
          <li>图片：生成项目概念图或工作流程图</li>
          <li>网页：制作项目速览或集成指南</li>
        </ul>
      </div>
    </div>
    `);
  } else if (st === 'academic') {
    const paperAbstract = primarySummary;
    sections.push(`
    <div class="section">
      <div class="section-title">📚 论文研究问题</div>
      <div class="section-body">${paperAbstract ? escapeHtml(truncate(paperAbstract, 400)) : '<p>现有信号不足，无法提供论文摘要。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">🔬 核心观点</div>
      <div class="section-body">${factsHtml}</div>
    </div>
    <div class="section">
      <div class="section-title">🎯 为什么值得关注</div>
      <div class="section-body">${cleanXpost ? escapeHtml(truncate(cleanXpost, 300)) : '<p>学术论文反映了该领域的前沿研究方向，对 AI 内容生产系统的理论基础和局限性认知有参考价值。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">📝 可以转化成哪些内容</div>
      <div class="section-body">
        <ul>
          <li>X 线程：提炼论文核心观点，制作通俗科普帖</li>
          <li>信息图：将论文数据或框架可视化</li>
          <li>图片 Prompt：生成与论文主题相关的概念图</li>
          <li>网页解读：深度解读论文对 AI 行业的启示</li>
        </ul>
      </div>
    </div>
    <div class="section">
      <div class="section-title">⚠️ 信息不确定性</div>
      <div class="section-body"><p>基于 arXiv 摘要和元数据，未获取论文全文。核心观点可能有偏差，建议阅读原文核实。</p></div>
    </div>
    `);
  } else if (st === 'culture-art') {
    const artworkDesc = primarySummary || briefSummary || '';
    sections.push(`
    <div class="section">
      <div class="section-title">🎨 作品 / 艺术品介绍</div>
      <div class="section-body">${artworkDesc ? escapeHtml(truncate(artworkDesc, 400)) : '<p>现有信号不足，无法提供作品介绍。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">👁️ 视觉元素</div>
      <div class="section-body">${factsHtml}</div>
    </div>
    <div class="section">
      <div class="section-title">🎭 风格特征</div>
      <div class="section-body"><p>${signal?.style || signal?.period || signal?.medium || '现有信号不足，无法判断具体风格。可参考艺术品所属博物馆或时期的典型风格。'}</p></div>
    </div>
    <div class="section">
      <div class="section-title">🎨 可转化成图片 Prompt 的角度</div>
      <div class="section-body">
        <ul>
          <li>复刻或致敬该作品风格</li>
          <li>提取作品中的色彩、构图元素</li>
          <li>生成与该作品主题相关的现代演绎</li>
        </ul>
      </div>
    </div>
    <div class="section">
      <div class="section-title">🖼️ 关联生成图片</div>
      <div class="section-body"><p>如有该主题生成的图片，将在此处展示。也可使用上方 Prompt 生成。</p></div>
    </div>
    `);
  } else if (st === 'ai-ecosystem') {
    const modelDesc = primarySummary || briefSummary || '';
    sections.push(`
    <div class="section">
      <div class="section-title">🤖 模型 / 项目能力</div>
      <div class="section-body">${modelDesc ? escapeHtml(truncate(modelDesc, 400)) : '<p>现有信号不足，无法提供模型能力描述。</p>'}${sourceUrlHtml}</div>
    </div>
    <div class="section">
      <div class="section-title">📥 输入输出</div>
      <div class="section-body">${factsHtml}</div>
    </div>
    <div class="section">
      <div class="section-title">🎯 适合场景</div>
      <div class="section-body"><p>AI 内容生成、模型评测、创意素材库扩展。具体场景取决于模型能力范围。</p></div>
    </div>
    <div class="section">
      <div class="section-title">💎 对内容生成系统的价值</div>
      <div class="section-body"><p>该模型可作为 Creative Quota 素材库的生成工具或参考基准，帮助评估同类模型的能力边界。</p></div>
    </div>
    <div class="section">
      <div class="section-title">✨ 可生成素材建议</div>
      <div class="section-body">
        <ul>
          <li>模型对比评测帖</li>
          <li>使用该模型生成的示例图片</li>
          <li>模型能力边界分析</li>
        </ul>
      </div>
    </div>
    `);
  } else if (st === 'dev-community') {
    const communityDesc = primarySummary || briefSummary || '';
    sections.push(`
    <div class="section">
      <div class="section-title">💬 社区讨论点</div>
      <div class="section-body">${communityDesc ? escapeHtml(truncate(communityDesc, 400)) : '<p>现有信号不足，无法提供社区讨论摘要。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">😤 开发者痛点</div>
      <div class="section-body">${factsHtml}</div>
    </div>
    <div class="section">
      <div class="section-title">📝 可转化的内容角度</div>
      <div class="section-body">
        <ul>
          <li>社区热议话题总结</li>
          <li>痛点分析与解决方案探讨</li>
          <li>工具推荐与使用技巧</li>
        </ul>
      </div>
    </div>
    `);
  } else {
    // Default / context
    const bgDesc = primarySummary || briefSummary || extractSummaryBackground(summaryMd) || '';
    sections.push(`
    <div class="section">
      <div class="section-title">📖 背景信息</div>
      <div class="section-body">${bgDesc ? escapeHtml(truncate(bgDesc, 400)) : '<p>现有信号不足，无法提供背景信息。</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">🎯 适合生成的氛围内容</div>
      <div class="section-body"><p>基于日期、天气或节气背景，生成与之匹配的氛围图片、短文案或音乐。</p></div>
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

  // Phase 4G: detect enhanced prompt
  const hasEnhancedPrompt = existsSync(join(ASSETS, packDir, 'image-prompt.enriched.md'));
  const enhancedBadge = hasEnhancedPrompt
    ? `<span class="enhanced-badge" title="Phase 4G: Source-aware Image Prompt Enhancement">✨ Enhanced Prompt</span>`
    : '';
  const factsText = safeReadText(join(ASSETS, packDir, 'facts.md'), '');
  const xpostText = safeReadText(join(ASSETS, packDir, 'x-post.zh.md'), '');
  const summaryMdText = safeReadText(join(ASSETS, packDir, 'content-summary.zh.md'), '');
  const signalJson = safeReadJson<any>(join(ASSETS, packDir, 'signal.json'), {});
  const sourceJson = safeReadJson<any>(join(ASSETS, packDir, 'source.json'), {});
  const facts = extractFacts(factsText);

  // Clean up why_it_matters - filter out template questions
  const whyItMattersClean = cleanWhyItMatters(whyItMatters) || extractSummaryWhyMatters(summaryMdText) || '';

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
  // Phase 4G: enhanced image prompt
  const enrichedPrompt = safeReadText(join(ASSETS, packDir, 'image-prompt.enriched.md'), '');
  if (enrichedPrompt) {
    // Extract just the English prompt block from the enriched file
    const enMatch = enrichedPrompt.match(/```text\n([\s\S]+?)\n```/);
    const enBlock = enMatch ? enMatch[1] : enrichedPrompt;
    const negMatch = enrichedPrompt.match(/## Negative Prompt\s*\n+\n```text\n([\s\S]+?)\n```/);
    const negBlock = negMatch ? negMatch[1] : '';
    promptPreviews.push(`
      <div class="prompt-card prompt-card--enhanced">
        <h4>✨ Enhanced Image Prompt <span class="badge-enhanced">Phase 4G</span></h4>
        <p class="prompt-subtitle">源感知增强版（基于 source-type 策略）</p>
        <details open>
          <summary>English Prompt</summary>
          <pre class="prompt-preview">${escapeHtml(truncate(enBlock, 800))}</pre>
        </details>
        ${negBlock ? `<details>
          <summary>Negative Prompt</summary>
          <pre class="prompt-preview">${escapeHtml(negBlock)}</pre>
        </details>` : ''}
        <div class="prompt-links">
          <a class="prompt-link" href="${baseUrl}/image-prompt.enriched.md" target="_blank">📄 完整增强版（含意图/参数） →</a>
          <a class="prompt-link" href="${baseUrl}/image-prompt.zh.md" target="_blank">🇨🇳 中文解释 →</a>
          <a class="prompt-link" href="${baseUrl}/image-prompt.meta.json" target="_blank">🔧 meta.json →</a>
        </div>
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
    // Phase 3E: Read quality scores for images associated with this pack
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
    const myImages = qualityTable.rows.filter((r: any) => {
      // Match by content pack slug at the end of pack_dir
      if (!r.filename) return false;
      const packSlug = packDir.split('/').pop() || '';
      const myImagesList: string[] = availableAssets.generated_images || [];
      return packSlug && (
        packSlug === r.content_pack_slug ||
        packDir.endsWith(r.content_pack || '') ||
        myImagesList.includes(r.filename)
      );
    });

    if (myImages.length > 0) {
      const imgCards = myImages.map((img: any) => {
        const label = QUALITY_LABELS_ZH[img.quality_label] || img.quality_label;
        const color = QUALITY_COLORS[img.quality_label] || '#5b5bd6';
        // Look up the path from generated-assets.json
        const genAssets = safeReadJson<any[]>(join(ASSETS, 'metadata', 'generated-assets.json'), []);
        const ga = genAssets.find((a: any) => a.filename === img.filename);
        const imgRelPath = ga?.path || `images/${img.filename}`;
        const imgUrl = `https://conanxin.github.io/creative-quota-assets/${imgRelPath}`;
        const dims = Object.entries(img.dimensions || {})
          .map(([k, v]) => `<span class="dim-chip">${escapeHtml(k)}: ${v}/20</span>`).join('');
        const uses = (img.recommended_uses || []).slice(0, 3).map((u: string) =>
          `<span class="use-chip">${escapeHtml(u)}</span>`).join('');
        return `
      <div class="gen-image-card">
        <div class="gen-image-header">
          <span class="quality-badge" style="color:${color};background:${color}15">${label} · ${img.score}/100</span>
          <span class="gen-image-meta">${escapeHtml(img.source_type)} · ${img.aspect_ratio} · ${img.file_size_kb}KB</span>
        </div>
        <div class="gen-image-dims">${dims}</div>
        <div class="gen-image-uses">${uses}</div>
        <div class="gen-image-actions">
          <a class="btn-secondary" href="${imgUrl}" target="_blank">🖼️ 查看原图</a>
          <a class="btn-secondary" href="${img.review_md_url}" target="_blank">📋 质量评审</a>
        </div>
      </div>`;
      }).join('');
      genImagesHtml = `<div class="gen-images-grid">${imgCards}</div>`;
    } else {
      genImagesHtml = '<div class="info-box">📸 该 Content Pack 关联了已生成图片（图片展示功能开发中）</div>';
    }
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
  const sourceSpecific = generateSourceSpecificSection(st, briefText, facts, xpostText, signalJson, sourceJson, summaryMdText, factsText);

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
    .prompt-card--enhanced { background: linear-gradient(135deg, #faf7ff 0%, #f0f4ff 100%); border-color: var(--accent); }
    .prompt-subtitle { font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.5rem; }
    .badge-enhanced { font-size: 0.6rem; background: var(--accent); color: #fff; padding: 0.1rem 0.4rem; border-radius: 4px; margin-left: 0.4rem; font-weight: 700; letter-spacing: 0.05em; }
    .enhanced-badge { display: inline-block; font-size: 0.65rem; background: linear-gradient(135deg, #5b5bd6 0%, #ec4899 100%); color: #fff; padding: 0.2rem 0.6rem; border-radius: 12px; margin-top: 0.3rem; font-weight: 600; }
    .prompt-card--enhanced details { margin-bottom: 0.5rem; }
    .prompt-card--enhanced summary { font-size: 0.8rem; font-weight: 600; color: var(--accent); cursor: pointer; padding: 0.2rem 0; }
    .prompt-card--enhanced details[open] summary { margin-bottom: 0.3rem; }
    .prompt-links { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
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
    /* Phase 3E: Generated image quality card */
    .gen-images-grid { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
    .gen-image-card {
      background: var(--bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 1rem;
    }
    .gen-image-header { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.5rem; }
    .quality-badge {
      font-size: 0.7rem; font-weight: 700;
      padding: 0.2rem 0.6rem; border-radius: 4px;
    }
    .gen-image-meta { font-size: 0.7rem; color: var(--text-muted); }
    .gen-image-dims {
      display: flex; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0.5rem;
    }
    .dim-chip {
      font-size: 0.65rem;
      background: var(--accent-dim);
      color: var(--accent);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }
    .gen-image-uses {
      display: flex; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0.5rem;
    }
    .gen-image-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .use-chip {
      font-size: 0.65rem; background: var(--accent-dim); color: var(--accent);
      padding: 0.15rem 0.4rem; border-radius: 4px;
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
      ${enhancedBadge}
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
    ${whyItMattersClean ? `
    <div class="section">
      <div class="section-title">💡 为什么值得关注</div>
      <div class="section-body">${escapeHtml(whyItMattersClean)}</div>
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
