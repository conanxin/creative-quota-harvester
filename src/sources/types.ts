/**
 * Creative Quota Harvester — Core Data Types
 * Version: 0.1.0 | Phase: 0A
 */

// ============================================================
// Source Layer
// ============================================================

export interface SourceRecord {
  id: string;
  source: string;
  sourceType: string;
  url: string;
  fetchedAt: string;
  raw: Record<string, unknown>;
}

export interface SourceAdapter {
  readonly sourceType: string;
  readonly sourceName: string;
  fetch(after?: Date): Promise<SourceRecord[]>;
  normalize(record: SourceRecord): SignalRecord[];
  estimatedCallsPerRun(): number;
  cacheTTLMs(): number;
}

// ============================================================
// Signal Layer
// ============================================================

export interface SignalMetadata {
  stars?: number;
  citations?: number;
  views?: number;
  language?: string;
  topics?: string[];
  score?: number;
  comments?: number;
  downloads?: number;
  likes?: number;
  [key: string]: unknown;
}

export interface SignalRecord {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  fetchedAt: string;
  tags: string[];
  metadata: SignalMetadata;
  // Scoring fields (Phase 1+)
  freshnessScore?: number;
  relevanceScore?: number;
  visualPotential?: number;
  xPostPotential?: number;
  creativeAssetPotential?: number;
  finalScore?: number;
}

// ============================================================
// Brief Layer
// ============================================================

export interface BriefReference {
  type: "image" | "music" | "video" | "text";
  description: string;
  url?: string;
}

export interface CreativeBrief {
  id: string;
  signalId: string;
  title: string;
  concept: string;
  keywords: string[];
  narrative: string;
  visualDirection: string;
  tone: string;
  audience: string;
  references: BriefReference[];
  createdAt: string;
  cached: boolean;
}

// ============================================================
// Asset Plan Layer
// ============================================================

export interface PlannedAsset {
  type: "image" | "music" | "video" | "prompt-text";
  priority: number;
  prompt: string;
  estimatedTokens: number;
  style?: string;
  duration?: number;
  dimensions?: { width: number; height: number };
}

export interface AssetPlan {
  id: string;
  briefId: string;
  assets: PlannedAsset[];
  totalEstimatedTokens: number;
  createdAt: string;
}

// ============================================================
// Generation Job Layer
// ============================================================

export type JobStatus = "pending" | "queued" | "running" | "done" | "failed" | "skipped";

export interface GenerationJob {
  id: string;
  planId: string;
  assetId: string;
  type: "image" | "music" | "video" | "prompt-text";
  prompt: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
}

// ============================================================
// Asset Record Layer
// ============================================================

export interface AssetMetadata {
  prompt: string;
  model: string;
  generationTimeMs: number;
  tokenCost?: number;
  dimensions?: { width: number; height: number };
  duration?: number;
  fileSize: number;
  mimeType: string;
  [key: string]: unknown;
}

export interface AssetRecord {
  id: string;
  jobId: string;
  type: "image" | "music" | "video" | "prompt-text";
  filePath: string;
  thumbnailPath?: string;
  metadata: AssetMetadata;
  generatedAt: string;
  briefId: string;
  signalId: string;
}

// ============================================================
// Content Pack Layer
// ============================================================

export interface ContentPackAsset {
  assetId: string;
  type: string;
  filePath: string;
  thumbnailPath?: string;
  metadata: Record<string, unknown>;
}

export interface ContentPackSignal {
  id: string;
  title: string;
  sourceType: string;
  url: string;
  metadata: Record<string, unknown>;
}

export interface ContentPackManifest {
  id: string;
  packId: string;
  name: string;
  description: string;
  version: string;
  createdAt: string;
  tags: string[];
  assets: ContentPackAsset[];
  briefs: Omit<CreativeBrief, "references">[];
  signals: ContentPackSignal[];
  quotaConsumed: {
    tokens: number;
    generationCount: number;
  };
}

// ============================================================
// Storage Layer
// ============================================================

export interface QuotaStatus {
  date: string;
  tokensUsed: number;
  tokensLimit: number;
  dailyRemaining: number;
  weeklyUsed: number;
  weeklyLimit: number;
  canGenerate: boolean;
}

export interface SchedulerDecision {
  action: "generate" | "queue" | "skip" | "wait";
  reason: string;
  tokensEstimate: number;
  waitUntil?: string;
}

// ============================================================
// Asset Index (creative-quota-assets)
// ============================================================

export interface AssetIndexEntry {
  assetId: string;
  type: "image" | "prompt-text" | "music" | "video";
  filePath: string;
  thumbnailPath?: string;
  mimeType: string;
  fileSize: number;
  dimensions?: { width: number; height: number };
  generatedAt: string;
  packId: string;
  briefId: string;
  signalId: string;
  tags: string[];
}

export interface AssetIndex {
  version: string;
  generatedAt: string;
  totalAssets: number;
  byType: Record<string, number>;
  assets: AssetIndexEntry[];
}

export interface DailyIndex {
  version: string;
  days: {
    date: string;
    signalsCollected: number;
    briefsCreated: number;
    assetsGenerated: Record<string, number>;
    quotaUsed: number;
    contentPacks: string[];
    note?: string;
  }[];
}