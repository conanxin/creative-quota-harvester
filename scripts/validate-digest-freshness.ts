#!/usr/bin/env npx ts-node
/**
 * scripts/validate-digest-freshness.ts — Phase 4C-2
 *
 * Validates the latest Daily Digest for:
 *  - No legacy phase references in next-phase list
 *  - Accurate delivery text (systemd timer, not cron/systemd: No)
 *  - Latest image URL matches real filename in generated-assets.json
 *  - Latest image URL contains the date directory
 *  - Recommended Generation Queue excludes already-generated topics
 *  - signal_last_collected_at present
 *  - No [truncated] / secrets / tokens
 *
 * Usage: npm run validate:digest-freshness
 */

import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

const HARVESTER_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const ASSETS_DIR = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

let failures = 0;
let passes = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

function safeRead(path: string): string | null {
  try { return existsSync(path) ? readFileSync(path, 'utf-8') : null; }
  catch { return null; }
}

// 1. Load digest
const digestPath = join(HARVESTER_DIR, 'reports/telegram-digest.txt');
if (!existsSync(digestPath)) { fail(`digest file missing: ${digestPath}`); process.exit(1); }
const digest = readFileSync(digestPath, 'utf-8');
console.log(`Loaded digest: ${digest.length} chars`);

// 2. No [truncated]
if (digest.includes('[truncated]')) fail('digest contains [truncated]'); else pass('no [truncated]');

// 3. No secrets
const SECRET_PATTERNS = [/sk-[A-Za-z0-9]{20,}/, /ghp_[A-Za-z0-9]{8,}/, /xoxb-[A-Za-z0-9-]{8,}/, /BOT_TOKEN=[A-Za-z0-9]{8,}/];
let secretHit = false;
for (const p of SECRET_PATTERNS) {
  if (p.test(digest)) { fail(`secret pattern matched: ${p}`); secretHit = true; }
}
if (!secretHit) pass('no obvious secrets');

// 4. No legacy next-phase references
const LEGACY = ['Phase 3A Full', 'Phase 4A: Manual Daily Digest', 'Phase 4B: Scheduled automation'];
for (const legacy of LEGACY) {
  if (digest.includes(legacy)) fail(`legacy phase in next-phase: ${legacy}`);
  else pass(`no legacy phase: ${legacy}`);
}

// 5. Accurate delivery text
if (digest.includes('Delivery: systemd timer')) pass('delivery text correct');
else fail('delivery text missing "systemd timer"');
if (digest.includes('cron/systemd: No')) fail('legacy "cron/systemd: No" still present');
else pass('no legacy "cron/systemd: No"');

// 6. signal_last_collected_at or freshness
if (digest.includes('Signal freshness:') || digest.includes('signal_last_collected_at')) pass('signal freshness present');
else fail('no signal freshness line');

// 7. Latest image URL — load generated-assets.json
const genAssetsRaw = safeRead(join(ASSETS_DIR, 'metadata/generated-assets.json'));
if (!genAssetsRaw) { fail('cannot read generated-assets.json'); process.exit(1); }
const assets: { filename: string; path: string }[] = JSON.parse(genAssetsRaw);
const latestAsset = assets[assets.length - 1];
const expectedFilename = latestAsset.filename;
const expectedPath = latestAsset.path;

const urlMatch = digest.match(/Latest image:\s*(https?:\S+)/);
if (!urlMatch) { fail('no Latest image URL in digest'); }
else {
  const url = urlMatch[1];
  if (url.includes(expectedFilename)) pass(`Latest image URL contains filename: ${expectedFilename}`);
  else fail(`Latest image URL missing filename: ${expectedFilename} (got ${url})`);
  if (url.includes(expectedPath.replace(/^\/+/, ''))) pass(`Latest image URL contains path: ${expectedPath}`);
  else fail(`Latest image URL does not match expected path: ${expectedPath} (got ${url})`);
  if (url.includes('gen-005001') || url.match(/gen-\d{6,}/)) fail(`URL contains underscore-missing filename pattern: ${url}`);
  else pass('URL has no underscore-missing pattern');
}

// 8. Recommended Queue excludes already-generated topics
// Extract recommended topics from digest and ensure none match generated topic slugs
const queueMatch = digest.match(/Recommended Generation Queue\s*\n([\s\S]+?)(?=\n\n|\n素材库|$)/);
if (queueMatch) {
  const queueBlock = queueMatch[1];
  // Skip "All top-priority packs already have generated images" / "Next step:" line — this is OK
  if (/All top-priority packs already have generated images/.test(queueBlock) ||
      /Next step: produce video prompt/.test(queueBlock)) {
    pass('Recommended Queue: explicit fallback to non-image suggestions');
  } else {
    // Extract numbered titles from queue
    const titles = [...queueBlock.matchAll(/\d+\.\s+([^\n]+)/g)].map(m => m[1].trim());
    // Build keyword sets from generated assets' prompts (titles in generated assets are referenced via prompts)
    const generatedKeywords = new Set<string>();
    for (const a of assets) {
      // Use the path basename as keyword
      const stem = basename(a.path, '.jpg').replace(/_001$/, '');
      generatedKeywords.add(stem);
    }
    // Check overlap by stem
    let conflict = false;
    for (const t of titles) {
      for (const stem of generatedKeywords) {
        if (stem.includes(t) || t.includes(stem)) { conflict = true; break; }
      }
      if (conflict) break;
    }
    if (conflict) fail(`Recommended Queue may include already-generated topic: ${titles.join(', ')}`);
    else pass(`Recommended Queue excludes already-generated topics (${titles.length} items)`);
  }
} else {
  fail('cannot parse Recommended Generation Queue block');
}

// 9. Char count under 3500
if (digest.length <= 3500) pass(`digest size ${digest.length}/3500`);
else fail(`digest too long: ${digest.length}/3500`);

// 10. Validate md report too
const mdReportPath = join(HARVESTER_DIR, 'reports/daily-digest.md');
if (existsSync(mdReportPath)) {
  const md = readFileSync(mdReportPath, 'utf-8');
  if (md.includes('Delivery | systemd timer + Telegram auto-send')) pass('md report has delivery line');
  else fail('md report missing delivery line');
  if (md.includes('signal_last_collected_at')) pass('md report has signal_last_collected_at');
  else fail('md report missing signal_last_collected_at');
  if (md.includes('Phase 4C-2')) pass('md report references current phase');
  else fail('md report missing current phase reference');
} else {
  fail('md report missing');
}

console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
if (failures > 0) {
  console.log('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
process.exit(0);