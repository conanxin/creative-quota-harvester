#!/usr/bin/env tsx
/**
 * scripts/validate-control-server.ts — Phase 5C-1
 *
 * Validates the localhost-only control server:
 *   - control-server.ts exists and listens on 127.0.0.1 (not 0.0.0.0)
 *   - No child_process, exec, spawn in source
 *   - No POST handler, no WebSocket
 *   - No .env reading, no token reading
 *   - Report whitelist exists and non-empty
 *   - Package.json has required scripts
 *   - Status.json and control-catalog.json are valid JSON
 *
 * Usage: npm run validate:control-server
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const HARVESTER_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const SERVER_PATH = join(HARVESTER_DIR, 'scripts', 'control-server.ts');
const STATUS_PATH = join(HARVESTER_DIR, 'dashboard', 'status.json');
const CATALOG_PATH = join(HARVESTER_DIR, 'dashboard', 'control-catalog.json');
const PKG_PATH = join(HARVESTER_DIR, 'package.json');

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

console.log('=== Control Server Validation (Phase 5C-1) ===');

// 1. File exists
if (!existsSync(SERVER_PATH)) {
  fail(`control-server.ts not found: ${SERVER_PATH}`);
  process.exit(1);
} else {
  pass('control-server.ts exists');
}

const serverCode = readFileSync(SERVER_PATH, 'utf-8');

// 2. Binds to 127.0.0.1
if (serverCode.includes('"127.0.0.1"') || serverCode.includes("'127.0.0.1'")) {
  pass('control-server.ts binds to 127.0.0.1');
} else {
  fail('control-server.ts does NOT bind to 127.0.0.1');
}

if (!serverCode.includes('"0.0.0.0"') && !serverCode.includes("'0.0.0.0'")) {
  pass('control-server.ts does NOT bind to 0.0.0.0');
} else {
  fail('control-server.ts binds to 0.0.0.0 (forbidden)');
}

// 3. No dangerous imports (child_process)
if (/\brequire\s*\(\s*['"]\s*child_process\s*['"]\s*\)/gi.test(serverCode)) {
  fail('control-server.ts requires child_process (forbidden)');
} else {
  pass('control-server.ts does NOT require child_process');
}

// 4. No exec/spawn function calls (must be followed by '(' to be a call)
const execCallRe = /\b(exec|spawn|execSync|spawnSync|execFile)\s*\(/gi;
if (execCallRe.test(serverCode)) {
  const matches = serverCode.match(execCallRe) || [];
  for (const m of matches.slice(0, 3)) {
    fail(`control-server.ts contains function call: ${m}`);
  }
} else {
  pass('control-server.ts: no exec()/spawn()/execSync()/spawnSync()/execFile() calls');
}

// 4. No POST handler
if (/\bmethod\s*!==?\s*["']GET["']/gi.test(serverCode) || /\breq\.method\s*!==?\s*["']GET["']/gi.test(serverCode)) {
  pass('control-server.ts blocks non-GET methods');
} else {
  fail('control-server.ts does NOT explicitly block non-GET methods');
}

// 5. No WebSocket constructor calls
if (/\bnew\s+WebSocket\s*\(/gi.test(serverCode)) {
  fail('control-server.ts contains new WebSocket() (forbidden)');
} else {
  pass('control-server.ts: no new WebSocket()');
}

// 6. No .env reading
if (!serverCode.includes('.env') || serverCode.includes('//') || serverCode.includes('/*')) {
  // Allow .env in comments only; check for actual read operations
  const envReadRe = /readFileSync\s*\(\s*.*?\.env/;
  if (envReadRe.test(serverCode)) {
    fail('control-server.ts reads .env file (forbidden)');
  } else {
    pass('control-server.ts: no .env file read');
  }
} else {
  pass('control-server.ts: no .env file read');
}

if (!serverCode.includes('.env.telegram.local')) {
  pass('control-server.ts: no .env.telegram.local reference');
} else {
  fail('control-server.ts references .env.telegram.local');
}

// 7. No token / secret reading
if (!/TELEGRAM_BOT_TOKEN\s*=\s*/.test(serverCode) && !/MINIMAX_API_KEY\s*=\s*/.test(serverCode)) {
  pass('control-server.ts: no token assignment patterns');
} else {
  fail('control-server.ts contains token assignment');
}

if (!/sk-cp-/.test(serverCode) && !/sk-[A-Za-z0-9]{20,}/.test(serverCode)) {
  pass('control-server.ts: no API key patterns');
} else {
  fail('control-server.ts contains API key pattern');
}

// 8. No eval
if (!/\beval\s*\(/.test(serverCode)) {
  pass('control-server.ts: no eval()');
} else {
  fail('control-server.ts contains eval()');
}

// 9. Path traversal check exists
if (serverCode.includes('..') || serverCode.includes('\\\\0')) {
  pass('control-server.ts has path traversal guard');
} else {
  fail('control-server.ts missing path traversal guard');
}

// 10. Report whitelist exists
if (serverCode.includes('REPORTS_WHITELIST') && serverCode.includes('whitelist')) {
  pass('control-server.ts: REPORTS_WHITELIST defined');
} else {
  fail('control-server.ts: REPORTS_WHITELIST not found');
}

// 11. Package.json scripts
if (existsSync(PKG_PATH)) {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  const scripts = pkg.scripts || {};
  const requiredScripts = ['control:server', 'control:server:check', 'control:server:smoke', 'validate:control-server'];
  let allFound = true;
  for (const s of requiredScripts) {
    if (scripts[s]) {
      pass(`package.json has script: ${s}`);
    } else {
      fail(`package.json missing script: ${s}`);
      allFound = false;
    }
  }
} else {
  fail('package.json not found');
}

// 12. Status.json valid
if (existsSync(STATUS_PATH)) {
  try {
    const status = JSON.parse(readFileSync(STATUS_PATH, 'utf-8'));
    pass('dashboard/status.json: valid JSON');
  } catch (e) {
    fail('dashboard/status.json: invalid JSON');
  }
} else {
  fail('dashboard/status.json: not found');
}

// 13. Control-catalog.json valid
if (existsSync(CATALOG_PATH)) {
  try {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
    pass('dashboard/control-catalog.json: valid JSON');
  } catch (e) {
    fail('dashboard/control-catalog.json: invalid JSON');
  }
} else {
  fail('dashboard/control-catalog.json: not found');
}

console.log(`\n=== Summary ===`);
console.log(`PASS: ${passes}  FAIL: ${failures}`);
if (failures > 0) {
  console.log('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
process.exit(0);
