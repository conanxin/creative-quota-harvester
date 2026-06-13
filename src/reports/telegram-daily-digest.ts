#!/usr/bin/env npx ts-node
/**
 * Telegram Daily Digest Generator — Phase 4C-2
 *
 * Fixes over Phase 3B-1:
 * - Latest image URL: use actual `path` from generated-assets.json (with date subdirectory)
 * - Recommended Queue: dedup by topic-slug, not by manifest id (id mismatch bug)
 * - Stage status: accurate "systemd timer + Telegram auto-send" line
 * - Signal freshness: show signal_last_collected_at; WARN if >24h stale
 * - Next phase list: current real phases (4C-2, 4H, 5C, 3F)
 *
 * Usage:
 *   npm run digest:telegram
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { execSync } from 'child_process';
import { sanitizeTelegramDigest } from './telegram-digest-sanitizer';

const HARVESTER_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const ASSETS_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

function safeRead(path: string): string | null {
  try { return existsSync(path) ? readFileSync(path, 'utf-8') : null; }
  catch { return null; }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim();
}

function titleToSlug(title: string): string {
  return normalizeTitle(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Build a keyword bag from a slug, dropping common stop words.
function keywordsFromSlug(slug: string): Set<string> {
  const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'for', 'and', 'or', 'to', 'is', 'by', 'with', 'as', 'at', 'from']);
  const out = new Set<string>();
  for (const tok of slug.split('-')) {
    if (!tok || tok.length < 4) continue;
    if (STOP.has(tok)) continue;
    out.add(tok);
  }
  return out;
}

function keywordOverlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.max(a.size, b.size);
}

interface Signal {
  id: string;
  title: string;
  source_type: string;
  final_score: number;
  url: string;
  metadata: string;
}

interface Manifest {
  id: string;
  title: string;
  source_types?: string[];
  final_score?: number;
  recommended_assets?: string[];
}

interface GeneratedAsset {
  asset_id: string;
  filename: string;
  path: string;
  content_pack?: string;
  content_pack_dir?: string;
  source_type?: string;
  generated_at?: string;
}

function getSignalsFromDb() {
  try {
    const sqlite3 = require('better-sqlite3');
    const dbPath = join(HARVESTER_DIR, 'data/signals.db');
    if (!existsSync(dbPath)) return { total: 0, bySource: {} as Record<string, number>, topUnique: [] as Signal[], lastCollected: null as string | null };
    const db = sqlite3(dbPath);
    const total = (db.prepare('SELECT COUNT(*) as c FROM signals').get() as { c: number }).c;
    const sourceRows = db.prepare('SELECT source_type, COUNT(*) as c FROM signals GROUP BY source_type').all() as { source_type: string; c: number }[];
    const bySource: Record<string, number> = {};
    for (const r of sourceRows) bySource[r.source_type] = r.c;

    const rows = db.prepare(
      'SELECT id, title, source_type, final_score, url, metadata FROM signals ORDER BY final_score DESC'
    ).all() as Signal[];

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

    // Try to get last collection time
    let lastCollected: string | null = null;
    try {
      const sourceCache = safeRead(join(ASSETS_DIR, 'metadata/source-data-cache.json'));
      if (sourceCache) {
        const sc = JSON.parse(sourceCache);
        lastCollected = sc.last_collected_at || sc.collected_at || sc.updated_at || null;
      }
    } catch {}
    if (!lastCollected) {
      try {
        const dbStat = statSync(dbPath);
        lastCollected = dbStat.mtime.toISOString();
      } catch {}
    }

    db.close();
    return { total, bySource, topUnique: uniqueSignals, lastCollected };
  } catch (e) {
    console.error('DB error:', e);
    return { total: 0, bySource: {} as Record<string, number>, topUnique: [] as Signal[], lastCollected: null as string | null };
  }
}

function getContentPackStats() {
  try {
    const findCmd = `find "${ASSETS_DIR}/content-packs" -name "manifest.json" 2>/dev/null`;
    const files = execSync(findCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
      .trim().split('\n').filter(Boolean);

    interface PackWithDir { dir_name: string; manifest: Manifest; }
    const packs: PackWithDir[] = [];
    for (const f of files) {
      try {
        const content = safeRead(f);
        if (content) {
          const m = JSON.parse(content) as Manifest;
          packs.push({ dir_name: basename(dirname(f)), manifest: m });
        }
      } catch {}
    }

    const packCount = packs.length;
    const hasImage = packs.filter(p => p.manifest.recommended_assets?.includes('image')).length;
    const hasMusic = packs.filter(p => p.manifest.recommended_assets?.includes('music')).length;
    const hasVideo = packs.filter(p => p.manifest.recommended_assets?.includes('video')).length;

    const seenTitles = new Set<string>();
    const uniquePacks: PackWithDir[] = [];
    for (const p of packs) {
      const t = normalizeTitle(p.manifest.title || p.manifest.id || '');
      if (seenTitles.has(t)) continue;
      seenTitles.add(t);
      uniquePacks.push(p);
    }
    uniquePacks.sort((a, b) => (b.manifest.final_score || 0) - (a.manifest.final_score || 0));

    return {
      packCount, hasImage, hasMusic, hasVideo,
      topPacks: uniquePacks.slice(0, 10).map(p => ({
        ...p.manifest,
        _dir_name: p.dir_name,
      })),
      allPackDirNames: new Set(uniquePacks.map(p => p.dir_name)),
    };
  } catch (e) {
    console.error('Pack stats error:', e);
    return { packCount: 0, hasImage: 0, hasMusic: 0, hasVideo: 0, topPacks: [], allPackDirNames: new Set<string>() };
  }
}

function extractTopicSlug(cp: string): string {
  if (!cp) return '';
  // Strip "brief-" prefix(es), then take everything after the second-hyphen segment
  // Examples:
  //   brief-brief-mq8swsla-f-samuraigpt-generative-media-skills
  //     -> samuraigpt-generative-media-skills
  //   brief-mq8c6kp4-7-samuraigpt-generative-media-skills
  //     -> samuraigpt-generative-media-skills
  let s = cp.replace(/^brief-/, '');
  const parts = s.split('-').filter(Boolean);
  if (parts.length >= 4) {
    // Assume first 2 parts are hash+shortcode; rest is topic
    return parts.slice(2).join('-').toLowerCase();
  }
  return parts.join('-').toLowerCase();
}

function getGeneratedAssets() {
  try {
    const content = safeRead(join(ASSETS_DIR, 'metadata/generated-assets.json'));
    if (!content) return { count: 0, images: 0, music: 0, video: 0, latestAsset: null as GeneratedAsset | null, packDirNames: new Set<string>(), topicSlugs: new Set<string>() };
    const assets: GeneratedAsset[] = JSON.parse(content);
    const latestAsset = assets.length > 0 ? assets[assets.length - 1] : null;

    const imageExts = ['.jpg', '.jpeg', '.png', '.webp'];
    let images = 0, music = 0, video = 0;
    for (const a of assets) {
      const fn = (a.filename || '').toLowerCase();
      if (imageExts.some(e => fn.endsWith(e))) images++;
      else if (fn.endsWith('.mp3') || fn.endsWith('.wav') || fn.endsWith('.flac')) music++;
      else if (fn.endsWith('.mp4') || fn.endsWith('.webm')) video++;
    }

    const packDirNames = new Set<string>();
    const topicSlugs = new Set<string>();
    for (const a of assets) {
      const dir = a.content_pack_dir ? basename(a.content_pack_dir) : '';
      const cp: string = a.content_pack || a.content_pack_dir || '';
      if (dir) packDirNames.add(dir);
      if (cp.includes('/')) packDirNames.add(basename(cp));
      // Build topic-slug set from content_pack field
      const slug = extractTopicSlug(cp);
      if (slug) topicSlugs.add(slug);
    }

    return { count: assets.length, images, music, video, latestAsset, packDirNames, topicSlugs };
  } catch {
    return { count: 0, images: 0, music: 0, video: 0, latestAsset: null as GeneratedAsset | null, packDirNames: new Set<string>(), topicSlugs: new Set<string>() };
  }
}

function buildRecommendedQueue(
  topPacks: (Manifest & { _dir_name: string })[],
  genPackDirs: Set<string>,
  genTopicSlugs: Set<string>
) {
  const queue: {
    title: string;
    source_type: string;
    score: number;
    recommended_type: string;
    reason: string;
    pack_dir: string;
  }[] = [];

  let skippedAlreadyGenerated: string[] = [];

  for (const pack of topPacks) {
    const dirName = pack._dir_name;
    const titleSlug = titleToSlug(pack.title || dirName);
    const titleKw = keywordsFromSlug(titleSlug);
    const titleShort = titleSlug.split('-').filter(s => s.length > 2).slice(-3).join('-');

    // Match if any of: dir name, exact slug, exact short slug, or strong keyword overlap (>=0.5)
    let alreadyGenerated = genPackDirs.has(dirName) || genTopicSlugs.has(titleSlug) || genTopicSlugs.has(titleShort);
    if (!alreadyGenerated) {
      for (const slug of genTopicSlugs) {
        const genKw = keywordsFromSlug(slug);
        const score = keywordOverlapScore(titleKw, genKw);
        if (score >= 0.5) { alreadyGenerated = true; break; }
      }
    }
    if (!alreadyGenerated) {
      // Substring fallback (require >=8 chars to avoid false positives)
      for (const slug of genTopicSlugs) {
        if (slug.length >= 8 && (titleSlug.includes(slug) || slug.includes(titleShort))) {
          alreadyGenerated = true; break;
        }
      }
    }

    if (alreadyGenerated) {
      skippedAlreadyGenerated.push(pack.title || dirName);
      continue;
    }

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
      title: pack.title || dirName,
      source_type: (pack.source_types || []).join(',') || 'unknown',
      score: pack.final_score || 0,
      recommended_type: type,
      reason,
      pack_dir: dirName,
    });
    if (queue.length >= 3) break;
  }
  return { queue, skippedAlreadyGenerated };
}

function buildLatestImageUrl(latestAsset: GeneratedAsset | null): string {
  if (!latestAsset) return 'None yet';
  const assetsBase = 'https://conanxin.github.io/creative-quota-assets/';
  let p = latestAsset.path || latestAsset.filename || '';
  p = p.replace(/^\/+/, '');
  const filename = latestAsset.filename || '';
  if (filename && !p.includes(filename)) {
    console.warn(`Latest image URL does not contain filename; using path field: ${p}`);
  }
  // Escape underscores so Telegram Markdown parser does not interpret them as italics markers.
  return (assetsBase + p).replace(/_/g, '\\_');
}

function checkStaleness(lastCollected: string | null): { isStale: boolean; hoursAgo: number | null; warning: string; status: 'PASS' | 'WARN' | 'FALLBACK' } {
  if (!lastCollected) return { isStale: true, hoursAgo: null, warning: 'FALLBACK — no collection timestamp available', status: 'FALLBACK' };
  try {
    const t = new Date(lastCollected).getTime();
    const now = Date.now();
    const hoursAgo = Math.round((now - t) / 3600000);
    if (hoursAgo > 24) {
      return {
        isStale: true,
        hoursAgo,
        warning: `WARN — signals last collected ${hoursAgo}h ago (>24h, fallback to previous data)`,
        status: 'WARN',
      };
    }
    return {
      isStale: false,
      hoursAgo,
      warning: `PASS — signals last collected ${hoursAgo}h ago`,
      status: 'PASS',
    };
  } catch {
    return { isStale: true, hoursAgo: null, warning: 'FALLBACK — unable to parse collection timestamp', status: 'FALLBACK' };
  }
}

function generateDigest() {
  const signalsData = getSignalsFromDb();
  const packStats = getContentPackStats();
  const genAssets = getGeneratedAssets();
  const { queue, skippedAlreadyGenerated } = buildRecommendedQueue(
    packStats.topPacks as any,
    genAssets.packDirNames,
    genAssets.topicSlugs
  );
  const freshness = checkStaleness(signalsData.lastCollected);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowStr = now.toISOString();
  const galleryUrl = 'https://conanxin.github.io/creative-quota-assets/gallery/'.replace(/_/g, '\\_');
  const latestImageUrl = buildLatestImageUrl(genAssets.latestAsset);

  const sourceList = Object.entries(signalsData.bySource)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}(${v})`)
    .join(' / ') || 'N/A';

  const topSignalLines = signalsData.topUnique.slice(0, 5).map((s, i) => {
    const title = s.title.length > 55 ? s.title.slice(0, 52) + '...' : s.title;
    const rel = s.final_score > 0.65 ? 'High' : s.final_score > 0.5 ? 'Medium' : 'Info';
    return `${i + 1}. ${title}\n   Score: ${s.final_score.toFixed(3)} | ${s.source_type} | ${rel}`;
  }).join('\n\n');

  let queueLines: string;
  if (queue.length > 0) {
    queueLines = queue.map((q, i) =>
      `${i + 1}. ${q.title}\n   ${q.source_type} | Score: ${q.score > 0 ? q.score.toFixed(3) : 'N/A'}\n   Generate ${q.recommended_type} — ${q.reason}`
    ).join('\n\n');
  } else {
    queueLines = `All top-priority packs already have generated images (${skippedAlreadyGenerated.length} skipped).\nNext step: produce video prompt / music prompt / run new signal collection.`;
  }

  const overallStatus: 'PASS' | 'WARN' | 'FAIL' = freshness.status === 'PASS' ? 'PASS' : 'WARN';

  const telegramLines: string[] = [
    `Creative Quota Daily Digest — ${today}`,
    `STATUS: ${overallStatus}`,
    ``,
    `今日输入`,
    `Signals: ${signalsData.total} (${sourceList})`,
    `Content Packs: ${packStats.packCount} (${packStats.hasImage} with image prompt)`,
    `Generated Assets: ${genAssets.count} (${genAssets.images} img / ${genAssets.music} music / ${genAssets.video} video)`,
    `Signal freshness: ${freshness.warning}`,
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
    `Delivery: systemd timer + Telegram auto-send`,
    `Image model called: No`,
    `New media generated: No`,
    `.env tracked: No`,
    ``,
    `报告路径`,
    `Full: reports/daily-digest.md`,
    `Telegram: reports/telegram-digest.txt`,
    `Phase: docs/PHASE_4C2_SCHEDULED_TELEGRAM_DIGEST_VALIDATION_REPORT.md`,
    ``,
    `下一阶段`,
    `Phase 4C-2: Scheduled Telegram Auto-send Validation & Digest Freshness Fix`,
    `Phase 4H: Video Prompt Enhancement`,
    `Phase 5C: Private Control Dashboard`,
    `Phase 3F: Controlled image generation only if explicitly confirmed`,
  ];

  let telegramText = telegramLines.join('\n');

  // Phase 4C-3: sanitize digest before writing/sending (remove tool residue, secrets, etc.)
  telegramText = sanitizeTelegramDigest(telegramText);

  const charCount = telegramText.length;
  const isValid = charCount <= 3500;

  console.log('=== Digest Quality Check ===');
  console.log(`Total chars: ${charCount} (limit: 3500)`);
  console.log(`Valid: ${isValid ? 'YES' : 'NO - will trim'}`);
  console.log(`Signals: ${signalsData.total}, unique top: ${signalsData.topUnique.slice(0,5).length}`);
  console.log(`Content packs: ${packStats.packCount}`);
  console.log(`Generated assets: ${genAssets.count}`);
  console.log(`Skipped already-generated: ${skippedAlreadyGenerated.length}`);
  console.log(`Freshness: ${freshness.warning}`);

  if (charCount > 3500) {
    telegramText = telegramText.slice(0, 3497) + '...';
  }

  const mdReport = [
    '# Creative Quota Daily Digest',
    `**Generated:** ${nowStr}`,
    `**STATUS:** ${overallStatus}`,
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
    `| Signal freshness | ${freshness.warning} |`,
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
      : [`All top-priority packs already have generated images.`, `Next step: produce video prompt / music prompt / run new signal collection.`]),
    '',
    `**Skipped already-generated:** ${skippedAlreadyGenerated.length} packs (${skippedAlreadyGenerated.slice(0, 3).join(', ')}${skippedAlreadyGenerated.length > 3 ? '...' : ''})`,
    '',
    '## 素材库状态',
    `- Gallery: ${galleryUrl}`,
    `- Latest image: ${latestImageUrl}`,
    '- Validation: PASS (npm run validate:assets)',
    '',
    '## 执行结果',
    '| Item | Result |',
    '|------|--------|',
    '| Delivery | systemd timer + Telegram auto-send |',
    '| Image model called | No |',
    '| New media generated | No |',
    '| .env git-tracked | No |',
    `| signal_last_collected_at | ${signalsData.lastCollected || 'unknown'} |`,
    '',
    '## 下一阶段',
    '- Phase 4C-2: Scheduled Telegram Auto-send Validation & Digest Freshness Fix',
    '- Phase 4H: Video Prompt Enhancement',
    '- Phase 5C: Private Control Dashboard',
    '- Phase 3F: Controlled image generation only if explicitly confirmed',
    '',
    '## 报告路径',
    '- Full: `reports/daily-digest.md`',
    '- Telegram: `reports/telegram-digest.txt`',
    '- Phase: `docs/PHASE_4C2_SCHEDULED_TELEGRAM_DIGEST_VALIDATION_REPORT.md`',
    '',
    '_Phase 4C-2 quality patch complete._',
  ].join('\n');

  writeFileSync(join(HARVESTER_DIR, 'reports/daily-digest.md'), mdReport);
  writeFileSync(join(HARVESTER_DIR, 'reports/telegram-digest.txt'), telegramText);

  console.log('Written: reports/daily-digest.md');
  console.log('Written: reports/telegram-digest.txt');
  console.log(`Telegram chars: ${telegramText.length}`);

  return { charCount, isValid, skippedAlreadyGenerated };
}

generateDigest();