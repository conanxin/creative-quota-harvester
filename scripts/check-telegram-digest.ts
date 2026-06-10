#!/usr/bin/env npx ts-node
/**
 * check-telegram-digest.ts — Phase 3B-2
 * Validates reports/telegram-digest.txt is Telegram-ready.
 * 
 * Checks:
 * - Char count <= 3500
 * - No "[truncated"
 * - No large JSON blocks
 * - No long tables (>|---)
 * - Contains required sections: STATUS, Top Picks, Recommended Generation Queue, Gallery
 * 
 * Usage:
 *   npm run digest:telegram:check
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const HARVESTER_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const DIGEST_TXT = join(HARVESTER_DIR, 'reports/telegram-digest.txt');

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

function run(): { overall: boolean; checks: CheckResult[] } {
  const checks: CheckResult[] = [];

  // 1. File exists
  const exists = existsSync(DIGEST_TXT);
  checks.push({
    name: 'File exists',
    pass: exists,
    detail: exists ? `Found: ${DIGEST_TXT}` : `Missing: ${DIGEST_TXT}`,
  });
  if (!exists) return { overall: false, checks };

  // 2. Char count
  const content = readFileSync(DIGEST_TXT, 'utf-8');
  const charCount = content.length;
  checks.push({
    name: 'Char count <= 3500',
    pass: charCount <= 3500,
    detail: `${charCount} chars ${charCount <= 3500 ? '' : '(FAIL)'} (limit: 3500)`,
  });

  // 3. No truncation marker
  const hasTruncated = content.includes('[truncated');
  checks.push({
    name: 'No truncation marker',
    pass: !hasTruncated,
    detail: hasTruncated ? 'Contains "[truncated]"' : 'OK',
  });

  // 4. No large JSON
  const jsonBlockRegex = /\{[\s\S]{200,}\}/g;
  const jsonMatches = content.match(jsonBlockRegex);
  checks.push({
    name: 'No large JSON blocks',
    pass: !jsonMatches || jsonMatches.length === 0,
    detail: jsonMatches && jsonMatches.length > 0
      ? `Found ${jsonMatches.length} JSON block(s)`
      : 'OK',
  });

  // 5. No long tables
  const tableRegex = /\n\|[^|]+\|[^|-]+\|[^|]+\|/g;
  const tableLines = content.split('\n').filter(l => l.match(/^\|.*\|.*\|.*\|.*\|/) && !l.match(/^\|[- :]+\|/) && !l.match(/^\|#/));
  checks.push({
    name: 'No long tables',
    pass: tableLines.length <= 5,
    detail: tableLines.length <= 5
      ? `OK (${tableLines.length} table rows)`
      : `WARN: ${tableLines.length} table rows (Telegram-friendly if short)`,
  });

  // 6. Required sections
  const requiredSections = [
    { name: 'STATUS', found: content.includes('STATUS') },
    { name: 'Top Picks', found: content.includes('Top') && content.includes('Signals') },
    { name: 'Recommended Generation Queue', found: content.includes('Recommended Generation Queue') },
    { name: 'Gallery', found: content.includes('Gallery') || content.includes('gallery') },
  ];
  for (const s of requiredSections) {
    checks.push({
      name: `Section: ${s.name}`,
      pass: s.found,
      detail: s.found ? `Found: ${s.name}` : `MISSING: ${s.name}`,
    });
  }

  const allPass = checks.every(c => c.pass);
  console.log('\n=== Telegram Digest Contract Check ===');
  for (const c of checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name} — ${c.detail}`);
  }
  console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}\n`);

  return { overall: allPass, checks };
}

const result = run();
process.exit(result.overall ? 0 : 1);
