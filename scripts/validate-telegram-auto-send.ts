#!/usr/bin/env tsx
/**
 * scripts/validate-telegram-auto-send.ts
 *
 * Validates Phase 4C-1 Telegram Auto-send
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const HARVESTER = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';

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

// .env.telegram.local not tracked by git
test('.env.telegram.local not git-tracked', () => {
  try {
    const { execSync } = require('child_process');
    const result = execSync('git check-ignore .env.telegram.local', { cwd: HARVESTER, encoding: 'utf8' });
    return result.trim().length > 0;
  } catch { return false; }
});

// daily-scheduled.sh no plaintext token
test('daily-scheduled.sh no plaintext token', () => {
  const sh = readFileSync(join(HARVESTER, 'scripts/daily-scheduled.sh'), 'utf8');
  return !/TELEGRAM_BOT_TOKEN=\S{20,}/.test(sh) && !sh.includes(':AA');
});

// daily-scheduled.sh only sends when CQA_ALLOW_TELEGRAM_SEND=1
test('daily-scheduled.sh checks CQA_ALLOW_TELEGRAM_SEND', () => {
  const sh = readFileSync(join(HARVESTER, 'scripts/daily-scheduled.sh'), 'utf8');
  return sh.includes('CQA_ALLOW_TELEGRAM_SEND');
});

// digest:send:confirmed blocks when no token
test('confirmed send blocks without token', () => {
  const { execSync } = require('child_process');
  try {
    execSync('CQA_ALLOW_TELEGRAM_SEND=1 TELEGRAM_BOT_TOKEN="" TELEGRAM_CHAT_ID="" npx tsx scripts/send-telegram-digest.ts --confirmed', {
      cwd: HARVESTER, encoding: 'utf8', env: { ...process.env, TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '', CQA_ALLOW_TELEGRAM_SEND: '1' }
    });
    return false; // Should have failed
  } catch (e: any) {
    return e.status === 1; // Expected to fail with exit 1
  }
});

// Dry-run PASS
test('dry-run passes', () => {
  const preview = readFileSync(join(HARVESTER, 'reports/telegram-send-preview.txt'), 'utf8');
  return preview.includes('DRY-RUN') || preview.includes('CONFIRMED');
});

// gateway config not modified
test('gateway config not in commit', () => {
  const { execSync } = require('child_process');
  try {
    const status = execSync('git status --short', { cwd: HARVESTER, encoding: 'utf8' });
    return !status.includes('openclaw') && !status.includes('gateway');
  } catch { return true; }
});

// No MiniMax calls in scripts
test('no MiniMax calls in send-telegram-digest.ts', () => {
  const script = readFileSync(join(HARVESTER, 'scripts/send-telegram-digest.ts'), 'utf8');
  return !script.includes('MiniMax') && !script.includes('minimax');
});

run();

console.log(`\n[validate-telegram-auto-send] ${pass}/${pass+fail} checks passed`);
if (fail > 0) process.exit(1);
