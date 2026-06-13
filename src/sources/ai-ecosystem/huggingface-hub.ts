/**
 * Hugging Face Hub Source Adapter — Phase 4C-5
 * Uses public Hub API with retry + curl fallback.
 *
 * Phase 4C-5 changes:
 *   - profile-aware: fast (4 filters) vs full (8+)
 *   - bounded concurrent pool (2)
 *   - per-filter cap (5 in fast, 3 in full)
 *   - no fixed 5s serial wait between filters
 *   - if API is slow / partial, return whatever succeeded
 *   - metadata only — no model downloads, no inference
 */
import { fetchWithRetry } from "../../utils/fetch-with-retry";
import { generateId } from "../utils";
import { getActiveProfile, getFastOrFullConfig, runWithPool, type CollectProfile } from "../profile";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

interface HFModel {
  id: string;
  lastModified?: string;
  likes?: number;
  downloads?: number;
  tags?: string[];
  pipeline_tag?: string;
  library_name?: string;
  private?: boolean;
  disabled?: boolean;
}

interface HFDataset {
  id: string;
  lastModified?: string;
  likes?: number;
  downloads?: number;
  tags?: string[];
  private?: boolean;
}

const HF_HEADERS: Record<string, string> = {
  "User-Agent": "creative-quota-harvester/1.0 (personal research)",
};
const HF_TOKEN = process.env.HF_TOKEN;
if (HF_TOKEN) HF_HEADERS["Authorization"] = `Bearer ${HF_TOKEN}`;

interface FilterResult {
  filter: string;
  type: "model" | "dataset";
  records: SourceRecord[];
  ok: boolean;
  status: number | null;
  durationMs: number;
  error?: string;
}

async function fetchHfModelFilter(filter: string, maxPerFilter: number): Promise<FilterResult> {
  const url = `https://huggingface.co/api/models?filter=${encodeURIComponent(filter)}&sort=likes&direction=-1&limit=${maxPerFilter}&full=true`;
  const result = await fetchWithRetry({ url, headers: HF_HEADERS, timeoutMs: 15000, retries: 1, retryDelayMs: 2000 });

  if (!result.ok) {
    return {
      filter,
      type: "model",
      records: [],
      ok: false,
      status: result.status,
      durationMs: result.durationMs,
      error: result.error || `HTTP ${result.status}`,
    };
  }

  const models = result.data as HFModel[] || [];
  const records: SourceRecord[] = [];
  for (const model of models) {
    if (model.private || model.disabled) continue;
    records.push({
      id: generateId("hf"),
      source: "huggingface-hub",
      sourceType: "ai-ecosystem",
      url: `https://huggingface.co/${model.id}`,
      fetchedAt: new Date().toISOString(),
      raw: {
        type: "model",
        modelId: model.id,
        lastModified: model.lastModified,
        likes: model.likes,
        downloads: model.downloads,
        pipeline_tag: model.pipeline_tag,
        library_name: model.library_name,
        tags: model.tags,
        usedCurlFallback: result.usedCurlFallback,
      },
    });
  }
  return {
    filter,
    type: "model",
    records,
    ok: true,
    status: result.status,
    durationMs: result.durationMs,
  };
}

async function fetchHfDatasetFilter(filter: string, maxPerFilter: number): Promise<FilterResult> {
  const url = `https://huggingface.co/api/datasets?filter=${encodeURIComponent(filter)}&sort=likes&direction=-1&limit=${maxPerFilter}`;
  const result = await fetchWithRetry({ url, headers: HF_HEADERS, timeoutMs: 15000, retries: 1, retryDelayMs: 2000 });

  if (!result.ok) {
    return {
      filter,
      type: "dataset",
      records: [],
      ok: false,
      status: result.status,
      durationMs: result.durationMs,
      error: result.error || `HTTP ${result.status}`,
    };
  }

  const datasets = result.data as HFDataset[] || [];
  const records: SourceRecord[] = [];
  for (const dataset of datasets) {
    if (dataset.private) continue;
    records.push({
      id: generateId("hf"),
      source: "huggingface-hub",
      sourceType: "ai-ecosystem",
      url: `https://huggingface.co/datasets/${dataset.id}`,
      fetchedAt: new Date().toISOString(),
      raw: {
        type: "dataset",
        datasetId: dataset.id,
        lastModified: dataset.lastModified,
        likes: dataset.likes,
        downloads: dataset.downloads,
        tags: dataset.tags,
        usedCurlFallback: result.usedCurlFallback,
      },
    });
  }
  return {
    filter,
    type: "dataset",
    records,
    ok: true,
    status: result.status,
    durationMs: result.durationMs,
  };
}

let lastProfileUsed: CollectProfile | null = null;

export const huggingfaceHubAdapter: SourceAdapter = {
  sourceType: "ai-ecosystem",
  sourceName: "Hugging Face Hub",

  async fetch(_after?: Date): Promise<SourceRecord[]> {
    const profile = getActiveProfile();
    lastProfileUsed = profile;

    if (profile === "diagnose") return [];

    const config = getFastOrFullConfig(profile);

    const allRecords: SourceRecord[] = [];
    const modelFilters = config.huggingface_filters;
    const datasetFilters: string[] = config.huggingface_dataset_filters || [];
    const maxPerFilter = config.huggingface_max_per_filter;
    const concurrency = config.huggingface_concurrency;

    // Model filters as concurrent tasks
    const modelTasks = modelFilters.map(f => () => fetchHfModelFilter(f, maxPerFilter));
    const modelResults = await runWithPool(modelTasks, concurrency);

    let modelSuccess = 0;
    let modelFailed = 0;
    for (const r of modelResults) {
      if (r.error) {
        modelFailed++;
        console.warn(`[huggingface] model filter "${modelFilters[r.index]}" ERROR: ${r.error.message} (${r.durationMs}ms)`);
        continue;
      }
      const fr = r.value as FilterResult;
      if (!fr.ok) {
        modelFailed++;
        console.warn(`[huggingface] model filter "${fr.filter}" HTTP ${fr.status} (${fr.durationMs}ms)`);
        continue;
      }
      modelSuccess++;
      allRecords.push(...fr.records);
      console.log(`[huggingface] model "${fr.filter}": ${fr.records.length} models (${fr.durationMs}ms)`);
    }

    // Dataset filters only on full profile
    let datasetSuccess = 0;
    let datasetFailed = 0;
    if (profile === "full" && datasetFilters.length > 0) {
      const datasetTasks: Array<() => Promise<FilterResult>> = datasetFilters.map((f: string) => () => fetchHfDatasetFilter(f, maxPerFilter));
      const datasetResults = await runWithPool(datasetTasks, concurrency);
      for (const r of datasetResults) {
        if (r.error) {
          datasetFailed++;
          console.warn(`[huggingface] dataset filter "${datasetFilters[r.index]}" ERROR: ${r.error.message} (${r.durationMs}ms)`);
          continue;
        }
        const fr = r.value as FilterResult;
        if (!fr.ok) {
          datasetFailed++;
          console.warn(`[huggingface] dataset filter "${fr.filter}" HTTP ${fr.status} (${fr.durationMs}ms)`);
          continue;
        }
        datasetSuccess++;
        allRecords.push(...fr.records);
        console.log(`[huggingface] dataset "${fr.filter}": ${fr.records.length} datasets (${fr.durationMs}ms)`);
      }
    }

    console.log(
      `[huggingface] profile=${profile} modelFilters=${modelFilters.length} datasetFilters=${datasetFilters.length} ` +
        `concurrency=${concurrency} modelOK=${modelSuccess}/${modelFilters.length} ` +
        `datasetOK=${datasetSuccess}/${datasetFilters.length} records=${allRecords.length}`
    );

    return allRecords;
  },

  normalize(record: SourceRecord): SignalRecord[] {
    const raw = record.raw as Record<string, unknown>;
    const type = raw["type"] as string || "model";
    const id = raw["modelId"] || raw["datasetId"] || record.id;
    const pipelineTag = raw["pipeline_tag"] as string || type;
    const tags = ["huggingface", "ai-ecosystem", pipelineTag, type].filter(Boolean);

    return [{
      id: record.id,
      sourceType: record.sourceType,
      sourceId: String(id),
      title: String(id),
      summary: `${type === "model" ? "Model" : "Dataset"}: ${id} (${pipelineTag}). Likes: ${raw["likes"] || 0}, Downloads: ${raw["downloads"] || 0}`,
      url: record.url,
      publishedAt: raw["lastModified"] as string || record.fetchedAt,
      fetchedAt: record.fetchedAt,
      tags,
      metadata: {
        likes: raw["likes"] as number,
        downloads: raw["downloads"] as number,
        pipeline: pipelineTag,
        type,
        topics: tags,
        usedCurlFallback: raw["usedCurlFallback"],
      },
    }];
  },

  estimatedCallsPerRun() {
    const profile = getActiveProfile();
    if (profile === "diagnose") return 0;
    const config = getFastOrFullConfig(profile);
    const modelCount = config.huggingface_filters.length;
    const datasetCount = (config.huggingface_dataset_filters || []).length;
    return modelCount + datasetCount;
  },
  cacheTTLMs() { return 6 * 60 * 60 * 1000; },
};

export function getLastProfileUsed(): CollectProfile | null {
  return lastProfileUsed;
}

export default huggingfaceHubAdapter;
