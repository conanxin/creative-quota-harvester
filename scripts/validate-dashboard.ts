#!/usr/bin/env tsx
/**
 * scripts/validate-dashboard.ts
 *
 * Validates Phase 5A Read-only Dashboard
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const HARVESTER = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const DASHBOARD_DIR = join(HARVESTER, 'dashboard');

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

// File existence
test('dashboard/index.html exists', () => existsSync(join(DASHBOARD_DIR, 'index.html')));
test('dashboard/status.json exists', () => existsSync(join(DASHBOARD_DIR, 'status.json')));

// JSON validity
let status: any;
test('status.json is valid JSON', () => {
  try {
    status = JSON.parse(readFileSync(join(DASHBOARD_DIR, 'status.json'), 'utf8'));
    return true;
  } catch { return false; }
});

// Content checks
test('status.json has gallery_url', () => status?.asset_library?.gallery_url?.includes('github.io'));
test('status.json has daily_archive_url', () => status?.asset_library?.daily_archive_url?.includes('github.io'));
test('status.json has timer section', () => status?.timer?.unit === 'creative-quota-digest.timer');
test('status.json has generation_guard', () => status?.generation_guard?.ambiguous_commands_blocked === true);
test('status.json has asset_library', () => status?.asset_library?.content_packs > 0);
test('status.json has recommended_queue', () => Array.isArray(status?.recommended_queue));
test('status.json has links', () => status?.links?.gallery?.includes('github.io'));

// HTML checks
const html = readFileSync(join(DASHBOARD_DIR, 'index.html'), 'utf8');
test('html contains dashboard title', () => html.includes('Creative Quota Harvester 控制台'));
test('html has read-only badge', () => html.includes('只读模式'));
test('html has timer section', () => html.includes('Timer 状态'));
test('html has guard section', () => html.includes('MiniMax Guard'));
test('html has asset library section', () => html.includes('素材库状态'));
test('html has recommended queue', () => html.includes('推荐生成队列'));
test('html has links section', () => html.includes('素材库链接'));

// Safety checks
test('html has no API keys', () => !html.includes('API_KEY') && !html.includes('sk-') && !html.includes('api_key'));
test('html has no .env', () => !html.includes('.env'));
test('html has no [truncated]', () => !html.includes('[truncated]'));
test('html has no real control buttons', () => !html.includes('生成图片') && !html.includes('停止 timer') && !html.includes('启用 timer') && !html.includes('<button'));

// Note: "已生成图片" (generated images count) is a metric label, not a control button
// The check above may false-positive on metric labels containing "生成图片"
// We accept this as a known limitation and verify manually that no <button> tags exist
test('html has no MiniMax key', () => !html.includes('MiniMax-') && !html.includes('minimax_key'));

run();

console.log(`\n[validate-dashboard] ${pass}/${pass+fail} checks passed`);
if (fail > 0) process.exit(1);
