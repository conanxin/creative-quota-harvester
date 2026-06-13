/**
 * profile.ts — Phase 4C-5
 *
 * Centralized budget + profile loader for source adapters.
 * Reads config/source-budgets.json (if present) or falls back to
 * config/source-budgets.example.json baked-in defaults.
 *
 * Profiles:
 *   - fast:   4 high-value queries/filters, low concurrency, daily 07:30 default
 *   - full:   all queries/filters, full concurrency, manual deep refresh
 *   - diagnose: connectivity only, no signal collection
 */
import * as fs from "fs";
import * as path from "path";

export type CollectProfile = "fast" | "full" | "diagnose";

export interface SourceBudgets {
  version: string;
  phase: string;
  default_source_timeout_ms: number;
  overall_collect_warning_ms: number;
  daily_profile: CollectProfile;
  concurrency: Record<string, number>;
  max_results_per_source: Record<string, number>;
  cooldown: {
    gdelt: string;
  };
  profiles: {
    fast: FastProfileConfig;
    full: FastProfileConfig;
    diagnose: DiagnoseProfileConfig;
  };
}

export interface FastProfileConfig {
  github_queries: string[];
  github_max_per_query: number;
  github_concurrency: number;
  huggingface_filters: string[];
  huggingface_dataset_filters?: string[];
  huggingface_max_per_filter: number;
  huggingface_concurrency: number;
  hackernews_story_count: number;
  hackernews_max_items_per_class: number;
  hackernews_item_concurrency: number;
  hackernews_item_timeout_ms: number;
  hackernews_keyword_fallback: number;
  gdelt: "skip_on_cooldown" | "always_try";
  gdelt_max_records: number;
}

export interface DiagnoseProfileConfig {
  connectivity_timeout_ms: number;
  connectivity_retries: number;
}

// ── Baked-in defaults (mirror config/source-budgets.example.json) ──
const DEFAULT_BUDGETS: SourceBudgets = {
  version: "0.1.0",
  phase: "4C-5",
  default_source_timeout_ms: 35000,
  overall_collect_warning_ms: 240000,
  daily_profile: "fast",
  concurrency: {
    github: 2,
    huggingface: 2,
    hackernews: 5,
    default: 2,
  },
  max_results_per_source: {
    github: 20,
    huggingface: 20,
    hackernews: 15,
    arxiv: 20,
    met: 7,
    context: 3,
  },
  cooldown: {
    gdelt: "6h on 429",
  },
  profiles: {
    fast: {
      github_queries: [
        "topic:ai-agent stars:>300",
        "topic:generative-ai stars:>500",
        "topic:mcp stars:>100",
        '"coding agent" stars:>100',
      ],
      github_max_per_query: 5,
      github_concurrency: 2,
      huggingface_filters: [
        "text-to-image",
        "image-to-video",
        "text-generation",
        "multimodal",
      ],
      huggingface_max_per_filter: 5,
      huggingface_concurrency: 2,
      hackernews_story_count: 60,
      hackernews_max_items_per_class: 20,
      hackernews_item_concurrency: 5,
      hackernews_item_timeout_ms: 4000,
      hackernews_keyword_fallback: 3,
      gdelt: "skip_on_cooldown",
      gdelt_max_records: 15,
    },
    full: {
      github_queries: [
        "topic:ai-agent stars:>300",
        "topic:mcp stars:>100",
        "topic:llm stars:>500",
        "topic:generative-ai stars:>500",
        '"coding agent" stars:>100',
        "topic:text-to-image stars:>100",
        '"text to video" stars:>100',
        '"music generation" stars:>50',
        "topic:local-llm stars:>200",
        "topic:rag stars:>100",
        "topic:knowledge-management stars:>50",
        "topic:personal-automation stars:>50",
      ],
      github_max_per_query: 5,
      github_concurrency: 2,
      huggingface_filters: [
        "text-generation",
        "text-to-image",
        "image-to-video",
        "automatic-speech-recognition",
        "text-to-speech",
        "image-to-text",
        "multimodal",
        "code",
      ],
      huggingface_dataset_filters: ["rag", "instruction-tuning", "preference"],
      huggingface_max_per_filter: 3,
      huggingface_concurrency: 2,
      hackernews_story_count: 100,
      hackernews_max_items_per_class: 20,
      hackernews_item_concurrency: 5,
      hackernews_item_timeout_ms: 4000,
      hackernews_keyword_fallback: 5,
      gdelt: "always_try",
      gdelt_max_records: 25,
    },
    diagnose: {
      connectivity_timeout_ms: 10000,
      connectivity_retries: 1,
    },
  },
};

let cachedBudgets: SourceBudgets | null = null;
let cachedResolvedFrom: string | null = null;

/**
 * Load source budgets. Resolution order:
 *   1. config/source-budgets.json (per-machine, gitignored)
 *   2. config/source-budgets.example.json (template)
 *   3. DEFAULT_BUDGETS baked-in
 */
export function loadSourceBudgets(): { budgets: SourceBudgets; resolvedFrom: string } {
  if (cachedBudgets) {
    return { budgets: cachedBudgets, resolvedFrom: cachedResolvedFrom || "cached" };
  }

  const configDir = path.resolve(__dirname, "..", "..", "config");
  const localPath = path.join(configDir, "source-budgets.json");
  const examplePath = path.join(configDir, "source-budgets.example.json");

  if (fs.existsSync(localPath)) {
    try {
      const raw = fs.readFileSync(localPath, "utf-8");
      cachedBudgets = JSON.parse(raw) as SourceBudgets;
      cachedResolvedFrom = localPath;
      return { budgets: cachedBudgets, resolvedFrom: localPath };
    } catch (err) {
      console.warn(`[profile] Failed to parse ${localPath}: ${(err as Error).message}. Falling back to example.`);
    }
  }

  if (fs.existsSync(examplePath)) {
    try {
      const raw = fs.readFileSync(examplePath, "utf-8");
      cachedBudgets = JSON.parse(raw) as SourceBudgets;
      cachedResolvedFrom = examplePath;
      return { budgets: cachedBudgets, resolvedFrom: examplePath };
    } catch (err) {
      console.warn(`[profile] Failed to parse ${examplePath}: ${(err as Error).message}. Using baked-in defaults.`);
    }
  }

  cachedBudgets = DEFAULT_BUDGETS;
  cachedResolvedFrom = "baked-in defaults";
  return { budgets: cachedBudgets, resolvedFrom: cachedResolvedFrom };
}

/**
 * Get the active profile config. Priority:
 *   1. CQA_PROFILE env var (set by npm scripts)
 *   2. budgets.daily_profile from config
 *   3. "fast" default
 */
export function getActiveProfile(): CollectProfile {
  const envProfile = process.env.CQA_PROFILE as CollectProfile | undefined;
  if (envProfile === "fast" || envProfile === "full" || envProfile === "diagnose") {
    return envProfile;
  }
  const { budgets } = loadSourceBudgets();
  return budgets.daily_profile || "fast";
}

export function getProfileConfig(profile: CollectProfile): FastProfileConfig | DiagnoseProfileConfig {
  const { budgets } = loadSourceBudgets();
  return budgets.profiles[profile];
}

/**
 * Helper: get the active profile config as FastProfileConfig (use after
 * checking that the profile is not "diagnose").
 */
export function getFastOrFullConfig(profile: CollectProfile): FastProfileConfig {
  if (profile === "diagnose") {
    throw new Error(`getFastOrFullConfig called with profile=diagnose`);
  }
  const { budgets } = loadSourceBudgets();
  return budgets.profiles[profile] as FastProfileConfig;
}

/**
 * Concurrency helper — run `tasks` with `limit` parallel workers.
 * Returns results in completion order, including per-task duration and error.
 */
export interface PoolResult<T> {
  value: T | null;
  error: Error | null;
  index: number;
  durationMs: number;
}

export async function runWithPool<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<PoolResult<T>[]> {
  const results: PoolResult<T>[] = [];
  const queue = tasks.map((fn, i) => ({ fn, i }));
  const workers: Promise<void>[] = [];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const start = Date.now();
      try {
        const value = await item.fn();
        results.push({ value, error: null, index: item.i, durationMs: Date.now() - start });
      } catch (err) {
        results.push({
          value: null,
          error: err instanceof Error ? err : new Error(String(err)),
          index: item.i,
          durationMs: Date.now() - start,
        });
      }
    }
  }

  for (let i = 0; i < Math.min(limit, tasks.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  // Restore original order
  return results.sort((a, b) => a.index - b.index);
}

/**
 * Cooldown state helpers — written to reports/source-cooldowns.json
 */
import * as fsPromises from "fs/promises";

export interface CooldownEntry {
  source: string;
  reason: string;
  cooldown_until: string;
  created_at: string;
}

export interface CooldownFile {
  version: string;
  updated_at: string;
  cooldowns: Record<string, CooldownEntry>;
}

const COOLDOWN_FILE = path.resolve(__dirname, "..", "..", "reports", "source-cooldowns.json");

function parseCooldownSpec(spec: string): number {
  // "6h on 429" -> 6 hours
  const m = spec.match(/^(\d+)\s*(s|m|h)\s+on\s+\d+$/i);
  if (!m) return 6 * 60 * 60 * 1000; // default 6h
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (unit === "s") return n * 1000;
  if (unit === "m") return n * 60 * 1000;
  return n * 60 * 60 * 1000;
}

export async function getCooldown(source: string): Promise<CooldownEntry | null> {
  try {
    if (!fs.existsSync(COOLDOWN_FILE)) return null;
    const raw = await fsPromises.readFile(COOLDOWN_FILE, "utf-8");
    const data = JSON.parse(raw) as CooldownFile;
    const entry = data.cooldowns?.[source];
    if (!entry) return null;
    if (new Date(entry.cooldown_until).getTime() < Date.now()) return null;
    return entry;
  } catch {
    return null;
  }
}

export async function setCooldown(
  source: string,
  reason: string,
  durationMs: number
): Promise<CooldownEntry> {
  const entry: CooldownEntry = {
    source,
    reason,
    cooldown_until: new Date(Date.now() + durationMs).toISOString(),
    created_at: new Date().toISOString(),
  };
  let data: CooldownFile = { version: "0.1.0", updated_at: new Date().toISOString(), cooldowns: {} };
  try {
    if (fs.existsSync(COOLDOWN_FILE)) {
      const raw = await fsPromises.readFile(COOLDOWN_FILE, "utf-8");
      data = JSON.parse(raw) as CooldownFile;
    }
  } catch {
    // Corrupt file — start fresh
  }
  data.cooldowns[source] = entry;
  data.updated_at = new Date().toISOString();
  await fsPromises.writeFile(COOLDOWN_FILE, JSON.stringify(data, null, 2), "utf-8");
  return entry;
}

export function getCooldownMs(source: string): number {
  const { budgets } = loadSourceBudgets();
  if (source === "gdelt") {
    return parseCooldownSpec(budgets.cooldown.gdelt);
  }
  return 6 * 60 * 60 * 1000;
}

export function clearCache() {
  cachedBudgets = null;
  cachedResolvedFrom = null;
}

export default loadSourceBudgets;
