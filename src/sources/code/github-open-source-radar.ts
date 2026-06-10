/**
 * GitHub Open Source Radar — Phase 1R
 *
 * CRITICAL: HARD-CODED EXCLUSION of conanxin/*
 * This radar discovers EXTERNAL open source projects only.
 */
import { fetchWithRetry } from "../../utils/fetch-with-retry";
import { generateId, sleep } from "../utils";
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

const QUERIES = [
  { query: "topic:ai-agent stars:>300", priority: 1 },
  { query: "topic:mcp stars:>100", priority: 1 },
  { query: "topic:llm stars:>500", priority: 2 },
  { query: "topic:generative-ai stars:>500", priority: 2 },
  { query: '"coding agent" stars:>100', priority: 2 },
  { query: "topic:text-to-image stars:>100", priority: 3 },
  { query: '"text to video" stars:>100', priority: 3 },
  { query: '"music generation" stars:>50', priority: 3 },
  { query: "topic:local-llm stars:>200", priority: 3 },
  { query: "topic:rag stars:>100", priority: 3 },
  { query: "topic:knowledge-management stars:>50", priority: 3 },
  { query: "topic:personal-automation stars:>50", priority: 3 },
];

const MAX_PER_QUERY = 5;

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: string;
  used: number;
}

let lastRateLimit: RateLimitInfo | null = null;

export const githubOpenSourceRadarAdapter: SourceAdapter = {
  sourceType: "code",
  sourceName: "GitHub Open Source Radar",

  async fetch(_after?: Date): Promise<SourceRecord[]> {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "creative-quota-harvester/1.0 (personal research)",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const records: SourceRecord[] = [];

    for (const q of QUERIES) {
      // NOTE: GitHub Search API does NOT support 'NOT user:username' syntax.
      // Exclusion of conanxin/* is enforced CLIENT-SIDE in the normalize() step.
      const fullQuery = `${q.query} pushed:>2026-05-01`;

      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        attempt++;
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(fullQuery)}&sort=stars&order=desc&per_page=${MAX_PER_QUERY}`;

        const result = await fetchWithRetry({
          url,
          headers,
          timeoutMs: 20000,
          retries:2,
          retryDelayMs: 5000,
        });

        const durationMs = result.durationMs;

        if (result.ok) {
          const data = result.data as GitHubSearchResponse;
          lastRateLimit = {
            limit: parseInt(result.headers["x-ratelimit-limit"] || "0") || 10,
            remaining: parseInt(result.headers["x-ratelimit-remaining"] || "0") || 0,
            reset: result.headers["x-ratelimit-reset"] || "",
            used: parseInt(result.headers["x-ratelimit-used"] || "0") || 0,
          };

          for (const item of data.items || []) {
            // Belt and suspenders: double-check exclusion
            if (item.full_name.toLowerCase().startsWith(`${EXCLUDED_USER}/`)) {
              console.warn(`[github-radar] Skipped excluded: ${item.full_name}`);
              continue;
            }

            records.push({
              id: generateId("gh"),
              source: "github-open-source-radar",
              sourceType: this.sourceType,
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
                query: q.query,
                priority: q.priority,
                usedCurlFallback: result.usedCurlFallback,
                rateLimit: lastRateLimit,
              },
            });
          }

          console.log(`[github-radar] "${q.query}": ${data.items?.length || 0} repos (${durationMs}ms, curl=${result.usedCurlFallback})`);
          break; // Success, exit retry loop
        }

        const status = result.status;
        console.warn(`[github-radar] Query "${q.query}" attempt ${attempt} failed: HTTP ${status} (${durationMs}ms)`);

        if (status === 403) {
          // Rate limited — wait longer
          const resetTs = result.headers["x-ratelimit-reset"];
          if (resetTs) {
            const resetDate = new Date(parseInt(resetTs) * 1000);
            const waitMs = Math.max(resetDate.getTime() - Date.now(), 0);
            console.warn(`[github-radar] Rate limited. Reset at ${resetDate.toISOString()}, waiting ${Math.ceil(waitMs/1000)}s`);
            await sleep(Math.min(waitMs + 5000, 120000));
          } else {
            await sleep(60000);
          }
        } else if (status === 422) {
          // Unprocessable — bad query, skip
          console.warn(`[github-radar] Query "${q.query}" returned 422, skipping`);
          break;
        } else if (attempt < maxAttempts) {
          await sleep(10000 * attempt);
        }
      }

      // 7s gap between queries (10 req/min safe)
      await sleep(7000);
    }

    if (lastRateLimit) {
      console.log(`[github-radar] Final rate limit: remaining=${lastRateLimit.remaining}, reset=${lastRateLimit.reset}`);
    }

    return records;
  },

  normalize(record: SourceRecord): SignalRecord[] {
    const raw = record.raw as Record<string, unknown>;
    const fullName = raw["full_name"] as string || "";
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
        priority: raw["priority"],
        license: raw["license"],
        usedCurlFallback: raw["usedCurlFallback"],
        rateLimit: raw["rateLimit"],
      },
    }];
  },

  estimatedCallsPerRun() { return QUERIES.length; },
  cacheTTLMs() { return 6 * 60 * 60 * 1000; },
};

export function getLastRateLimit(): RateLimitInfo | null {
  return lastRateLimit;
}

export { EXCLUDED_USER };
export default githubOpenSourceRadarAdapter;