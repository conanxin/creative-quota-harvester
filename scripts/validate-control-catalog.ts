#!/usr/bin/env tsx
/**
 * scripts/validate-control-catalog.ts — Phase 5C-0
 *
 * Validates the Private Control Command Catalog (dashboard/control.html + control-catalog.json):
 *  - control-catalog.json is valid JSON, no secrets, no .env contents, no real tokens
 *  - control.html exists, contains required copy ("只读命令目录", etc.)
 *  - control.html does NOT contain any real execution button (no <button> triggers, no fetch POST, no WebSocket, no exec/child_process)
 *  - All high/danger commands have requires_confirm=true
 *  - All generates_media=true commands either call a model or are documented as dry-run
 *  - image_confirmed commands include CQA_ALLOW_GENERATION=1 and --confirm-spend
 *  - digest confirmed sends include CQA_ALLOW_TELEGRAM_SEND=1
 *  - timer commands have modifies_timer=true
 *  - No [truncated] marker
 *
 * Usage: npm run dashboard:control:validate
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const HARVESTER_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const CATALOG_PATH = join(HARVESTER_DIR, 'dashboard', 'control-catalog.json');
const HTML_PATH = join(HARVESTER_DIR, 'dashboard', 'control.html');

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

console.log('=== Private Control Command Catalog Validation (Phase 5C-0) ===');

// 1. control-catalog.json exists and is valid JSON
if (!existsSync(CATALOG_PATH)) {
  fail(`control-catalog.json not found: ${CATALOG_PATH}`);
} else {
  const raw = readFileSync(CATALOG_PATH, 'utf-8');
  let catalog: any = null;
  try {
    catalog = JSON.parse(raw);
    pass(`control-catalog.json: valid JSON (${raw.length} chars)`);
  } catch (e: any) {
    fail(`control-catalog.json: JSON parse error: ${e.message}`);
    process.exit(1);
  }

  // 2. No secrets in catalog
  // Note: .env.telegram.local is allowed as a *filename reference* in
  // boundaries.gitignore_targets (it documents what is excluded from
  // git), but the FORBIDDEN match looks for actual secret assignments,
  // not filenames. Same for MINIMAX_API_KEY= (filename-only is OK).
  const FORBIDDEN = [
    /sk-[A-Za-z0-9_-]{20,}/g,
    /sk-(cp|proj)-[A-Za-z0-9_-]{20,}/g,
    /ghp_[A-Za-z0-9]{20,}/g,
    /xox[baprs]-[A-Za-z0-9-]{8,}/g,
    /TELEGRAM_BOT_TOKEN\s*=\s*[\w-]{8,}/g,
    /MINIMAX_API_KEY\s*=\s*[\w-]{8,}/g,
    /[A-Z_]+_API_KEY\s*=\s*[\w-]{8,}/g,
    /Authorization:\s*Bearer\s+[\w-]{10,}/gi,
    /\[truncated\]/gi,
  ];
  let anyForbidden = false;
  for (const re of FORBIDDEN) {
    const m = raw.match(re);
    if (m && m.length > 0) {
      fail(`control-catalog.json contains forbidden pattern: ${m[0].slice(0, 40)}`);
      anyForbidden = true;
    }
  }
  if (!anyForbidden) pass(`control-catalog.json: no secret / token / .env leak`);

  // 3. Structural checks
  if (!catalog.command_groups || !Array.isArray(catalog.command_groups)) {
    fail(`control-catalog.json: missing command_groups array`);
  } else {
    pass(`control-catalog.json: ${catalog.command_groups.length} command groups`);

    // Iterate all commands
    let totalCmds = 0;
    let highRisk = 0;
    let mediumRisk = 0;
    let dangerRisk = 0;
    let safeRisk = 0;
    let withConfirm = 0;
    let allOk = true;

    for (const group of catalog.command_groups) {
      if (!group.commands || !Array.isArray(group.commands)) continue;
      for (const cmd of group.commands) {
        totalCmds++;

        // Required fields
        const requiredFields = ['id', 'label_zh', 'description_zh', 'command', 'risk_level', 'requires_confirm', 'requires_env', 'calls_model', 'generates_media', 'modifies_timer', 'public_safe', 'notes'];
        for (const f of requiredFields) {
          if (cmd[f] === undefined) {
            fail(`command ${cmd.id || '?'} missing field ${f}`);
            allOk = false;
          }
        }

        // Risk level stats
        const risk = (cmd.risk_level || '').toLowerCase();
        if (risk === 'safe') safeRisk++;
        else if (risk === 'medium') mediumRisk++;
        else if (risk === 'high') highRisk++;
        else if (risk === 'danger') dangerRisk++;
        else {
          fail(`command ${cmd.id}: invalid risk_level "${cmd.risk_level}"`);
          allOk = false;
        }

        // high/danger must require confirm
        if ((risk === 'high' || risk === 'danger') && cmd.requires_confirm !== true) {
          fail(`command ${cmd.id} (risk=${risk}) MUST have requires_confirm=true`);
          allOk = false;
        } else if (risk === 'high' || risk === 'danger') {
          withConfirm++;
        }

        // generates_media commands must call a model or be documented dry-run
        if (cmd.generates_media === true) {
          const cmdStr = String(cmd.command || '');
          if (!cmd.calls_model && !/dry-run/.test(cmdStr) && !/prompt-only/.test(cmdStr)) {
            fail(`command ${cmd.id} generates_media=true but neither calls_model nor has dry-run/prompt-only in command`);
            allOk = false;
          }
        }

        // image_confirmed: must include CQA_ALLOW_GENERATION=1
        // The canary script uses --confirm-spend as a CLI flag.
        // The controlled-images script enforces confirm_spend programmatically;
        // the catalog notes MUST mention that.
        // Skip dry-run commands (identified by --dry-run flag)
        const isDryRun = /--dry-run/.test(String(cmd.command || ''));
        if (!isDryRun && (/^image_confirmed/.test(String(cmd.id)) || /minimax-image-canary/.test(String(cmd.command)))) {
          if (!/CQA_ALLOW_GENERATION=1/.test(String(cmd.command))) {
            fail(`command ${cmd.id} (image confirmed) MUST include CQA_ALLOW_GENERATION=1`);
            allOk = false;
          }
          // canary (image_confirmed_1) needs --confirm-spend as CLI flag
          if (/minimax-image-canary/.test(String(cmd.command)) && !/--confirm-spend/.test(String(cmd.command))) {
            fail(`command ${cmd.id} (canary) MUST include --confirm-spend`);
            allOk = false;
          }
          // controlled-images (image_confirmed_2) enforces internally;
          // notes must document this
          if (/generate:controlled:images/.test(String(cmd.command))) {
            const notes = String(cmd.notes || '');
            if (!/confirm_spend|confirm-spend/.test(notes)) {
              fail(`command ${cmd.id} (controlled-images) MUST mention confirm_spend in notes (enforced programmatically)`);
              allOk = false;
            }
          }
        }

        // digest confirmed send: must include CQA_ALLOW_TELEGRAM_SEND=1
        if (/send_digest_confirmed|send_project_report_confirmed/.test(String(cmd.id)) || /digest:send:confirmed|report:send.*--confirmed/.test(String(cmd.command))) {
          if (!/CQA_ALLOW_TELEGRAM_SEND=1/.test(String(cmd.command))) {
            fail(`command ${cmd.id} (telegram confirmed) MUST include CQA_ALLOW_TELEGRAM_SEND=1`);
            allOk = false;
          }
        }

        // timer commands: must have modifies_timer=true
        if (/timer_(status|logs|disable_command|enable_command)/.test(String(cmd.id))) {
          if (cmd.modifies_timer !== true && !/_status|_logs/.test(String(cmd.id))) {
            fail(`command ${cmd.id} (timer) MUST have modifies_timer=true`);
            allOk = false;
          }
        }
      }
    }
    if (allOk) pass(`control-catalog.json: all ${totalCmds} commands structurally valid`);
    pass(`control-catalog.json: risk distribution safe=${safeRisk} medium=${mediumRisk} high=${highRisk} danger=${dangerRisk}`);
    if (highRisk + dangerRisk > 0) {
      pass(`control-catalog.json: ${withConfirm} high/danger commands have requires_confirm=true`);
    }
  }
}

// 4. control.html exists and contains required copy
if (!existsSync(HTML_PATH)) {
  fail(`control.html not found: ${HTML_PATH}`);
} else {
  const html = readFileSync(HTML_PATH, 'utf-8');
  pass(`control.html: loaded (${html.length} chars)`);

  // Required copy
  const requiredCopy = [
    'Creative Quota 私有控制目录',
    '只读命令目录',
    '不会执行任何命令',
    'GitHub Pages',
  ];
  for (const s of requiredCopy) {
    if (html.includes(s)) pass(`control.html: contains "${s}"`);
    else fail(`control.html: missing required copy "${s}"`);
  }

  // 5. No real execution in code blocks (not in safety warnings / CSS / comments)
  // Strip HTML comments AND CSS block contents AND the safety-warning text
  // before checking for dangerous patterns. The safety warning legitimately
  // mentions these names (e.g. "no <button> / WebSocket / child_process"),
  // so the warning must be excluded from the "code" check.
  const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const htmlNoCss = htmlNoComments.replace(/<style[\s\S]*?<\/style>/gi, '');
  // Strip the critical-warning block. We match by class name and use a
  // balanced search for the closing </div> by counting depth.
  function stripByClass(html: string, className: string): string {
    const open = new RegExp(`<div class="${className}">`);
    const m = html.match(open);
    if (!m) return html;
    const start = m.index!;
    let depth = 1;
    let i = start + m[0].length;
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        i = nextClose + 6;
      }
    }
    return html.slice(0, start) + html.slice(i);
  }
  const htmlNoWarning = stripByClass(htmlNoCss, 'critical-warning');
  // Extract the <script> block specifically — that's where executable JS lives
  const scriptMatch = htmlNoWarning.match(/<script>([\s\S]*?)<\/script>/i);
  const scriptCode = scriptMatch ? scriptMatch[1] : '';
  const cssAndWarning = htmlNoWarning.replace(/<script>[\s\S]*?<\/script>/i, '');

  const FORBIDDEN_CODE = [
    // No <button ... onclick|data-action|data-execute> anywhere (DOM + JS string sources)
    /<button[^>]*\s(onclick|data-action|data-execute)/i,
    /fetch\s*\(\s*['"`][^'"`]*['"`]\s*,\s*\{\s*method\s*:\s*['"`]\s*POST/i,
    /new\s+WebSocket\s*\(/i,
    /document\.write\s*\(/i,
    /\bexec\s*\(/,
    /child_process/,
  ];
  let htmlSafe = true;
  for (const re of FORBIDDEN_CODE) {
    if (re.test(scriptCode) || re.test(cssAndWarning)) {
      fail(`control.html: contains forbidden code pattern ${re} (outside safety warning)`);
      htmlSafe = false;
    }
  }
  if (htmlSafe) pass(`control.html: no POST / WebSocket / exec / child_process / document.write in code`);

  // 6. No <button> tags at all (per spec: 不要使用 <button> 触发命令)
  // Allow <button> only in safety-warning copy that says "no buttons" —
  // the actual rendered DOM should not contain <button> elements.
  if (/<button\b/i.test(cssAndWarning)) {
    fail(`control.html: contains <button> tag in DOM (spec forbids)`);
  } else {
    pass(`control.html: no <button> tags in DOM`);
  }

  // 6b. Interactive triggers on non-button elements must declare data-safety
  // (Phase 5C-2C-C5M1A: explicit safety marker is the documented escape hatch
  //  for safe localhost + confirm-phrase-gated actions. The allow-list is
  //  intentionally small; production writes, collect, send, generate, timer,
  //  git, build, deploy, model, media, telegram-send are all forbidden.)
  const ALLOWED_SAFETY = new Set([
    'safe-localhost',
    'safe-localhost-confirm-phrase-gated',
    'safe-localhost-dry-run',
    'read-only',
    'dry-run',
    'simulation',
  ]);
  const FORBIDDEN_SAFETY_HINTS = [
    'production-write', 'production-promote', 'high-risk', 'telegram-send',
    'collect', 'generate', 'timer', 'git', 'build', 'deploy', 'model',
    'media', 'unrestricted', 'remote', 'arbitrary',
  ];
  const elementOpenRe = /<(a|span|div|li|p)\b[^>]*>/gi;
  const triggerAttrRe = /\s(onclick|data-action|data-execute)\s*=\s*['"][^'"]*['"]/i;
  const safetyAttrRe = /\sdata-safety\s*=\s*["']([^"']+)["']/i;
  let m: RegExpExecArray | null;
  const safetyIssues: string[] = [];
  while ((m = elementOpenRe.exec(cssAndWarning)) !== null) {
    const element = m[0];
    if (!triggerAttrRe.test(element)) continue;
    const safetyMatch = element.match(safetyAttrRe);
    if (!safetyMatch) {
      safetyIssues.push(`<${m[1]}> has trigger attribute (onclick/data-action/data-execute) but no data-safety declaration`);
      continue;
    }
    const value = safetyMatch[1].toLowerCase();
    if (FORBIDDEN_SAFETY_HINTS.some(h => value.includes(h))) {
      safetyIssues.push(`<${m[1]}> declares forbidden data-safety="${safetyMatch[1]}" (matches: ${FORBIDDEN_SAFETY_HINTS.filter(h => value.includes(h)).join(',')})`);
      continue;
    }
    if (!ALLOWED_SAFETY.has(value)) {
      safetyIssues.push(`<${m[1]}> declares unknown data-safety="${safetyMatch[1]}" (allowed: ${[...ALLOWED_SAFETY].join(', ')})`);
    }
  }
  if (safetyIssues.length === 0) {
    pass(`control.html: all interactive triggers declare safe data-safety (allow-list: ${[...ALLOWED_SAFETY].join(', ')})`);
  } else {
    for (const issue of safetyIssues) fail(`control.html: ${issue}`);
  }

  // 7. No secrets / tokens in HTML
  const SECRET_RE = [
    /sk-[A-Za-z0-9_-]{20,}/g,
    /sk-(cp|proj)-[A-Za-z0-9_-]{20,}/g,
    /ghp_[A-Za-z0-9]{20,}/g,
    /xox[baprs]-[A-Za-z0-9-]{8,}/g,
    /TELEGRAM_BOT_TOKEN\s*=\s*[\w-]{8,}/g,
    /\[truncated\]/gi,
  ];
  let anySecret = false;
  for (const re of SECRET_RE) {
    const m = html.match(re);
    if (m && m.length > 0) {
      fail(`control.html: contains secret/truncated pattern ${m[0].slice(0, 40)}`);
      anySecret = true;
    }
  }
  if (!anySecret) pass(`control.html: no secret / token / [truncated]`);

  // 8. References control-catalog.json via fetch
  if (/fetch\s*\(\s*['"`][^'"`]*control-catalog\.json/i.test(html)) {
    pass(`control.html: references control-catalog.json via fetch`);
  } else {
    fail(`control.html: missing fetch('./control-catalog.json') call`);
  }
}

console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
if (failures > 0) {
  console.log('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
process.exit(0);
