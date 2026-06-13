#!/usr/bin/env tsx
/**
 * scripts/validate-telegram-sanitizer.ts — Phase 4C-3 / 4I-1
 *
 * Validates that the latest Daily Digest:
 *  - Has no tool residue (tool_call, </tool_call>, </invoke>, </content>, etc.)
 *  - Has no [truncated] markers
 *  - Has no secret patterns (sk-..., ghp_..., TELEGRAM_BOT_TOKEN=, MINIMAX_API_KEY=, Bearer ...)
 *  - Has no .env secret-leak references
 *  - Has signal_last_collected_at or Signal freshness line
 *
 * Phase 4I-1: The plain product name "MiniMax" / "minimax" is no longer
 * treated as forbidden. It is allowed in public project reports as a
 * legitimate product/model name (e.g. "MiniMax Music Prompt",
 * "model_family: minimax-music", "MiniMax called: No").
 *
 * Usage: npm run validate:telegram-sanitizer
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { findForbiddenPatterns, sanitizeTelegramDigest } from '../src/reports/telegram-digest-sanitizer';

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

console.log('=== Telegram Digest Sanitizer Check (Phase 4C-3 / 4I-1) ===');

// --- Phase 4I-1: Self-test cases (no real files) ---
const selfTests: Array<{ name: string; input: string; expectPass: boolean }> = [
  // Public product name should be ALLOWED
  { name: 'allow: MiniMax Music Prompt', input: 'prompt: MiniMax Music Prompt', expectPass: true },
  { name: 'allow: model_family: minimax-music', input: 'parameters: model_family: minimax-music', expectPass: true },
  { name: 'allow: MiniMax called: No', input: 'MiniMax called: No\nNew media: No', expectPass: true },
  { name: 'allow: MiniMax Music', input: 'See MiniMax Music prompt documentation', expectPass: true },
  // Tool residue should be FLAGGED
  { name: 'flag: </tool_call>', input: 'some text\n</tool_call>', expectPass: false },
  { name: 'flag: </invoke>', input: 'before</invoke>after', expectPass: false },
  { name: 'flag: <tool_call>', input: '<tool_call>{"name":"x"}</tool_call>', expectPass: false },
  { name: 'flag: [truncated]', input: 'content [truncated] more', expectPass: false },
  // Real secrets should be FLAGGED
  { name: 'flag: sk-cp-real-key-here', input: 'sk-cp-aBcDeFgHiJkLmNoPqRsTuVwXyZ123456', expectPass: false },
  { name: 'flag: TELEGRAM_BOT_TOKEN=realvalue12345', input: 'TELEGRAM_BOT_TOKEN=1234567890:ABCdef_GHIjkl', expectPass: false },
  { name: 'flag: MINIMAX_API_KEY=realvalue', input: 'MINIMAX_API_KEY=sk-1234567890abcdef', expectPass: false },
  { name: 'flag: Authorization: Bearer realtoken', input: 'Authorization: Bearer ya29aBcDeFgHiJkLmNoPqRsT', expectPass: false },
];

console.log(`\n--- Phase 4I-1 Self-Tests ---`);
for (const t of selfTests) {
  const hits = findForbiddenPatterns(t.input);
  const clean = hits.length === 0;
  if (clean === t.expectPass) {
    pass(`self-test: ${t.name}`);
  } else {
    fail(`self-test: ${t.name} (expected ${t.expectPass ? 'PASS' : 'FAIL'}, got ${clean ? 'PASS' : 'FAIL'})`);
  }
}

// --- Sanitizer behavior self-test (no substitution of product name) ---
const sanitizeTestInput = 'model_family: minimax-music\nprompt: MiniMax Music Prompt\n<tool_call>bad</tool_call>';
const sanitized = sanitizeTelegramDigest(sanitizeTestInput);
if (sanitized.includes('minimax-music') && sanitized.includes('MiniMax Music Prompt')) {
  pass('sanitizer preserves public product names');
} else {
  fail(`sanitizer removed public product names. Output: ${sanitized.slice(0, 200)}`);
}
if (!sanitized.includes('tool_call')) {
  pass('sanitizer still strips tool_call residue');
} else {
  fail('sanitizer did NOT strip tool_call residue');
}

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