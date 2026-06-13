/**
 * GitHub Open Source Radar — Phase 4C-5
 *
 * CRITICAL: HARD-CODED EXCLUSION of conanxin/*
 * This radar discovers EXTERNAL open source projects only.
 *
 * Phase 4C-5 changes:
 *   - profile-aware: fast (4 high-value queries) vs full (12)
 *   - concurrent execution with bounded pool (2)
 *   - per-query result cap (5) enforced
 *   - rate-limit header awareness: stop early if remaining < 3
 *   - per-query timeout enforcement (3 attempts max)
 *   - one failure does not drag the whole source
 *   - still serial fallback when concurrency=1
 */
import { fetchWithRetry } from "../../utils/fetch-with-retry";
import { generateId } from "../utils";
import { getActiveProfile, getFastOrFullConfig, runWithPool, type CollectProfile } from "../profile";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

// HARD-CODED — NEVER configurable
const EXCLUDED_USER = "conanxin";

interface GitHubSearchItem {
  id: number;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  pushed_at: string;
  created_at: string;
  updated_at: string;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  license: { name: string } | null;
  homepage: string | null;
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchItem[];
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: string;
  used: number;
}

interface QueryResult {
  query: string;
  items: SourceRecord[];
  ok: boolean;
  status: number | null;
  durationMs: number;
  error?: string;
  rateLimit?: RateLimitInfo;
}

let lastRateLimit: RateLimitInfo | null = null;
let lastProfileUsed: CollectProfile | null = null;

function todayIso(): string {
  // Use a 30-day window so we don't fail on the very first day of a new month.
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

async function runOneQuery(
  query: string,
  maxPerQuery: number,
  headers: Record<string, string>
): Promise<QueryResult> {
  // NOTE: GitHub Search API does NOT support 'NOT user:username' syntax.
  // Exclusion of conanxin/* is enforced CLIENT-SIDE in normalize() and below.
  const fullQuery = `${query} pushed:>${todayIso()}`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(fullQuery)}&sort=stars&order=desc&per_page=${maxPerQuery}`;

  const result = await fetchWithRetry({
    url,
    headers,
    timeoutMs: 20000,
    retries: 1,
    retryDelayMs: 3000,
  });

  const records: SourceRecord[] = [];
  let rl: RateLimitInfo | undefined;

  if (result.ok) {
    const data = result.data as GitHubSearchResponse;
    rl = {
      limit: parseInt(result.headers["x-ratelimit-limit"] || "0") || 10,
      remaining: parseInt(result.headers["x-ratelimit-remaining"] || "0") || 0,
      reset: result.headers["x-ratelimit-reset"] || "",
      used: parseInt(result.headers["x-ratelimit-used"] || "0") || 0,
    };
    for (const item of data.items || []) {
      if (item.full_name.toLowerCase().startsWith(`${EXCLUDED_USER}/`)) {
        continue;
      }
      records.push({
        id: generateId("gh"),
        source: "github-open-source-radar",
        sourceType: "code",
        url: item.html_url,
        fetchedAt: new Date().toISOString(),
        raw: {
          repo_id: item.id,
          full_name: item.full_name,
          description: item.description,
          stars: item.stargazers_count,
          language: item.language,
          topics: item.topics,
          pushed_at: item.pushed_at,
          created_at: item.created_at,
          forks: item.forks_count,
          watchers: item.watchers_count,
          license: item.license?.name,
          homepage: item.homepage,
          query,
          usedCurlFallback: result.usedCurlFallback,
          rateLimit: rl,
        },
      });
    }
    return {
      query,
      items: records,
      ok: true,
      status: result.status,
      durationMs: result.durationMs,
      rateLimit: rl,
    };
  }

  // Non-OK (e.g., 422 unprocessable query, 403 rate-limited, network failure)
  return {
    query,
    items: records,
    ok: false,
    status: result.status,
    durationMs: result.durationMs,
    error: result.error || `HTTP ${result.status}`,
  };
}

export const githubOpenSourceRadarAdapter: SourceAdapter = {
  sourceType: "code",
  sourceName: "GitHub Open Source Radar",

  async fetch(_after?: Date): Promise<SourceRecord[]> {
    const profile = getActiveProfile();
    lastProfileUsed = profile;

    // diagnose profile returns empty — connectivity is checked elsewhere
    if (profile === "diagnose") return [];

    const config = getFastOrFullConfig(profile);

    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "creative-quota-harvester/1.0 (personal research)",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const queries = config.github_queries;
    const maxPerQuery = config.github_max_per_query;
    const concurrency = config.github_concurrency;

    // Build task list
    const tasks: Array<() => Promise<QueryResult>> = queries.map(q => () => runOneQuery(q, maxPerQuery, headers));

    // Bounded concurrent pool
    const results = await runWithPool(tasks, concurrency);

    let allRecords: SourceRecord[] = [];
    let succeededQueries = 0;
    let failedQueries = 0;
    let stoppedEarly = false;

    for (const r of results) {
      if (r.error) {
        failedQueries++;
        console.warn(`[github-radar] "${queries[r.index]}" FAILED: ${r.error.message} (${r.durationMs}ms)`);
        continue;
      }
      const qr = r.value as QueryResult;
      if (!qr.ok) {
        failedQueries++;
        console.warn(`[github-radar] "${qr.query}" NOT OK: ${qr.error} (${qr.durationMs}ms)`);
        continue;
      }
      succeededQueries++;
      allRecords = allRecords.concat(qr.items);
      if (qr.rateLimit) {
        lastRateLimit = qr.rateLimit;
        if (qr.rateLimit.remaining < 3) {
          stoppedEarly = true;
          console.warn(`[github-radar] Rate limit remaining=${qr.rateLimit.remaining} < 3 — stop early`);
          break;
        }
      }
    }

    console.log(
      `[github-radar] profile=${profile} queries=${queries.length} concurrency=${concurrency} ` +
        `succeeded=${succeededQueries} failed=${failedQueries} records=${allRecords.length} ` +
        `stoppedEarly=${stoppedEarly} rateLimit=${lastRateLimit ? `remaining=${lastRateLimit.remaining}/${lastRateLimit.limit}` : "n/a"}`
    );

    return allRecords;
  },

  normalize(record: SourceRecord): SignalRecord[] {
    const raw = record.raw as Record<string, unknown>;
    const fullName = raw["full_name"] as string || "";
    // Final belt-and-suspenders exclusion check
    if (fullName.toLowerCase().startsWith(`${EXCLUDED_USER}/`)) {
      return [];
    }
    const description = raw["description"] as string | null || "No description";
    const topics = raw["topics"] as string[] || [];
    const stars = raw["stars"] as number || 0;
    const language = raw["language"] as string | null || "";
    const tags = [...topics, "github", "open-source", language || "unknown"].filter(Boolean);

    return [{
      id: record.id,
      sourceType: record.sourceType,
      sourceId: fullName,
      title: fullName,
      summary: description,
      url: record.url,
      publishedAt: raw["created_at"] as string || record.fetchedAt,
      fetchedAt: record.fetchedAt,
      tags,
      metadata: {
        stars,
        language,
        topics,
        pushedAt: raw["pushed_at"],
        forks: raw["forks"],
        watchers: raw["watchers"],
        query: raw["query"],
        license: raw["license"],
        usedCurlFallback: raw["usedCurlFallback"],
        rateLimit: raw["rateLimit"],
      },
    }];
  },

  estimatedCallsPerRun() {
    const profile = getActiveProfile();
    if (profile === "diagnose") return 0;
    const config = getFastOrFullConfig(profile);
    return config.github_queries.length;
  },
  cacheTTLMs() { return 6 * 60 * 60 * 1000; },
};

export function getLastRateLimit(): RateLimitInfo | null {
  return lastRateLimit;
}

export function getLastProfileUsed(): CollectProfile | null {
  return lastProfileUsed;
}

export { EXCLUDED_USER };
export default githubOpenSourceRadarAdapter;
