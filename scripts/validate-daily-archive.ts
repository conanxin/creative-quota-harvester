#!/usr/bin/env tsx
/**
 * scripts/validate-daily-archive.ts
 *
 * Validates the daily archive output.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ASSETS    = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';
const DAILY_DIR = join(ASSETS, 'daily');

interface Check { name: string; pass: boolean; detail: string; }
function check(cond: boolean, name: string, detail = ''): Check {
  return { name, pass: cond, detail };
}

function main() {
  const checks: Check[] = [];

  // 1. daily/index.html exists
  const indexHtml = join(DAILY_DIR, 'index.html');
  checks.push(check(existsSync(indexHtml), 'daily/index.html exists'));
  if (existsSync(indexHtml)) {
    const content = readFileSync(indexHtml, 'utf8');
    checks.push(check(content.includes('每日创意归档'), 'daily/index.html has Chinese title'));
    checks.push(check(!content.includes('[truncated]'), 'No [truncated] in index.html'));
  }

  // 2. calendar-index.json valid
  const calPath = join(DAILY_DIR, 'calendar-index.json');
  const calValid = existsSync(calPath);
  checks.push(check(calValid, 'calendar-index.json exists'));
  if (calValid) {
    try {
      const cal = JSON.parse(readFileSync(calPath, 'utf8'));
      checks.push(check(Array.isArray(cal.days), 'calendar-index.json days is array', `${cal.days?.length ||0} days`));
      if (cal.days?.length > 0) {
        const firstDay = cal.days[0];
        checks.push(check(firstDay.date, 'First day has date'));
        checks.push(check(typeof firstDay.content_pack_count === 'number', 'First day has content_pack_count'));
        checks.push(check(firstDay.detail_url, 'First day has detail_url'));
      }
    } catch (e: any) {
      checks.push(check(false, 'calendar-index.json valid JSON', e.message));
    }
  }

  // 3. Each day has detail page and daily-summary.json
  if (calValid) {
    try {
      const cal = JSON.parse(readFileSync(calPath, 'utf8'));
      let dayPagesOk = 0, daySummariesOk = 0;
      for (const day of cal.days || []) {
        const detailUrl = day.detail_url || '';
        // detail_url looks like "daily/YYYY/MM/YYYY-MM-DD/"
        const dayDir = join(DAILY_DIR, detailUrl.replace(/^daily\//, '').replace(/\/$/, ''));
        if (existsSync(join(dayDir, 'index.html'))) dayPagesOk++;
        if (existsSync(join(dayDir, 'daily-summary.json'))) {
          try {
            JSON.parse(readFileSync(join(dayDir, 'daily-summary.json'), 'utf8'));
            daySummariesOk++;
          } catch {}
        }
      }
      checks.push(check(dayPagesOk === cal.days.length, 'All day pages exist', `${dayPagesOk}/${cal.days.length}`));
      checks.push(check(daySummariesOk === cal.days.length, 'All daily-summary.json valid', `${daySummariesOk}/${cal.days.length}`));
    } catch {}
  }

  // 4. gallery/index.html links to daily
  const galleryHtml = join(ASSETS, 'gallery', 'index.html');
  if (existsSync(galleryHtml)) {
    const content = readFileSync(galleryHtml, 'utf8');
    checks.push(check(content.includes('daily') || content.includes('归档') || content.includes('日历'),
      'gallery/index.html links to daily archive'));
  }

  // 5. No API key leaks
  const noKeyLeak = !existsSync(join(DAILY_DIR, 'index.html')) ||
    !readFileSync(join(DAILY_DIR, 'index.html'), 'utf8').match(/\bapi_key|secret|token|password\b/i);
  checks.push(check(noKeyLeak, 'No API key leaks in archive'));

  const passCount = checks.filter(c => c.pass).length;
  const totalCount = checks.length;
  const allPass = passCount === totalCount;

  console.log(`\n=== validate-daily-archive ===`);
  for (const c of checks) {
    console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}${c.detail ? ' (' + c.detail + ')' : ''}`);
  }
  console.log(`\nResult: ${passCount}/${totalCount} checks passed${allPass ? ' — ALL PASS' : ' — SOME FAIL'}`);

  process.exit(allPass ? 0 : 1);
}

main();