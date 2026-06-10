/**
 * normalize-signals.ts — Phase 1 Real Implementation
 * Applies normalization rules to raw signals
 */
import type { SignalRecord } from "../sources/types";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "must", "shall", "can", "need",
]);

function cleanTags(tags: string[]): string[] {
  return tags
    .map(t => t.toLowerCase().replace(/[^a-z0-9\-_\s]/g, "").trim())
    .filter(t => t.length > 2 && t.length < 30)
    .filter(t => !STOPWORDS.has(t));
}

export async function normalizeSignals(signals: SignalRecord[]): Promise<SignalRecord[]> {
  return signals.map(signal => {
    // Truncate summary
    const summary = signal.summary?.slice(0, 500) || "";

    // Clean and deduplicate tags
    const tags = cleanTags([...(signal.tags || []), signal.sourceType]);

    // Ensure required metadata fields
    const metadata = {
      ...signal.metadata,
      sourceType: signal.sourceType,
    };

    return {
      ...signal,
      summary,
      tags,
      metadata,
    };
  });
}

export default normalizeSignals;