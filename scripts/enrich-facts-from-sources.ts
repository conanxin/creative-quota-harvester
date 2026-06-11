#!/usr/bin/env tsx
/**
 * scripts/enrich-facts-from-sources.ts
 *
 * Phase 4F: Source-aware Facts Enrichment
 *
 * Fetches real public data for each source type and enriches facts.md / detail.json.
 * No MiniMax calls. No LLM calls. Pure public API + template text generation.
 *
 * Source types supported:
 *   code          → GitHub REST API
 *   academic      → arXiv Atom API
 *   ai-ecosystem  → HuggingFace Hub API
 *   culture-art   → Met Museum Public Collection API
 *   dev-community → HTTP fetch + HTML parse
 *
 * Idempotent: only fetches if cache miss or --force.
 * --offline flag: only uses cached data (no new fetches).
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// ── Hardcoded paths ────────────────────────────────────────────────────────────
const HARVESTER = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester';
const ASSETS    = '/home/ubuntu/.openclaw/workspace/projects/creative-quota-assets';
const PACK_DIR  = join(ASSETS, 'content-packs');
const CACHE_FILE = join(ASSETS, 'metadata', 'source-data-cache.json');

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Helpers ────────────────────────────────────────────────────────────────────
function tryRead(path: string, fallback = ''): string {
  try { return readFileSync(path, 'utf8').trim(); } catch { return fallback; }
}

function safeReadJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return fallback; }
}

function fileExists(path: string): boolean {
  try { statSync(path); return true; } catch { return false; }
}

function httpGet(url: string, timeoutMs = 15000): { ok: boolean; data: string; status: number } {
  try {
    const out = execSync(
      `curl -s --max-time 15 -L "${url.replace(/"/g, '\\"')}"`,
      { timeout: timeoutMs, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { ok: true, data: out as string, status: 200 };
  } catch (e: any) {
    const status = e.status || (e.message.includes('curl') ? 0 : 0);
    return { ok: false, data: '', status };
  }
}

function readCache(): Record<string, any> {
  return safeReadJson<Record<string, any>>(CACHE_FILE, {});
}

function writeCache(cache: Record<string, any>): void {
  try { mkdirSync(dirname(CACHE_FILE), { recursive: true }); } catch {}
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function isCacheValid(entry: any, url: string): boolean {
  if (!entry || !entry.data || !entry.fetchedAt) return false;
  if (entry.url !== url) return false;
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
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
            if (fileExists(join(packPath, 'manifest.json'))) dirs.push(packPath);
          }
        }
      }
    }
  } catch {}
  return dirs.sort();
}

// ── Per-source-type fetchers ───────────────────────────────────────────────────

interface FetchResult {
  raw: any;       // raw API response
  summary: string; // one-line summary
  facts: string[]; // 5-10 key facts
  enriched: boolean;
  error?: string;
}

function fetchGitHubRepo(url: string, cache: Record<string, any>, offline: boolean): FetchResult {
  const cacheKey = `gh:${url}`;
  const cached = cache[cacheKey];
  if (cached && isCacheValid(cached, url)) {
    console.log(`  [cache hit] ${url}`);
    return { raw: cached.data?.raw, summary: cached.data?.summary || '', facts: cached.data?.facts || [], enriched: true };
  }
  if (offline) {
    return { raw: null, summary: '', facts: [], enriched: false, error: 'no cache' };
  }

  // Extract owner/repo from URL
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) return { raw: null, summary: '', facts: [], enriched: false, error: 'invalid gh url' };

  const apiUrl = `https://api.github.com/repos/${match[1]}`;
  console.log(`  fetching GitHub API: ${apiUrl}`);
  const res = httpGet(apiUrl);
  if (!res.ok || res.status !== 200) return { raw: null, summary: '', facts: [], enriched: false, error: `HTTP ${res.status}` };

  let repo: any;
  try { repo = JSON.parse(res.data); } catch { return { raw: null, summary: '', facts: [], enriched: false, error: 'parse error' }; }

  const summary = `${repo.description || 'Multi-modal AI agent tool library'} — ${repo.stargazers_count.toLocaleString()} ⭐ · ${repo.forks_count.toLocaleString()} forks · ${repo.language || 'N/A'}`;

  const facts: string[] = [];
  if (repo.description) facts.push(`项目描述: ${repo.description}`);
  if (repo.stargazers_count) facts.push(`GitHub 星标数: ${repo.stargazers_count.toLocaleString()} (截至 ${new Date(repo.updated_at).toLocaleDateString('zh-CN')})`);
  if (repo.forks_count) facts.push(` forks: ${repo.forks_count.toLocaleString()}`);
  if (repo.language) facts.push(`主要语言: ${repo.language}`);
  if (repo.topics && repo.topics.length > 0) facts.push(`主题标签: ${repo.topics.slice(0, 10).join(', ')}`);
  if (repo.license) facts.push(`开源协议: ${repo.license.name || repo.license.spdx_id}`);
  if (repo.open_issues_count !== undefined) facts.push(`open issues: ${repo.open_issues_count}`);
  facts.push(`创建时间: ${new Date(repo.created_at).toLocaleDateString('zh-CN')} · 默认分支: ${repo.default_branch}`);
  if (repo.homepage) facts.push(`官网: ${repo.homepage}`);

  const entry = { url, fetchedAt: Date.now(), data: { summary, facts, raw: repo }, enriched: true };
  cache[cacheKey] = entry;
  return { raw: repo, summary, facts, enriched: true };
}

function fetchArXiv(url: string, cache: Record<string, any>, offline: boolean): FetchResult {
  const cacheKey = `arxiv:${url}`;
  const cached = cache[cacheKey];
  if (cached && isCacheValid(cached, url)) {
    console.log(`  [cache hit] ${url}`);
    return { raw: cached.data?.raw, summary: cached.data?.summary || '', facts: cached.data?.facts || [], enriched: true };
  }
  if (offline) {
    return { raw: null, summary: '', facts: [], enriched: false, error: 'no cache' };
  }

  // Extract arXiv ID from URL (e.g. 2606.11166v1)
  const match = url.match(/(\d{4}\.\d{4,5}(?:v\d+)?)/);
  if (!match) return { raw: null, summary: '', facts: [], enriched: false, error: 'invalid arxiv url' };

  const apiUrl = `https://export.arxiv.org/api/query?id_list=${match[1]}`;
  console.log(`  fetching arXiv API: ${apiUrl}`);
  const res = httpGet(apiUrl);
  if (!res.ok) return { raw: null, summary: '', facts: [], enriched: false, error: `HTTP ${res.status}` };

  // Parse Atom XML manually (no extra deps)
  const xml = res.data;
  const getTag = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
    return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
  };
  const getTags = (tag: string) => {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
    const results: string[] = [];
    let m;
    while ((m = re.exec(xml)) !== null) results.push(m[1].replace(/<[^>]+>/g, '').trim());
    return results;
  };

  const title = getTag('title').replace(/\n/g, ' ');
  const summary = getTag('summary').replace(/\n/g, ' ').slice(0, 300);
  const authors = getTags('author').map(a => a.replace(/<[^>]+>/g, ''));
  const published = getTag('published');
  const categories = [...new Set(getTags('category').map(c => {
    const m = c.match(/term="([^"]+)"/);
    return m ? m[1] : c;
  }))].slice(0, 5);
  const primaryCat = xml.match(/<arxiv:primary_category[^>]+term="([^"]+)"/);
  const updated = getTag('updated');

  const facts: string[] = [];
  if (title) facts.push(`论文标题: ${title}`);
  if (authors.length > 0) facts.push(`作者: ${authors.slice(0, 5).join(', ')}${authors.length > 5 ? ' 等' : ''}`);
  if (published) facts.push(`发表于: ${new Date(published).toLocaleDateString('zh-CN')} (arXiv)`);
  if (primaryCat) facts.push(`主要分类: ${primaryCat[1]}`);
  if (categories.length > 0) facts.push(`相关分类: ${categories.join(', ')}`);
  if (summary) facts.push(`摘要: ${summary.slice(0, 200)}${summary.length > 200 ? '…' : ''}`);
  facts.push(`arXiv ID: ${match[1]}`);
  facts.push(`arXiv URL: https://arxiv.org/abs/${match[1]}`);

  const entry = { url, fetchedAt: Date.now(), data: { title, summary, facts, authors, categories, published }, enriched: true };
  cache[cacheKey] = entry;
  return { raw: { title, summary, authors, categories, published }, summary, facts, enriched: true };
}

function fetchHuggingFace(url: string, cache: Record<string, any>, offline: boolean): FetchResult {
  const cacheKey = `hf:${url}`;
  const cached = cache[cacheKey];
  if (cached && isCacheValid(cached, url)) {
    console.log(`  [cache hit] ${url}`);
    return { raw: cached.data?.raw, summary: cached.data?.summary || '', facts: cached.data?.facts || [], enriched: true };
  }
  if (offline) {
    return { raw: null, summary: '', facts: [], enriched: false, error: 'no cache' };
  }

  // Extract model ID from URL
  const match = url.match(/huggingface\.co\/([^/]+\/[^/\s?]+)/);
  if (!match) return { raw: null, summary: '', facts: [], enriched: false, error: 'invalid hf url' };

  const modelId = match[1].split('?')[0];
  const apiUrl = `https://huggingface.co/api/models/${modelId}`;
  console.log(`  fetching HuggingFace API: ${apiUrl}`);
  const res = httpGet(apiUrl);
  if (!res.ok || res.status !== 200) return { raw: null, summary: '', facts: [], enriched: false, error: `HTTP ${res.status}` };

  let model: any;
  try { model = JSON.parse(res.data); } catch { return { raw: null, summary: '', facts: [], enriched: false, error: 'parse error' }; }

  const summary = `${model.pipeline_tag || 'AI model'} — ${(model.downloads || 0).toLocaleString()} downloads · ${(model.likes || 0).toLocaleString()} likes · ${model.library_name || 'N/A'}`;

  const facts: string[] = [];
  if (model.id) facts.push(`模型 ID: ${model.id}`);
  if (model.pipeline_tag) facts.push(`任务类型: ${model.pipeline_tag}`);
  if (model.downloads) facts.push(`下载量: ${model.downloads.toLocaleString()}`);
  if (model.likes) facts.push(`点赞数: ${model.likes.toLocaleString()}`);
  if (model.library_name) facts.push(`库: ${model.library_name}`);
  if (model.created_at) facts.push(`创建时间: ${new Date(model.created_at).toLocaleDateString('zh-CN')}`);
  if (model.last_modified) facts.push(`最后更新: ${new Date(model.last_modified).toLocaleDateString('zh-CN')}`);
  const tags = (model.tags || []).filter((t: string) => !t.startsWith('license:') && t.length < 30).slice(0, 10);
  if (tags.length > 0) facts.push(`标签: ${tags.join(', ')}`);
  if (model.cardData?.license_name) facts.push(`许可证: ${model.cardData.license_name}`);
  facts.push(`模型页面: https://huggingface.co/${model.id}`);

  const entry = { url, fetchedAt: Date.now(), data: { summary, facts, raw: model }, enriched: true };
  cache[cacheKey] = entry;
  return { raw: model, summary, facts, enriched: true };
}

function fetchMetMuseum(url: string, cache: Record<string, any>, offline: boolean): FetchResult {
  const cacheKey = `met:${url}`;
  const cached = cache[cacheKey];
  if (cached && isCacheValid(cached, url)) {
    console.log(`  [cache hit] ${url}`);
    return { raw: cached.data?.raw, summary: cached.data?.summary || '', facts: cached.data?.facts || [], enriched: true };
  }
  if (offline) {
    return { raw: null, summary: '', facts: [], enriched: false, error: 'no cache' };
  }

  // Extract object ID from URL
  const match = url.match(/\/(\d+)(?:\?.*)?$/);
  if (!match) return { raw: null, summary: '', facts: [], enriched: false, error: 'invalid met url' };

  const apiUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${match[1]}`;
  console.log(`  fetching Met Museum API: ${apiUrl}`);
  const res = httpGet(apiUrl);
  if (!res.ok || res.status !== 200) return { raw: null, summary: '', facts: [], enriched: false, error: `HTTP ${res.status}` };

  let obj: any;
  try { obj = JSON.parse(res.data); } catch { return { raw: null, summary: '', facts: [], enriched: false, error: 'parse error' }; }

  const summary = `${obj.title || 'Unknown artwork'} by ${obj.artistDisplayName || 'Unknown artist'} — ${obj.objectDate || obj.period || 'Unknown date'}`;

  const facts: string[] = [];
  if (obj.title) facts.push(`作品名称: ${obj.title}`);
  if (obj.artistDisplayName) facts.push(`艺术家: ${obj.artistDisplayName}`);
  if (obj.artistDisplayBio) facts.push(`艺术家简介: ${obj.artistDisplayBio}`);
  if (obj.objectDate) facts.push(`创作年代: ${obj.objectDate}`);
  if (obj.medium) facts.push(`媒介/材质: ${obj.medium}`);
  if (obj.dimensions) facts.push(`尺寸: ${obj.dimensions}`);
  if (obj.classification) facts.push(`分类: ${obj.classification}`);
  if (obj.department) facts.push(`部门: ${obj.department}`);
  if (obj.culture) facts.push(`文化/地区: ${obj.culture}`);
  if (obj.period) facts.push(`时期: ${obj.period}`);
  if (obj.GalleryNumber) facts.push(`展厅: Gallery ${obj.GalleryNumber}`);
  if (obj.isPublicDomain !== undefined) facts.push(`公版状态: ${obj.isPublicDomain ? '公版' : '版权保护'}`);
  if (obj.primaryImage) facts.push(`高清图片: ${obj.primaryImage}`);
  const tags = (obj.tags || []).filter((t: any) => t && t.term).map((t: any) => t.term as string);
  if (tags.length > 0) facts.push(`主题标签: ${tags.slice(0, 8).join(', ')}`);

  const entry = { url, fetchedAt: Date.now(), data: { summary, facts, raw: obj }, enriched: true };
  cache[cacheKey] = entry;
  return { raw: obj, summary, facts, enriched: true };
}

function fetchDevCommunity(url: string, cache: Record<string, any>, offline: boolean): FetchResult {
  const cacheKey = `dev:${url}`;
  const cached = cache[cacheKey];
  if (cached && isCacheValid(cached, url)) {
    console.log(`  [cache hit] ${url}`);
    return { raw: cached.data?.raw, summary: cached.data?.summary || '', facts: cached.data?.facts || [], enriched: true };
  }
  if (offline) {
    return { raw: null, summary: '', facts: [], enriched: false, error: 'no cache' };
  }

  console.log(`  fetching dev-community page: ${url}`);
  const res = httpGet(url);
  if (!res.ok) return { raw: null, summary: '', facts: [], enriched: false, error: `HTTP ${res.status}` };

  const html = res.data;
  const getMeta = (name: string) => {
    const m = html.match(new RegExp(`<meta\\s+(?:name|property)=["\\']${name}["\\']\\s+content=["\\']([^"\\']+)["\\']`, 'i'));
    return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim() : '';
  };
  const getH1 = () => {
    const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
  };
  const getFirstPara = () => {
    const m = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!m) return '';
    return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/^\s*/, '').slice(0, 400);
  };

  const title = getMeta('og:title') || getMeta('title') || getH1();
  const description = getMeta('description') || getFirstPara();
  const summary = description ? description.slice(0, 200) : title;

  const facts: string[] = [];
  if (title) facts.push(`标题: ${title}`);
  if (description) facts.push(`简介: ${description.slice(0, 300)}`);
  facts.push(`来源: ${url}`);
  const author = getMeta('author') || '';
  if (author) facts.push(`作者: ${author}`);
  const published = getMeta('article:published_time') || '';
  if (published) facts.push(`发布时间: ${new Date(published).toLocaleDateString('zh-CN')}`);

  const entry = { url, fetchedAt: Date.now(), data: { summary, facts, raw: { title, description } }, enriched: true };
  cache[cacheKey] = entry;
  return { raw: { title, description }, summary, facts, enriched: true };
}

function fetchSourceData(sourceType: string, url: string, cache: Record<string, any>, offline: boolean): FetchResult {
  switch (sourceType) {
    case 'code':          return fetchGitHubRepo(url, cache, offline);
    case 'academic':      return fetchArXiv(url, cache, offline);
    case 'ai-ecosystem':  return fetchHuggingFace(url, cache, offline);
    case 'culture-art':   return fetchMetMuseum(url, cache, offline);
    case 'dev-community': return fetchDevCommunity(url, cache, offline);
    default:              return { raw: null, summary: '', facts: [], enriched: false, error: `unknown source type: ${sourceType}` };
  }
}

// ── Facts template generation ─────────────────────────────────────────────────

function generateFactsMd(sourceType: string, result: FetchResult, packDir: string): string {
  const { summary, facts, enriched } = result;
  const actualFacts = facts || result.data?.facts || [];
  const actualSummary = summary || result.data?.summary || '';
  if (!enriched || actualFacts.length === 0) {
    return `# Factual Basis: ${basename(packDir)}\n\n**Source Confidence:** low\n\n## Key Facts\n1. 信息不足（${result.error || 'enrichment failed'}），facts 基于已有信号元数据生成。\n\n## Source References\n- ${packDir.replace(ASSETS + '/', '')}/source.json\n`;
  }

  const lines: string[] = [
    `# Factual Basis: ${basename(packDir)}`,
    '',
    `**Source Confidence:** high`,
    '',
    '## Key Facts',
  ];
  for (let i = 0; i < Math.min(actualFacts.length, 10); i++) {
    lines.push(`${i + 1}. ${actualFacts[i]}`);
  }
  lines.push('');
  lines.push('## Source References');
  lines.push(`- ${basename(packDir)}/source.json`);

  return lines.join('\n');
}

function generateEnrichedDetail(sourceType: string, result: FetchResult, existingDetail: any): any {
  if (!result.enriched) return existingDetail;

  const { summary, facts } = result;
  const actualFacts = facts || result.data?.facts || [];
  const actualSummary = summary || result.data?.summary || '';

  // Generate a richer one_sentence_summary from the fetched data
  const oneSentenceSummary = actualSummary
    ? actualSummary.slice(0, 200)
    : existingDetail?.one_sentence_summary || '';

  // Generate a more specific why_it_matters based on source type
  let whyItMatters = '';
  if (sourceType === 'code') {
    whyItMatters = `该开源项目在 GitHub 上获得了较高关注度（${actualFacts.find(f => f.includes('⭐')) || '有社区活跃度'}），反映了当前 AI Agent 工具链领域的技术热点，值得开发者关注和参考。`;
  } else if (sourceType === 'academic') {
    whyItMatters = `该 arXiv 论文探讨了 ${actualFacts.find(f => f.includes('论文标题')) || 'AI 领域'} 的前沿问题，对理解当前 AI 技术边界和局限性具有重要参考价值。`;
  } else if (sourceType === 'ai-ecosystem') {
    whyItMatters = `该模型在 HuggingFace 上有 ${actualFacts.find(f => f.includes('下载量')) || '一定下载量'}，是 AI 内容生成生态中的重要工具，可作为生成能力参考或素材来源。`;
  } else if (sourceType === 'culture-art') {
    whyItMatters = `该艺术品来自大都会艺术博物馆馆藏，具有 ${actualFacts.find(f => f.includes('时期')) || '文化和艺术价值'}，是生成视觉创意内容的重要参考。`;
  } else if (sourceType === 'dev-community') {
    whyItMatters = `该社区讨论涉及 ${actualFacts.find(f => f.includes('标题')) || '开发者关心的技术话题'}，反映了行业一线从业者的真实关切和实践经验。`;
  }

  return {
    ...existingDetail,
    one_sentence_summary: oneSentenceSummary || existingDetail?.one_sentence_summary,
    why_it_matters: whyItMatters || existingDetail?.why_it_matters,
    background: existingDetail?.background,
    source_confidence: 'high',
    enriched_facts: actualFacts.slice(0, 5),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  const offline = process.argv.includes('--offline');
  const force = process.argv.includes('--force');
  console.log(`[enrich-facts-from-sources] Starting Phase 4F enrichment (offline=${offline}, force=${force})`);

  const packs = listPacks();
  console.log(`[enrich-facts-from-sources] Found ${packs.length} content packs`);

  const cache = force ? {} : readCache();
  if (force) console.log('[enrich-facts-from-sources] --force: clearing cache before starting');

  const results: { pack: string; enriched: boolean; sourceType: string; error?: string }[] = [];

  let fetches = 0;
  for (const packDir of packs) {
    const sourcePath = join(packDir, 'source.json');
    const source = safeReadJson<any>(sourcePath, {});
    const sourceType = (source.source_types || [])[0] || '';
    const url = (source.source_urls || [])[0] || '';

    if (!sourceType || !url) {
      results.push({ pack: basename(packDir), enriched: false, sourceType: 'unknown', error: 'no source info' });
      continue;
    }

    console.log(`\n[${basename(packDir)}] source_type=${sourceType}`);
    const result = fetchSourceData(sourceType, url, cache, offline);

    if (!result.enriched && !offline) {
      console.log(`  ERROR: ${result.error}`);
      results.push({ pack: basename(packDir), enriched: false, sourceType, error: result.error });
      continue;
    }

    // Write enriched facts.md
    const factsMd = generateFactsMd(sourceType, result, packDir);
    const factsPath = join(packDir, 'facts.md');
    try { writeFileSync(factsPath, factsMd, 'utf8'); } catch (e: any) { console.error(`  ERROR writing facts.md: ${e.message}`); }

    // Update detail.json
    const detailPath = join(packDir, 'detail.json');
    const existingDetail = safeReadJson<any>(detailPath, {});
    const enrichedDetail = generateEnrichedDetail(sourceType, result, existingDetail);
    try { writeFileSync(detailPath, JSON.stringify(enrichedDetail, null, 2), 'utf8'); } catch (e: any) { console.error(`  ERROR writing detail.json: ${e.message}`); }

    if (result.enriched) fetches++;
    results.push({ pack: basename(packDir), enriched: result.enriched, sourceType, error: result.error });

    if (result.enriched) {
      console.log(`  ✓ enriched (${result.facts.length} facts)`);
    } else if (offline) {
      console.log(`  – offline mode, no cache for ${url}`);
    }
  }

  // Save cache
  writeCache(cache);
  console.log(`\n[enrich-facts-from-sources] Done. ${results.filter(r => r.enriched).length}/${packs.length} packs enriched. (${fetches} new fetches)`);
  process.exit(0);
}

main();