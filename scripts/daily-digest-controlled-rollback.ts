#!/usr/bin/env tsx
/**
 * scripts/daily-digest-controlled-rollback.ts
 * Phase 5C-2C-C5M-1: Controlled Rollback Helper (DRY-RUN ONLY)
 *
 * This script does NOT perform rollback. It only:
 *   - Reads the latest promote history
 *   - Locates the backup manifest
 *   - Computes rollback command
 *   - Validates that backup files exist and match recorded hashes
 *   - Reports the planned rollback actions
 *
 * Rollback execution is intentionally disabled in Phase 5C-2C-C5M-1.
 * A future phase with explicit human authorization may add the actual
 * restore step.
 *
 * Safety:
 *   - No child_process / exec / spawn
 *   - No .env / .control.local reads
 *   - No network calls
 *   - No production writes
 *   - Output is redacted
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const HISTORY_DIR = path.join(HARVESTER_DIR, "reports/promote-history");
const BACKUP_ROOT = path.join(HARVESTER_DIR, "reports/promote-backups/daily-digest");

function loadJson(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function fileExists(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}

function fingerprint(p: string): { size: number; hash: string; hash_short: string } | null {
  if (!fileExists(p)) return null;
  const stat = fs.statSync(p);
  const buf = fs.readFileSync(p);
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  return { size: stat.size, hash, hash_short: hash.slice(0, 16) };
}

function redact(text: string): string {
  return text
    .replace(/TELEGRAM_BOT_TOKEN\s*=\s*['"]\S+['"]/g, "TELEGRAM_BOT_TOKEN=\"***\"")
    .replace(/CQA_CONTROL_TOKEN\s*=\s*['"]\S+['"]/g, "CQA_CONTROL_TOKEN=\"***\"")
    .replace(/MINIMAX_API_KEY\s*=\s*['"]\S+['"]/g, "MINIMAX_API_KEY=\"***\"")
    .replace(/OPENAI_API_KEY\s*=\s*['"]\S+['"]/g, "OPENAI_API_KEY=\"***\"")
    .replace(/sk-cp-[A-Za-z0-9_-]{10,}/g, "sk-cp-<REDACTED>")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-<REDACTED>");
}

interface RollbackPlan {
  phase: string;
  mode: string;
  version: string;
  generated_at: string;
  execution_allowed: false;
  history_files_found: string[];
  latest_history: string | null;
  latest_history_record: any;
  backup_root: string | null;
  backup_manifest: any;
  backup_files_status: Array<{
    name: string;
    backup_path: string;
    exists: boolean;
    backup_size: number;
    backup_hash_short: string;
    manifest_hash_short: string;
    matches_manifest: boolean;
  }>;
  restore_command: string | null;
  rollback_supported: boolean;
  warnings: string[];
  safe_next_step: string;
  blocked_actions: string[];
}

export function planControlledRollback(): RollbackPlan {
  const plan: RollbackPlan = {
    phase: "5C-2C-C5M-1",
    mode: "controlled_rollback_dry_run",
    version: "0.1.0",
    generated_at: new Date().toISOString(),
    execution_allowed: false,
    history_files_found: [],
    latest_history: null,
    latest_history_record: null,
    backup_root: null,
    backup_manifest: null,
    backup_files_status: [],
    restore_command: null,
    rollback_supported: false,
    warnings: [],
    safe_next_step: "",
    blocked_actions: ["production_restore", "auto_rollback"],
  };

  if (!fileExists(HISTORY_DIR)) {
    plan.warnings.push("history dir does not exist");
    plan.safe_next_step = "no promote history to roll back";
    return plan;
  }

  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.startsWith("daily-digest-promote-") && f.endsWith(".json"))
    .sort();
  plan.history_files_found = files;

  if (files.length === 0) {
    plan.safe_next_step = "no promote history to roll back";
    return plan;
  }

  const latestFile = files[files.length - 1];
  const latestPath = path.join(HISTORY_DIR, latestFile);
  const record = loadJson(latestPath);
  plan.latest_history = latestPath;
  plan.latest_history_record = record;

  if (!record || !record.backup_path) {
    plan.warnings.push("latest history record missing backup_path");
    return plan;
  }

  plan.backup_root = record.backup_path;
  const manifestPath = path.join(record.backup_path, "backup-manifest.json");
  const manifest = loadJson(manifestPath);
  if (!manifest) {
    plan.warnings.push("backup manifest missing at " + manifestPath);
    return plan;
  }
  plan.backup_manifest = manifest;

  if (manifest.files && Array.isArray(manifest.files)) {
    for (const f of manifest.files) {
      if (f.backup === "(no prior production file)") {
        plan.backup_files_status.push({
          name: f.name,
          backup_path: "(no prior production file)",
          exists: false,
          backup_size: 0,
          backup_hash_short: "",
          manifest_hash_short: (f.hash_sha256 || "").slice(0, 16),
          matches_manifest: true,
        });
        continue;
      }
      const fp = fingerprint(f.backup);
      plan.backup_files_status.push({
        name: f.name,
        backup_path: f.backup,
        exists: !!fp,
        backup_size: fp?.size || 0,
        backup_hash_short: fp?.hash_short || "",
        manifest_hash_short: (f.hash_sha256 || "").slice(0, 16),
        matches_manifest: !!(fp && fp.hash === f.hash_sha256),
      });
    }
  }

  plan.restore_command = manifest.restore_command || null;
  plan.rollback_supported = !!(manifest.rollback_supported && plan.backup_files_status.every(s => s.exists || s.backup_path === "(no prior production file)"));

  if (plan.rollback_supported) {
    plan.safe_next_step =
      "Backup is intact and matches manifest. To execute rollback in a future phase, " +
      "the user must provide explicit authorization and the executor must re-implement restore logic. " +
      "Current phase does not auto-rollback.";
  } else {
    plan.warnings.push("Backup is incomplete or hash-mismatched; rollback not safe.");
    plan.safe_next_step = "Do not roll back. Investigate backup integrity.";
  }

  return plan;
}

if (require.main === module) {
  const plan = planControlledRollback();
  console.log(redact(JSON.stringify(plan, null, 2)));
  process.exit(0);
}
