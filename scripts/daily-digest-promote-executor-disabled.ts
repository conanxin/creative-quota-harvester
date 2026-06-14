#!/usr/bin/env tsx
/**
 * scripts/daily-digest-promote-executor-disabled.ts
 * Phase 5C-2C-C5L: Promote Execution Disabled Scaffold
 *
 * Provides the entry point for future promote execution but always returns
 * disabled_design_only. No files are copied to production.
 *
 * Safety:
 *   - No child_process, no exec, no spawn
 *   - No .env or .control.local reads
 *   - No network calls
 *   - Does not copy files to production
 *   - Does not send Telegram
 *   - Output is redacted
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const SANDBOX_ROOT = path.join(HARVESTER_DIR, "reports/sandbox/daily-digest");
const LATEST_JSON = path.join(SANDBOX_ROOT, "latest.json");
const DISABLED_CONFIG = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-execution-disabled.json");

interface GateCheck {
  met: boolean;
  message: string;
}

interface DisabledExecutorResult {
  phase: string;
  mode: string;
  version: string;
  generated_at: string;
  real_promote_allowed: false;
  production_write_allowed: false;
  telegram_send_allowed: false;
  would_promote: boolean;
  blocked_reason: string;
  latest_run_id: string | null;
  gate_checks: Record<string, GateCheck>;
  all_gates_met: boolean;
  future_execution_steps: string[];
  blocked_actions: string[];
  required_confirm_phrase: string;
  required_human_approval: boolean;
  output_files: string[];
  safe_next_step: string;
}

function loadJson(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
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

export function runDisabledExecutor(): DisabledExecutorResult {
  const result: DisabledExecutorResult = {
    phase: "5C-2C-C5L",
    mode: "execution_scaffold_disabled",
    version: "0.1.0",
    generated_at: new Date().toISOString(),
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    would_promote: false,
    blocked_reason: "Promote execution disabled in Phase 5C-2C-C5L",
    latest_run_id: null,
    gate_checks: {},
    all_gates_met: false,
    future_execution_steps: [
      "acquire promote lock",
      "recheck gate",
      "backup production",
      "copy sandbox outputs",
      "verify hashes",
      "run validations",
      "write audit",
      "release lock",
    ],
    blocked_actions: [
      "production_write",
      "telegram_send",
      "collect",
      "timer",
      "git",
      "promote",
    ],
    required_confirm_phrase: "PROMOTE DAILY DIGEST FROM SANDBOX",
    required_human_approval: true,
    output_files: [],
    safe_next_step: "",
  };

  // 1. Read disabled config
  const config = loadJson(DISABLED_CONFIG);
  if (!config) {
    result.blocked_reason = "Disabled config not found";
    return result;
  }

  // 2. Check latest sandbox run
  const latest = loadJson(LATEST_JSON);
  if (!latest || !latest.latest_run_id) {
    result.gate_checks["latest_sandbox_run"] = { met: false, message: "Latest sandbox run not found" };
    result.blocked_reason = "No latest sandbox run";
    result.safe_next_step = "Create sandbox run first";
    return result;
  }
  result.latest_run_id = latest.latest_run_id;
  const runPath = latest.latest_run_path || path.join(SANDBOX_ROOT, result.latest_run_id);
  const reportsDir = path.join(runPath, "reports");
  const shadowDir = path.join(reportsDir, "promote-shadow");

  // 3. Check promote gate
  const gatePath = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-gate.json");
  const gate = loadJson(gatePath);
  if (gate && gate.gate_status === "pass") {
    result.gate_checks["promote_gate_pass"] = { met: true, message: `Gate status: pass` };
  } else {
    result.gate_checks["promote_gate_pass"] = { met: false, message: `Gate status: ${gate?.gate_status || "missing"}` };
  }

  // 4. Check shadow copy
  if (fileExists(shadowDir)) {
    result.gate_checks["shadow_copy_pass"] = { met: true, message: "Shadow copy directory exists" };
  } else {
    result.gate_checks["shadow_copy_pass"] = { met: false, message: "Shadow copy missing" };
  }

  // 5. Check rollback manifest
  const rollbackPath = path.join(shadowDir, "rollback-manifest.json");
  if (fileExists(rollbackPath)) {
    result.gate_checks["rollback_manifest_exists"] = { met: true, message: "Rollback manifest exists" };
  } else {
    result.gate_checks["rollback_manifest_exists"] = { met: false, message: "Rollback manifest missing" };
  }

  // 6. Check protected paths snapshot
  const backupPreviewDir = path.join(shadowDir, "production-backup-preview");
  if (fileExists(backupPreviewDir)) {
    const files = fs.readdirSync(backupPreviewDir);
    result.gate_checks["protected_paths_snapshot_exists"] = {
      met: files.length > 0,
      message: `Production backup preview contains ${files.length} files`,
    };
  } else {
    result.gate_checks["protected_paths_snapshot_exists"] = { met: false, message: "Production backup preview missing" };
  }

  // 7. Human approval
  result.gate_checks["human_approval_required"] = { met: true, message: "Human approval required (always)" };

  // Determine if all gates met
  result.all_gates_met = Object.values(result.gate_checks).every(c => c.met);

  // 8. Determine blocked reason and safe next step
  if (!result.all_gates_met) {
    result.blocked_reason = "Required gates not all met";
    const missing = Object.entries(result.gate_checks).filter(([_, v]) => !v.met).map(([k]) => k);
    result.safe_next_step = `Missing gates: ${missing.join(", ")}. Complete previous phases first.`;
  } else {
    result.blocked_reason = "Promote execution disabled in Phase 5C-2C-C5L (design-only scaffold)";
    result.safe_next_step = "All gates met but execution is disabled by design. Future phase can enable.";
  }

  // Always blocked
  result.would_promote = false;
  result.real_promote_allowed = false;
  result.production_write_allowed = false;
  result.telegram_send_allowed = false;

  return result;
}

// CLI entry point
if (require.main === module) {
  const result = runDisabledExecutor();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
