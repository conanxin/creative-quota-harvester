#!/usr/bin/env tsx
/**
 * scripts/validate-dashboard-pages.ts
 *
 * Validates Phase 5B Dashboard Pages for GitHub Pages
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

// Root index.html
test('root index.html exists', () => existsSync(join(HARVESTER, 'index.html')));
const rootHtml = readFileSync(join(HARVESTER, 'index.html'), 'utf8');
test('root has dashboard link', () => rootHtml.includes('/creative-quota-harvester/dashboard/'));
test('root has gallery link', () => rootHtml.includes('gallery'));
test('root has GitHub link', () => rootHtml.includes('github.com'));

// Dashboard files
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

// Dashboard HTML checks
const html = readFileSync(join(DASHBOARD_DIR, 'index.html'), 'utf8');
test('html has dashboard title', () => html.includes('Creative Quota Harvester 控制台'));
test('html has read-only badge', () => html.includes('只读模式'));
test('html has timer section', () => html.includes('Timer 状态'));
test('html has guard section', () => html.includes('MiniMax Guard'));
test('html has asset library section', () => html.includes('素材库状态'));
test('html has recommended queue', () => html.includes('推荐生成队列'));
test('html has links section', () => html.includes('素材库链接'));

// Safety checks
test('html has no button tags', () => !html.includes('<button'));
test('html has no API keys', () => !html.includes('API_KEY') && !html.includes('sk-') && !html.includes('api_key'));
test('html has no .env', () => !html.includes('.env'));
test('html has no [truncated]', () => !html.includes('[truncated]'));
test('html has no MiniMax key', () => !html.includes('MiniMax-') && !html.includes('minimax_key'));

// status.json safety
test('status.json has no API keys', () => !JSON.stringify(status).includes('API_KEY') && !JSON.stringify(status).includes('sk-'));
test('status.json has no .env', () => !JSON.stringify(status).includes('.env'));
test('status.json has no token', () => !JSON.stringify(status).includes('token'));

// Light theme check
test('html has light background', () => html.includes('background: #f5f5f0') || html.includes('background:#f5f5f0'));
test('html has dark text', () => html.includes('color: #333') || html.includes('color:#333') || html.includes('color: #2c3e50'));

run();

console.log(`\n[validate-dashboard-pages] ${pass}/${pass+fail} checks passed`);
if (fail > 0) process.exit(1);
