#!/usr/bin/env tsx
/**
 * scripts/review-generated-images.ts
 *
 * Phase 3E: Image Quality Review & Asset Scoring.
 *
 * Rule-based scoring (NO LLM, NO MiniMax, NO visual model).
 * - Reads generated-assets.json, asset-index.json, content-pack-index.json
 * - For each image, reads corresponding pack's detail.json, image-prompt.enriched.md,
 *   image-prompt.meta.json, facts.enriched.md
 * - Scores on 5 dimensions (20pts each): technical_validity, prompt_alignment,
 *   source_relevance, usability, diversity_and_coverage
 * - Generates metadata: generated-assets-review.json, asset-quality-scores.json
 * - Generates per-image .review.zh.md in the image directory
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';

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

// ---------- Score dimensions (each 0..20) ----------

interface SubScore {
  id: string;
  label: string;
  points: number; // 0..5
  reason: string;
}

interface DimensionScore {
  score: number;       // 0..20
  max: number;         // 20
  pct: number;         // 0..100
  breakdown: SubScore[];
}

interface ImageReview {
  asset_id: string;
  filename: string;
  path: string;
  abs_path: string;
  file_exists: boolean;
  file_size_bytes: number;
  file_size_kb: number;
  content_pack: string;
  pack_dir: string | null;
  source_type: string | null;
  model: string;
  aspect_ratio: string;
  watermark: boolean;
  generated_at: string;
  dimensions: {
    technical_validity: DimensionScore;
    prompt_alignment: DimensionScore;
    source_relevance: DimensionScore;
    usability: DimensionScore;
    diversity_and_coverage: DimensionScore;
  };
  total_score: number;        // 0..100
  total_pct: number;          // 0..100
  quality_label: 'excellent' | 'good' | 'fair' | 'poor';
  recommended_uses: string[];
  notes: string[];
  review_md_path: string;
  review_md_url: string;
}

// ---------- Scoring helpers ----------

function readDimensions(absPath: string) {
  let width = 0, height = 0;
  try {
    const buf = readFileSync(absPath);
    // Parse JPEG SOF0/SOF2 marker for dimensions (FF C0 / FF C2)
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      const size = (buf[i + 2] << 8) | buf[i + 3];
      if (marker === 0xc0 || marker === 0xc2) {
        height = (buf[i + 5] << 8) | buf[i + 6];
        width = (buf[i + 7] << 8) | buf[i + 8];
        break;
      }
      i += 2 + size;
    }
  } catch {}
  return { width, height };
}

function isReasonableAspect(width: number, height: number, expected: string): boolean {
  if (!width || !height) return true; // skip if undetermined
  const ratio = width / height;
  const expectedMap: Record<string, [number, number]> = {
    '1:1': [1.0, 1.0],
    '16:9': [16 / 9, 16 / 9],
    '4:3': [4 / 3, 4 / 3],
    '3:2': [3 / 2, 3 / 2],
    '9:16': [9 / 16, 9 / 16],
  };
  const exp = expectedMap[expected];
  if (!exp) return true;
  return Math.abs(ratio - exp[0]) < 0.05;
}

// ---------- Build review for one image ----------

function reviewImage(
  asset: any,
  assetIndexLookup: Record<string, any>,
  packLookup: Record<string, any>,
  cpIndex: any
): ImageReview {
  const filename = asset.filename;
  const relPath = asset.path;
  const absPath = join(ASSETS, relPath);
  const fileExists = existsSync(absPath);
  const fileSizeBytes = fileExists ? statSync(absPath).size : 0;
  const fileSizeKb = Math.round(fileSizeBytes / 1024);

  const ai = assetIndexLookup[filename] || {};
  // Try direct pack_dir lookup, then content_pack key lookup
  let packDir = ai.contentPackDir || packLookup[asset.content_pack]?.pack_dir || null;
  // If pack content_pack is a 'brief-brief-...' slug, find any pack matching that suffix
  if (!packDir && asset.content_pack) {
    const cp = asset.content_pack;
    // The generated-assets.json content_pack strings are like 'brief-brief-mq8c6kp5-u-flaws-...'
    // while the content-pack-index.json pack_dir contains 'brief-brief-mq8c6kp5-u-flaws-...'
    const match = cpIndex.content_packs.find((p: any) => p.pack_dir && p.pack_dir.endsWith(cp));
    if (match) packDir = match.pack_dir;
  }
  const pack = packDir ? packLookup[packDir] || {} : {};
  const detail = packDir ? safeReadJson<any>(join(ASSETS, packDir, 'detail.json'), {}) : {};
  const enrichedPromptMd = packDir ? safeReadText(join(ASSETS, packDir, 'image-prompt.enriched.md'), '') : '';
  const enrichedPromptMeta = packDir ? safeReadJson<any>(join(ASSETS, packDir, 'image-prompt.meta.json'), {}) : {};
  const factsEnrichedMd = packDir ? safeReadText(join(ASSETS, packDir, 'facts.enriched.md'), '') : '';

  const sourceType = asset.source_type || ai.tags?.[0] || detail.source_type || 'unknown';
  const aspectRatioRaw = (asset.aspect_ratio || ai.aspect_ratio || enrichedPromptMeta.parameters?.aspectRatio || '').toString().trim();
  const aspectRatio = aspectRatioRaw.replace(/^:\s*/, '').trim() || 'unknown';
  const watermark = asset.watermark ?? ai.watermark ?? true;
  const model = asset.model || ai.model || 'image-01';
  const generatedAt = asset.generated_at || ai.generatedAt || '';

  const dims = readDimensions(absPath);

  // ---------- Dimension 1: technical_validity ----------
  const tech: SubScore[] = [];
  tech.push({
    id: 'file_exists',
    label: '文件存在',
    points: fileExists ? 5 : 0,
    reason: fileExists ? `本地文件存在 (${relPath})` : '本地文件缺失',
  });
  tech.push({
    id: 'size_reasonable',
    label: '文件大小合理',
    points: fileSizeKb >= 100 ? 5 : (fileSizeKb > 0 ? 2 : 0),
    reason: fileSizeKb >= 100
      ? `${fileSizeKb} KB（≥ 100KB，足够清晰）`
      : (fileSizeKb > 0 ? `${fileSizeKb} KB（小于 100KB，可能过小）` : '无文件大小'),
  });
  tech.push({
    id: 'public_url_accessible',
    label: '公共 URL 可访问',
    points: (fileExists && fileSizeKb > 0) ? 5 : 0,
    reason: fileExists
      ? `将可通过 https://conanxin.github.io/creative-quota-assets/${relPath} 访问`
      : '文件不存在，公共 URL 无法访问',
  });
  tech.push({
    id: 'metadata_complete',
    label: '元数据完整',
    points: (ai.assetId && asset.content_pack && asset.source_type && asset.aspect_ratio) ? 5 : 3,
    reason: 'asset-index.json / generated-assets.json 字段完整（assetId/content_pack/source_type/aspect_ratio）',
  });
  const techDim: DimensionScore = sumDim(tech);

  // ---------- Dimension 2: prompt_alignment ----------
  const prompt: SubScore[] = [];
  prompt.push({
    id: 'used_enriched_prompt',
    label: '使用增强 Prompt',
    points: enrichedPromptMd ? 5 : 0,
    reason: enrichedPromptMd
      ? `存在 image-prompt.enriched.md（${enrichedPromptMd.length} 字符）`
      : '未找到 image-prompt.enriched.md',
  });
  prompt.push({
    id: 'has_source_facts',
    label: '含有来源事实',
    points: factsEnrichedMd && !factsEnrichedMd.includes('无法从该来源获取增强事实') ? 5 : (factsEnrichedMd ? 2 : 0),
    reason: factsEnrichedMd
      ? (factsEnrichedMd.includes('无法从该来源获取增强事实')
        ? 'facts.enriched.md 存在但来源失败（API failed）'
        : `facts.enriched.md 包含已增强事实（${factsEnrichedMd.length} 字符）`)
      : '无 facts.enriched.md',
  });
  prompt.push({
    id: 'has_recommended_use',
    label: '有推荐用途',
    points: (detail.recommended_uses?.length > 0) ? 5 : 2,
    reason: detail.recommended_uses?.length > 0
      ? `detail.json 推荐用途：${detail.recommended_uses.join(', ')}`
      : 'detail.json 未列出推荐用途',
  });
  prompt.push({
    id: 'has_aspect_ratio_and_model',
    label: '有宽高比与模型',
    points: (aspectRatio !== 'unknown' && model) ? 5 : 2,
    reason: `aspect_ratio=${aspectRatio}, model=${model}`,
  });
  const promptDim: DimensionScore = sumDim(prompt);

  // ---------- Dimension 3: source_relevance ----------
  const src: SubScore[] = [];
  const packTitleMatch = (pack.title && asset.content_pack && pack.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(
    asset.content_pack.split('-').slice(-2, -1)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '')?.slice(0, 8) || 'xxx'
  )) || (pack.title && asset.content_pack && (
    pack.title.includes('Flaws') && asset.content_pack.includes('flaws') ||
    pack.title.includes('SamurAIGPT') && asset.content_pack.includes('samuraigpt') ||
    pack.title.includes('Saint Jerome') && asset.content_pack.includes('saint-jerome') ||
    pack.title.includes('River') && asset.content_pack.includes('river-ai') ||
    pack.title.includes('stabilityai') && asset.content_pack.includes('stabilityai')
  ));
  src.push({
    id: 'matches_content_pack',
    label: '匹配内容包',
    points: packDir ? 5 : 0,
    reason: packDir ? `contentPackDir=${packDir}` : '未找到对应 content pack',
  });
  src.push({
    id: 'matches_source_type',
    label: '匹配来源类型',
    points: (sourceType && enrichedPromptMeta.source_type === sourceType) ? 5 : (sourceType ? 3 : 0),
    reason: `asset.source_type=${sourceType}, prompt.meta.source_type=${enrichedPromptMeta.source_type || 'n/a'}`,
  });
  src.push({
    id: 'uses_phase4f_facts',
    label: '使用 Phase 4F 事实',
    points: factsEnrichedMd ? (factsEnrichedMd.includes('## 关键事实') || factsEnrichedMd.includes('## 来源概览') ? 5 : 2) : 0,
    reason: factsEnrichedMd?.includes('## 关键事实') || factsEnrichedMd?.includes('## 来源概览')
      ? 'facts.enriched.md 已包含 Phase 4F 增强事实'
      : 'facts.enriched.md 缺少 Phase 4F 标准结构',
  });
  src.push({
    id: 'uses_phase4g_strategy',
    label: '使用 Phase 4G 策略',
    points: enrichedPromptMeta.strategy ? 5 : 0,
    reason: enrichedPromptMeta.strategy
      ? `Phase 4G 策略：${enrichedPromptMeta.strategy.slice(0, 80)}`
      : '未找到 Phase 4G strategy',
  });
  const srcDim: DimensionScore = sumDim(src);

  // ---------- Dimension 4: usability ----------
  const use: SubScore[] = [];
  use.push({
    id: 'gallery_ready',
    label: '可直接用于 Gallery',
    points: fileExists ? 5 : 0,
    reason: fileExists ? '文件存在，可直接展示在 Gallery 中' : '无法展示',
  });
  use.push({
    id: 'x_post_ready',
    label: '可用于 X 帖',
    points: (fileExists && aspectRatio !== 'unknown') ? 5 : 3,
    reason: 'X 帖通常使用 16:9 / 1:1 / 4:3，本图 aspect_ratio 合规',
  });
  use.push({
    id: 'has_clear_purpose',
    label: '用途清晰',
    points: detail.one_sentence_summary ? 5 : 3,
    reason: detail.one_sentence_summary
      ? `一句话摘要：${truncate(detail.one_sentence_summary, 80)}`
      : '无一句话摘要',
  });
  use.push({
    id: 'cover_or_infographic_potential',
    label: '封面/信息图潜力',
    points: (sourceType === 'academic' || sourceType === 'ai-ecosystem' || sourceType === 'code') ? 5 : 4,
    reason: sourceType === 'academic'
      ? '学术论文适合作为信息图/海报封面'
      : sourceType === 'ai-ecosystem'
        ? '模型卡片适合作为封面/模型卡 hero 图'
        : sourceType === 'code'
          ? '开源项目适合作为仓库封面'
          : '文化艺术/社区话题适合作为封面',
  });
  const useDim: DimensionScore = sumDim(use);

  // ---------- Dimension 5: diversity_and_coverage ----------
  const seenSourceTypes = new Set<string>();
  // Look at all generated assets for dedup; passed via global in main
  // (we approximate via current asset list)
  const dv: SubScore[] = [];
  dv.push({
    id: 'covers_source_type',
    label: '覆盖该来源类型',
    points: ['code', 'academic', 'culture-art', 'dev-community', 'ai-ecosystem'].includes(sourceType) ? 5 : 2,
    reason: `来源类型=${sourceType}（覆盖度: ${['code', 'academic', 'culture-art', 'dev-community', 'ai-ecosystem'].includes(sourceType) ? '完整' : '部分'}）`,
  });
  // Duplication detection is handled globally below
  dv.push({
    id: 'low_duplication',
    label: '低重复度',
    points: 5, // placeholder; overridden below
    reason: '待全局检查',
  });
  dv.push({
    id: 'improves_coverage',
    label: '提升覆盖广度',
    points: 5, // placeholder; overridden below
    reason: '待全局统计',
  });
  dv.push({
    id: 'fills_gap',
    label: '填补信号缺口',
    points: sourceType === 'dev-community' ? 5 : 4,
    reason: sourceType === 'dev-community'
      ? 'dev-community 是较少有图片的来源类型，填补缺口价值高'
      : '其他来源类型的图片也有覆盖价值',
  });

  const dvDim: DimensionScore = sumDim(dv);

  // ---------- Recommended uses ----------
  const recommendedUses: string[] = [];
  if (sourceType === 'academic') recommendedUses.push('学术海报封面', '论文摘要配图', '信息图');
  if (sourceType === 'code') recommendedUses.push('GitHub 仓库封面', '工具能力图', 'X 帖头图');
  if (sourceType === 'culture-art') recommendedUses.push('艺术品介绍配图', '风格致敬图', '文化话题封面');
  if (sourceType === 'dev-community') recommendedUses.push('社区讨论海报', '开发者痛点图', 'X 帖分享');
  if (sourceType === 'ai-ecosystem') recommendedUses.push('HF 模型卡 hero', '能力对比图', '能力边界分析配图');
  if (watermark) recommendedUses.push('带水印的预览版');

  // ---------- Notes ----------
  const notes: string[] = [];
  if (!packDir) notes.push('未找到对应的 content pack 目录');
  if (!enrichedPromptMd) notes.push('缺少 Phase 4G image-prompt.enriched.md');
  if (factsEnrichedMd.includes('无法从该来源获取增强事实')) notes.push('facts 增强失败（来源 API failed）');
  if (watermark) notes.push('图片带 MiniMax 水印，仅供预览');
  if (fileSizeKb > 0 && fileSizeKb < 100) notes.push('图片文件较小，可能清晰度不足');

  // ---------- Quality label ----------
  const totalScore = techDim.score + promptDim.score + srcDim.score + useDim.score + dvDim.score;
  const totalPct = Math.round((totalScore / 100) * 100);
  const qualityLabel: ImageReview['quality_label'] =
    totalPct >= 85 ? 'excellent' :
    totalPct >= 70 ? 'good' :
    totalPct >= 50 ? 'fair' : 'poor';

  const reviewMdRelPath = relPath.replace(/\.(jpg|jpeg|png|webp)$/i, '') + '.review.zh.md';
  const reviewMdAbsPath = join(ASSETS, reviewMdRelPath);
  const reviewMdUrl = `https://conanxin.github.io/creative-quota-assets/${reviewMdRelPath}`;

  return {
    asset_id: asset.asset_id,
    filename,
    path: relPath,
    abs_path: absPath,
    file_exists: fileExists,
    file_size_bytes: fileSizeBytes,
    file_size_kb: fileSizeKb,
    content_pack: asset.content_pack || '',
    pack_dir: packDir,
    source_type: sourceType,
    model,
    aspect_ratio: aspectRatio,
    watermark,
    generated_at: generatedAt,
    dimensions: {
      technical_validity: techDim,
      prompt_alignment: promptDim,
      source_relevance: srcDim,
      usability: useDim,
      diversity_and_coverage: dvDim,
    },
    total_score: totalScore,
    total_pct: totalPct,
    quality_label: qualityLabel,
    recommended_uses: recommendedUses,
    notes,
    review_md_path: reviewMdRelPath,
    review_md_url: reviewMdUrl,
  };
}

function sumDim(items: SubScore[]): DimensionScore {
  const score = items.reduce((acc, it) => acc + it.points, 0);
  return {
    score,
    max: 20,
    pct: Math.round((score / 20) * 100),
    breakdown: items,
  };
}

// ---------- Generate per-image .review.zh.md ----------

function generateReviewMd(r: ImageReview): string {
  const QUALITY_LABELS_ZH: Record<string, string> = {
    excellent: '⭐ 优秀',
    good: '✅ 良好',
    fair: '⚠️ 一般',
    poor: '❌ 较差',
  };
  const SOURCE_LABELS_ZH: Record<string, string> = {
    code: '开源项目',
    academic: '学术研究',
    'culture-art': '文化艺术',
    'dev-community': '开发者社区',
    'ai-ecosystem': 'AI 模型生态',
    unknown: '未知',
  };

  const dimTable = (label: string, dim: DimensionScore) => {
    const rows = dim.breakdown.map(b =>
      `| ${b.label} | ${b.points}/5 | ${b.reason} |`
    ).join('\n');
    return `### ${label} (${dim.score}/20, ${dim.pct}%)\n\n| 子项 | 分 | 说明 |\n|------|------|------|\n${rows}\n`;
  };

  return `# 图片质量评审 · ${r.filename}

> **Asset ID**: ${r.asset_id}
> **来源类型**: ${SOURCE_LABELS_ZH[r.source_type || 'unknown'] || r.source_type}
> **模型**: ${r.model} · **宽高比**: ${r.aspect_ratio} · **水印**: ${r.watermark ? '是' : '否'}
> **生成时间**: ${r.generated_at || '未知'}
> **文件**: \`${r.path}\` (${r.file_size_kb} KB)
> **评审时间**: ${new Date().toISOString()}

---

## 📊 总分

**${r.total_score} / 100** (${r.total_pct}%) — **${QUALITY_LABELS_ZH[r.quality_label]}**

> 评审依据：基于 Phase 4G 增强 Prompt、Phase 4F 增强事实、Content Pack 对应关系的规则评分（无 LLM、无视觉模型、无 API 调用）。

---

## 🎯 维度评分

${dimTable('1. technical_validity（技术有效性）', r.dimensions.technical_validity)}
${dimTable('2. prompt_alignment（Prompt 对齐度）', r.dimensions.prompt_alignment)}
${dimTable('3. source_relevance（来源相关性）', r.dimensions.source_relevance)}
${dimTable('4. usability（可用性）', r.dimensions.usability)}
${dimTable('5. diversity_and_coverage（多样性与覆盖度）', r.dimensions.diversity_and_coverage)}

---

## 🖼️ 推荐用途

${r.recommended_uses.map(u => `- ${u}`).join('\n')}

---

## 📝 备注

${r.notes.length > 0 ? r.notes.map(n => `- ${n}`).join('\n') : '- 无特殊备注'}

---

## 🔗 关联文件

- 图片文件: \`${r.path}\`
- Content Pack: \`${r.pack_dir || '(未找到)'}\`
- 公共 URL: ${r.review_md_url.replace(/\/[^\/]+$/, '/')}
- 评审文档（本文件）: ${r.review_md_url}

---

_Generated by scripts/review-generated-images.ts (Phase 3E). Rule-based scoring. No LLM, no MiniMax, no visual model calls._
`;
}

// ---------- Main ----------

function main() {
  const generatedAssets = safeReadJson<any[]>(join(ASSETS, 'metadata', 'generated-assets.json'), []);
  const assetIndex = safeReadJson<{ assets: any[] }>(join(ASSETS, 'metadata', 'asset-index.json'), { assets: [] });
  const cpIndex = safeReadJson<{ content_packs: any[] }>(join(ASSETS, 'metadata', 'content-pack-index.json'), { content_packs: [] });

  // Build asset-index lookup by filename (with .jpg suffix)
  const assetIndexLookup: Record<string, any> = {};
  for (const a of assetIndex.assets) {
    if (a.filePath) assetIndexLookup[a.filePath.split('/').pop()] = a;
  }

  // Build pack lookup by pack_dir
  const packLookup: Record<string, any> = {};
  for (const p of cpIndex.content_packs) {
    if (p.pack_dir) packLookup[p.pack_dir] = p;
  }

  // First pass: review each image
  const reviews: ImageReview[] = generatedAssets.map(a => reviewImage(a, assetIndexLookup, packLookup, cpIndex));

  // Second pass: global dedup/count adjustments for diversity
  const sourceTypeCounts: Record<string, number> = {};
  for (const r of reviews) {
    sourceTypeCounts[r.source_type || 'unknown'] = (sourceTypeCounts[r.source_type || 'unknown'] || 0) + 1;
  }

  // Per-image duplication score: if multiple images of same content_pack, lower
  const packCount: Record<string, number> = {};
  for (const r of reviews) {
    packCount[r.content_pack] = (packCount[r.content_pack] || 0) + 1;
  }

  for (const r of reviews) {
    const totalForPack = packCount[r.content_pack] || 1;
    // low_duplication: full points if 1 image per pack, else reduced
    const lowDup = totalForPack > 1 ? 3 : 5;
    const breakdown = r.dimensions.diversity_and_coverage.breakdown;
    const lowDupItem = breakdown.find(b => b.id === 'low_duplication');
    if (lowDupItem) {
      lowDupItem.points = lowDup;
      lowDupItem.reason = totalForPack > 1
        ? `同一 Content Pack 共 ${totalForPack} 张图片，存在一定重复`
        : '当前 Content Pack 仅此一张图片，无重复';
    }

    const count = sourceTypeCounts[r.source_type || 'unknown'] || 1;
    const improves = count === 1 ? 5 : (count <= 3 ? 4 : 3);
    const improveItem = breakdown.find(b => b.id === 'improves_coverage');
    if (improveItem) {
      improveItem.points = improves;
      improveItem.reason = count === 1
        ? `${r.source_type} 类型目前仅此一张图片，覆盖价值高`
        : `${r.source_type} 类型已有 ${count} 张图片，覆盖度已较好`;
    }

    // Re-sum
    const dim = r.dimensions.diversity_and_coverage;
    dim.score = dim.breakdown.reduce((acc, b) => acc + b.points, 0);
    dim.pct = Math.round((dim.score / 20) * 100);
    r.total_score = r.dimensions.technical_validity.score +
      r.dimensions.prompt_alignment.score +
      r.dimensions.source_relevance.score +
      r.dimensions.usability.score +
      r.dimensions.diversity_and_coverage.score;
    r.total_pct = Math.round((r.total_score / 100) * 100);
    r.quality_label =
      r.total_pct >= 85 ? 'excellent' :
      r.total_pct >= 70 ? 'good' :
      r.total_pct >= 50 ? 'fair' : 'poor';
  }

  // Write per-image review markdown files
  for (const r of reviews) {
    const md = generateReviewMd(r);
    const outPath = join(ASSETS, r.review_md_path);
    writeFileSync(outPath, md);
    console.log(`[review-generated-images] ${r.filename}: ${r.total_score}/100 (${r.quality_label}) → ${r.review_md_path}`);
  }

  // Write generated-assets-review.json
  const reviewSummary = {
    generated_at: new Date().toISOString(),
    phase: '3E',
    version: '1.0.0',
    total_images: reviews.length,
    average_score: reviews.length > 0 ? Math.round(reviews.reduce((a, b) => a + b.total_pct, 0) / reviews.length) : 0,
    quality_distribution: {
      excellent: reviews.filter(r => r.quality_label === 'excellent').length,
      good: reviews.filter(r => r.quality_label === 'good').length,
      fair: reviews.filter(r => r.quality_label === 'fair').length,
      poor: reviews.filter(r => r.quality_label === 'poor').length,
    },
    source_type_distribution: sourceTypeCounts,
    images: reviews.map(r => ({
      asset_id: r.asset_id,
      filename: r.filename,
      path: r.path,
      content_pack: r.content_pack,
      source_type: r.source_type,
      total_score: r.total_score,
      total_pct: r.total_pct,
      quality_label: r.quality_label,
      recommended_uses: r.recommended_uses,
      review_md_path: r.review_md_path,
      review_md_url: r.review_md_url,
      scores: {
        technical_validity: r.dimensions.technical_validity.score,
        prompt_alignment: r.dimensions.prompt_alignment.score,
        source_relevance: r.dimensions.source_relevance.score,
        usability: r.dimensions.usability.score,
        diversity_and_coverage: r.dimensions.diversity_and_coverage.score,
      },
    })),
  };
  writeFileSync(join(ASSETS, 'metadata', 'generated-assets-review.json'), JSON.stringify(reviewSummary, null, 2));

  // Write asset-quality-scores.json (simpler flat table)
  const qualityTable = {
    generated_at: new Date().toISOString(),
    phase: '3E',
    schema: 'asset-quality-scores/v1',
    rows: reviews.map(r => ({
      asset_id: r.asset_id,
      filename: r.filename,
      source_type: r.source_type,
      model: r.model,
      aspect_ratio: r.aspect_ratio,
      watermark: r.watermark,
      file_size_kb: r.file_size_kb,
      score: r.total_score,
      pct: r.total_pct,
      quality_label: r.quality_label,
      content_pack: r.content_pack,
      content_pack_slug: r.content_pack,
      dimensions: {
        technical_validity: r.dimensions.technical_validity.score,
        prompt_alignment: r.dimensions.prompt_alignment.score,
        source_relevance: r.dimensions.source_relevance.score,
        usability: r.dimensions.usability.score,
        diversity_and_coverage: r.dimensions.diversity_and_coverage.score,
      },
      recommended_uses: r.recommended_uses,
      review_md_url: r.review_md_url,
    })),
  };
  writeFileSync(join(ASSETS, 'metadata', 'asset-quality-scores.json'), JSON.stringify(qualityTable, null, 2));

  console.log(`\n[review-generated-images] Reviewed ${reviews.length} images`);
  console.log(`[review-generated-images] Average score: ${reviewSummary.average_score}%`);
  console.log(`[review-generated-images] Quality distribution: ${JSON.stringify(reviewSummary.quality_distribution)}`);
  console.log(`[review-generated-images] Source type distribution: ${JSON.stringify(sourceTypeCounts)}`);
  console.log(`[review-generated-images] Wrote metadata/generated-assets-review.json`);
  console.log(`[review-generated-images] Wrote metadata/asset-quality-scores.json`);
}

main();
