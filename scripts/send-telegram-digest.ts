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
import { sanitizeTelegramDigest, findForbiddenPatterns } from '../src/reports/telegram-digest-sanitizer';

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
  // Apply sanitizer to verify output is safe, then re-check.
  const sanitized = sanitizeTelegramDigest(digest);
  const hasSecrets = /API_KEY=[^\s]|sk-[a-zA-Z0-9]{20,}|Bearer\s+[A-Za-z0-9]{20,}|TELEGRAM_BOT_TOKEN=\S{10,}|\.env\s+(?:contains|holds|has)|Authorization:\s*Bearer/.test(sanitized);
  const forbiddenHits = findForbiddenPatterns(sanitized);
  const hasToolResidue = forbiddenHits.length > 0;

  const pass = charCount <= 3500 && !hasTruncated && !hasSecrets && !hasToolResidue;

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
    `Has truncated marker: ${check.hasTruncated ? 'YES ❌' : 'NO ✅'}`,
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
    phase: '4C-3',
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

  console.log('=== Telegram Digest Send Hook (Phase 4C-3) ===');
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

  // Step 2: Validate digest (sanitize + check)
  const sanitizedDigest = sanitizeTelegramDigest(digest);
  const check = validateDigest(digest);
  const forbiddenAfterSanitize = findForbiddenPatterns(sanitizedDigest);
  console.log(`\nDigest check:`);
  console.log(`  Chars: ${check.charCount}/3500`);
  console.log(`  Truncated marker: ${check.hasTruncated ? 'YES ❌' : 'NO ✅'}`);
  console.log(`  Secrets: ${check.hasSecrets ? 'YES ❌' : 'NO ✅'}`);
  console.log(`  Tool residue after sanitize: ${forbiddenAfterSanitize.length === 0 ? 'NONE ✅' : 'STILL PRESENT ❌'}`);
  console.log(`  Valid: ${check.pass && forbiddenAfterSanitize.length === 0 ? 'PASS ✅' : 'FAIL ❌'}`);

  if (!check.pass || forbiddenAfterSanitize.length > 0) {
    console.log('\nDigest validation FAILED. Not sending.');
    if (forbiddenAfterSanitize.length > 0) {
      console.log('Forbidden patterns still present after sanitize:');
      for (const h of forbiddenAfterSanitize) {
        console.log(`  - ${h.pattern} (${h.matches.length} match)`);
      }
    }
    process.exit(1);
  }

  // Step 3: Check send permission
  const permission = checkSendPermission();
  console.log(`\nSend permission:`);
  console.log(`  Allowed: ${permission.allowed ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  Reason: ${permission.reason}`);

  // Step 4: Generate preview (using sanitized text so preview matches what gets sent)
  const preview = generatePreview(sanitizedDigest, check, permission);
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

  // Real send path
  if (!permission.allowed) {
    console.log('\nBLOCKED: Cannot send. Check environment variables.');
    process.exit(1);
  }

  // Real send — use Telegram Bot API via curl (SOCKS5 proxy compatible)
  console.log('\n=== REAL SEND PATH ===');
  console.log('Sending digest via Telegram Bot API (sanitized text)...');

  try {
    const { execSync } = await import('child_process');
    const url = `https://api.telegram.org/bot${permission.token}/sendMessage`;
    // Escape digest for shell — use temp file to avoid escaping issues
    const tmpFile = '/tmp/cqa-digest-send.json';
    writeFileSync(tmpFile, JSON.stringify({
      chat_id: permission.chatId,
      text: sanitizedDigest,  // send sanitized version
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }));
    
    const result = execSync(
      `curl -sS --connect-timeout 10 --max-time 20 --socks5-hostname 127.0.0.1:7898 ` +
      `-H "Content-Type: application/json" ` +
      `-X POST -d @${tmpFile} "${url}"`,
      { encoding: 'utf-8', timeout: 25000 }
    );
    const parsed = JSON.parse(result) as { ok: boolean; description?: string; result?: { message_id: number } };
    
    // Clean up tmp file
    try { require('fs').unlinkSync(tmpFile); } catch {}
    
    if (parsed.ok) {
      console.log(`✅ Sent successfully. message_id: ${parsed.result?.message_id}`);
      checkJson.send_permission = {
        ...checkJson.send_permission,
        allowed: true,
        send_result: 'success',
        message_id: parsed.result?.message_id,
      };
      writeFileSync(join(REPORTS_DIR, 'telegram-send-check.json'), JSON.stringify(checkJson, null, 2));
    } else {
      console.error(`❌ Send failed: ${parsed.description}`);
      checkJson.send_permission = {
        ...checkJson.send_permission,
        allowed: true,
        send_result: 'failed',
        error: parsed.description,
      };
      writeFileSync(join(REPORTS_DIR, 'telegram-send-check.json'), JSON.stringify(checkJson, null, 2));
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Send error:', err.message);
    process.exit(1);
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
