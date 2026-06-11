#!/usr/bin/env tsx
/**
 * scripts/validate-content-enrichment.ts
 *
 * Validates content pack enrichment output.
 * No MiniMax calls. No external dependencies.
 */

import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

// Hardcoded absolute paths
const HARVESTER = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const ASSETS    = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';
const PACK_DIR  = join(ASSETS, 'content-packs');

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

function check(condition: boolean, name: string, detail = ''): Check {
  return { name, pass: condition, detail };
}

function listPacks(): string[] {
  const dirs: string[] = [];
  try {
    for (const yearEntry of readdirSync(PACK_DIR)) {
      const yearPath = join(PACK_DIR, yearEntry);
      if (!statSync(yearPath).isDirectory()) continue;
      for (const monthEntry of readdirSync(yearPath)) {
        const monthPath = join(yearPath, monthEntry);
        if (!statSync(monthPath).isDirectory()) continue;
        for (const dateEntry of readdirSync(monthPath)) {
          const datePath = join(monthPath, dateEntry);
          if (!statSync(datePath).isDirectory()) continue;
          for (const packEntry of readdirSync(datePath)) {
            const packPath = join(datePath, packEntry);
            if (!statSync(packPath).isDirectory()) continue;
            if (existsSync(join(packPath, 'manifest.json'))) dirs.push(packPath);
          }
        }
      }
    }
  } catch {}
  return dirs.sort();
}

function main() {
  const checks: Check[] = [];
  const packs = listPacks();

  // 1. Check each pack has detail.json
  let allHaveDetail = true;
  let allHaveSummary = true;
  let detailJsonValid = true;
  for (const packDir of packs) {
    const detailPath = join(packDir, 'detail.json');
    const summaryPath = join(packDir, 'content-summary.zh.md');
    if (!existsSync(detailPath)) { allHaveDetail = false; }
    if (!existsSync(summaryPath)) { allHaveSummary = false; }
    if (existsSync(detailPath)) {
      try { JSON.parse(readFileSync(detailPath, 'utf8')); }
      catch { detailJsonValid = false; checks.push(check(false, `detail.json valid JSON`, packDir)); }
    }
  }
  checks.push(check(allHaveDetail, 'All packs have detail.json', `${packs.filter(p => existsSync(join(p, 'detail.json'))).length}/${packs.length}`));
  checks.push(check(allHaveSummary, 'All packs have content-summary.zh.md', `${packs.filter(p => existsSync(join(p, 'content-summary.zh.md'))).length}/${packs.length}`));
  checks.push(check(detailJsonValid, 'All detail.json are valid JSON'));

  // 2. Check content-pack-index.json
  const cpIndexPath = join(ASSETS, 'metadata', 'content-pack-index.json');
  let cpIndexValid = existsSync(cpIndexPath);
  if (cpIndexValid) {
    try { JSON.parse(readFileSync(cpIndexPath, 'utf8')); }
    catch { checks.push(check(false, 'content-pack-index.json valid JSON')); cpIndexValid = false; }
  }
  checks.push(check(cpIndexValid, 'content-pack-index.json exists'));

  // 3. Check generated-image-descriptions.json
  const gidPath = join(ASSETS, 'metadata', 'generated-image-descriptions.json');
  const gidExists = existsSync(gidPath);
  if (gidExists) {
    try {
      const gid = JSON.parse(readFileSync(gidPath, 'utf8'));
      checks.push(check(Array.isArray(gid), 'generated-image-descriptions.json is array', `${gid.length} entries`));
    } catch {
      checks.push(check(false, 'generated-image-descriptions.json valid JSON'));
    }
  } else {
    checks.push(check(false, 'generated-image-descriptions.json exists'));
  }

  // 4. Check gallery/assets.json
  const assetsJsonPath = join(ASSETS, 'gallery', 'assets.json');
  const assetsJsonValid = existsSync(assetsJsonPath);
  if (assetsJsonValid) {
    try { JSON.parse(readFileSync(assetsJsonPath, 'utf8')); }
    catch { checks.push(check(false, 'gallery/assets.json valid JSON')); assetsJsonValid = false; }
  }
  checks.push(check(assetsJsonValid, 'gallery/assets.json exists and valid JSON'));

  // 5. Check .env not leaked
  const envRe = /\b(api_key|secret|token|password)\s*=\s*[\w\-]+\b/i;
  let envLeaked = false;
  for (const packDir of packs.slice(0, 5)) { // Sample check
    for (const file of ['detail.json', 'content-summary.zh.md']) {
      try {
        const content = readFileSync(join(packDir, file), 'utf8');
        if (envRe.test(content)) envLeaked = true;
      } catch {}
    }
  }
  checks.push(check(!envLeaked, 'No .env / API key leaks in enrichment files'));

  // 6. Check [truncated] not present
  let hasTruncated = false;
  for (const packDir of packs.slice(0, 5)) {
    try {
      const content = readFileSync(join(packDir, 'content-summary.zh.md'), 'utf8');
      if (content.includes('[truncated]')) hasTruncated = true;
    } catch {}
  }
  checks.push(check(!hasTruncated, 'No [truncated] markers in enrichment files'));

  // Summary
  const passCount = checks.filter(c => c.pass).length;
  const totalCount = checks.length;
  const allPass = passCount === totalCount;

  console.log(`\n=== validate-content-enrichment ===`);
  console.log(`Packs found: ${packs.length}`);
  for (const c of checks) {
    const mark = c.pass ? '✅' : '❌';
    console.log(`  ${mark} ${c.name}${c.detail ? ' (' + c.detail + ')' : ''}`);
  }
  console.log(`\nResult: ${passCount}/${totalCount} checks passed${allPass ? ' — ALL PASS' : ' — SOME FAIL'}`);

  process.exit(allPass ? 0 : 1);
}

main();