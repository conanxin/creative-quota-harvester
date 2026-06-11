#!/usr/bin/env tsx
/**
 * scripts/validate-public-gallery.ts
 *
 * Validates the public gallery is correctly configured:
 * - Card layout, filtering, static content
 * - Daily archive links, JSON validity
 * - No broken links, no API leaks
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

interface Check { name: string; pass: boolean; detail: string; }
function check(cond: boolean, name: string, detail = ''): Check {
  return { name, pass: cond, detail };
}

function main() {
  const checks: Check[] = [];
  const html = readFileSync(join(ASSETS, 'gallery', 'index.html'), 'utf8');

  // ── Phase 4E-6: Card Layout & Filter Checks ───────────
  checks.push(check(html.includes('asset-card'), 'Has asset-card class'));
  checks.push(check(html.includes('data-source-type'), 'Has data-source-type attribute'));
  checks.push(check(html.includes('data-filter'), 'Has data-filter attribute'));
  checks.push(check(html.includes('asset-grid'), 'Has asset-grid class'));
  checks.push(check(html.includes('image-grid'), 'Has image-grid class'));
  checks.push(check(html.includes('data-kind="content-pack"'), 'Has data-kind content-pack'));
  checks.push(check(html.includes('data-kind="generated-image"'), 'Has data-kind generated-image'));
  checks.push(check(!html.includes('正在加载素材'), 'No loading text'));
  checks.push(check(html.includes('addEventListener'), 'Has JS event listener'));
  checks.push(check(html.includes('querySelectorAll'), 'Has JS querySelectorAll'));
  checks.push(check(html.includes('暂无匹配素材'), 'Has empty state text'));
  checks.push(check(html.includes('btn-primary'), 'Has primary button class'));

  // Count cards
  const packCards = (html.match(/data-kind="content-pack"/g) || []).length;
  const imgCards = (html.match(/data-kind="generated-image"/g) || []).length;
  const filterBtns = (html.match(/data-filter=/g) || []).length;
  checks.push(check(packCards >= 25, 'Has >= 25 content pack cards', `${packCards} found`));
  checks.push(check(imgCards >= 3, 'Has >= 3 image cards', `${imgCards} found`));
  checks.push(check(filterBtns >= 7, 'Has >= 7 filter buttons', `${filterBtns} found`));

  // ── Phase 4E-5: Static Content & Link Checks ───────────
  checks.push(check(html.includes('SamurAIGPT'), 'Has SamurAIGPT content'));
  checks.push(check(html.includes('cqa-2026-06-11'), 'Has generated image filename'));
  checks.push(check(!html.includes('gallery/daily'), 'No gallery/daily link'));
  checks.push(check(!html.includes('href="daily/"'), 'No href="daily/" wrong link'));
  checks.push(check(html.includes('href="/creative-quota-assets/daily/"'), 'Has correct daily absolute link'));

  // ── Phase 4E-5: CSS & Mobile Checks ───────────────────
  const galStyleEnd = html.lastIndexOf('</style>');
  const galMobileStart = html.indexOf('/* ── Mobile Responsive');
  checks.push(check(galMobileStart < 0 || galMobileStart < galStyleEnd, 'Gallery mobile CSS inside style tag'));

  const dailyHtml = readFileSync(join(ASSETS, 'daily', 'index.html'), 'utf8');
  const dailyStyleEnd = dailyHtml.lastIndexOf('</style>');
  const dailyMobileStart = dailyHtml.indexOf('/* ── Mobile Responsive');
  checks.push(check(dailyMobileStart < 0 || dailyMobileStart < dailyStyleEnd, 'Daily mobile CSS inside style tag'));

  // ── JSON Validity ──────────────────────────────────────
  const assetsPath = join(ASSETS, 'gallery', 'assets.json');
  if (existsSync(assetsPath)) {
    try {
      const d = JSON.parse(readFileSync(assetsPath, 'utf8'));
      const assets = d.assets || d;
      checks.push(check(Array.isArray(assets), 'gallery/assets.json valid', `${assets.length} items`));
    } catch (e: any) {
      checks.push(check(false, 'gallery/assets.json valid', e.message));
    }
  }

  const cpPath = join(ASSETS, 'metadata', 'content-pack-index.json');
  if (existsSync(cpPath)) {
    try {
      const d = JSON.parse(readFileSync(cpPath, 'utf8'));
      checks.push(check(Array.isArray(d.content_packs), 'content-pack-index.json valid', `${d.content_packs?.length || 0} packs`));
    } catch (e: any) {
      checks.push(check(false, 'content-pack-index.json valid', e.message));
    }
  }

  const genPath = join(ASSETS, 'metadata', 'generated-assets.json');
  if (existsSync(genPath)) {
    try {
      const d: any[] = JSON.parse(readFileSync(genPath, 'utf8'));
      checks.push(check(Array.isArray(d), 'generated-assets.json valid', `${d.length} images`));
    } catch (e: any) {
      checks.push(check(false, 'generated-assets.json valid', e.message));
    }
  }

  // ── Daily Pages ────────────────────────────────────────
  checks.push(check(existsSync(join(ASSETS, 'daily', 'index.html')), 'daily/index.html exists'));
  const calPath = join(ASSETS, 'daily', 'calendar-index.json');
  if (existsSync(calPath)) {
    try {
      const cal = JSON.parse(readFileSync(calPath, 'utf8'));
      let dayPagesOk = 0;
      for (const day of cal.days || []) {
        const detailUrl = day.detail_url || '';
        const raw = detailUrl.replace(/^\//, '').replace(/\/$/, '').replace(/^creative-quota-assets\//, '');
        const dayDir = join(ASSETS, raw);
        if (existsSync(join(dayDir, 'index.html'))) dayPagesOk++;
      }
      checks.push(check(dayPagesOk === cal.days.length, 'All daily day pages exist', `${dayPagesOk}/${cal.days.length}`));
    } catch {}
  }

  // ── Safety ─────────────────────────────────────────────
  checks.push(check(!html.includes('No Real Media Generated Yet'), 'No outdated status text'));
  checks.push(check(!html.includes('[truncated]'), 'No [truncated] markers'));
  checks.push(check(!html.match(/\bapi_key|secret|token|password\b/i), 'No API key leaks'));

  // ── Results ────────────────────────────────────────────
  const passCount = checks.filter(c => c.pass).length;
  const totalCount = checks.length;
  const allPass = passCount === totalCount;

  console.log(`\n=== validate-public-gallery ===`);
  for (const c of checks) {
    console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}${c.detail ? ' (' + c.detail + ')' : ''}`);
  }
  console.log(`\nResult: ${passCount}/${totalCount} checks passed${allPass ? ' — ALL PASS' : ' — SOME FAIL'}`);

  process.exit(allPass ? 0 : 1);
}

main();
