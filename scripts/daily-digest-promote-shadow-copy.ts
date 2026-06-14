#!/usr/bin/env tsx
/**
 * scripts/daily-digest-promote-shadow-copy.ts
 * Phase 5C-2C-C5I: Promote Shadow Copy / Backup Plan
 *
 * Creates shadow backup of production files, candidate preview, rollback manifest,
 * and promote checklist. Only writes to sandbox run directory. Does NOT copy to production.
 *
 * Safety:
 *   - No child_process, no exec, no spawn
 *   - No .env or .control.local reads
 *   - No network calls
 *   - Only writes to reports/sandbox/daily-digest/<run_id>/reports/promote-shadow/
 *   - Does not copy files to production
 *   - Does not send Telegram
 *   - Output is redacted
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const SANDBOX_ROOT = path.join(HARVESTER_DIR, "reports/sandbox/daily-digest");
const LATEST_JSON = path.join(SANDBOX_ROOT, "latest.json");

const PRODUCTION_PATHS = {
  dailyDigest: path.join(HARVESTER_DIR, "reports/daily-digest.md"),
  telegramDigest: path.join(HARVESTER_DIR, "reports/telegram-digest.txt"),
  statusJson: path.join(HARVESTER_DIR, "dashboard/status.json"),
};

interface FileSnapshot {
  file: string;
  exists: boolean;
  size: number;
  mtime: number;
  hash: string | null;
}

interface ShadowCopyResult {
  phase: string;
  mode: string;
  run_id: string | null;
  generated_at: string;
  real_promote_allowed: boolean;
  production_write_allowed: boolean;
  telegram_send_allowed: boolean;
  shadow_dir: string | null;
  production_backups: Record<string, FileSnapshot>;
  candidate_previews: Record<string, FileSnapshot>;
  rollback_manifest: any;
  promote_checklist: string[];
  output_files: string[];
  safe_next_step: string;
}

function loadJson(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function loadText(p: string): string {
  try { return fs.readFileSync(p, "utf-8"); } catch { return ""; }
}

function getSnapshot(filePath: string): FileSnapshot {
  const exists = fs.existsSync(filePath);
  if (!exists) {
    return { file: filePath, exists: false, size: 0, mtime: 0, hash: null };
  }
  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath);
  return {
    file: filePath,
    exists: true,
    size: stat.size,
    mtime: stat.mtimeMs,
    hash: crypto.createHash("sha256").update(content).digest("hex"),
  };
}

function redact(text: string): string {
  return text
    .replace(/TELEGRAM_BOT_TOKEN\s*=\s*['"]\S+['"]/g, "TELEGRAM_BOT_TOKEN=\"***\"")
    .replace(/CQA_CONTROL_TOKEN\s*=\s*['"]\S+['"]/g, "CQA_CONTROL_TOKEN=\"***\"")
    .replace(/MINIMAX_API_KEY\s*=\s*['"]\S+['"]/g, "MINIMAX_API_KEY=\"***\"")
    .replace(/OPENAI_API_KEY\s*=\s*['"]\S+['"]/g, "OPENAI_API_KEY=\"***\"")
    .replace(/Bearer\s+[A-Za-z0-9._-]{20,}/g, "Bearer <REDACTED>")
    .replace(/sk-cp-[A-Za-z0-9_-]{10,}/g, "sk-cp-<REDACTED>")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-<REDACTED>");
}

export function createPromoteShadowCopy(): ShadowCopyResult {
  const result: ShadowCopyResult = {
    phase: "5C-2C-C5I",
    mode: "shadow_copy_only",
    run_id: null,
    generated_at: new Date().toISOString(),
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    shadow_dir: null,
    production_backups: {},
    candidate_previews: {},
    rollback_manifest: null,
    promote_checklist: [],
    output_files: [],
    safe_next_step: "",
  };

  // 1. Load latest sandbox run
  const latest = loadJson(LATEST_JSON);
  if (!latest || !latest.latest_run_id) {
    result.safe_next_step = "latest.json missing or invalid. Create sandbox run first.";
    return result;
  }

  result.run_id = latest.latest_run_id;
  const runPath = latest.latest_run_path || path.join(SANDBOX_ROOT, result.run_id);
  const outputsDir = path.join(runPath, "outputs");
  const reportsDir = path.join(runPath, "reports");
  result.shadow_dir = path.join(reportsDir, "promote-shadow");

  // Ensure shadow dir exists
  if (!fs.existsSync(result.shadow_dir)) {
    fs.mkdirSync(result.shadow_dir, { recursive: true });
  }

  const backupPreviewDir = path.join(result.shadow_dir, "production-backup-preview");
  const candidatePreviewDir = path.join(result.shadow_dir, "candidate-preview");

  if (!fs.existsSync(backupPreviewDir)) fs.mkdirSync(backupPreviewDir, { recursive: true });
  if (!fs.existsSync(candidatePreviewDir)) fs.mkdirSync(candidatePreviewDir, { recursive: true });

  // 2. Capture production snapshots
  const prodDailyDigest = getSnapshot(PRODUCTION_PATHS.dailyDigest);
  const prodTelegramDigest = getSnapshot(PRODUCTION_PATHS.telegramDigest);

  result.production_backups = {
    "daily-digest.md": prodDailyDigest,
    "telegram-digest.txt": prodTelegramDigest,
  };

  // 3. Write production backup previews (redacted copies for inspection)
  if (prodDailyDigest.exists) {
    const content = loadText(PRODUCTION_PATHS.dailyDigest);
    fs.writeFileSync(path.join(backupPreviewDir, "daily-digest.md"), redact(content), "utf-8");
  }
  if (prodTelegramDigest.exists) {
    const content = loadText(PRODUCTION_PATHS.telegramDigest);
    fs.writeFileSync(path.join(backupPreviewDir, "telegram-digest.txt"), redact(content), "utf-8");
  }

  // 4. Capture candidate snapshots
  const candDailyDigest = getSnapshot(path.join(outputsDir, "daily-digest.md"));
  const candTelegramDigest = getSnapshot(path.join(outputsDir, "telegram-digest.txt"));

  result.candidate_previews = {
    "daily-digest.md": candDailyDigest,
    "telegram-digest.txt": candTelegramDigest,
  };

  // 5. Write candidate previews
  if (candDailyDigest.exists) {
    const content = loadText(path.join(outputsDir, "daily-digest.md"));
    fs.writeFileSync(path.join(candidatePreviewDir, "daily-digest.md"), redact(content), "utf-8");
  }
  if (candTelegramDigest.exists) {
    const content = loadText(path.join(outputsDir, "telegram-digest.txt"));
    fs.writeFileSync(path.join(candidatePreviewDir, "telegram-digest.txt"), redact(content), "utf-8");
  }

  // 6. Write rollback manifest
  result.rollback_manifest = {
    phase: "5C-2C-C5I",
    generated_at: result.generated_at,
    run_id: result.run_id,
    production_files: {
      "reports/daily-digest.md": {
        path: path.relative(HARVESTER_DIR, PRODUCTION_PATHS.dailyDigest),
        size: prodDailyDigest.size,
        hash: prodDailyDigest.hash,
        mtime: prodDailyDigest.mtime,
        rollback_strategy: "restore from backup file reports/daily-digest.md.bak",
      },
      "reports/telegram-digest.txt": {
        path: path.relative(HARVESTER_DIR, PRODUCTION_PATHS.telegramDigest),
        size: prodTelegramDigest.size,
        hash: prodTelegramDigest.hash,
        mtime: prodTelegramDigest.mtime,
        rollback_strategy: "restore from backup file reports/telegram-digest.txt.bak",
      },
    },
    rollback_supported: true,
    rollback_procedure: "Copy .bak files back to original locations",
  };

  const rollbackPath = path.join(result.shadow_dir, "rollback-manifest.json");
  fs.writeFileSync(rollbackPath, JSON.stringify(result.rollback_manifest, null, 2), "utf-8");
  result.output_files.push(rollbackPath);

  // 7. Write promote checklist
  result.promote_checklist = [
    "1. Verify promote readiness: dashboard/daily-digest-promote-readiness.json shows ready_for_future_promote=true",
    "2. Verify promote dry-run plan: reports/sandbox/daily-digest/<run_id>/reports/promote-dry-run-plan.json",
    "3. Verify shadow copy: reports/sandbox/daily-digest/<run_id>/reports/promote-shadow/ exists",
    "4. Verify rollback manifest: reports/sandbox/daily-digest/<run_id>/reports/promote-shadow/rollback-manifest.json",
    "5. Review production backup preview: production-backup-preview/ contains current production files",
    "6. Review candidate preview: candidate-preview/ contains sandbox output files",
    "7. Confirm human approval: required before any promote",
    "8. Confirm future confirm phrase: 'PROMOTE DAILY DIGEST FROM SANDBOX' (NOT yet enabled)",
    "9. Verify production protected paths: reports/daily-digest.md, reports/telegram-digest.txt, dashboard/status.json, reports/daily/",
    "10. After promote: verify rollback capability by restoring .bak files if needed",
  ];

  const checklistMd = [
    "# Promote Checklist",
    "",
    `**Phase:** 5C-2C-C5I`,
    `**Run ID:** ${result.run_id}`,
    `**Mode:** shadow_copy_only`,
    `**Generated:** ${result.generated_at}`,
    "",
    "## Pre-Promote Checklist",
    "",
    ...result.promote_checklist.map(item => `- [ ] ${item}`),
    "",
    "## Rollback Procedure",
    "",
    "1. Locate .bak files in reports/ directory",
    "2. Copy .bak files back to original locations",
    "3. Verify production paths match pre-promote state",
    "4. Update audit log with rollback action",
    "",
    "## Safety Invariants",
    "",
    "- real_promote_allowed=false",
    "- future_confirm_phrase_enabled=false",
    "- human_approval_required=true",
    "- Production write is BLOCKED until promote is explicitly enabled",
    "",
    "---",
    "*Generated by daily-digest-promote-shadow-copy.ts*",
  ];

  const checklistPath = path.join(result.shadow_dir, "promote-checklist.md");
  fs.writeFileSync(checklistPath, checklistMd.join("\n"), "utf-8");
  result.output_files.push(checklistPath);

  // 8. Write shadow copy summary
  const summary = {
    phase: "5C-2C-C5I",
    mode: "shadow_copy_only",
    run_id: result.run_id,
    generated_at: result.generated_at,
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    shadow_dir: path.relative(HARVESTER_DIR, result.shadow_dir),
    production_backups: Object.fromEntries(
      Object.entries(result.production_backups).map(([k, v]) => [
        k,
        {
          file: path.relative(HARVESTER_DIR, v.file),
          exists: v.exists,
          size: v.size,
          mtime: v.mtime,
          hash: v.hash,
        },
      ])
    ),
    candidate_previews: Object.fromEntries(
      Object.entries(result.candidate_previews).map(([k, v]) => [
        k,
        {
          file: path.relative(HARVESTER_DIR, v.file),
          exists: v.exists,
          size: v.size,
          mtime: v.mtime,
          hash: v.hash,
        },
      ])
    ),
    rollback_manifest_location: path.relative(HARVESTER_DIR, rollbackPath),
    promote_checklist_location: path.relative(HARVESTER_DIR, checklistPath),
    output_files: result.output_files.map(f => path.relative(HARVESTER_DIR, f)),
  };

  const summaryPath = path.join(result.shadow_dir, "shadow-copy-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
  result.output_files.push(summaryPath);

  result.safe_next_step = "Shadow copy complete. Review production-backup-preview/ and candidate-preview/ before any future promote.";
  return result;
}

// CLI entry point
if (require.main === module) {
  const result = createPromoteShadowCopy();
  console.log(JSON.stringify(result, null, 2));
}
