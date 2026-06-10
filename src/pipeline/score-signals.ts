/**
 * score-signals.ts — Phase 1 Real Implementation
 * Computes 5 scoring dimensions + final score
 */
import type { SignalRecord } from "../sources/types";

export interface ScoredSignal extends SignalRecord {
  freshnessScore: number;
  relevanceScore: number;
  visualPotential: number;
  xPostPotential: number;
  creativeAssetPotential: number;
  finalScore: number;
}

// Keywords for relevance scoring
const RELEVANCE_KEYWORDS = [
  "ai", "agent", "llm", "model", "generative", "image", "video", "music",
  "coding", "automation", "open source", "copilot", "claude", "gpt",
  "diffusion", "transformer", "neural", "autonomous", "multi-agent",
  "mcp", "rag", "local llm", "knowledge", "creative", "art", "museum",
  "cultural", "landscape", "ancient", "historical", "photographic",
];

function computeFreshnessScore(publishedAt: string): number {
  const published = new Date(publishedAt);
  const now = new Date();
  const ageHours = (now.getTime() - published.getTime()) / (1000 * 60 * 60);
  // Exponential decay: half-life of 7 days (168 hours)
  const halfLifeHours = 168;
  return Math.max(0.1, Math.pow(0.5, ageHours / halfLifeHours));
}

function computeRelevanceScore(title: string, summary: string, tags: string[]): number {
  const text = `${title} ${summary} ${tags.join(" ")}`.toLowerCase();
  let score = 0.3; // base score
  for (const kw of RELEVANCE_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) score +=0.08;
    if (score >= 1.0) break;
  }
  return Math.min(1.0, score);
}

function computeVisualPotential(sourceType: string, tags: string[], metadata: Record<string, unknown>): number {
  let score = 0.3;
  // Culture-art sources have high visual potential
  if (sourceType === "culture-art") score += 0.4;
  // Art/museum/landscape keywords boost visual
  const visualKeywords = ["art", "museum", "landscape", "photographic", "painting", "ancient", "photography", "image"];
  for (const tag of tags) {
    if (visualKeywords.some(vk => tag.includes(vk))) score += 0.15;
  }
  // Has image URL
  if (metadata["primaryImageSmall"] || metadata["image"]) score += 0.2;
  return Math.min(1.0, score);
}

function computeXPostPotential(title: string, summary: string, metadata: Record<string, unknown>): number {
  let score = 0.3;
  const text = `${title} ${summary}`.toLowerCase();
  // Technical interest signals
  if (metadata["stars"] && (metadata["stars"] as number) > 1000) score += 0.2;
  if (metadata["score"] && (metadata["score"] as number) > 100) score += 0.2;
  if (metadata["likes"] && (metadata["likes"] as number) > 100) score += 0.15;
  // Developer tools / agents
  if (text.includes("agent") || text.includes("llm") || text.includes("open source")) score += 0.15;
  return Math.min(1.0, score);
}

function computeCreativeAssetPotential(
  sourceType: string, tags: string[], visualPotential: number, xPostPotential: number
): number {
  let score = 0.3;
  // High visual potential → good for image/music generation
  score += visualPotential * 0.3;
  // High X post potential → good for social content
  score += xPostPotential * 0.2;
  // Culture-art sources are rich creative assets
  if (sourceType === "culture-art") score += 0.15;
  // Has multimedia keywords
  const multimediaKeywords = ["image", "video", "music", "sound", "art", "design", "visual"];
  for (const tag of tags) {
    if (multimediaKeywords.some(mk => tag.includes(mk))) score += 0.1;
  }
  return Math.min(1.0, score);
}

export async function scoreSignals(signals: SignalRecord[]): Promise<ScoredSignal[]> {
  return signals.map(signal => {
    const freshnessScore = computeFreshnessScore(signal.publishedAt);
    const relevanceScore = computeRelevanceScore(signal.title, signal.summary, signal.tags);
    const visualPotential = computeVisualPotential(signal.sourceType, signal.tags, signal.metadata);
    const xPostPotential = computeXPostPotential(signal.title, signal.summary, signal.metadata);
    const creativeAssetPotential = computeCreativeAssetPotential(
      signal.sourceType, signal.tags, visualPotential, xPostPotential
    );

    // Weighted final score
    const finalScore = (
      relevanceScore * 0.35 +
      freshnessScore * 0.25 +
      visualPotential * 0.15 +
      xPostPotential * 0.10 +
      creativeAssetPotential * 0.15
    );

    return {
      ...signal,
      freshnessScore,
      relevanceScore,
      visualPotential,
      xPostPotential,
      creativeAssetPotential,
      finalScore,
    };
  }).sort((a, b) => b.finalScore - a.finalScore);
}

export default scoreSignals;