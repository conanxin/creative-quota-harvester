#!/usr/bin/env tsx
/**
 * scripts/send-project-report.ts — Phase 4C-3A
 *
 * Generic project report sender that uses the project's own sanitizer
 * and Telegram sender (independent of OpenClaw final-reply channel).
 *
 * Usage:
 *   npm run report:send:dry-run -- --file reports/<x>.txt --label "Phase X"
 *   CQA_ALLOW_TELEGRAM_SEND=1 npm run report:send -- --file reports/<x>.txt --label "Phase X"
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve, basename } from 'path';
import { execSync } from 'child_process';
import { sanitizeTelegramDigest, findForbiddenPatterns } from '../src/reports/telegram-digest-sanitizer';

const HARVESTER_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const REPORTS_DIR = join(HARVESTER_DIR, 'reports');

interface SendResult {
  generated_at: string;
  phase: string;
  mode: 'dry-run' | 'real-send' | 'blocked';
  file: string;
  label: string;
  char_count: number;
  max_allowed: number;
  sanitizer_pass: boolean;
  forbidden_hits: { pattern: string; matches: number }[];
  send_attempted: boolean;
  send_result?: { ok: boolean; message_id?: number; error?: string };
  reason: string;
}

function parseArgs(): { file: string; label: string } {
  const args = process.argv.slice(2);
  let file = '';
  let label = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) file = args[++i];
    else if (args[i] === '--label' && args[i + 1]) label = args[++i];
  }
  if (!file) {
    console.error('Usage: send-project-report.ts --file <path> [--label "<label>"]');
    process.exit(2);
  }
  return { file, label: label || basename(file) };
}

function loadReport(file: string): string | null {
  const fullPath = resolve(HARVESTER_DIR, file);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, 'utf-8');
}

function main() {
  const { file, label } = parseArgs();
  const mode = process.env.CQA_ALLOW_TELEGRAM_SEND === '1' ? 'real-send' : 'dry-run';
  console.log('=== Project Report Sender (Phase 4C-3A) ===');
  console.log(`File: ${file}`);
  console.log(`Label: ${label}`);
  console.log(`Mode: ${mode.toUpperCase()}`);

  const raw = loadReport(file);
  if (!raw) {
    console.error(`Report file not found: ${file}`);
    process.exit(1);
  }
  console.log(`Loaded: ${raw.length} chars`);

  // Apply sanitizer
  const sanitized = sanitizeTelegramDigest(raw);
  console.log(`Sanitized: ${sanitized.length} chars (removed ${raw.length - sanitized.length})`);

  // Check forbidden patterns (after sanitize)
  const hits = findForbiddenPatterns(sanitized);
  const sanitizerPass = hits.length === 0;

  // Length check
  const charCount = sanitized.length;
  const overLimit = charCount > 3500;

  console.log('\n--- Sanitizer check ---');
  console.log(`  Char count: ${charCount}/3500 ${overLimit ? '❌' : '✅'}`);
  console.log(`  Forbidden hits: ${hits.length} ${sanitizerPass ? '✅' : '❌'}`);
  if (!sanitizerPass) {
    for (const h of hits) {
      console.log(`    - ${h.pattern}: ${h.matches.length} match(es)`);
    }
  }

  if (overLimit || !sanitizerPass) {
    console.log('\nBLOCKED: report fails sanitizer or length check.');
    const result: SendResult = {
      generated_at: new Date().toISOString(),
      phase: '4C-3A',
      mode: 'blocked',
      file, label,
      char_count: charCount,
      max_allowed: 3500,
      sanitizer_pass: sanitizerPass,
      forbidden_hits: hits.map(h => ({ pattern: h.pattern, matches: h.matches.length })),
      send_attempted: false,
      reason: overLimit ? 'char_count > 3500' : 'forbidden patterns present after sanitize',
    };
    writeFileSync(join(REPORTS_DIR, 'project-report-send-result.json'), JSON.stringify(result, null, 2));
    process.exit(1);
  }

  if (mode === 'dry-run') {
    console.log('\n--- DRY-RUN COMPLETE ---');
    console.log('No message sent to Telegram.');
    console.log('To enable real send:');
    console.log('  export CQA_ALLOW_TELEGRAM_SEND=1');
    console.log(`  npm run report:send -- --file ${file} --label "${label}"`);
    const result: SendResult = {
      generated_at: new Date().toISOString(),
      phase: '4C-3A',
      mode: 'dry-run',
      file, label,
      char_count: charCount,
      max_allowed: 3500,
      sanitizer_pass: true,
      forbidden_hits: [],
      send_attempted: false,
      reason: 'dry-run mode',
    };
    writeFileSync(join(REPORTS_DIR, 'project-report-send-result.json'), JSON.stringify(result, null, 2));
    return;
  }

  // Real send path — use same Telegram sender as send-telegram-digest.ts
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('\nBLOCKED: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.');
    const result: SendResult = {
      generated_at: new Date().toISOString(),
      phase: '4C-3A',
      mode: 'blocked',
      file, label,
      char_count: charCount,
      max_allowed: 3500,
      sanitizer_pass: true,
      forbidden_hits: [],
      send_attempted: false,
      reason: 'missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID',
    };
    writeFileSync(join(REPORTS_DIR, 'project-report-send-result.json'), JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log('\n--- REAL SEND PATH ---');
  console.log('Sending sanitized report via Telegram Bot API...');

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const tmpFile = '/tmp/cqa-project-report-send.json';
    writeFileSync(tmpFile, JSON.stringify({
      chat_id: chatId,
      text: sanitized,
      disable_web_page_preview: true,
    }));
    const result = execSync(
      `curl -sS --connect-timeout 10 --max-time 20 --socks5-hostname 127.0.0.1:7898 ` +
      `-H "Content-Type: application/json" ` +
      `-X POST -d @${tmpFile} "${url}"`,
      { encoding: 'utf-8', timeout: 25000 }
    );
    const parsed = JSON.parse(result) as { ok: boolean; description?: string; result?: { message_id: number } };
    try { require('fs').unlinkSync(tmpFile); } catch {}

    const finalResult: SendResult = {
      generated_at: new Date().toISOString(),
      phase: '4C-3A',
      mode: 'real-send',
      file, label,
      char_count: charCount,
      max_allowed: 3500,
      sanitizer_pass: true,
      forbidden_hits: [],
      send_attempted: true,
      send_result: parsed.ok
        ? { ok: true, message_id: parsed.result?.message_id }
        : { ok: false, error: parsed.description },
      reason: parsed.ok ? 'sent successfully' : 'send failed',
    };
    writeFileSync(join(REPORTS_DIR, 'project-report-send-result.json'), JSON.stringify(finalResult, null, 2));

    if (parsed.ok) {
      console.log(`✅ Sent successfully. message_id: ${parsed.result?.message_id}`);
      return;
    } else {
      console.error(`❌ Send failed: ${parsed.description}`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`❌ Send error: ${err.message}`);
    process.exit(1);
  }
}

main();