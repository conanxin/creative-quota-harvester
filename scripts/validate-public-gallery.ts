#!/usr/bin/env tsx
/**
 * scripts/validate-public-gallery.ts
 *
 * Validates the public gallery is correctly configured:
 * - Data loading paths work
 * - Daily archive links are correct
 * - JSON files are valid
 * - No broken links to key assets
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

  // 1. gallery/index.html exists
  checks.push(check(existsSync(join(ASSETS, 'gallery', 'index.html')), 'gallery/index.html exists'));

  // 2. No wrong daily link (gallery/daily/)
  checks.push(check(
    !html.includes('href="daily/"'),
    'No href="daily/" wrong relative link'
  ));

  // 3. Correct daily link present
  checks.push(check(
    html.includes('href="/creative-quota-assets/daily/"'),
    'Has correct /creative-quota-assets/daily/ link'
  ));

  // 4. Has BASE path resolution
  checks.push(check(
    html.includes('getBase()') && html.includes("location.pathname"),
    'Has BASE path resolution (getBase)'
  ));

  // 5. assets.json valid
  const assetsPath = join(ASSETS, 'gallery', 'assets.json');
  let assetsOk = existsSync(assetsPath);
  if (assetsOk) {
    try {
      const d = JSON.parse(readFileSync(assetsPath, 'utf8'));
      const assets = d.assets || d;
      checks.push(check(Array.isArray(assets), 'gallery/assets.json is valid array', `${assets.length} items`));
      const hasCpd = assets.filter((a: any) => a.content_pack_dir).length;
      checks.push(check(hasCpd > 0, 'assets.json has content_pack_dir', `${hasCpd}/${assets.length}`));
    } catch (e: any) {
      checks.push(check(false, 'gallery/assets.json is valid JSON', e.message));
    }
  } else {
    checks.push(check(false, 'gallery/assets.json exists'));
  }

  // 6. content-pack-index.json valid
  const cpPath = join(ASSETS, 'metadata', 'content-pack-index.json');
  let cpOk = existsSync(cpPath);
  if (cpOk) {
    try {
      const d = JSON.parse(readFileSync(cpPath, 'utf8'));
      checks.push(check(Array.isArray(d.content_packs), 'content-pack-index.json valid', `${d.content_packs?.length || 0} packs`));
    } catch (e: any) {
      checks.push(check(false, 'content-pack-index.json valid JSON', e.message));
    }
  }
  checks.push(check(cpOk, 'content-pack-index.json exists'));

  // 7. generated-assets.json valid
  const genPath = join(ASSETS, 'metadata', 'generated-assets.json');
  checks.push(check(existsSync(genPath), 'generated-assets.json exists'));
  if (existsSync(genPath)) {
    try {
      const d: any[] = JSON.parse(readFileSync(genPath, 'utf8'));
      checks.push(check(Array.isArray(d), 'generated-assets.json valid', `${d.length} images`));
    } catch (e: any) {
      checks.push(check(false, 'generated-assets.json valid JSON', e.message));
    }
  }

  // 8. daily/index.html exists
  checks.push(check(existsSync(join(ASSETS, 'daily', 'index.html')), 'daily/index.html exists'));

  // 9. daily/calendar-index.json valid
  const calPath = join(ASSETS, 'daily', 'calendar-index.json');
  let calOk = existsSync(calPath);
  checks.push(check(calOk, 'calendar-index.json exists'));
  if (calOk) {
    try {
      const d = JSON.parse(readFileSync(calPath, 'utf8'));
      checks.push(check(Array.isArray(d.days), 'calendar-index.json days array', `${d.days?.length || 0} days`));
    } catch (e: any) {
      checks.push(check(false, 'calendar-index.json valid JSON', e.message));
    }
  }

  // 10. No outdated status text
  checks.push(check(
    !html.includes('No Real Media Generated Yet'),
    'No "No Real Media Generated Yet" text'
  ));

  // 11. No [truncated]
  checks.push(check(!html.includes('[truncated]'), 'No [truncated] markers'));

  // 12. No API key leaks
  checks.push(check(
    !html.match(/\bapi_key|secret|token|password\b/i),
    'No API key leaks in gallery HTML'
  ));

  // 13. Daily pages exist
  if (calOk) {
    try {
      const cal = JSON.parse(readFileSync(calPath, 'utf8'));
      let dayPagesOk = 0;
      for (const day of cal.days || []) {
        const detailUrl = day.detail_url || '';
        const dayDir = join(ASSETS, 'daily', detailUrl.replace(/^daily\//, '').replace(/\/$/, ''));
        if (existsSync(join(dayDir, 'index.html'))) dayPagesOk++;
      }
      checks.push(check(dayPagesOk === cal.days.length, 'All daily day pages exist', `${dayPagesOk}/${cal.days.length}`));
    } catch {}
  }

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