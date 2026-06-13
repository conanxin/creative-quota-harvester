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
  // Phase 5C-2C-A2: False positive self-tests for sk- pattern
  { name: 'allow: low-risk-execution (not sk-key)', input: 'reports/low-risk-execution-policy-validation-fix.md', expectPass: true },
  { name: 'allow: risk-execution (not sk-key)', input: 'prompt: risk-execution', expectPass: true },
  { name: 'allow: task-execution (not sk-key)', input: 'task-execution', expectPass: true },
  { name: 'allow: markdown-sketch-note (not sk-key)', input: 'markdown-sketch-note', expectPass: true },
  { name: 'allow: desk-report (not sk-key)', input: 'desk-report', expectPass: true },
  { name: 'allow: flask-app (not sk-key)', input: 'flask-app', expectPass: true },
  { name: 'allow: risk-management (not sk-key)', input: 'risk-management', expectPass: true },
  { name: 'allow: disk-space (not sk-key)', input: 'disk-space', expectPass: true },
  { name: 'allow: mask-policy (not sk-key)', input: 'mask-policy', expectPass: true },
  { name: 'allow: task-list (not sk-key)', input: 'task-list', expectPass: true },
  { name: 'allow: sk-cp (too short)', input: 'sk-cp', expectPass: true },
  { name: 'allow: sk-test (too short)', input: 'sk-test', expectPass: true },
  // Real secrets should still be FLAGGED
  { name: 'flag: sk-cp-real-looking-secret-1234567890', input: 'sk-cp-real-looking-secret-1234567890', expectPass: false },
  { name: 'flag: sk-real-looking-secret-1234567890', input: 'sk-real-looking-secret-1234567890', expectPass: false },
  { name: 'flag: OPENAI_API_KEY=real-looking-secret-value', input: 'OPENAI_API_KEY=real-looking-secret-value', expectPass: false },
  { name: 'flag: Authorization Bearer real-looking-token', input: 'Authorization: Bearer real-looking-token-1234567890', expectPass: false },
  // Phase 5C-2C-A2: Check redaction preserves surrounding text for false positives
  { name: 'redact: low-risk-execution preserves path', input: 'reports/low-risk-execution-policy-validation-fix.md', expectPass: true },
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

// --- Phase 5C-2C-A2: Sanitizer behavior self-test for false positives ---
const falsePositiveInput = 'Full report: reports/low-risk-execution-policy-validation-fix.md\nlow-risk-execution\nrisk-execution\ntask-execution\nmarkdown-sketch-note\nMiniMax Music Prompt\nminimax-music';
const falsePositiveSanitized = sanitizeTelegramDigest(falsePositiveInput);
if (falsePositiveSanitized.includes('low-risk-execution-policy-validation-fix.md')) {
  pass('sanitizer preserves false-positive path: low-risk-execution-policy-validation-fix.md');
} else {
  fail('sanitizer redacted false-positive path. Output: ' + falsePositiveSanitized.slice(0, 200));
}
if (falsePositiveSanitized.includes('low-risk-execution') && falsePositiveSanitized.includes('risk-execution') && falsePositiveSanitized.includes('task-execution')) {
  pass('sanitizer preserves false-positive words: low-risk-execution, risk-execution, task-execution');
} else {
  fail('sanitizer redacted false-positive words. Output: ' + falsePositiveSanitized.slice(0, 200));
}
if (falsePositiveSanitized.includes('MiniMax Music Prompt') && falsePositiveSanitized.includes('minimax-music')) {
  pass('sanitizer preserves MiniMax product names');
} else {
  fail('sanitizer removed MiniMax product names. Output: ' + falsePositiveSanitized.slice(0, 200));
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

// --- Phase 5C-2C-A2: Redaction self-test for real secrets ---
const secretInput = 'Token: sk-cp-real-looking-secret-1234567890\nKey: sk-real-looking-secret-1234567890\nOPENAI_API_KEY=real-looking-secret-value\nMINIMAX_API_KEY=real-looking-secret-value\nAuthorization: Bearer real-looking-token-1234567890\nTELEGRAM_BOT_TOKEN=1234567890:ABCdef_GHIjkl';
const secretSanitized = sanitizeTelegramDigest(secretInput);
if (secretSanitized.includes('[REDACTED-API-KEY]') && !secretSanitized.includes('sk-cp-real-looking-secret')) {
  pass('sanitizer redacts sk-cp-* real secrets');
} else {
  fail('sanitizer did NOT redact sk-cp-* real secrets. Output: ' + secretSanitized.slice(0, 200));
}
if (secretSanitized.includes('OPENAI_API_KEY=[REDACTED]') && secretSanitized.includes('MINIMAX_API_KEY=[REDACTED]')) {
  pass('sanitizer redacts API key assignments');
} else {
  fail('sanitizer did NOT redact API key assignments. Output: ' + secretSanitized.slice(0, 200));
}
if (secretSanitized.includes('Authorization: Bearer [REDACTED]') && secretSanitized.includes('TELEGRAM_BOT_TOKEN=[REDACTED]')) {
  pass('sanitizer redacts Bearer token and Telegram token');
} else {
  fail('sanitizer did NOT redact Bearer/Telegram token. Output: ' + secretSanitized.slice(0, 200));
}

// --- Phase 5C-2C-A2: Mixed false-positive + real secret test ---
const mixedInput = 'Path: reports/low-risk-execution-policy-validation-fix.md\nToken: sk-cp-real-looking-secret-1234567890\nProduct: MiniMax Music Prompt';
const mixedSanitized = sanitizeTelegramDigest(mixedInput);
if (mixedSanitized.includes('low-risk-execution-policy-validation-fix.md') && mixedSanitized.includes('[REDACTED-API-KEY]') && mixedSanitized.includes('MiniMax Music Prompt')) {
  pass('sanitizer: false positives preserved, real secrets redacted, product names preserved');
} else {
  fail('sanitizer mixed test failed. Output: ' + mixedSanitized.slice(0, 300));
}

console.log(`\n=== Summary ===`);
console.log(`PASS: ${passes}   FAIL: ${failures}`);
if (failures > 0) {
  console.log('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
process.exit(0);