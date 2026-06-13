#!/usr/bin/env tsx
/**
 * scripts/validate-sanitizer-secret-completeness.ts — Phase 5C-2C-A3
 *
 * Validates that the sanitizer COMPLETELY redacts all secrets:
 *  - TELEGRAM_BOT_TOKEN values (including colon and entire value)
 *  - Standalone Telegram bot tokens (numeric:alphanumeric format)
 *  - CQA_CONTROL_TOKEN values
 *  - Authorization: Bearer tokens
 *  - API_KEY values (including those with colons)
 *
 * Also verifies false positives from Phase 5C-2C-A2 are NOT regressed.
 *
 * Usage: npm run validate:sanitizer-secret-completeness
 */

import { findForbiddenPatterns, sanitizeTelegramDigest } from '../src/reports/telegram-digest-sanitizer';

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

console.log('=== Sanitizer Secret Completeness Validation (Phase 5C-2C-A3) ===');

// --- A. Complete redaction tests (must be redacted to [REDACTED]) ---

interface SecretTest {
  name: string;
  input: string;
  expectedRedacted: string;
  forbiddenPatternsExpected: number; // >= 1
}

const secretTests: SecretTest[] = [
  {
    name: 'TELEGRAM_BOT_TOKEN with colon (full value)',
    input: 'TELEGRAM_BOT_TOKEN=123456789:ABCdef_GHIjkl-MnopQRST',
    expectedRedacted: 'TELEGRAM_BOT_TOKEN=[REDACTED]',
    forbiddenPatternsExpected: 1,
  },
  {
    name: 'TELEGRAM_BOT_TOKEN long format',
    input: 'TELEGRAM_BOT_TOKEN=123456789:ABCdef_GHIjkl-MnopQRSTuvwxyz1234567890',
    expectedRedacted: 'TELEGRAM_BOT_TOKEN=[REDACTED]',
    forbiddenPatternsExpected: 1,
  },
  {
    name: 'Standalone Telegram bot token (numeric:alphanumeric)',
    input: 'Token: 123456789:ABCdef_GHIjkl-MnopQRSTuvwxyz1234567890',
    expectedRedacted: '[REDACTED-TELEGRAM-BOT-TOKEN]',
    forbiddenPatternsExpected: 1,
  },
  {
    name: 'CQA_CONTROL_TOKEN',
    input: 'CQA_CONTROL_TOKEN=test-local-control-token-12345',
    expectedRedacted: 'CQA_CONTROL_TOKEN=[REDACTED]',
    forbiddenPatternsExpected: 1,
  },
  {
    name: 'CQA_CONTROL_TOKEN with dashes',
    input: 'CQA_CONTROL_TOKEN=tk-5c2b-extra-long-value',
    expectedRedacted: 'CQA_CONTROL_TOKEN=[REDACTED]',
    forbiddenPatternsExpected: 1,
  },
  {
    name: 'Authorization Bearer token',
    input: 'Authorization: Bearer real-looking-token-1234567890',
    expectedRedacted: 'Authorization: Bearer [REDACTED]',
    forbiddenPatternsExpected: 1,
  },
  {
    name: 'OPENAI_API_KEY',
    input: 'OPENAI_API_KEY=real-looking-secret-value',
    expectedRedacted: 'OPENAI_API_KEY=[REDACTED]',
    forbiddenPatternsExpected: 1,
  },
  {
    name: 'MINIMAX_API_KEY',
    input: 'MINIMAX_API_KEY=real-looking-secret-value',
    expectedRedacted: 'MINIMAX_API_KEY=[REDACTED]',
    forbiddenPatternsExpected: 1,
  },
  {
    name: 'Generic API_KEY with underscore',
    input: 'MY_APP_API_KEY=some-secret-value-12345',
    expectedRedacted: 'MY_APP_API_KEY=[REDACTED]',
    forbiddenPatternsExpected: 1,
  },
  {
    name: 'sk-cp real secret',
    input: 'sk-cp-real-looking-secret-1234567890',
    expectedRedacted: '[REDACTED-API-KEY]',
    forbiddenPatternsExpected: 1,
  },
  {
    name: 'sk real secret',
    input: 'sk-real-looking-secret-1234567890',
    expectedRedacted: '[REDACTED-API-KEY]',
    forbiddenPatternsExpected: 1,
  },
  {
    name: 'sk-proj real secret',
    input: 'sk-proj-real-looking-secret-1234567890',
    expectedRedacted: '[REDACTED-API-KEY]',
    forbiddenPatternsExpected: 1,
  },
];

console.log('\n--- Complete Redaction Tests ---');
for (const t of secretTests) {
  const hits = findForbiddenPatterns(t.input);
  const sanitized = sanitizeTelegramDigest(t.input);
  const hasHits = hits.length >= t.forbiddenPatternsExpected;
  const hasRedacted = sanitized.includes(t.expectedRedacted);
  const noResidue = !sanitized.includes(t.input.split('=')[1]?.trim()) && !sanitized.includes(t.input.split(': ')[1]?.trim());

  if (hasHits && hasRedacted) {
    pass(`redaction: ${t.name}`);
  } else {
    fail(`redaction: ${t.name} (hits=${hits.length}, expected>=${t.forbiddenPatternsExpected}, hasRedacted=${hasRedacted}, sanitized=${sanitized})`);
  }
}

// --- B. False positive regression tests (must NOT be redacted) ---

interface FalsePositiveTest {
  name: string;
  input: string;
  expectedUnchanged: string;
}

const falsePositiveTests: FalsePositiveTest[] = [
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

console.log('\n--- False Positive Regression Tests ---');
for (const t of falsePositiveTests) {
  const hits = findForbiddenPatterns(t.input);
  const sanitized = sanitizeTelegramDigest(t.input);
  if (hits.length === 0 && sanitized === t.input && sanitized.includes(t.expectedUnchanged)) {
    pass(`false-positive: ${t.name}`);
  } else {
    fail(`false-positive: ${t.name} (hits=${hits.length}, sanitized=${sanitized})`);
  }
}

// --- C. Mixed tests (false positives + real secrets in same text) ---

console.log('\n--- Mixed Tests ---');
const mixedInputs = [
  {
    name: 'path + TELEGRAM_BOT_TOKEN',
    input: 'Path: reports/low-risk-execution-policy-validation-fix.md\nToken: TELEGRAM_BOT_TOKEN=123456789:ABCdef_GHIjkl-MnopQRST',
    expectContains: ['low-risk-execution-policy-validation-fix.md', 'TELEGRAM_BOT_TOKEN=[REDACTED]'],
    expectNotContains: ['123456789:ABCdef_GHIjkl-MnopQRST'],
  },
  {
    name: 'MiniMax + CQA_CONTROL_TOKEN + sk secret',
    input: 'Product: MiniMax Music Prompt\nControl: CQA_CONTROL_TOKEN=tk-5c2b-secret\nKey: sk-real-looking-secret-1234567890',
    expectContains: ['MiniMax Music Prompt', 'CQA_CONTROL_TOKEN=[REDACTED]', '[REDACTED-API-KEY]'],
    expectNotContains: ['tk-5c2b-secret', 'sk-real-looking-secret-1234567890'],
  },
  {
    name: 'many false positives + standalone Telegram token',
    input: 'risk-execution, task-execution, low-risk-execution, markdown-sketch-note, desk-report, flask-app\nToken: 123456789:ABCdef_GHIjkl-MnopQRSTuvwxyz1234567890',
    expectContains: ['risk-execution', 'task-execution', 'low-risk-execution', 'markdown-sketch-note', '[REDACTED-TELEGRAM-BOT-TOKEN]'],
    expectNotContains: ['ABCdef_GHIjkl-MnopQRSTuvwxyz1234567890'],
  },
  {
    name: 'Authorization Bearer + false positives',
    input: 'Auth: Authorization: Bearer real-looking-token-1234567890\nPath: low-risk-execution-policy-validation-fix.md',
    expectContains: ['Authorization: Bearer [REDACTED]', 'low-risk-execution-policy-validation-fix.md'],
    expectNotContains: ['real-looking-token-1234567890'],
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
  for (const notExpected of t.expectNotContains) {
    if (sanitized.includes(notExpected)) {
      fail(`mixed: ${t.name} contains leaked secret "${notExpected}"`);
      allFound = false;
    }
  }
  if (allFound) {
    pass(`mixed: ${t.name}`);
  }
}

// --- D. Specific edge cases for Telegram token ---

console.log('\n--- Telegram Token Edge Cases ---');

// Test: TELEGRAM_BOT_TOKEN with full token, must be fully redacted
const telegramInput = 'TELEGRAM_BOT_TOKEN=123456789:ABCdef_GHIjkl-MnopQRST';
const telegramSanitized = sanitizeTelegramDigest(telegramInput);
if (telegramSanitized === 'TELEGRAM_BOT_TOKEN=[REDACTED]' && !telegramSanitized.includes('ABCdef')) {
  pass('Telegram token fully redacted (no residue after colon)');
} else {
  fail(`Telegram token not fully redacted. Got: ${telegramSanitized}`);
}

// Test: standalone Telegram token
const standaloneToken = 'Token: 123456789:ABCdef_GHIjkl-MnopQRSTuvwxyz1234567890';
const standaloneSanitized = sanitizeTelegramDigest(standaloneToken);
if (standaloneSanitized.includes('[REDACTED-TELEGRAM-BOT-TOKEN]') && !standaloneSanitized.includes('ABCdef')) {
  pass('Standalone Telegram token fully redacted');
} else {
  fail(`Standalone Telegram token not fully redacted. Got: ${standaloneSanitized}`);
}

// Test: short token (should NOT be redacted as standalone Telegram token)
const shortToken = '1:2';
const shortSanitized = sanitizeTelegramDigest(shortToken);
if (shortSanitized === '1:2') {
  pass('Short token (1:2) NOT redacted (too short)');
} else {
  fail(`Short token unexpectedly redacted. Got: ${shortSanitized}`);
}

// Test: non-Telegram colon pattern (should NOT be redacted)
const nonTelegram = 'ratio: 1:2:3:4:5';
const nonTelegramSanitized = sanitizeTelegramDigest(nonTelegram);
if (nonTelegramSanitized === 'ratio: 1:2:3:4:5') {
  pass('Non-Telegram colon pattern NOT redacted');
} else {
  fail(`Non-Telegram colon pattern unexpectedly redacted. Got: ${nonTelegramSanitized}`);
}

// Test: CQA_CONTROL_TOKEN with dashes and underscores
const controlToken = 'CQA_CONTROL_TOKEN=tk-5c2b_test_local_1234567890';
const controlSanitized = sanitizeTelegramDigest(controlToken);
if (controlSanitized === 'CQA_CONTROL_TOKEN=[REDACTED]' && !controlSanitized.includes('tk-5c2b')) {
  pass('CQA_CONTROL_TOKEN fully redacted');
} else {
  fail(`CQA_CONTROL_TOKEN not fully redacted. Got: ${controlSanitized}`);
}

console.log(`\n=== Summary ===`);
console.log(`PASS: ${passes}   FAIL: ${failures}`);
if (failures > 0) {
  console.log('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
process.exit(0);
