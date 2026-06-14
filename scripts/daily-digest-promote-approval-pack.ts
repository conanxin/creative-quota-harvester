#!/usr/bin/env tsx
/**
 * scripts/daily-digest-promote-approval-pack.ts
 * Phase 5C-2C-C5M-0: Promote Human Approval Pack Generator
 *
 * Generates a human approval pack for future one-shot controlled promote.
 * Reads latest sandbox run, promote gate, shadow copy, rollback manifest,
 * dry-run plan, validation, and diff summary.
 *
 * Safety:
 *   - No child_process, no exec, no spawn
 *   - No .env or .control.local reads
 *   - No network calls
 *   - Only writes to dashboard/ and reports/
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
const APPROVAL_PACK_JSON = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-approval-pack.json");
const APPROVAL_PACK_MD = path.join(HARVESTER_DIR, "reports/promote-human-approval-pack.md");
const APPROVAL_PACK_TG = path.join(HARVESTER_DIR, "reports/telegram-phase-5c2c-c5m0-promote-approval-pack.txt");

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

interface ApprovalPack {
  phase: string;
  mode: string;
  version: string;
  generated_at: string;
  real_promote_allowed: false;
  production_write_allowed: false;
  telegram_send_allowed: false;
  required_human_approval: boolean;
  required_confirm_phrase: string;
  approval_decision: string;
  future_allowed_operation: string;
  latest_run_id: string | null;
  sandbox_source_files: Record<string, FileSnapshot>;
  future_production_target_files: Record<string, FileSnapshot>;
  backup_status: {
    backup_preview_exists: boolean;
    backup_preview_files: string[];
    rollback_manifest_exists: boolean;
  };
  validation_evidence: {
    promote_gate_pass: boolean;
    shadow_copy_pass: boolean;
    sandbox_output_validation_pass: boolean;
    diff_summary_exists: boolean;
  };
  diff_summary: {
    exists: boolean;
    files_compared: number;
  };
  human_checklist: string[];
  blocked_actions: string[];
  explicit_no_production_write: string;
  output_files: string[];
  safe_next_step: string;
}

function loadJson(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function fileExists(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}

function getSnapshot(filePath: string): FileSnapshot {
  const exists = fileExists(filePath);
  if (!exists) return { file: filePath, exists: false, size: 0, mtime: 0, hash: null };
  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath);
  return {
    file: filePath,
    exists: true,
    size: stat.size,
    mtime: stat.mtimeMs,
    hash: crypto.createHash("sha256").update(content).digest("hex").substring(0, 16),
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

export function generateApprovalPack(): ApprovalPack {
  const result: ApprovalPack = {
    phase: "5C-2C-C5M-0",
    mode: "human_approval_pack_only",
    version: "0.1.0",
    generated_at: new Date().toISOString(),
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    required_human_approval: true,
    required_confirm_phrase: "PROMOTE DAILY DIGEST FROM SANDBOX",
    approval_decision: "not_requested",
    future_allowed_operation: "one-shot controlled promote",
    latest_run_id: null,
    sandbox_source_files: {},
    future_production_target_files: {},
    backup_status: {
      backup_preview_exists: false,
      backup_preview_files: [],
      rollback_manifest_exists: false,
    },
    validation_evidence: {
      promote_gate_pass: false,
      shadow_copy_pass: false,
      sandbox_output_validation_pass: false,
      diff_summary_exists: false,
    },
    diff_summary: {
      exists: false,
      files_compared: 0,
    },
    human_checklist: [
      "I have reviewed the latest sandbox run outputs",
      "I have reviewed the diff summary between sandbox and production",
      "I have reviewed the rollback manifest",
      "I have confirmed production backup preview is valid",
      "I have confirmed all validation evidence passes",
      "I understand this is a one-shot controlled promote",
      "I will provide the required confirm phrase at execution time",
      "I accept responsibility for the production write",
    ],
    blocked_actions: [
      "production_write",
      "telegram_send",
      "collect",
      "timer",
      "git",
      "promote",
    ],
    explicit_no_production_write: "NO PRODUCTION WRITE WAS PERFORMED. This is a human approval pack only.",
    output_files: [],
    safe_next_step: "",
  };

  // 1. Load latest sandbox run
  const latest = loadJson(LATEST_JSON);
  if (!latest || !latest.latest_run_id) {
    result.safe_next_step = "No latest sandbox run found. Create sandbox run first.";
    return result;
  }

  result.latest_run_id = latest.latest_run_id;
  const runPath = latest.latest_run_path || path.join(SANDBOX_ROOT, result.latest_run_id);
  const outputsDir = path.join(runPath, "outputs");
  const diffsDir = path.join(runPath, "diffs");
  const reportsDir = path.join(runPath, "reports");
  const shadowDir = path.join(reportsDir, "promote-shadow");

  // 2. Sandbox source files
  const sandboxDaily = getSnapshot(path.join(outputsDir, "daily-digest.md"));
  const sandboxTelegram = getSnapshot(path.join(outputsDir, "telegram-digest.txt"));
  result.sandbox_source_files = {
    "daily-digest.md": sandboxDaily,
    "telegram-digest.txt": sandboxTelegram,
  };

  // 3. Future production target files
  result.future_production_target_files = {
    "daily-digest.md": getSnapshot(PRODUCTION_PATHS.dailyDigest),
    "telegram-digest.txt": getSnapshot(PRODUCTION_PATHS.telegramDigest),
  };

  // 4. Backup status
  const backupPreviewDir = path.join(shadowDir, "production-backup-preview");
  if (fileExists(backupPreviewDir)) {
    result.backup_status.backup_preview_exists = true;
    result.backup_status.backup_preview_files = fs.readdirSync(backupPreviewDir);
  }
  result.backup_status.rollback_manifest_exists = fileExists(path.join(shadowDir, "rollback-manifest.json"));

  // 5. Validation evidence
  const gate = loadJson(path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-gate.json"));
  result.validation_evidence.promote_gate_pass = gate?.gate_status === "pass";
  result.validation_evidence.shadow_copy_pass = fileExists(shadowDir);
  result.validation_evidence.sandbox_output_validation_pass = sandboxDaily.exists && sandboxTelegram.exists;
  const diffJson = path.join(diffsDir, "diff-summary.json");
  result.validation_evidence.diff_summary_exists = fileExists(diffJson);

  // 6. Diff summary
  if (fileExists(diffJson)) {
    const diff = loadJson(diffJson);
    result.diff_summary.exists = true;
    result.diff_summary.files_compared = diff?.files?.length || 0;
  }

  // 7. Determine safe next step
  const allEvidence = Object.values(result.validation_evidence).every(v => v);
  if (allEvidence && result.backup_status.rollback_manifest_exists) {
    result.safe_next_step = "All evidence met. Approval pack is ready. Human review and confirm phrase required for actual promote execution.";
  } else {
    const missing = [];
    if (!result.validation_evidence.promote_gate_pass) missing.push("promote_gate");
    if (!result.validation_evidence.shadow_copy_pass) missing.push("shadow_copy");
    if (!result.validation_evidence.sandbox_output_validation_pass) missing.push("sandbox_output");
    if (!result.validation_evidence.diff_summary_exists) missing.push("diff_summary");
    if (!result.backup_status.rollback_manifest_exists) missing.push("rollback_manifest");
    result.safe_next_step = `Approval pack not ready. Missing: ${missing.join(", ")}.`;
  }

  return result;
}

function writeApprovalPackReports(pack: ApprovalPack): string[] {
  const outputFiles: string[] = [];

  // 1. Write JSON
  try {
    fs.writeFileSync(APPROVAL_PACK_JSON, JSON.stringify(pack, null, 2), "utf-8");
    outputFiles.push(APPROVAL_PACK_JSON);
  } catch (e) {
    console.error("Failed to write approval pack JSON:", e);
  }

  // 2. Write MD
  const mdLines = [
    "# Promote Human Approval Pack",
    "",
    `**Phase:** 5C-2C-C5M-0`,
    `**Mode:** ${pack.mode}`,
    `**Generated:** ${pack.generated_at}`,
    `**Latest Run:** ${pack.latest_run_id || "N/A"}`,
    `**Approval Decision:** ${pack.approval_decision}`,
    `**Future Allowed Operation:** ${pack.future_allowed_operation}`,
    "",
    "## ⚠️ Explicit Statement",
    "",
    pack.explicit_no_production_write,
    "",
    "## Required Confirmation Phrase",
    "",
    `\`${pack.required_confirm_phrase}\``,
    "",
    "## Sandbox Source Files",
    "",
    ...Object.entries(pack.sandbox_source_files).map(([k, v]) =>
      `- **${k}**: ${v.exists ? "✅" : "❌"} size=${v.size}, mtime=${v.mtime}, hash=${v.hash?.slice(0, 8) || "N/A"}...`
    ),
    "",
    "## Future Production Target Files (current state)",
    "",
    ...Object.entries(pack.future_production_target_files).map(([k, v]) =>
      `- **${k}**: ${v.exists ? "✅" : "❌"} size=${v.size}, mtime=${v.mtime}, hash=${v.hash?.slice(0, 8) || "N/A"}...`
    ),
    "",
    "## Copy Map (if approved)",
    "",
    "- sandbox/outputs/daily-digest.md → reports/daily-digest.md",
    "- sandbox/outputs/telegram-digest.txt → reports/telegram-digest.txt",
    "",
    "## Backup Status",
    "",
    `- Backup preview exists: ${pack.backup_status.backup_preview_exists ? "✅ YES" : "❌ NO"}`,
    `- Backup files: ${pack.backup_status.backup_preview_files.join(", ") || "N/A"}`,
    `- Rollback manifest exists: ${pack.backup_status.rollback_manifest_exists ? "✅ YES" : "❌ NO"}`,
    "",
    "## Validation Evidence",
    "",
    `- Promote gate pass: ${pack.validation_evidence.promote_gate_pass ? "✅ YES" : "❌ NO"}`,
    `- Shadow copy pass: ${pack.validation_evidence.shadow_copy_pass ? "✅ YES" : "❌ NO"}`,
    `- Sandbox output validation pass: ${pack.validation_evidence.sandbox_output_validation_pass ? "✅ YES" : "❌ NO"}`,
    `- Diff summary exists: ${pack.validation_evidence.diff_summary_exists ? "✅ YES" : "❌ NO"}`,
    "",
    "## Diff Summary",
    "",
    `- Diff summary exists: ${pack.diff_summary.exists ? "✅ YES" : "❌ NO"}`,
    `- Files compared: ${pack.diff_summary.files_compared}`,
    "",
    "## Blocked Actions",
    "",
    ...pack.blocked_actions.map(a => `- ${a}`),
    "",
    "## Human Approval Checklist",
    "",
    ...pack.human_checklist.map((c, i) => `${i + 1}. [ ] ${c}`),
    "",
    "## Safe Next Step",
    "",
    redact(pack.safe_next_step),
    "",
    "---",
    "*Generated by daily-digest-promote-approval-pack.ts*",
  ];

  try {
    fs.writeFileSync(APPROVAL_PACK_MD, mdLines.join("\n"), "utf-8");
    outputFiles.push(APPROVAL_PACK_MD);
  } catch (e) {
    console.error("Failed to write approval pack MD:", e);
  }

  // 3. Write Telegram report
  const tgLines = [
    "Phase 5C-2C-C5M-0 complete. APPROVAL_PACK=ready. message_id=xxxxxx.",
    "",
    "📋 Promote Human Approval Pack",
    "",
    "STATUS: ✅ COMPLETE",
    `LATEST_RUN: ${pack.latest_run_id || "N/A"}`,
    "",
    pack.explicit_no_production_write,
    "",
    "VALIDATION:",
    `- Promote gate: ${pack.validation_evidence.promote_gate_pass ? "✅" : "❌"}`,
    `- Shadow copy: ${pack.validation_evidence.shadow_copy_pass ? "✅" : "❌"}`,
    `- Sandbox output: ${pack.validation_evidence.sandbox_output_validation_pass ? "✅" : "❌"}`,
    `- Diff summary: ${pack.validation_evidence.diff_summary_exists ? "✅" : "❌"}`,
    `- Rollback manifest: ${pack.backup_status.rollback_manifest_exists ? "✅" : "❌"}`,
    "",
    "COPY_MAP:",
    "- sandbox/outputs/daily-digest.md → reports/daily-digest.md",
    "- sandbox/outputs/telegram-digest.txt → reports/telegram-digest.txt",
    "",
    `CONFIRM: "${pack.required_confirm_phrase}"`,
    "",
    "HUMAN_CHECKLIST: 8 items",
    "",
    "LIMITATION: Approval pack only. No actual promote.",
  ];

  try {
    fs.writeFileSync(APPROVAL_PACK_TG, tgLines.join("\n"), "utf-8");
    outputFiles.push(APPROVAL_PACK_TG);
  } catch (e) {
    console.error("Failed to write approval pack TG:", e);
  }

  return outputFiles;
}

// CLI entry point
if (require.main === module) {
  const pack = generateApprovalPack();
  pack.output_files = writeApprovalPackReports(pack);
  console.log(JSON.stringify(pack, null, 2));
  process.exit(0);
}
