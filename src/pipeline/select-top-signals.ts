/**
 * src/pipeline/select-top-signals.ts
 * Phase 2A: Select top signals for Creative Brief generation
 */
import * as path from "path";
import Database from "better-sqlite3";
import { SQLiteStore } from "../storage/sqlite";

export interface SignalWithMeta {
  id: string;
  source_type: string;
  source_id: string;
  title: string;
  summary: string;
  url: string;
  published_at: string;
  fetched_at: string;
  tags: string;
  metadata: string;
  final_score: number;
  run_id: string;
}

export interface SignalSelectionResult {
  selected_signals: SignalWithMeta[];
  coverage_report: Record<string, number>;
  deduplicated_count: number;
  total_candidates: number;
}

/** Simple Jaccard-like title similarity (0-1) */
function titleSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  tokensA.forEach(t => { if (tokensB.has(t)) intersection++; });
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/** URL hostname deduplication — keep first seen */
function urlDedup(signals: SignalWithMeta[]): SignalWithMeta[] {
  const seen = new Set<string>();
  return signals.filter(s => {
    try {
      const hostname = new URL(s.url).hostname;
      if (seen.has(hostname)) return false;
      seen.add(hostname);
      return true;
    } catch {
      return true;
    }
  });
}

/** Title deduplication — drop very similar titles */
function titleDedup(signals: SignalWithMeta[], threshold = 0.6): SignalWithMeta[] {
  const kept: SignalWithMeta[] = [];
  for (const s of signals) {
    const tooSimilar = kept.some(k => titleSimilarity(k.title, s.title) >= threshold);
    if (!tooSimilar) kept.push(s);
  }
  return kept;
}

export function selectTopSignals(options: {
  dbPath?: string;
  runId?: string;
  maxPerSourceType?: number;
  maxSignals?: number;
}): SignalSelectionResult {
  const { dbPath = "data/signals.db", runId, maxPerSourceType = 3, maxSignals = 20 } = options;

  const store = new SQLiteStore(path.resolve(dbPath));

  // Get latest run if not specified
  let targetRunId = runId;
  if (!targetRunId) {
    const db = new Database(path.resolve(dbPath), { readonly: true });
    const rows = db.prepare("SELECT id FROM runs ORDER BY started_at DESC LIMIT 1").all() as { id: string }[];
    db.close();
    if (rows.length === 0) throw new Error("No runs found in SQLite");
    targetRunId = rows[0].id;
  }

  // Load signals from this run
  const signals = store.getSignalsByRun(targetRunId);

  if (signals.length === 0) throw new Error(`No signals found for run ${targetRunId}`);

  // Group by source_type
  const byType = new Map<string, SignalWithMeta[]>();
  for (const s of signals) {
    const st = s.source_type || "unknown";
    if (!byType.has(st)) byType.set(st, []);
    byType.get(st)!.push(s);
  }

  // Select top N per source type
  const perTypeSelected: SignalWithMeta[] = [];
  byType.forEach((sigList) => {
    perTypeSelected.push(...sigList.slice(0, maxPerSourceType));
  });

  // Deduplicate
  const afterUrlDedup = urlDedup(perTypeSelected);
  const afterTitleDedup = titleDedup(afterUrlDedup);

  // Sort by final_score
  afterTitleDedup.sort((a, b) => b.final_score - a.final_score);

  // Take top maxSignals
  const selected = afterTitleDedup.slice(0, maxSignals);

  // Coverage report
  const coverage_report: Record<string, number> = {};
  byType.forEach((list, type) => { coverage_report[type] = list.length; });

  return {
    selected_signals: selected,
    coverage_report,
    deduplicated_count: signals.length - selected.length,
    total_candidates: signals.length,
  };
}