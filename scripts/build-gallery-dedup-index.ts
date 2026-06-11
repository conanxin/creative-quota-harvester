#!/usr/bin/env tsx
/**
 * scripts/build-gallery-dedup-index.ts
 *
 * Deduplicates content packs by canonical key (title + source_type).
 * Groups versions, picks best (highest score) as primary.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ASSETS = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';

function safeReadJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; }
  catch { return fallback; }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[…]+/g, '...')
    .replace(/\.{3,}/g, '...');
}

function canonicalKey(pack: any): string {
  return `${normalizeTitle(pack.title)}__${pack.source_types?.[0] || 'unknown'}`;
}

interface PackData {
  pack_dir: string;
  title: string;
  date: string;
  source_types: string[];
  score: number;
  tags: string[];
  recommended_assets: string[];
  detail_path: string;
  summary_path: string;
  has_generated_image: boolean;
  detail_page_path?: string;
  detail_page_url?: string;
  summary_md_path?: string;
  detail_json_path?: string;
}

interface DedupItem {
  canonical_key: string;
  title: string;
  source_type: string;
  source_label_zh: string;
  primary_pack_dir: string;
  version_count: number;
  versions: {
    pack_dir: string;
    title: string;
    date: string;
    score: number;
    source_type: string;
    detail_page_path: string;
  }[];
  score: number;
  one_sentence_summary: string;
  why_it_matters: string;
  recommended_uses: string[];
  generated_images: any[];
  detail_page_path: string;
  summary_md_path: string;
  detail_json_path: string;
  tags: string[];
}

function main() {
  const cpIndex = safeReadJson<{ content_packs: PackData[] }>(
    join(ASSETS, 'metadata', 'content-pack-index.json'),
    { content_packs: [] }
  );

  // Group by canonical key
  const groups: Record<string, PackData[]> = {};
  for (const pack of cpIndex.content_packs) {
    const key = canonicalKey(pack);
    if (!groups[key]) groups[key] = [];
    groups[key].push(pack);
  }

  // Build dedup items
  const items: DedupItem[] = [];
  for (const [key, packs] of Object.entries(groups)) {
    // Sort by score descending, pick highest as primary
    const sorted = [...packs].sort((a, b) => b.score - a.score);
    const primary = sorted[0];

    // Read primary detail.json for rich content
    const detailPath = join(ASSETS, primary.pack_dir, 'detail.json');
    const detail = safeReadJson<any>(detailPath, {});

    const item: DedupItem = {
      canonical_key: key,
      title: primary.title,
      source_type: primary.source_types[0] || 'unknown',
      source_label_zh: detail.source_label_zh || '素材',
      primary_pack_dir: primary.pack_dir,
      version_count: packs.length,
      versions: sorted.map(p => ({
        pack_dir: p.pack_dir,
        title: p.title,
        date: p.date,
        score: p.score,
        source_type: p.source_types[0] || 'unknown',
        detail_page_path: p.detail_page_path || `${p.pack_dir}/index.html`,
      })),
      score: primary.score,
      one_sentence_summary: detail.one_sentence_summary || '',
      why_it_matters: detail.why_it_matters || '',
      recommended_uses: detail.recommended_uses || primary.recommended_assets || [],
      generated_images: detail.available_assets?.generated_images || [],
      detail_page_path: primary.detail_page_path || `${primary.pack_dir}/index.html`,
      summary_md_path: primary.summary_md_path || `${primary.pack_dir}/content-summary.zh.md`,
      detail_json_path: primary.detail_json_path || `${primary.pack_dir}/detail.json`,
      tags: primary.tags || [],
    };
    items.push(item);
  }

  // Sort by score descending
  items.sort((a, b) => b.score - a.score);

  const dedupIndex = {
    generated_at: new Date().toISOString(),
    total_packs: cpIndex.content_packs.length,
    unique_topics: items.length,
    duplicates_collapsed: cpIndex.content_packs.length - items.length,
    items,
  };

  writeFileSync(
    join(ASSETS, 'metadata', 'gallery-dedup-index.json'),
    JSON.stringify(dedupIndex, null, 2) + '\n'
  );

  console.log(`[build-gallery-dedup] ${dedupIndex.total_packs} packs → ${dedupIndex.unique_topics} unique topics (${dedupIndex.duplicates_collapsed} duplicates collapsed)`);
}

main();
