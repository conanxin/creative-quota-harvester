/**
 * SQLite Storage Layer — Phase 1 Real Implementation
 * Uses better-sqlite3 for synchronous, zero-config storage
 */
import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import type {
  SourceRecord, SignalRecord, QuotaStatus,
} from "../sources/types";

export class SQLiteStore {
  private db: Database.Database;

  constructor(private dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  async init(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_name TEXT NOT NULL,
        adapter_file TEXT NOT NULL,
        last_fetched_at TEXT,
        signals_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'planned',
        note TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        url TEXT NOT NULL,
        published_at TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        tags TEXT NOT NULL,
        metadata TEXT NOT NULL,
        freshness_score REAL DEFAULT 0,
        relevance_score REAL DEFAULT 0,
        visual_potential REAL DEFAULT 0,
        x_post_potential REAL DEFAULT 0,
        creative_asset_potential REAL DEFAULT 0,
        final_score REAL DEFAULT 0,
        run_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        total_signals INTEGER DEFAULT 0,
        sources_attempted INTEGER DEFAULT 0,
        sources_succeeded INTEGER DEFAULT 0,
        sources_failed INTEGER DEFAULT 0,
        status TEXT DEFAULT 'running'
      );

      CREATE TABLE IF NOT EXISTS quota_tracker (
        date TEXT PRIMARY KEY,
        tokens_used INTEGER DEFAULT 0,
        tokens_limit INTEGER,
        generation_count INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_signals_source_type ON signals(source_type);
      CREATE INDEX IF NOT EXISTS idx_signals_final_score ON signals(final_score DESC);
      CREATE INDEX IF NOT EXISTS idx_signals_run_id ON signals(run_id);
    `);
  }

  // ── Sources ────────────────────────────────────────────────

  upsertSource(src: {
    id: string; source_type: string; source_name: string;
    adapter_file: string; status: string; note?: string;
  }): void {
    this.db.prepare(`
      INSERT INTO sources (id, source_type, source_name, adapter_file, status, note, created_at)
      VALUES (@id, @source_type, @source_name, @adapter_file, @status, @note, @created_at)
      ON CONFLICT(id) DO UPDATE SET
        last_fetched_at = @last_fetched_at,
        signals_count = @signals_count,
        status = @status
    `).run({ ...src, last_fetched_at: new Date().toISOString(), signals_count: 0, created_at: new Date().toISOString() });
  }

  updateSourceStats(id: string, signalsCount: number): void {
    this.db.prepare(`
      UPDATE sources SET last_fetched_at = ?, signals_count = ? WHERE id = ?
    `).run(new Date().toISOString(), signalsCount, id);
  }

  getAllSources(): Array<{
    id: string; source_type: string; source_name: string;
    adapter_file: string; last_fetched_at: string | null;
    signals_count: number; status: string; note: string | null;
  }> {
    return this.db.prepare("SELECT * FROM sources ORDER BY source_type, source_name").all() as Array<{
      id: string; source_type: string; source_name: string;
      adapter_file: string; last_fetched_at: string | null;
      signals_count: number; status: string; note: string | null;
    }>;
  }

  // ── Runs ─────────────────────────────────────────────────

  insertRun(runId: string): void {
    this.db.prepare(`
      INSERT INTO runs (id, started_at, status) VALUES (?, ?, 'running')
    `).run(runId, new Date().toISOString());
  }

  finishRun(runId: string, stats: {
    total: number; attempted: number; succeeded: number; failed: number; status: string;
  }): void {
    this.db.prepare(`
      UPDATE runs SET ended_at = ?, total_signals = ?, sources_attempted = ?,
        sources_succeeded = ?, sources_failed = ?, status = ?
      WHERE id = ?
    `).run(new Date().toISOString(), stats.total, stats.attempted, stats.succeeded, stats.failed, stats.status, runId);
  }

  getRun(runId: string) {
    return this.db.prepare("SELECT * FROM runs WHERE id = ?").get(runId);
  }

  // ── Signals ──────────────────────────────────────────────

  insertSignal(signal: SignalRecord & {
    run_id: string; freshness_score: number; relevance_score: number;
    visual_potential: number; x_post_potential: number;
    creative_asset_potential: number; final_score: number;
  }): void {
    this.db.prepare(`
      INSERT INTO signals (
        id, source_type, source_id, title, summary, url,
        published_at, fetched_at, tags, metadata,
        freshness_score, relevance_score, visual_potential,
        x_post_potential, creative_asset_potential, final_score,
        run_id, created_at
      ) VALUES (
        @id, @source_type, @source_id, @title, @summary, @url,
        @published_at, @fetched_at, @tags, @metadata,
        @freshness_score, @relevance_score, @visual_potential,
        @x_post_potential, @creative_asset_potential, @final_score,
        @run_id, @created_at
      )
    `).run({
      id: signal.id,
      source_type: signal.sourceType,
      source_id: signal.sourceId,
      title: signal.title,
      summary: signal.summary,
      url: signal.url,
      published_at: signal.publishedAt,
      fetched_at: signal.fetchedAt,
      tags: JSON.stringify(signal.tags),
      metadata: JSON.stringify(signal.metadata),
      freshness_score: signal.freshness_score,
      relevance_score: signal.relevance_score,
      visual_potential: signal.visual_potential,
      x_post_potential: signal.x_post_potential,
      creative_asset_potential: signal.creative_asset_potential,
      final_score: signal.final_score,
      run_id: signal.run_id,
      created_at: new Date().toISOString(),
    });
  }

  getSignalsByRun(runId: string): Array<{
    id: string; source_type: string; source_id: string; title: string;
    summary: string; url: string; published_at: string; fetched_at: string;
    tags: string; metadata: string; final_score: number; run_id: string;
  }> {
    return this.db.prepare(
      "SELECT * FROM signals WHERE run_id = ? ORDER BY final_score DESC"
    ).all(runId) as Array<{
      id: string; source_type: string; source_id: string; title: string;
      summary: string; url: string; published_at: string; fetched_at: string;
      tags: string; metadata: string; final_score: number; run_id: string;
    }>;
  }

  getSignalCountBySource(runId: string): Array<{ source_type: string; count: number }> {
    return this.db.prepare(
      "SELECT source_type, COUNT(*) as count FROM signals WHERE run_id = ? GROUP BY source_type"
    ).all(runId) as Array<{ source_type: string; count: number }>;
  }

  getTotalSignalCount(runId: string): number {
    const row = this.db.prepare(
      "SELECT COUNT(*) as count FROM signals WHERE run_id = ?"
    ).get(runId) as { count: number };
    return row.count;
  }

  close(): void {
    this.db.close();
  }
}

export default SQLiteStore;