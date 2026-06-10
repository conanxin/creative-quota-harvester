/**
 * Hugging Face Hub Source Adapter — Phase 1R
 * Uses public Hub API with retry + curl fallback
 */
import { fetchWithRetry } from "../../utils/fetch-with-retry";
import { generateId, truncate } from "../utils";
import type { SourceAdapter, SourceRecord, SignalRecord } from "../types";

const MODEL_FILTERS = [
  "text-generation", "text-to-image", "image-to-video",
  "automatic-speech-recognition", "text-to-speech",
  "image-to-text", "multimodal", "code",
];

const DATASET_FILTERS = ["rag", "instruction-tuning", "preference"];

const MAX_PER_FILTER = 3;
const HF_HEADERS: Record<string, string> = {
  "User-Agent": "creative-quota-harvester/1.0 (personal research)",
};
const HF_TOKEN = process.env.HF_TOKEN;
if (HF_TOKEN) HF_HEADERS["Authorization"] = `Bearer ${HF_TOKEN}`;

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

async function fetchHfModels(): Promise<SourceRecord[]> {
  const records: SourceRecord[] = [];

  for (const filter of MODEL_FILTERS) {
    const url = `https://huggingface.co/api/models?filter=${encodeURIComponent(filter)}&sort=likes&direction=-1&limit=${MAX_PER_FILTER}&full=true`;

    const result = await fetchWithRetry({ url, headers: HF_HEADERS, timeoutMs: 20000, retries: 1, retryDelayMs: 3000 });

    if (!result.ok) {
      console.warn(`[huggingface] Model filter "${filter}" HTTP ${result.status} (${result.durationMs}ms, curl=${result.usedCurlFallback})`);
      continue;
    }

    const models = result.data as HFModel[] || [];
    let added = 0;
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
      added++;
    }
    console.log(`[huggingface] "${filter}": ${added} models (${result.durationMs}ms)`);
    await new Promise(r => setTimeout(r, 5000)); // 1 req/5s
  }

  return records;
}

async function fetchHfDatasets(): Promise<SourceRecord[]> {
  const records: SourceRecord[] = [];

  for (const filter of DATASET_FILTERS) {
    const url = `https://huggingface.co/api/datasets?filter=${encodeURIComponent(filter)}&sort=likes&direction=-1&limit=${MAX_PER_FILTER}`;

    const result = await fetchWithRetry({ url, headers: HF_HEADERS, timeoutMs: 20000, retries: 1, retryDelayMs: 3000 });

    if (!result.ok) {
      console.warn(`[huggingface] Dataset filter "${filter}" HTTP ${result.status} (${result.durationMs}ms)`);
      continue;
    }

    const datasets = result.data as HFDataset[] || [];
    let added = 0;
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
      added++;
    }
    console.log(`[huggingface] dataset:"${filter}": ${added} datasets (${result.durationMs}ms)`);
    await new Promise(r => setTimeout(r, 5000));
  }

  return records;
}

export const huggingfaceHubAdapter: SourceAdapter = {
  sourceType: "ai-ecosystem",
  sourceName: "Hugging Face Hub",

  async fetch(_after?: Date): Promise<SourceRecord[]> {
    const allRecords: SourceRecord[] = [];

    try {
      const modelRecords = await fetchHfModels();
      allRecords.push(...modelRecords);
    } catch (err) {
      console.warn(`[huggingface] Models fetch failed: ${(err as Error).message}`);
    }

    try {
      const datasetRecords = await fetchHfDatasets();
      allRecords.push(...datasetRecords);
    } catch (err) {
      console.warn(`[huggingface] Datasets fetch failed: ${(err as Error).message}`);
    }

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

  estimatedCallsPerRun() { return MODEL_FILTERS.length + DATASET_FILTERS.length; },
  cacheTTLMs() { return 6 * 60 * 60 * 1000; },
};

export default huggingfaceHubAdapter;