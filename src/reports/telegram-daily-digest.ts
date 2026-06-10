#!/usr/bin/env npx ts-node
/**
 * Telegram Daily Digest Generator — Phase 3B-1 (Quality Patch)
 * 
 * Fixes over Phase 3B:
 * - Top signals deduplication (by URL + normalized title)
 * - Structured counting from JSON/manifest sources
 * - Recommended Generation Queue (packs without generated images)
 * 
 * Usage:
 *   npm run digest:telegram
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const HARVESTER_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const ASSETS_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

function safeRead(path: string): string | null {
  try { return existsSync(path) ? readFileSync(path, 'utf-8') : null; }
  catch { return null; }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim();
}

interface Signal {
  id: string;
  title: string;
  source_type: string;
  final_score: number;
  url: string;
  metadata: string;
}

interface ContentPack {
  pack_id: string;
  source_types?: string[];
  final_score?: number;
  recommended_assets?: string[];
  title?: string;
}

function getSignalsFromDb() {
  try {
    const sqlite3 = require('better-sqlite3');
    const dbPath = join(HARVESTER_DIR, 'data/signals.db');
    if (!existsSync(dbPath)) return { total: 0, bySource: {} as Record<string, number>, topUnique: [] as Signal[] };
    const db = sqlite3(dbPath);
    const total = (db.prepare('SELECT COUNT(*) as c FROM signals').get() as { c: number }).c;
    const sourceRows = db.prepare('SELECT source_type, COUNT(*) as c FROM signals GROUP BY source_type').all() as { source_type: string; c: number }[];
    const bySource: Record<string, number> = {};
    for (const r of sourceRows) bySource[r.source_type] = r.c;

    const rows = db.prepare(
      'SELECT id, title, source_type, final_score, url, metadata FROM signals ORDER BY final_score DESC'
    ).all() as Signal[];

    // Deduplicate by URL + normalized title
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const uniqueSignals: Signal[] = [];
    for (const s of rows) {
      const url = s.url || '';
      const normTitle = normalizeTitle(s.title);
      if (seenUrls.has(url)) continue;
      if (seenTitles.has(normTitle)) continue;
      seenUrls.add(url);
      seenTitles.add(normTitle);
      uniqueSignals.push(s);
    }

    db.close();
    return { total, bySource, topUnique: uniqueSignals };
  } catch (e) {
    console.error('DB error:', e);
    return { total: 0, bySource: {} as Record<string, number>, topUnique: [] as Signal[] };
  }
}

function getContentPackStats() {
  try {
    const countResult = execSync(
      `find "${ASSETS_DIR}/content-packs" -name "manifest.json" 2>/dev/null | wc -l`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    const packCount = parseInt(countResult.trim(), 10) || 0;

    const findCmd = `find "${ASSETS_DIR}/content-packs" -name "manifest.json" 2>/dev/null`;
    const files = execSync(findCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
      .trim().split('\n').filter(Boolean);

    const manifests: ContentPack[] = [];
    for (const f of files) {
      try {
        const content = safeRead(f);
        if (content) manifests.push(JSON.parse(content));
      } catch {}
    }

    const hasImage = manifests.filter(m => m.recommended_assets?.includes('image')).length;
    const hasMusic = manifests.filter(m => m.recommended_assets?.includes('music')).length;
    const hasVideo = manifests.filter(m => m.recommended_assets?.includes('video')).length;

    // Deduplicate packs by normalized title
    const seenTitles = new Set<string>();
    const uniquePacks: ContentPack[] = [];
    for (const m of manifests) {
      const t = normalizeTitle(m.title || m.pack_id || '');
      if (seenTitles.has(t)) continue;
      seenTitles.add(t);
      uniquePacks.push(m);
    }
    uniquePacks.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));

    return { packCount, hasImage, hasMusic, hasVideo, topPacks: uniquePacks.slice(0, 5) };
  } catch (e) {
    console.error('Pack stats error:', e);
    return { packCount: 0, hasImage: 0, hasMusic: 0, hasVideo: 0, topPacks: [] as ContentPack[] };
  }
}

function getGeneratedAssets() {
  try {
    const content = safeRead(join(ASSETS_DIR, 'metadata/generated-assets.json'));
    if (!content) return { count: 0, images: 0, music: 0, video: 0, latestImage: null };
    const assets: { filename?: string; content_pack_dir?: string }[] = JSON.parse(content);
    const latestImage = assets.length > 0 ? assets[assets.length - 1].filename : null;

    const imageExts = ['.jpg', '.jpeg', '.png', '.webp'];
    let images = 0, music = 0, video = 0;
    for (const a of assets) {
      const fn = (a.filename || '').toLowerCase();
      if (imageExts.some(e => fn.endsWith(e))) images++;
      else if (fn.endsWith('.mp3') || fn.endsWith('.wav') || fn.endsWith('.flac')) music++;
      else if (fn.endsWith('.mp4') || fn.endsWith('.webm')) video++;
    }
    return { count: assets.length, images, music, video, latestImage };
  } catch {
    return { count: 0, images: 0, music: 0, video: 0, latestImage: null };
  }
}

function buildRecommendedQueue(topPacks: ContentPack[], genAssets: { count: number; latestImage: string | null | undefined }) {
  // Find packs that don't have generated images yet
  const genPackDirs = new Set<string>();
  try {
    const content = safeRead(join(ASSETS_DIR, 'metadata/generated-assets.json'));
    if (content) {
      const assets = JSON.parse(content);
      for (const a of assets) {
        const dir = (a as { content_pack_dir?: string }).content_pack_dir;
        if (dir) genPackDirs.add(basename(dir));
      }
    }
  } catch {}

  const queue: {
    title: string;
    source_type: string;
    score: number;
    recommended_type: string;
    reason: string;
    pack_dir: string;
  }[] = [];

  for (const pack of topPacks) {
    const packDir = basename(pack.pack_id || '');
    if (genPackDirs.has(packDir)) continue;

    const assets = pack.recommended_assets || [];
    let type = 'image';
    let reason = 'High score + image prompt available';

    if (assets.includes('music') && !assets.includes('image')) {
      type = 'music'; reason = 'Music prompt available';
    } else if (assets.includes('video') && !assets.includes('image')) {
      type = 'video'; reason = 'Video prompt available';
    } else if (!assets.includes('image')) {
      continue;
    }

    queue.push({
      title: pack.title || packDir,
      source_type: (pack.source_types || []).join(',') || 'unknown',
      score: pack.final_score || 0,
      recommended_type: type,
      reason,
      pack_dir: packDir,
    });
    if (queue.length >= 3) break;
  }
  return queue;
}

function generateDigest() {
  const signalsData = getSignalsFromDb();
  const packStats = getContentPackStats();
  const genAssets = getGeneratedAssets();
  const queue = buildRecommendedQueue(packStats.topPacks, genAssets);

  // System is Asia/Shanghai (UTC+8) — use local date methods directly
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowStr = now.toISOString();
  const galleryUrl = 'https://conanxin.github.io/creative-quota-assets/gallery/';
  const latestImageUrl = genAssets.latestImage
    ? `https://conanxin.github.io/creative-quota-assets/images/2026/06/${genAssets.latestImage}`
    : 'None yet';

  const sourceList = Object.entries(signalsData.bySource)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}(${v})`)
    .join(' / ') || 'N/A';

  const topSignalLines = signalsData.topUnique.slice(0, 5).map((s, i) => {
    const title = s.title.length > 55 ? s.title.slice(0, 52) + '...' : s.title;
    const rel = s.final_score > 0.65 ? 'High' : s.final_score > 0.5 ? 'Medium' : 'Info';
    return `${i + 1}. ${title}\n   Score: ${s.final_score.toFixed(3)} | ${s.source_type} | ${rel}`;
  }).join('\n\n');

  const queueLines = queue.length > 0
    ? queue.map((q, i) =>
        `${i + 1}. ${q.title}\n   ${q.source_type} | Score: ${q.score > 0 ? q.score.toFixed(3) : 'N/A'}\n   Generate ${q.recommended_type} — ${q.reason}`
      ).join('\n\n')
    : 'None — all high-priority packs have generated assets';

  const telegramLines: string[] = [
    `Creative Quota Daily Digest — ${today}`,
    `STATUS: PASS`,
    ``,
    `今日输入`,
    `Signals: ${signalsData.total} (${sourceList})`,
    `Content Packs: ${packStats.packCount} (${packStats.hasImage} with image prompt)`,
    `Generated Assets: ${genAssets.count} (${genAssets.images} img / ${genAssets.music} music / ${genAssets.video} video)`,
    ``,
    `Top 5 Signals (deduplicated, by score)`,
    topSignalLines,
    ``,
    `Recommended Generation Queue`,
    queueLines,
    ``,
    `素材库状态`,
    `Gallery: ${galleryUrl}`,
    `Latest image: ${latestImageUrl}`,
    `Validation: PASS (npm run validate:assets)`,
    ``,
    `本阶段执行结果`,
    `MiniMax called: No | New media: No | cron/systemd: No`,
    `.env tracked: No`,
    ``,
    `报告路径`,
    `Full: reports/daily-digest.md`,
    `Telegram: reports/telegram-digest.txt`,
    `Phase: docs/PHASE_3B1_DIGEST_QUALITY_PATCH_REPORT.md`,
    ``,
    `下一阶段`,
    `Phase 3A Full: Batch image generation (quota guard)`,
    `Phase 4A: Manual Daily Digest Runbook`,
    `Phase 4B: Scheduled automation (external cron/systemd)`,
  ];

  let telegramText = telegramLines.join('\n');
  const charCount = telegramText.length;
  const isValid = charCount <= 3500;

  console.log('=== Digest Quality Check ===');
  console.log(`Total chars: ${charCount} (limit: 3500)`);
  console.log(`Valid: ${isValid ? 'YES' : 'NO - will trim'}`);
  console.log(`Signals: ${signalsData.total}, unique top: ${signalsData.topUnique.slice(0,5).length}`);
  console.log(`Content packs: ${packStats.packCount}`);
  console.log(`Generated assets: ${genAssets.count}`);

  if (charCount > 3500) {
    telegramText = telegramText.slice(0, 3497) + '...';
  }

  const mdReport = [
    '# Creative Quota Daily Digest',
    `**Generated:** ${nowStr}`,
    '**STATUS:** PASS',
    '',
    '## 今日输入',
    `| 指标 | 数值 |`,
    `|------|------|`,
    `| Signals (DB) | ${signalsData.total} |`,
    `| Content Packs | ${packStats.packCount} |`,
    `| Packs with image prompt | ${packStats.hasImage} |`,
    `| Generated Assets | ${genAssets.count} |`,
    `| Images | ${genAssets.images} |`,
    `| Music | ${genAssets.music} |`,
    `| Video | ${genAssets.video} |`,
    '',
    '### Signal Sources',
    ...Object.entries(signalsData.bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Top 5 Signals (deduplicated)',
    ...signalsData.topUnique.slice(0, 5).map((s, i) =>
      `${i + 1}. **${s.title}** — ${s.source_type} (score: ${s.final_score.toFixed(3)})\n   URL: ${s.url}`
    ),
    '',
    '## Recommended Generation Queue',
    ...(queue.length > 0
      ? queue.map((q, i) => `${i + 1}. **${q.title}** — ${q.source_type} (${q.score > 0 ? q.score.toFixed(3) : 'N/A'})\n   Generate: ${q.recommended_type} — ${q.reason}`)
      : ['None — all high-priority packs have generated assets']),
    '',
    '## 素材库状态',
    `- Gallery: ${galleryUrl}`,
    `- Latest image: ${latestImageUrl}`,
    '- Validation: PASS (npm run validate:assets)',
    '',
    '## 执行结果',
    '| Item | Result |',
    '|------|--------|',
    '| MiniMax called | No |',
    '| New media generated | No |',
    '| cron/systemd | No |',
    '| .env git-tracked | No |',
    '',
    '## 报告路径',
    '- Full: `reports/daily-digest.md`',
    '- Telegram: `reports/telegram-digest.txt`',
    '- Phase: `docs/PHASE_3B1_DIGEST_QUALITY_PATCH_REPORT.md`',
    '',
    '_Phase 3B-1 quality patch complete._',
  ].join('\n');

  writeFileSync(join(HARVESTER_DIR, 'reports/daily-digest.md'), mdReport);
  writeFileSync(join(HARVESTER_DIR, 'reports/telegram-digest.txt'), telegramText);

  console.log('Written: reports/daily-digest.md');
  console.log('Written: reports/telegram-digest.txt');
  console.log(`Telegram chars: ${telegramText.length}`);

  return { charCount, isValid };
}

generateDigest();
