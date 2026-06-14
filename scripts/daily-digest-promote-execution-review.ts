#!/usr/bin/env tsx
/**
 * scripts/daily-digest-promote-execution-review.ts
 * Phase 5C-2C-C5K: Promote Execution Design Review
 *
 * Reviews the future promote execution design. Checks if all evidence is available
 * and generates a design review report. Does NOT execute promote.
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

const HARVESTER_DIR = path.resolve(__dirname, "..");
const SANDBOX_ROOT = path.join(HARVESTER_DIR, "reports/sandbox/daily-digest");
const LATEST_JSON = path.join(SANDBOX_ROOT, "latest.json");
const DESIGN_JSON = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-execution-design.json");
const REVIEW_JSON = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-execution-review.json");

interface ReviewEvidence {
  met: boolean;
  message: string;
}

interface ReviewResult {
  phase: string;
  mode: string;
  version: string;
  generated_at: string;
  recommendation: "allow_next_phase_design_only" | "allow_controlled_promote" | "block";
  promote_gate_status: string;
  latest_run_id: string | null;
  real_promote_allowed: boolean;
  production_write_allowed: boolean;
  telegram_send_allowed: boolean;
  required_human_approval: boolean;
  required_confirm_phrase: string;
  evidence: Record<string, ReviewEvidence>;
  unresolved_risks: string[];
  required_locks: string[];
  allowed_copy_map: Record<string, { source: string; target: string }>;
  rollback_readiness: {
    rollback_supported: boolean;
    rollback_manifest_exists: boolean;
    backup_files_planned: string[];
  };
  validation_gates_after_copy: string[];
  proposed_execution_steps: string[];
  rollback_steps: string[];
  safe_next_step: string;
  output_files: string[];
}

function loadJson(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function loadText(p: string): string {
  try { return fs.readFileSync(p, "utf-8"); } catch { return ""; }
}

function fileExists(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
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

export function reviewPromoteExecution(): ReviewResult {
  const result: ReviewResult = {
    phase: "5C-2C-C5K",
    mode: "promote_execution_design_only",
    version: "0.1.0",
    generated_at: new Date().toISOString(),
    recommendation: "block",
    promote_gate_status: "unknown",
    latest_run_id: null,
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    required_human_approval: true,
    required_confirm_phrase: "PROMOTE DAILY DIGEST FROM SANDBOX",
    evidence: {},
    unresolved_risks: [],
    required_locks: ["promote_lock", "execution_lock"],
    allowed_copy_map: {
      "daily-digest.md": {
        source: "sandbox/outputs/daily-digest.md",
        target: "reports/daily-digest.md",
      },
      "telegram-digest.txt": {
        source: "sandbox/outputs/telegram-digest.txt",
        target: "reports/telegram-digest.txt",
      },
    },
    rollback_readiness: {
      rollback_supported: true,
      rollback_manifest_exists: false,
      backup_files_planned: [
        "reports/daily-digest.md.bak",
        "reports/telegram-digest.txt.bak",
      ],
    },
    validation_gates_after_copy: [
      "validate:telegram-sanitizer",
      "validate:sanitizer-secret-completeness",
      "validate:digest-freshness",
    ],
    proposed_execution_steps: [
      "1. Acquire promote lock",
      "2. Recheck latest gate status",
      "3. Backup production files",
      "4. Copy sandbox daily-digest.md to production",
      "5. Copy sandbox telegram-digest.txt to production",
      "6. Verify hashes/sizes",
      "7. Run validation scripts",
      "8. Write promote audit record",
      "9. Release lock",
    ],
    rollback_steps: [
      "1. Restore production backups from .bak files",
      "2. Verify hashes match pre-promote state",
      "3. Write rollback audit record",
    ],
    safe_next_step: "",
    output_files: [],
  };

  // 1. Read promote gate
  const gatePath = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-gate.json");
  const gate = loadJson(gatePath);
  if (gate && gate.gate_status) {
    result.promote_gate_status = gate.gate_status;
    result.latest_run_id = gate.latest_run_id;
    result.evidence["promote_gate_pass"] = {
      met: gate.gate_status === "pass",
      message: `Gate status: ${gate.gate_status}`,
    };
  } else {
    result.evidence["promote_gate_pass"] = { met: false, message: "Promote gate not found or invalid" };
    result.unresolved_risks.push("Promote gate not available");
  }

  // 2. Check latest sandbox run
  const latest = loadJson(LATEST_JSON);
  if (!latest || !latest.latest_run_id) {
    result.unresolved_risks.push("Latest sandbox run not found");
  } else {
    result.latest_run_id = latest.latest_run_id;
    const runPath = latest.latest_run_path || path.join(SANDBOX_ROOT, result.latest_run_id);
    const reportsDir = path.join(runPath, "reports");
    const shadowDir = path.join(reportsDir, "promote-shadow");

    // 3. Shadow copy pass
    if (fileExists(shadowDir)) {
      result.evidence["shadow_copy_pass"] = { met: true, message: "Shadow copy directory exists" };
    } else {
      result.evidence["shadow_copy_pass"] = { met: false, message: "Shadow copy missing" };
      result.unresolved_risks.push("Shadow copy not found");
    }

    // 4. Rollback manifest exists
    const rollbackPath = path.join(shadowDir, "rollback-manifest.json");
    const rollback = loadJson(rollbackPath);
    if (rollback) {
      result.evidence["rollback_manifest_exists"] = { met: true, message: "Rollback manifest exists" };
      result.rollback_readiness.rollback_manifest_exists = true;
    } else {
      result.evidence["rollback_manifest_exists"] = { met: false, message: "Rollback manifest missing" };
      result.unresolved_risks.push("Rollback manifest missing");
    }

    // 5. Protected paths snapshot exists
    const backupPreviewDir = path.join(shadowDir, "production-backup-preview");
    if (fileExists(backupPreviewDir)) {
      const files = fs.readdirSync(backupPreviewDir);
      result.evidence["protected_paths_snapshot_exists"] = {
        met: files.length > 0,
        message: `Production backup preview contains ${files.length} files`,
      };
    } else {
      result.evidence["protected_paths_snapshot_exists"] = { met: false, message: "Production backup preview missing" };
      result.unresolved_risks.push("Production paths snapshot missing");
    }

    // 6. Sandbox output validation pass (check outputs exist)
    const outputsDir = path.join(runPath, "outputs");
    const dailyDigest = path.join(outputsDir, "daily-digest.md");
    const telegramDigest = path.join(outputsDir, "telegram-digest.txt");
    if (fileExists(dailyDigest) && fileExists(telegramDigest)) {
      result.evidence["sandbox_output_validation_pass"] = { met: true, message: "Both outputs exist" };
    } else {
      result.evidence["sandbox_output_validation_pass"] = { met: false, message: "Sandbox outputs missing" };
      result.unresolved_risks.push("Sandbox outputs not validated");
    }

    // 7. Diff summary reviewed
    const diffJson = path.join(runPath, "diffs", "diff-summary.json");
    if (fileExists(diffJson)) {
      result.evidence["diff_summary_reviewed"] = { met: true, message: "Diff summary exists (review required)" };
    } else {
      result.evidence["diff_summary_reviewed"] = { met: false, message: "Diff summary missing" };
      result.unresolved_risks.push("Diff summary not reviewed");
    }
  }

  // 8. Determine recommendation
  const allEvidenceMet = Object.values(result.evidence).every(e => e.met);
  if (allEvidenceMet && result.unresolved_risks.length === 0) {
    result.recommendation = "allow_next_phase_design_only";
    result.safe_next_step = "All evidence met. Design review complete. Next phase can implement actual promote execution with safety guards.";
  } else {
    result.recommendation = "block";
    result.safe_next_step = `Blocked. Unresolved: ${result.unresolved_risks.join(", ")}. Complete previous phases first.`;
  }

  // 9. Write review reports
  try {
    fs.writeFileSync(REVIEW_JSON, JSON.stringify(result, null, 2), "utf-8");
    result.output_files.push(REVIEW_JSON);
  } catch (e) {
    console.error("Failed to write review JSON:", e);
  }

  // Write MD report
  const reportPath = path.join(HARVESTER_DIR, "reports/promote-execution-design-review.md");
  const mdLines = [
    "# Promote Execution Design Review",
    "",
    `**Phase:** 5C-2C-C5K`,
    `**Mode:** ${result.mode}`,
    `**Generated:** ${result.generated_at}`,
    `**Latest Run:** ${result.latest_run_id || "N/A"}`,
    `**Promote Gate Status:** ${result.promote_gate_status}`,
    `**Recommendation:** ${result.recommendation.toUpperCase()}`,
    "",
    "## Evidence Checklist",
    "",
    ...Object.entries(result.evidence).map(([k, v]) =>
      `- **${k}**: ${v.met ? "✅" : "❌"} ${v.message}`
    ),
    "",
    "## Unresolved Risks",
    "",
    result.unresolved_risks.length > 0
      ? result.unresolved_risks.map(r => `- ⚠️ ${r}`).join("\n")
      : "None",
    "",
    "## Required Locks",
    "",
    ...result.required_locks.map(l => `- ${l}`),
    "",
    "## Allowed Copy Map",
    "",
    ...Object.entries(result.allowed_copy_map).map(([name, map]) =>
      `- **${name}**: ${map.source} → ${map.target}`
    ),
    "",
    "## Rollback Readiness",
    "",
    `- Rollback supported: ${result.rollback_readiness.rollback_supported ? "✅ YES" : "❌ NO"}`,
    `- Rollback manifest exists: ${result.rollback_readiness.rollback_manifest_exists ? "✅ YES" : "❌ NO"}`,
    `- Backup files planned: ${result.rollback_readiness.backup_files_planned.join(", ")}`,
    "",
    "## Validation Gates After Copy",
    "",
    ...result.validation_gates_after_copy.map(v => `- ${v}`),
    "",
    "## Proposed Execution Steps",
    "",
    ...result.proposed_execution_steps.map(s => `- ${s}`),
    "",
    "## Rollback Steps",
    "",
    ...result.rollback_steps.map(s => `- ${s}`),
    "",
    "## Safety Invariants",
    "",
    "- real_promote_allowed=false (always, until design review complete)",
    "- production_write_allowed=false (always, until promote execution enabled)",
    "- telegram_send_allowed=false (always, until send enabled)",
    "- confirm_phrase required for any promote action",
    "- human_approval required for any promote action",
    "",
    "## Safe Next Step",
    "",
    redact(result.safe_next_step),
    "",
    "---",
    "*Generated by daily-digest-promote-execution-review.ts*",
  ];

  try {
    fs.writeFileSync(reportPath, mdLines.join("\n"), "utf-8");
    result.output_files.push(reportPath);
  } catch (e) {
    console.error("Failed to write review MD:", e);
  }

  return result;
}

// CLI entry point
if (require.main === module) {
  const result = reviewPromoteExecution();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.recommendation === "block" ? 1 : 0);
}
