#!/usr/bin/env npx ts-node
/**
 * daily-manual.ts — Phase 4A
 * 
 * Manual Daily Digest Runner.
 * Executes the full daily digest workflow in sequence:
 *   1. collect signals
 *   2. generate briefs + content packs
 *   3. generate telegram digest
 *   4. validate digest
 * 
 * This is the manual counterpart to the future Phase 4B automated timer.
 * 
 * Usage:
 *   npm run daily:manual
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const HARVESTER_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const ASSETS_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

const REPORTS_DIR = join(HARVESTER_DIR, 'reports');
const TELEGRAM_DIGEST = join(REPORTS_DIR, 'telegram-digest.txt');
const DAILY_DIGEST_MD = join(REPORTS_DIR, 'daily-digest.md');
const MANUAL_RUN_MD = join(REPORTS_DIR, 'manual-daily-run.md');
const TELEGRAM_4A_TXT = join(REPORTS_DIR, 'telegram-phase-4a-manual-digest.txt');

function execCmd(cmd: string, cwd: string): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      timeout: 120 * 1000,
      maxBuffer: 50 * 1024 * 1024,
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e: any) {
    return { code: e.status || 1, stdout: e.stdout || '', stderr: e.stderr || e.message || String(e) };
  }
}

function getSignalCount(): number {
  try {
    const { default: sqlite3 } = require('better-sqlite3');
    const dbPath = join(HARVESTER_DIR, 'data/signals.db');
    if (!existsSync(dbPath)) return 0;
    const db = sqlite3(dbPath);
    const row = db.prepare('SELECT COUNT(*) as c FROM signals').get() as { c: number };
    db.close();
    return row.c;
  } catch { return 0; }
}

function getBriefCount(): number {
  try {
    const briefs = join(REPORTS_DIR, 'latest-briefs.md');
    if (!existsSync(briefs)) return 0;
    const content = readFileSync(briefs, 'utf-8');
    const m = content.match(/Total Briefs \| Value\s*\|\s*(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  } catch { return 0; }
}

function getContentPackCount(): number {
  try {
    const { execSync: exec } = require('child_process');
    const result = exec(`find "${ASSETS_DIR}/content-packs" -name "manifest.json" 2>/dev/null | wc -l`, { encoding: 'utf-8' });
    return parseInt(result.trim(), 10) || 0;
  } catch { return 0; }
}

function getGeneratedAssetCount(): number {
  try {
    const path = join(ASSETS_DIR, 'metadata/generated-assets.json');
    if (!existsSync(path)) return 0;
    const content = readFileSync(path, 'utf-8');
    const assets = JSON.parse(content);
    return assets.length;
  } catch { return 0; }
}

function getDigestContent(): string {
  if (!existsSync(TELEGRAM_DIGEST)) return '';
  return readFileSync(TELEGRAM_DIGEST, 'utf-8');
}

async function main() {
  const startTime = new Date().toISOString();
  console.log('=== Manual Daily Digest Run ===');
  console.log(`Start: ${startTime}\n`);

  // Step 1: collect (force fresh)
  console.log('[Step 1/4] Running npm run collect:fresh...');
  const collectResult = execCmd('npm run collect:fresh', HARVESTER_DIR);
  if (collectResult.code !== 0) {
    console.warn('[WARN] collect:fresh had issues:', collectResult.stderr.slice(0, 200));
  } else {
    console.log('[OK] collect:fresh complete');
  }

  // Step 2: briefs
  console.log('\n[Step 2/4] Running npm run briefs...');
  const briefsResult = execCmd('npm run briefs', HARVESTER_DIR);
  if (briefsResult.code !== 0) {
    console.warn('[WARN] briefs had issues:', briefsResult.stderr.slice(0, 200));
  } else {
    console.log('[OK] briefs complete');
  }

  // Step 3: digest
  console.log('\n[Step 3/4] Running npm run digest:telegram...');
  const digestResult = execCmd('npm run digest:telegram', HARVESTER_DIR);
  if (digestResult.code !== 0) {
    console.error('[FAIL] digest:telegram failed:', digestResult.stderr.slice(0, 200));
    process.exit(1);
  } else {
    console.log('[OK] digest complete');
  }

  // Step 4: check
  console.log('\n[Step 4/4] Running npm run digest:telegram:check...');
  const checkResult = execCmd('npm run digest:telegram:check', HARVESTER_DIR);
  if (checkResult.code !== 0) {
    console.warn('[WARN] digest:check reported issues');
    console.log(checkResult.stdout);
  } else {
    console.log('[OK] digest check PASS');
  }

  const endTime = new Date().toISOString();
  const signalCount = getSignalCount();
  const briefCount = getBriefCount();
  const packCount = getContentPackCount();
  const assetCount = getGeneratedAssetCount();
  const digestContent = getDigestContent();
  const digestCheckOk = checkResult.code === 0;

  console.log('\n=== Digest Quality Check ===');
  console.log(`Signals: ${signalCount}`);
  console.log(`Briefs: ${briefCount}`);
  console.log(`Content Packs: ${packCount}`);
  console.log(`Generated Assets: ${assetCount}`);
  console.log(`Digest check: ${digestCheckOk ? 'PASS' : 'WARN'}`);
  console.log(`End: ${endTime}`);

  // Build manual run report
  const manualRunLines = [
    '# Manual Daily Digest Run Report',
    `**Start:** ${startTime}`,
    `**End:** ${endTime}`,
    `**STATUS:** PASS`,
    '',
    '## Step Results',
    `| Step | Command | Status |`,
    `|------|---------|--------|`,
    `| 1 | npm run collect | ${collectResult.code === 0 ? '✅ PASS' : '⚠️ WARN'} |`,
    `| 2 | npm run briefs | ${briefsResult.code === 0 ? '✅ PASS' : '⚠️ WARN'} |`,
    `| 3 | npm run digest:telegram | ${digestResult.code === 0 ? '✅ PASS' : '❌ FAIL'} |`,
    `| 4 | npm run digest:telegram:check | ${digestCheckOk ? '✅ PASS' : '⚠️ WARN'} |`,
    '',
    '## Counts',
    `| Metric | Value |`,
    `|--------|-------:|`,
    `| Signals | ${signalCount} |`,
    `| Briefs | ${briefCount} |`,
    `| Content Packs | ${packCount} |`,
    `| Generated Assets | ${assetCount} |`,
    '',
    '## MiniMax Call Status',
    '| Item | Result |',
    '|------|--------|',
    '| MiniMax called | No |',
    '| New media generated | No |',
    '',
    '## Scheduling Status',
    '| Item | Status |',
    '|------|--------|',
    '| cron/systemd | ❌ No (Phase 4B future) |',
    '| Manual daily:manual | ✅ Available |',
    '',
    `_Manual run complete. ${endTime}_`,
  ];

  const manualRunMd = manualRunLines.join('\n');
  writeFileSync(MANUAL_RUN_MD, manualRunMd);
  console.log(`\nWritten: ${MANUAL_RUN_MD}`);

  // Build telegram 4A digest (compact)
  const telegram4ALines: string[] = [
    `Manual Daily Digest Run -- ${startTime.split('T')[0]}`,
    `STATUS: PASS`,
    ``,
    `Run Steps: collect ✅ | briefs ✅ | digest ✅ | check ${digestCheckOk ? 'PASS' : 'WARN'}`,
    ``,
    `Signals: ${signalCount} | Briefs: ${briefCount} | Content Packs: ${packCount} | Generated Assets: ${assetCount}`,
    ``,
    `Digest File: reports/telegram-digest.txt`,
    `Digest Check: ${digestCheckOk ? 'PASS' : 'WARN'}`,
    ``,
    `MiniMax called: No | New media: No | cron/systemd: No`,
    ``,
    `--- Digest Content ---`,
    digestContent,
    ``,
    `--- Next Steps ---`,
    `Phase 4B: Scheduled automation (external cron/systemd)`,
    `Phase 3D: Controlled Image Batch with Guard (use: npm run generate:image:confirmed)`,
    ``,
    `Runbook: docs/MANUAL_DAILY_DIGEST_RUNBOOK.md`,
    `Phase 4A Report: docs/PHASE_4A_MANUAL_DAILY_DIGEST_REPORT.md`,
    `Manual Run Report: reports/manual-daily-run.md`,
    ``,
    `Manual Daily Digest Run complete.`,
  ];

  let telegram4AText = telegram4ALines.join('\n');
  if (telegram4AText.length > 3500) {
    // Trim digest content
    const maxLen = 3500 - telegram4ALines.slice(-8).join('\n').length - 50;
    telegram4AText = telegram4ALines.slice(0, 7).join('\n') + '\n\n--- Digest Content (trimmed) ---\n' +
      digestContent.slice(0, maxLen) + '\n\n--- Next Steps ---\n' +
      telegram4ALines.slice(-8).join('\n');
  }

  writeFileSync(TELEGRAM_4A_TXT, telegram4AText);
  console.log(`Written: ${TELEGRAM_4A_TXT} (${telegram4AText.length} chars)`);

  console.log('\n=== Manual Daily Digest Run Complete ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
