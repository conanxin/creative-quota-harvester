#!/usr/bin/env tsx
/**
 * scripts/send-telegram-digest.ts
 *
 * Phase 4C-0: Telegram Digest Send Hook (Dry Run by default)
 *
 * Reads reports/telegram-digest.txt and optionally sends it to Telegram.
 *
 * Modes:
 *   - Dry-run (default): validates digest, generates preview, no real send
 *   - Confirmed: requires CQA_ALLOW_TELEGRAM_SEND=1 + TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const HARVESTER = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const REPORTS_DIR = join(HARVESTER, 'reports');

interface SendCheck {
  pass: boolean;
  charCount: number;
  hasTruncated: boolean;
  hasSecrets: boolean;
  dryRun: boolean;
  allowed: boolean;
  reason: string;
}

function loadDigest(): string {
  const path = join(REPORTS_DIR, 'telegram-digest.txt');
  if (!existsSync(path)) {
    throw new Error('telegram-digest.txt not found. Run npm run digest:telegram first.');
  }
  return readFileSync(path, 'utf8');
}

function validateDigest(digest: string): SendCheck {
  const charCount = digest.length;
  const hasTruncated = digest.includes('[truncated]');
  const hasSecrets = /API_KEY=[^\s]|sk-[a-zA-Z0-9]{20,}|Bearer\s+[A-Za-z0-9]{20,}|TELEGRAM_BOT_TOKEN=\S{10,}|\.env\s+(?:contains|holds|has)|Authorization:\s*Bearer/.test(digest);

  const pass = charCount <= 3500 && !hasTruncated && !hasSecrets;

  return {
    pass,
    charCount,
    hasTruncated,
    hasSecrets,
    dryRun: true,
    allowed: false,
    reason: pass ? 'Digest valid for Telegram' : 'Digest invalid',
  };
}

function checkSendPermission(): { allowed: boolean; reason: string; token?: string; chatId?: string } {
  const envFlag = process.env.CQA_ALLOW_TELEGRAM_SEND === '1';
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!envFlag) {
    return { allowed: false, reason: 'CQA_ALLOW_TELEGRAM_SEND is not 1. Set to 1 to enable real send.' };
  }

  if (!token) {
    return { allowed: false, reason: 'TELEGRAM_BOT_TOKEN missing.' };
  }

  if (!chatId) {
    return { allowed: false, reason: 'TELEGRAM_CHAT_ID missing.' };
  }

  return { allowed: true, reason: 'All conditions met for real send.', token, chatId };
}

function generatePreview(digest: string, check: SendCheck, permission: { allowed: boolean; reason: string }): string {
  const lines = [
    '=== Telegram Send Preview ===',
    '',
    `Mode: ${permission.allowed ? 'REAL SEND' : 'DRY-RUN'}`,
    `Digest chars: ${check.charCount}/3500`,
    `Has [truncated]: ${check.hasTruncated ? 'YES ❌' : 'NO ✅'}`,
    `Has secrets: ${check.hasSecrets ? 'YES ❌' : 'NO ✅'}`,
    `Digest valid: ${check.pass ? 'PASS ✅' : 'FAIL ❌'}`,
    `Send allowed: ${permission.allowed ? 'YES ✅' : 'NO ❌'}`,
    `Reason: ${permission.reason}`,
    '',
    '--- Preview (first 200 chars) ---',
    digest.slice(0, 200).replace(/\n/g, ' '),
    '...',
    '',
    '--- Full digest ---',
    digest,
  ];
  return lines.join('\n');
}

function generateCheckJson(check: SendCheck, permission: { allowed: boolean; reason: string }): object {
  return {
    generated_at: new Date().toISOString(),
    phase: '4C-0',
    mode: permission.allowed ? 'real-send' : 'dry-run',
    digest_check: {
      char_count: check.charCount,
      max_allowed: 3500,
      pass: check.pass,
      has_truncated: check.hasTruncated,
      has_secrets: check.hasSecrets,
    },
    send_permission: {
      allowed: permission.allowed,
      reason: permission.reason,
      env_flag: process.env.CQA_ALLOW_TELEGRAM_SEND,
      has_token: !!process.env.TELEGRAM_BOT_TOKEN,
      has_chat_id: !!process.env.TELEGRAM_CHAT_ID,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isConfirmed = args.includes('--confirmed') || args.includes('-c');
  const isDryRun = !isConfirmed;

  console.log('=== Telegram Digest Send Hook (Phase 4C-0) ===');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN' : 'CONFIRMED'}`);

  // Step 1: Load digest
  let digest: string;
  try {
    digest = loadDigest();
    console.log(`Digest loaded: ${digest.length} chars`);
  } catch (err: any) {
    console.error('Failed to load digest:', err.message);
    process.exit(1);
  }

  // Step 2: Validate digest
  const check = validateDigest(digest);
  console.log(`\nDigest check:`);
  console.log(`  Chars: ${check.charCount}/3500`);
  console.log(`  [truncated]: ${check.hasTruncated ? 'YES ❌' : 'NO ✅'}`);
  console.log(`  Secrets: ${check.hasSecrets ? 'YES ❌' : 'NO ✅'}`);
  console.log(`  Valid: ${check.pass ? 'PASS ✅' : 'FAIL ❌'}`);

  if (!check.pass) {
    console.log('\nDigest validation FAILED. Not sending.');
    process.exit(1);
  }

  // Step 3: Check send permission
  const permission = checkSendPermission();
  console.log(`\nSend permission:`);
  console.log(`  Allowed: ${permission.allowed ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  Reason: ${permission.reason}`);

  // Step 4: Generate preview
  const preview = generatePreview(digest, check, permission);
  writeFileSync(join(REPORTS_DIR, 'telegram-send-preview.txt'), preview);
  console.log('\nPreview written: reports/telegram-send-preview.txt');

  // Step 5: Generate check JSON
  const checkJson = generateCheckJson(check, permission);
  writeFileSync(join(REPORTS_DIR, 'telegram-send-check.json'), JSON.stringify(checkJson, null, 2));
  console.log('Check JSON written: reports/telegram-send-check.json');

  // Step 6: Dry-run or send
  if (isDryRun) {
    console.log('\n=== DRY-RUN COMPLETE ===');
    console.log('No message sent to Telegram.');
    console.log('To enable real send:');
    console.log('  export TELEGRAM_BOT_TOKEN=your_token');
    console.log('  export TELEGRAM_CHAT_ID=your_chat_id');
    console.log('  export CQA_ALLOW_TELEGRAM_SEND=1');
    console.log('  npm run digest:send:confirmed');
    process.exit(0);
  }

  // Real send path (only if confirmed)
  if (!permission.allowed) {
    console.log('\nBLOCKED: Cannot send. Check environment variables.');
    process.exit(1);
  }

  // Real send would happen here, but we don't implement it in Phase 4C-0
  // This is a placeholder for Phase 4C-1
  console.log('\n=== REAL SEND PATH ===');
  console.log('Token and chat ID verified. Sending would happen here.');
  console.log('Note: Real send implementation in Phase 4C-1.');

  // Actual send code (commented out for safety in Phase 4C-0):
  // const url = `https://api.telegram.org/bot${token}/sendMessage`;
  // const body = { chat_id: chatId, text: digest, parse_mode: 'Markdown' };
  // const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  // const result = await response.json();
  // console.log('Send result:', result.ok ? 'SUCCESS' : 'FAILED');

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
