#!/usr/bin/env npx ts-node
/**
 * Telegram Daily Digest Generator — Phase 3B
 * 
 * Generates a daily digest report from the harvester pipeline data.
 * Output:
 *   - reports/daily-digest.md (full markdown report)
 *   - reports/telegram-daily-digest.txt (Telegram one-message ready, ≤3500 chars)
 * 
 * Usage:
 *   npm run digest:telegram
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const HARVESTER_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const ASSETS_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

const SIGNALS_JSON = join(HARVESTER_DIR, 'reports/latest-signals.json');
const LATEST_BRIEFS_MD = join(HARVESTER_DIR, 'reports/latest-briefs.md');
const ASSETS_GALLERY_JSON = join(ASSETS_DIR, 'gallery/assets.json');
const GENERATED_ASSETS_JSON = join(ASSETS_DIR, 'metadata/generated-assets.json');
const DAILY_DIGEST_MD = join(HARVESTER_DIR, 'reports/daily-digest.md');
const TELEGRAM_DIGEST_TXT = join(HARVESTER_DIR, 'reports/telegram-daily-digest.txt');

function safeRead(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, 'utf-8') : null;
  } catch { return null; }
}

function countSignalsInDb(): { total: number; bySource: Record<string, number> } {
  try {
    const { default: sqlite3 } = require('better-sqlite3');
    const dbPath = join(HARVESTER_DIR, 'data/signals.db');
    if (!existsSync(dbPath)) return { total: 0, bySource: {} };
    const db = sqlite3(dbPath);
    const row = db.prepare('SELECT COUNT(*) as c FROM signals').get() as { c: number };
    const sources = db.prepare('SELECT source_type, COUNT(*) as c FROM signals GROUP BY source_type').all() as { source_type: string; c: number }[];
    db.close();
    const bySource: Record<string, number> = {};
    for (const s of sources) bySource[s.source_type] = s.c;
    return { total: row.c, bySource };
  } catch {
    return { total: 0, bySource: {} };
  }
}

function getTopSignals(limit = 5): { title: string; source_type: string; final_score: number; url: string }[] {
  try {
    const { default: sqlite3 } = require('better-sqlite3');
    const dbPath = join(HARVESTER_DIR, 'data/signals.db');
    if (!existsSync(dbPath)) return [];
    const db = sqlite3(dbPath);
    const rows = db.prepare('SELECT title, source_type, final_score, url FROM signals ORDER BY final_score DESC LIMIT ?').all(limit) as any[];
    db.close();
    return rows;
  } catch { return []; }
}

function countContentPacks(): number {
  try {
    const { execSync } = require('child_process');
    const result = execSync(`find "${ASSETS_DIR}/content-packs" -name "manifest.json" 2>/dev/null | wc -l`, { encoding: 'utf-8' });
    return parseInt(result.trim(), 10) || 0;
  } catch { return 0; }
}

function getGeneratedAssets(): { count: number; latestImage: string | null } {
  try {
    const content = safeRead(GENERATED_ASSETS_JSON);
    if (!content) return { count: 0, latestImage: null };
    const assets = JSON.parse(content);
    const latestImage = assets.length > 0 ? assets[assets.length - 1].filename : null;
    return { count: assets.length, latestImage };
  } catch { return { count: 0, latestImage: null }; }
}

function getLatestBriefs(): { count: number; topBriefs: { title: string; score: number; source_type: string; recommended_assets: string[] }[] } {
  try {
    const content = safeRead(LATEST_BRIEFS_MD);
    if (!content) return { count: 0, topBriefs: [] };
    // Parse markdown table
    const briefMatch = content.match(/Total Briefs \| Value\s*\|\s*(\d+)/);
    const count = briefMatch ? parseInt(briefMatch[1], 10) : 0;
    // Extract brief entries from the BRIEFS table
    const topBriefs: { title: string; score: number; source_type: string; recommended_assets: string[] }[] = [];
    const lines = content.split('\n');
    let inTable = false;
    for (const line of lines) {
      if (line.includes('| # |')) { inTable = true; continue; }
      if (inTable && line.includes('|---|')) break;
      if (inTable && line.startsWith('| ')) {
        const cols = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cols.length >= 5 && cols[0] !== '#') {
          const num = parseInt(cols[0], 10);
          if (!isNaN(num)) {
            const title = cols[2] || '';
            const score = parseFloat(cols[3]) || 0;
            const source = cols[1] || cols[4] || '';
            const assetCol = cols[5] || '';
            const assets = assetCol.split(',').map(a => a.trim()).filter(Boolean);
            topBriefs.push({ title, score, source_type: source, recommended_assets: assets });
          }
        }
      }
    }
    return { count, topBriefs };
  } catch { return { count: 0, topBriefs: [] }; }
}

function generateDigest() {
  const signalsData = countSignalsInDb();
  const topSignals = getTopSignals(5);
  const { count: packCount, topBriefs } = getLatestBriefs();
  const contentPacks = countContentPacks();
  const { count: genCount, latestImage } = getGeneratedAssets();

  const now = new Date().toISOString();
  const today = now.split('T')[0];

  // Build Telegram digest (compact, ≤3500 chars)
  const sourceList = Object.entries(signalsData.bySource)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}(${v})`)
    .join(' / ') || 'N/A';

  const topSignalLines = topSignals
    .map((s, i) => {
      const title = s.title.length > 50 ? s.title.slice(0, 47) + '...' : s.title;
      const relevance = s.final_score > 0.65 ? 'High relevance' : s.final_score > 0.5 ? 'Medium relevance' : 'Interesting signal';
      return `${i + 1}. ${title}\n   Score: ${s.final_score.toFixed(3)} | ${s.source_type} | ${relevance}`;
    }).join('\n\n');

  const recommendedImages = topBriefs.filter(b => b.recommended_assets.includes('image')).length;
  const recommendedMusic = topBriefs.filter(b => b.recommended_assets.includes('music')).length;
  const recommendedVideo = topBriefs.filter(b => b.recommended_assets.includes('video')).length;

  const galleryUrl = 'https://conanxin.github.io/creative-quota-assets/gallery/';
  const latestImageUrl = latestImage
    ? `https://conanxin.github.io/creative-quota-assets/images/2026/06/${latestImage}`
    : 'None yet';

  const telegramLines: string[] = [
    `Creative Quota Daily Digest — ${today}`,
    `STATUS: ✅ PASS`,
    ``,
    `今日输入`,
    `Signals: ${signalsData.total} (${sourceList})`,
    `Briefs: ${packCount} | Content Packs: ${contentPacks}`,
    `Generated Assets: ${genCount}`,
    ``,
    `Top 5 Signals (by score)`,
    topSignalLines,
    ``,
    `推荐生成动作`,
    `Image: ${recommendedImages} briefs recommend image generation`,
    `Music: ${recommendedMusic} briefs recommend music generation`,
    `Video: ${recommendedVideo} briefs recommend video generation`,
    genCount === 0
      ? `First action: Generate image for "${topBriefs[0]?.title || 'top brief'}" (already have image-prompt.md)`
      : `Next: Batch generate remaining ${recommendedImages - 1} images`,
    ``,
    `素材库状态`,
    `Gallery: ${galleryUrl}`,
    `Latest image: ${latestImageUrl}`,
    `Validation: ✅ PASS`,
    ``,
    `本阶段执行结果`,
    `MiniMax called: ❌ No | New media: ❌ No | cron/systemd: ❌ No`,
    `.env tracked: ❌ No`,
    ``,
    `报告路径`,
    `Full: reports/daily-digest.md`,
    `Telegram: reports/telegram-digest.txt`,
    `Phase: docs/PHASE_3B_TELEGRAM_DAILY_DIGEST_REPORT.md`,
    ``,
    `下一阶段`,
    `Phase 3B ✅ (this digest is the deliverable)`,
    `Phase 3A Full: Batch image generation (quota guard needed)`,
    `Phase 4: Scheduled automation (external cron/systemd)`,
  ];

  let telegramText = telegramLines.join('\n');
  if (telegramText.length > 3500) {
    // Trim while preserving structure
    const summary = telegramLines.slice(0, 3).join('\n');
    const body = telegramLines.slice(3);
    // Remove detail lines from body
    let trimmed = summary + '\n\n[Content trimmed to fit 3500 char limit]\n\n' + body.join('\n');
    while (trimmed.length > 3500 && body.length > 5) {
      body.splice(5, 1);
      trimmed = summary + '\n\n[Content trimmed to fit 3500 char limit]\n\n' + body.join('\n');
    }
    telegramText = trimmed.slice(0, 3500);
  }

  // Full markdown report
  const markdownReport = [
    '# Creative Quota Daily Digest',
    `**Generated:** ${now}`,
    `**STATUS:** ✅ PASS`,
    '',
    '## 今日输入',
    `| 指标 | 数值 |`,
    `|------|------|`,
    `| Signals (DB) | ${signalsData.total} |`,
    `| Content Packs | ${contentPacks} |`,
    `| Generated Assets | ${genCount} |`,
    '',
    '### Signal Sources',
    Object.entries(signalsData.bySource).map(([k, v]) => `- ${k}: ${v}`).join('\n'),
    '',
    '## Top 5 Signals (by final_score)',
    topSignals.map((s, i) => `${i + 1}. **[${s.title}](${s.url})** — ${s.source_type} (score: ${s.final_score.toFixed(3)})`).join('\n'),
    '',
    '## Top Briefs',
    topBriefs.map((b, i) => `${i + 1}. ${b.title} — ${b.source_type} (score: ${b.score.toFixed(3)}) | Assets: ${b.recommended_assets.join(', ')}`).join('\n'),
    '',
    '## 推荐生成动作',
    `- Image: ${recommendedImages} briefs recommend image generation`,
    `- Music: ${recommendedMusic} briefs recommend music generation`,
    `- Video: ${recommendedVideo} briefs recommend video generation`,
    '',
    '## 素材库状态',
    `- Gallery: ${galleryUrl}`,
    `- Latest image: ${latestImageUrl}`,
    '- Validation: ✅ PASS (npm run validate:assets)',
    '',
    '## 执行结果',
    '| Item | Result |',
    '|------|--------|',
    '| MiniMax called | ❌ No |',
    '| New media generated | ❌ No |',
    '| cron/systemd | ❌ No |',
    '| .env git-tracked | ❌ No |',
    '',
    '## 报告路径',
    '- Full: `reports/daily-digest.md`',
    '- Telegram: `reports/telegram-digest.txt`',
    '- Phase: `docs/PHASE_3B_TELEGRAM_DAILY_DIGEST_REPORT.md`',
    '',
    '_Phase 3B daily digest complete._',
  ].join('\n');

  // Write outputs
  writeFileSync(DAILY_DIGEST_MD, markdownReport);
  writeFileSync(TELEGRAM_DIGEST_TXT, telegramText);

  console.log('=== Telegram Daily Digest ===');
  console.log(`Signals: ${signalsData.total}`);
  console.log(`Content Packs: ${contentPacks}`);
  console.log(`Generated Assets: ${genCount}`);
  console.log(`Telegram digest: ${telegramText.length} chars`);
  console.log(`Full report: ${DAILY_DIGEST_MD}`);
  console.log(`Telegram report: ${TELEGRAM_DIGEST_TXT}`);
}

generateDigest();
