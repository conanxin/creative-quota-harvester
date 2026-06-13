#!/usr/bin/env tsx
/**
 * scripts/validate-sanitizer-false-positives.ts — Phase 5C-2C-A2
 *
 * Validates that the sanitizer does NOT false-positive on common words
 * containing 'sk-' while still redacting real API keys.
 *
 * Usage: npm run validate:sanitizer-false-positives
 */

import { findForbiddenPatterns, sanitizeTelegramDigest } from '../src/reports/telegram-digest-sanitizer';

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

console.log('=== Sanitizer False-Positive Validation (Phase 5C-2C-A2) ===');

// --- False positive cases (must NOT be flagged or redacted) ---
const falsePositives: Array<{ name: string; input: string; expectedUnchanged: string }> = [
  { name: 'path: low-risk-execution-policy-validation-fix.md', input: 'reports/low-risk-execution-policy-validation-fix.md', expectedUnchanged: 'low-risk-execution-policy-validation-fix.md' },
  { name: 'word: low-risk-execution', input: 'low-risk-execution', expectedUnchanged: 'low-risk-execution' },
  { name: 'word: risk-execution', input: 'risk-execution', expectedUnchanged: 'risk-execution' },
  { name: 'word: task-execution', input: 'task-execution', expectedUnchanged: 'task-execution' },
  { name: 'word: markdown-sketch-note', input: 'markdown-sketch-note', expectedUnchanged: 'markdown-sketch-note' },
  { name: 'word: desk-report', input: 'desk-report', expectedUnchanged: 'desk-report' },
  { name: 'word: flask-app', input: 'flask-app', expectedUnchanged: 'flask-app' },
  { name: 'word: risk-management', input: 'risk-management', expectedUnchanged: 'risk-management' },
  { name: 'word: disk-space', input: 'disk-space', expectedUnchanged: 'disk-space' },
  { name: 'word: mask-policy', input: 'mask-policy', expectedUnchanged: 'mask-policy' },
  { name: 'word: task-list', input: 'task-list', expectedUnchanged: 'task-list' },
  { name: 'short: sk-cp (too short)', input: 'sk-cp', expectedUnchanged: 'sk-cp' },
  { name: 'short: sk-test (too short)', input: 'sk-test', expectedUnchanged: 'sk-test' },
  { name: 'product: MiniMax Music Prompt', input: 'MiniMax Music Prompt', expectedUnchanged: 'MiniMax Music Prompt' },
  { name: 'product: minimax-music', input: 'minimax-music', expectedUnchanged: 'minimax-music' },
];

console.log('\n--- False Positive Tests ---');
for (const t of falsePositives) {
  const hits = findForbiddenPatterns(t.input);
  const sanitized = sanitizeTelegramDigest(t.input);
  if (hits.length === 0 && sanitized === t.input && sanitized.includes(t.expectedUnchanged)) {
    pass(`false-positive: ${t.name}`);
  } else {
    fail(`false-positive: ${t.name} (hits=${hits.length}, sanitized=${sanitized})`);
  }
}

// --- Real secret cases (MUST be flagged and redacted) ---
const realSecrets: Array<{ name: string; input: string; expectedRedacted: string }> = [
  { name: 'sk-cp real secret', input: 'sk-cp-real-looking-secret-1234567890', expectedRedacted: '[REDACTED-API-KEY]' },
  { name: 'sk real secret', input: 'sk-real-looking-secret-1234567890', expectedRedacted: '[REDACTED-API-KEY]' },
  { name: 'sk-proj real secret', input: 'sk-proj-real-looking-secret-1234567890', expectedRedacted: '[REDACTED-API-KEY]' },
  { name: 'OPENAI_API_KEY', input: 'OPENAI_API_KEY=real-looking-secret-value', expectedRedacted: '[REDACTED]' },
  { name: 'MINIMAX_API_KEY', input: 'MINIMAX_API_KEY=real-looking-secret-value', expectedRedacted: '[REDACTED]' },
  { name: 'Authorization Bearer', input: 'Authorization: Bearer real-looking-token-1234567890', expectedRedacted: '[REDACTED]' },
  { name: 'TELEGRAM_BOT_TOKEN', input: 'TELEGRAM_BOT_TOKEN=1234567890:ABCdef_GHIjkl', expectedRedacted: '[REDACTED]' },
];

console.log('\n--- Real Secret Tests ---');
for (const t of realSecrets) {
  const hits = findForbiddenPatterns(t.input);
  const sanitized = sanitizeTelegramDigest(t.input);
  if (hits.length > 0 && sanitized.includes(t.expectedRedacted)) {
    pass(`real-secret: ${t.name}`);
  } else {
    fail(`real-secret: ${t.name} (hits=${hits.length}, sanitized=${sanitized})`);
  }
}

// --- Mixed cases (false positives + real secrets in same text) ---
console.log('\n--- Mixed Tests ---');
const mixedInputs = [
  {
    name: 'path + real secret',
    input: 'Path: reports/low-risk-execution-policy-validation-fix.md\nToken: sk-cp-real-looking-secret-1234567890',
    expectContains: ['low-risk-execution-policy-validation-fix.md', '[REDACTED-API-KEY]'],
  },
  {
    name: 'MiniMax + real secret',
    input: 'Product: MiniMax Music Prompt\nKey: sk-real-looking-secret-1234567890',
    expectContains: ['MiniMax Music Prompt', '[REDACTED-API-KEY]'],
  },
  {
    name: 'many false positives + one real secret',
    input: 'risk-execution, task-execution, low-risk-execution, markdown-sketch-note, desk-report, flask-app\nToken: sk-proj-real-looking-secret-1234567890',
    expectContains: ['risk-execution', 'task-execution', 'low-risk-execution', 'markdown-sketch-note', '[REDACTED-API-KEY]'],
  },
];

for (const t of mixedInputs) {
  const sanitized = sanitizeTelegramDigest(t.input);
  let allFound = true;
  for (const expected of t.expectContains) {
    if (!sanitized.includes(expected)) {
      fail(`mixed: ${t.name} missing "${expected}" in sanitized output`);
      allFound = false;
    }
  }
  if (allFound) {
    pass(`mixed: ${t.name}`);
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
