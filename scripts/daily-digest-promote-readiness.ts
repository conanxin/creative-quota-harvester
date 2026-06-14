#!/usr/bin/env tsx
/**
 * scripts/daily-digest-promote-readiness.ts
 * Phase 5C-2C-C5G: Sandbox promote readiness checker
 *
 * Checks if sandbox outputs are ready for future promotion.
 * Reads latest sandbox run, validation, and diff results.
 * Outputs readiness JSON to dashboard/daily-digest-promote-readiness.json
 *
 * Safety:
 *   - No child_process, no exec, no spawn
 *   - No .env or .control.local reads
 *   - No network calls
 *   - Only writes to dashboard/daily-digest-promote-readiness.json
 *   - Does not copy sandbox outputs to production
 *   - Does not send Telegram
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const SANDBOX_ROOT = path.join(HARVESTER_DIR, "reports/sandbox/daily-digest");
const LATEST_JSON = path.join(SANDBOX_ROOT, "latest.json");
const OUTPUT_READINESS_JSON = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-readiness.json");

interface ReadinessResult {
  phase: string;
  mode: string;
  version: string;
  generated_at: string;
  latest_run_id: string | null;
  ready_for_future_promote: boolean;
  real_promote_allowed: boolean;
  production_write_allowed: boolean;
  telegram_send_allowed: boolean;
  collect_allowed: boolean;
  timer_allowed: boolean;
  human_approval_required: boolean;
  preconditions: Record<string, { met: boolean; message: string }>;
  blocked_actions: string[];
  missing_requirements: string[];
  safe_next_step: string;
  future_confirm_phrase: string;
  future_confirm_phrase_enabled: boolean;
}

function loadJson(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function loadText(p: string): string {
  try { return fs.readFileSync(p, "utf-8"); } catch { return ""; }
}

function pathExists(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}

export function checkPromoteReadiness(): ReadinessResult {
  const result: ReadinessResult = {
    phase: "5C-2C-C5G",
    mode: "promote_readiness_only",
    version: "0.1.0",
    generated_at: new Date().toISOString(),
    latest_run_id: null,
    ready_for_future_promote: false,
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    collect_allowed: false,
    timer_allowed: false,
    human_approval_required: true,
    preconditions: {},
    blocked_actions: [
      "production_write",
      "telegram_send",
      "collect",
      "timer",
      "git",
      "promote",
      "model_call",
      "media_generation",
    ],
    missing_requirements: [],
    safe_next_step: "",
    future_confirm_phrase: "PROMOTE DAILY DIGEST FROM SANDBOX",
    future_confirm_phrase_enabled: false,
  };

  // 1. Load latest sandbox run
  const latest = loadJson(LATEST_JSON);
  if (!latest || !latest.latest_run_id) {
    result.missing_requirements.push("latest.json missing or invalid");
    result.safe_next_step = "Create sandbox run first";
    return result;
  }

  result.latest_run_id = latest.latest_run_id;
  const runPath = latest.latest_run_path || path.join(SANDBOX_ROOT, result.latest_run_id);
  const outputsDir = path.join(runPath, "outputs");
  const diffsDir = path.join(runPath, "diffs");
  const reportsDir = path.join(runPath, "reports");

  // 2. Check sandbox outputs exist
  const dailyDigestExists = pathExists(path.join(outputsDir, "daily-digest.md"));
  const telegramDigestExists = pathExists(path.join(outputsDir, "telegram-digest.txt"));

  result.preconditions["sandbox_outputs_exist"] = {
    met: dailyDigestExists && telegramDigestExists,
    message: dailyDigestExists && telegramDigestExists
      ? "Both outputs exist"
      : `Missing: daily-digest=${dailyDigestExists}, telegram=${telegramDigestExists}`,
  };

  if (!dailyDigestExists || !telegramDigestExists) {
    result.missing_requirements.push("Sandbox outputs missing");
  }

  // 3. Check sandbox output validation
  const validationPath = path.join(reportsDir, "validation-summary.json");
  // Also try to infer from validate-daily-digest-sandbox-output.ts by checking if it would pass
  // Since we can't run it here (no child_process), we check the outputs directly
  let secretsFound = 0;
  let toolResiduesFound = 0;

  if (dailyDigestExists) {
    const text = loadText(path.join(outputsDir, "daily-digest.md"));
    const secretPatterns = [
      /TELEGRAM_BOT_TOKEN\s*=\s*['"]\S+['"]/,
      /CQA_CONTROL_TOKEN\s*=\s*['"]\S+['"]/,
      /MINIMAX_API_KEY\s*=\s*['"]\S+['"]/,
      /sk-cp-[A-Za-z0-9_-]{10,}/,
      /sk-[A-Za-z0-9_-]{20,}/,
      /Bearer\s+[A-Za-z0-9._-]{20,}/,
    ];
    secretsFound += secretPatterns.reduce((sum, p) => sum + (text.match(p) || []).length, 0);

    const toolPatterns = [/<tool_call/, /<\/tool_call>/, /<invoke/, /<\/invoke>/, /\[truncated\]/];
    toolResiduesFound += toolPatterns.reduce((sum, p) => sum + (text.match(p) || []).length, 0);
  }

  if (telegramDigestExists) {
    const text = loadText(path.join(outputsDir, "telegram-digest.txt"));
    const secretPatterns = [
      /TELEGRAM_BOT_TOKEN\s*=\s*['"]\S+['"]/,
      /CQA_CONTROL_TOKEN\s*=\s*['"]\S+['"]/,
      /MINIMAX_API_KEY\s*=\s*['"]\S+['"]/,
      /sk-cp-[A-Za-z0-9_-]{10,}/,
      /sk-[A-Za-z0-9_-]{20,}/,
      /Bearer\s+[A-Za-z0-9._-]{20,}/,
    ];
    secretsFound += secretPatterns.reduce((sum, p) => sum + (text.match(p) || []).length, 0);

    const toolPatterns = [/<tool_call/, /<\/tool_call>/, /<invoke/, /<\/invoke>/, /\[truncated\]/];
    toolResiduesFound += toolPatterns.reduce((sum, p) => sum + (text.match(p) || []).length, 0);
  }

  result.preconditions["secret_scan_pass"] = {
    met: secretsFound === 0,
    message: secretsFound === 0 ? "No secrets found" : `${secretsFound} potential secrets found`,
  };

  result.preconditions["tool_residue_scan_pass"] = {
    met: toolResiduesFound === 0,
    message: toolResiduesFound === 0 ? "No tool residues found" : `${toolResiduesFound} tool residues found`,
  };

  if (secretsFound > 0) {
    result.missing_requirements.push("Secrets found in sandbox outputs");
  }
  if (toolResiduesFound > 0) {
    result.missing_requirements.push("Tool residues found in sandbox outputs");
  }

  // 4. Check diff summary exists
  const diffJsonExists = pathExists(path.join(diffsDir, "diff-summary.json"));
  const diffMdExists = pathExists(path.join(diffsDir, "diff-summary.md"));

  result.preconditions["diff_summary_exists"] = {
    met: diffJsonExists && diffMdExists,
    message: diffJsonExists && diffMdExists ? "Diff summary exists" : "Diff summary missing",
  };

  if (!diffJsonExists || !diffMdExists) {
    result.missing_requirements.push("Diff summary missing");
  }

  // 5. Check build summary exists (proof of successful build)
  const buildSummaryExists = pathExists(path.join(reportsDir, "build-summary.json"));
  result.preconditions["pilot_build_executed"] = {
    met: buildSummaryExists,
    message: buildSummaryExists ? "Build summary exists (pilot executed)" : "Build summary missing",
  };

  if (!buildSummaryExists) {
    result.missing_requirements.push("Pilot build not executed");
  }

  // 6. Check manifest has correct flags
  const manifestPath = path.join(runPath, "manifest.json");
  const manifest = loadJson(manifestPath);
  if (manifest) {
    result.preconditions["manifest_flags_correct"] = {
      met: manifest.collect_allowed === false && manifest.telegram_send_allowed === false && manifest.production_write_allowed === false,
      message: `collect=${manifest.collect_allowed}, send=${manifest.telegram_send_allowed}, write=${manifest.production_write_allowed}`,
    };
  } else {
    result.preconditions["manifest_flags_correct"] = {
      met: false,
      message: "Manifest missing",
    };
    result.missing_requirements.push("Manifest missing");
  }

  // 7. Check protected paths unchanged (read from build-summary if available)
  if (buildSummaryExists) {
    const buildSummary = loadJson(path.join(reportsDir, "build-summary.json"));
    if (buildSummary) {
      result.preconditions["protected_paths_unchanged"] = {
        met: buildSummary.production_write_detected === false,
        message: buildSummary.production_write_detected === false
          ? "Production paths unchanged"
          : "Production paths were modified during build",
      };
      if (buildSummary.production_write_detected) {
        result.missing_requirements.push("Production paths were modified during build");
      }
    } else {
      result.preconditions["protected_paths_unchanged"] = {
        met: false,
        message: "Could not verify protected paths",
      };
      result.missing_requirements.push("Could not verify protected paths");
    }
  } else {
    result.preconditions["protected_paths_unchanged"] = {
      met: false,
      message: "Build summary missing, cannot verify",
    };
  }

  // 8. Check human approval requirement
  result.preconditions["human_approval_required"] = {
    met: result.human_approval_required,
    message: "Human approval required before any promote",
  };

  // 9. Determine readiness
  const allPreconditionsMet = Object.values(result.preconditions).every(p => p.met);
  result.ready_for_future_promote = allPreconditionsMet && result.missing_requirements.length === 0;

  if (result.ready_for_future_promote) {
    result.safe_next_step = "All preconditions met. When ready to enable promote, set future_confirm_phrase_enabled=true and implement copy-to-production logic.";
  } else {
    result.safe_next_step = `Missing: ${result.missing_requirements.join(", ")}. Complete these before promoting.`;
  }

  return result;
}

export function writePromoteReadiness(): void {
  const result = checkPromoteReadiness();
  fs.writeFileSync(OUTPUT_READINESS_JSON, JSON.stringify(result, null, 2), "utf-8");
  console.log(JSON.stringify(result, null, 2));
}

// CLI entry point
if (require.main === module) {
  writePromoteReadiness();
}
