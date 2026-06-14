#!/usr/bin/env tsx
/**
 * scripts/daily-digest-promote-dry-run.ts
 * Phase 5C-2C-C5H: Promote Dry-run / Copy Plan
 *
 * Generates a dry-run plan for promoting sandbox outputs to production.
 * Reads latest sandbox run, outputs, diff, and readiness JSON.
 * Writes plan to sandbox reports/ without copying to production.
 *
 * Safety:
 *   - No child_process, no exec, no spawn
 *   - No .env or .control.local reads
 *   - No network calls
 *   - Only writes to sandbox reports/ (promote-dry-run-plan.json + .md)
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

interface DryRunPlan {
  phase: string;
  mode: string;
  run_id: string | null;
  generated_at: string;
  real_promote_allowed: boolean;
  production_write_allowed: boolean;
  telegram_send_allowed: boolean;
  source_files: Record<string, FileSnapshot>;
  target_files: Record<string, FileSnapshot>;
  copy_map: Record<string, { source: string; target: string; backup_target: string }>;
  backup_plan: {
    backup_before_promote: boolean;
    backup_manifest: string | null;
    rollback_manifest: string | null;
  };
  preconditions: {
    readiness: boolean;
    outputs_exist: boolean;
    diff_exists: boolean;
  };
  human_approval_required: boolean;
  future_confirm_phrase: string;
  future_confirm_phrase_enabled: boolean;
  blocked_actions: string[];
  safe_next_step: string;
  output_files: string[];
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

export function generatePromoteDryRunPlan(): DryRunPlan {
  const plan: DryRunPlan = {
    phase: "5C-2C-C5H",
    mode: "promote_dry_run_only",
    run_id: null,
    generated_at: new Date().toISOString(),
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    source_files: {},
    target_files: {},
    copy_map: {
      "daily-digest.md": {
        source: "sandbox/outputs/daily-digest.md",
        target: "reports/daily-digest.md",
        backup_target: "reports/daily-digest.md.bak",
      },
      "telegram-digest.txt": {
        source: "sandbox/outputs/telegram-digest.txt",
        target: "reports/telegram-digest.txt",
        backup_target: "reports/telegram-digest.txt.bak",
      },
    },
    backup_plan: {
      backup_before_promote: true,
      backup_manifest: null,
      rollback_manifest: null,
    },
    preconditions: {
      readiness: false,
      outputs_exist: false,
      diff_exists: false,
    },
    human_approval_required: true,
    future_confirm_phrase: "PROMOTE DAILY DIGEST FROM SANDBOX",
    future_confirm_phrase_enabled: false,
    blocked_actions: [
      "production_write",
      "telegram_send",
      "collect",
      "timer",
      "git",
      "promote",
    ],
    safe_next_step: "",
    output_files: [],
  };

  // 1. Load latest sandbox run
  const latest = loadJson(LATEST_JSON);
  if (!latest || !latest.latest_run_id) {
    plan.safe_next_step = "latest.json missing or invalid. Create sandbox run first.";
    return plan;
  }

  plan.run_id = latest.latest_run_id;
  const runPath = latest.latest_run_path || path.join(SANDBOX_ROOT, plan.run_id);
  const outputsDir = path.join(runPath, "outputs");
  const diffsDir = path.join(runPath, "diffs");
  const reportsDir = path.join(runPath, "reports");

  // 2. Read sandbox outputs
  const sandboxDigest = getSnapshot(path.join(outputsDir, "daily-digest.md"));
  const sandboxTelegram = getSnapshot(path.join(outputsDir, "telegram-digest.txt"));

  plan.source_files = {
    "daily-digest.md": sandboxDigest,
    "telegram-digest.txt": sandboxTelegram,
  };

  plan.preconditions.outputs_exist = sandboxDigest.exists && sandboxTelegram.exists;

  // 3. Read current production files
  plan.target_files = {
    "daily-digest.md": getSnapshot(PRODUCTION_PATHS.dailyDigest),
    "telegram-digest.txt": getSnapshot(PRODUCTION_PATHS.telegramDigest),
  };

  // 4. Read promote readiness
  const readinessPath = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-readiness.json");
  const readiness = loadJson(readinessPath);
  plan.preconditions.readiness = readiness?.ready_for_future_promote === true;

  // 5. Read diff summary
  const diffPath = path.join(diffsDir, "diff-summary.json");
  plan.preconditions.diff_exists = fs.existsSync(diffPath);

  // 6. Determine backup/rollback paths
  const backupManifest = path.join(reportsDir, "backup-manifest.json");
  const rollbackManifest = path.join(reportsDir, "rollback-manifest.json");
  plan.backup_plan.backup_manifest = backupManifest;
  plan.backup_plan.rollback_manifest = rollbackManifest;

  // 7. Determine safe next step
  if (plan.preconditions.readiness && plan.preconditions.outputs_exist && plan.preconditions.diff_exists) {
    plan.safe_next_step = "All preconditions met. When ready to enable promote, set future_confirm_phrase_enabled=true and execute copy plan with human approval.";
  } else {
    const missing = [];
    if (!plan.preconditions.readiness) missing.push("readiness not ready");
    if (!plan.preconditions.outputs_exist) missing.push("outputs missing");
    if (!plan.preconditions.diff_exists) missing.push("diff summary missing");
    plan.safe_next_step = `Missing: ${missing.join(", ")}. Complete these before promoting.`;
  }

  // 8. Write dry-run plan JSON
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const jsonPath = path.join(reportsDir, "promote-dry-run-plan.json");
  const planForJson = {
    ...plan,
    source_files: Object.fromEntries(
      Object.entries(plan.source_files).map(([k, v]) => [
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
    target_files: Object.fromEntries(
      Object.entries(plan.target_files).map(([k, v]) => [
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
  };
  fs.writeFileSync(jsonPath, JSON.stringify(planForJson, null, 2), "utf-8");
  plan.output_files.push(jsonPath);

  // 9. Write dry-run plan MD
  const mdLines = [
    "# Promote Dry-run Plan",
    "",
    `**Phase:** 5C-2C-C5H`,
    `**Run ID:** ${plan.run_id}`,
    `**Mode:** ${plan.mode}`,
    `**Generated:** ${plan.generated_at}`,
    `**Real Promote Allowed:** ${plan.real_promote_allowed}`,
    `**Production Write Allowed:** ${plan.production_write_allowed}`,
    `**Telegram Send Allowed:** ${plan.telegram_send_allowed}`,
    "",
    "## Source Files (Sandbox Outputs)",
    "",
    ...Object.entries(plan.source_files).map(([name, snap]) =>
      `- **${name}**: ${snap.exists ? "✅" : "❌"} ${snap.size} bytes, mtime=${snap.mtime}, hash=${snap.hash?.slice(0, 8)}...`
    ),
    "",
    "## Target Files (Production)",
    "",
    ...Object.entries(plan.target_files).map(([name, snap]) =>
      `- **${name}**: ${snap.exists ? "✅" : "❌"} ${snap.size} bytes, mtime=${snap.mtime}, hash=${snap.hash?.slice(0, 8)}...`
    ),
    "",
    "## Copy Map",
    "",
    ...Object.entries(plan.copy_map).map(([name, map]) =>
      `- **${name}**: ${map.source} → ${map.target} (backup: ${map.backup_target})`
    ),
    "",
    "## Backup Plan",
    "",
    `- Backup before promote: ${plan.backup_plan.backup_before_promote ? "✅" : "❌"}`,
    `- Backup manifest: ${plan.backup_plan.backup_manifest || "N/A"}`,
    `- Rollback manifest: ${plan.backup_plan.rollback_manifest || "N/A"}`,
    "",
    "## Preconditions",
    "",
    `- Readiness: ${plan.preconditions.readiness ? "✅ PASS" : "❌ FAIL"}`,
    `- Outputs exist: ${plan.preconditions.outputs_exist ? "✅ PASS" : "❌ FAIL"}`,
    `- Diff exists: ${plan.preconditions.diff_exists ? "✅ PASS" : "❌ FAIL"}`,
    "",
    "## Human Approval",
    "",
    `- Required: ${plan.human_approval_required ? "✅ YES" : "❌ NO"}`,
    `- Future confirm phrase: ${plan.future_confirm_phrase}`,
    `- Enabled: ${plan.future_confirm_phrase_enabled ? "✅ YES" : "❌ NO"}`,
    "",
    "## Blocked Actions",
    "",
    ...plan.blocked_actions.map(a => `- ${a}`),
    "",
    "## Safe Next Step",
    "",
    plan.safe_next_step,
    "",
    "---",
    "*Generated by daily-digest-promote-dry-run.ts*",
  ];

  const mdPath = path.join(reportsDir, "promote-dry-run-plan.md");
  fs.writeFileSync(mdPath, redact(mdLines.join("\n")), "utf-8");
  plan.output_files.push(mdPath);

  return plan;
}

// CLI entry point
if (require.main === module) {
  const result = generatePromoteDryRunPlan();
  console.log(JSON.stringify(result, null, 2));
}
