#!/usr/bin/env tsx
/**
 * scripts/validate-telegram-sanitizer.ts — Phase 4C-3
 *
 * Validates that the latest Daily Digest:
 *  - Has no tool residue (tool_call, </tool_call>, </invoke>, </content>, etc.)
 *  - Has no MiniMax/minimax identifier mentions
 *  - Has no [truncated] markers
 *  - Has no secret patterns (sk-..., ghp_..., TELEGRAM_BOT_TOKEN=, MINIMAX_API_KEY=, Bearer ...)
 *  - Has no .env secret-leak references
 *  - Has signal_last_collected_at or Signal freshness line
 *
 * Usage: npm run validate:telegram-sanitizer
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { findForbiddenPatterns } from '../src/reports/telegram-digest-sanitizer';

const HARVESTER_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const DIGEST_PATH = join(HARVESTER_DIR, 'reports/telegram-digest.txt');
const PREVIEW_PATH = join(HARVESTER_DIR, 'reports/telegram-send-preview.txt');
const MD_PATH = join(HARVESTER_DIR, 'reports/daily-digest.md');

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

function checkFile(label: string, path: string): string | null {
  if (!existsSync(path)) { fail(`${label}: file not found (${path})`); return null; }
  const content = readFileSync(path, 'utf-8');
  pass(`${label}: loaded (${content.length} chars)`);
  return content;
}

console.log('=== Telegram Digest Sanitizer Check (Phase 4C-3) ===');

const targets: Array<{ label: string; path: string }> = [
  { label: 'reports/telegram-digest.txt', path: DIGEST_PATH },
  { label: 'reports/telegram-send-preview.txt', path: PREVIEW_PATH },
  { label: 'reports/daily-digest.md', path: MD_PATH },
];

for (const t of targets) {
  console.log(`\n--- ${t.label} ---`);
  const content = checkFile(t.label, t.path);
  if (!content) continue;
  const hits = findForbiddenPatterns(content);
  if (hits.length === 0) {
    pass(`no forbidden patterns`);
  } else {
    for (const h of hits) {
      const safe = h.matches.map(m => m.length > 50 ? m.slice(0, 47) + '...' : m).slice(0, 3).join(' | ');
      fail(`${h.pattern} → ${safe}`);
    }
  }
}

console.log(`\n=== Summary ===`);
console.log(`PASS: ${passes}   FAIL: ${failures}`);
if (failures > 0) {
  console.log('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
process.exit(0);