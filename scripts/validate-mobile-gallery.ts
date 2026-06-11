#!/usr/bin/env tsx
/**
 * scripts/validate-mobile-gallery.ts
 *
 * Validates mobile gallery UX requirements:
 * - @media (max-width: 720px) present
 * - No broken link patterns
 * - Pre-rendered content present
 * - No outdated status text
 * - No API key leaks
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

  // 1. Mobile CSS media query
  checks.push(check(
    html.includes('@media (max-width: 720px)'),
    'Has @media (max-width: 720px)'
  ));

  // 2. Daily archive link correct
  checks.push(check(
    html.includes('/creative-quota-assets/daily/'),
    'Has /creative-quota-assets/daily/ link'
  ));

  // 3. No broken detail.json patterns
  checks.push(check(
    !html.includes('detail.jsondetail.json'),
    'No detail.jsondetail.json broken link'
  ));

  // 4. No gallery/daily wrong link
  checks.push(check(
    !html.includes('gallery/daily'),
    'No gallery/daily wrong link'
  ));

  // 5. Pre-rendered pack content
  const packTitles = ['SamurAIGPT', 'Flaws in the LLM', 'Penitence'].filter(t => html.includes(t));
  checks.push(check(
    packTitles.length >= 2,
    'Pre-rendered content titles present',
    `${packTitles.length}/3`
  ));

  // 6. Generated image filename present
  checks.push(check(
    html.includes('cqa-2026-06-11-gen-') || html.includes('gen-'),
    'Generated image filename present'
  ));

  // 7. No "No Real Media Generated Yet"
  checks.push(check(
    !html.includes('No Real Media Generated Yet'),
    'No "No Real Media Generated Yet" text'
  ));

  // 8. No [truncated]
  checks.push(check(!html.includes('[truncated]'), 'No [truncated] markers'));

  // 9. No API key leaks
  checks.push(check(
    !html.match(/\bapi_key|secret|token|password\b/i),
    'No API key leaks in gallery HTML'
  ));

  // 10. Mobile stats format (short date)
  checks.push(check(
    html.includes('statUpdated') && !html.includes('T08:19:00+08:00'),
    'StatUpdated uses short format'
  ));

  // 11. Accent button or prominent CTA
  checks.push(check(
    html.includes('accent-btn') || html.includes('每日归档'),
    'Has prominent CTA button'
  ));

  // 12. Daily index mobile CSS
  const dailyHtml = readFileSync(join(ASSETS, 'daily', 'index.html'), 'utf8');
  checks.push(check(
    dailyHtml.includes('@media (max-width: 720px)'),
    'daily/index.html has mobile CSS'
  ));

  // 13. Daily detail pages mobile CSS
  const dayDetail11 = existsSync(join(ASSETS, 'daily/2026/06/2026-06-11/index.html'));
  if (dayDetail11) {
    const ddHtml = readFileSync(join(ASSETS, 'daily/2026/06/2026-06-11/index.html'), 'utf8');
    checks.push(check(
      ddHtml.includes('@media (max-width: 720px)'),
      'daily detail page has mobile CSS'
    ));
  } else {
    checks.push(check(false, 'daily detail page exists'));
  }

  // 14. No daily/daily links in daily HTML
  checks.push(check(
    !dailyHtml.includes('daily/daily'),
    'daily/index.html no daily/daily link'
  ));

  // 15. Pack card mobile-friendly (has pack-card class)
  checks.push(check(
    html.includes('pack-card'),
    'Has pack-card class for mobile styling'
  ));

  const passCount = checks.filter(c => c.pass).length;
  const totalCount = checks.length;
  const allPass = passCount === totalCount;

  console.log(`\n=== validate-mobile-gallery ===`);
  for (const c of checks) {
    console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}${c.detail ? ' (' + c.detail + ')' : ''}`);
  }
  console.log(`\nResult: ${passCount}/${totalCount} checks passed${allPass ? ' — ALL PASS' : ' — SOME FAIL'}`);

  process.exit(allPass ? 0 : 1);
}

main();