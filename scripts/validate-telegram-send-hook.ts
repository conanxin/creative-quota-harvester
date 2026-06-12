#!/usr/bin/env tsx
/**
 * scripts/validate-telegram-send-hook.ts
 *
 * Validates Phase 4C-0 Telegram Send Hook
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const HARVESTER = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const REPORTS_DIR = join(HARVESTER, 'reports');

const checks: { name: string; check: () => boolean }[] = [];
let pass = 0, fail = 0;

function test(name: string, fn: () => boolean) {
  checks.push({ name, check: fn });
}

function run() {
  for (const c of checks) {
    try {
      const ok = c.check();
      if (ok) { pass++; console.log(`  PASS: ${c.name}`); }
      else { fail++; console.log(`  FAIL: ${c.name}`); }
    } catch (e) {
      fail++; console.log(`  FAIL: ${c.name} (${e})`);
    }
  }
}

// Script existence
test('send-telegram-digest.ts exists', () => existsSync(join(HARVESTER, 'scripts/send-telegram-digest.ts')));

// Digest existence
test('telegram-digest.txt exists', () => existsSync(join(REPORTS_DIR, 'telegram-digest.txt')));

// Dry-run outputs
test('telegram-send-preview.txt exists', () => existsSync(join(REPORTS_DIR, 'telegram-send-preview.txt')));
test('telegram-send-check.json exists', () => existsSync(join(REPORTS_DIR, 'telegram-send-check.json')));

// Check JSON validity
let checkJson: any;
test('telegram-send-check.json is valid JSON', () => {
  try {
    checkJson = JSON.parse(readFileSync(join(REPORTS_DIR, 'telegram-send-check.json'), 'utf8'));
    return true;
  } catch { return false; }
});

test('check.json has phase 4C-0', () => checkJson?.phase === '4C-0');
test('check.json mode is dry-run', () => checkJson?.mode === 'dry-run');
test('check.json digest_check.char_count <= 3500', () => checkJson?.digest_check?.char_count <= 3500);
test('check.json digest_check.has_truncated is false', () => checkJson?.digest_check?.has_truncated === false);
test('check.json digest_check.has_secrets is false', () => checkJson?.digest_check?.has_secrets === false);
test('check.json send_permission.allowed is false', () => checkJson?.send_permission?.allowed === false);

// Preview check
const preview = readFileSync(join(REPORTS_DIR, 'telegram-send-preview.txt'), 'utf8');
test('preview contains DRY-RUN', () => preview.includes('DRY-RUN'));
test('preview contains no real token', () => !preview.includes('sk-') && !preview.includes('123456789:'));

// Safety
test('no .env.telegram.local committed', () => !existsSync(join(HARVESTER, '.env.telegram.local')));
test('.env.telegram.example exists', () => existsSync(join(HARVESTER, '.env.telegram.example')));

run();

console.log(`\n[validate-telegram-send] ${pass}/${pass+fail} checks passed`);
if (fail > 0) process.exit(1);
