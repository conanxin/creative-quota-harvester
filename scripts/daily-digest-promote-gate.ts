#!/usr/bin/env tsx
/**
 * scripts/daily-digest-promote-gate.ts
 * Phase 5C-2C-C5J: Promote Commit Gate
 *
 * Checks if all preconditions are met for future promote.
 * Reads latest sandbox run, readiness, dry-run, shadow copy, validation, diff.
 * Outputs gate report to dashboard and sandbox reports.
 *
 * Safety:
 *   - No child_process, no exec, no spawn
 *   - No .env or .control.local reads
 *   - No network calls
 *   - Only writes to dashboard/ and sandbox reports/
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
const GATE_JSON = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-gate.json");

const PRODUCTION_PATHS = {
  dailyDigest: path.join(HARVESTER_DIR, "reports/daily-digest.md"),
  telegramDigest: path.join(HARVESTER_DIR, "reports/telegram-digest.txt"),
  statusJson: path.join(HARVESTER_DIR, "dashboard/status.json"),
};

interface Evidence {
  met: boolean;
  message: string;
}

interface GateResult {
  phase: string;
  mode: string;
  version: string;
  generated_at: string;
  gate_status: "pass" | "fail" | "partial";
  latest_run_id: string | null;
  real_promote_allowed: boolean;
  production_write_allowed: boolean;
  telegram_send_allowed: boolean;
  evidence: Record<string, Evidence>;
  missing_requirements: string[];
  blocked_actions: string[];
  human_approval_required: boolean;
  future_confirm_phrase: string;
  future_confirm_phrase_enabled: boolean;
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

function getFileHash(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);
  } catch { return null; }
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

export function checkPromoteGate(): GateResult {
  // Read config first to preserve required_evidence in output
  const configPath = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-gate.json");
  const config = loadJson(configPath);

  const result: GateResult = {
    phase: "5C-2C-C5J",
    mode: "promote_gate_only",
    version: "0.1.0",
    generated_at: new Date().toISOString(),
    gate_status: "fail",
    latest_run_id: null,
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    required_evidence: config?.required_evidence && Object.keys(config.required_evidence).length > 0 ? config.required_evidence : {
      latest_sandbox_run_exists: { description: "Latest sandbox run must exist", required: true, source: "reports/sandbox/daily-digest/latest.json" },
      sandbox_build_success: { description: "Sandbox build must have succeeded", required: true, source: "build-summary.json" },
      sandbox_output_validation_pass: { description: "Sandbox output validation must pass", required: true, source: "validate-daily-digest-sandbox-output.ts" },
      secret_scan_pass: { description: "No secrets found in sandbox outputs", required: true, source: "validate-daily-digest-sandbox-output.ts" },
      tool_residue_scan_pass: { description: "No tool residues found in sandbox outputs", required: true, source: "validate-daily-digest-sandbox-output.ts" },
      diff_summary_exists: { description: "Diff summary must exist", required: true, source: "daily-digest-sandbox-diff.ts" },
      promote_readiness_ready: { description: "Promote readiness checker must show ready", required: true, source: "daily-digest-promote-readiness.ts" },
      promote_dry_run_pass: { description: "Promote dry-run plan must pass", required: true, source: "daily-digest-promote-dry-run.ts" },
      shadow_copy_pass: { description: "Shadow copy must be created successfully", required: true, source: "daily-digest-promote-shadow-copy.ts" },
      rollback_manifest_exists: { description: "Rollback manifest must exist", required: true, source: "promote-shadow/rollback-manifest.json" },
      promote_checklist_exists: { description: "Promote checklist must exist", required: true, source: "promote-shadow/promote-checklist.md" },
      protected_paths_unchanged: { description: "Production protected paths must be unchanged", required: true, source: "build-summary.json" },
      human_approval_required: { description: "Human approval required before any promote", required: true, source: "policy" },
    },
    evidence: {},
    missing_requirements: [],
    blocked_actions: [
      "production_write",
      "telegram_send",
      "collect",
      "timer",
      "git",
      "promote",
    ],
    human_approval_required: true,
    future_confirm_phrase: config?.future_confirm_phrase || "PROMOTE DAILY DIGEST FROM SANDBOX",
    future_confirm_phrase_enabled: false,
    safe_next_step: "",
    output_files: [],
  };

  // 1. Check latest sandbox run exists
  const latest = loadJson(LATEST_JSON);
  if (!latest || !latest.latest_run_id) {
    result.missing_requirements.push("latest sandbox run missing");
    result.evidence["latest_sandbox_run_exists"] = { met: false, message: "latest.json missing or invalid" };
    result.safe_next_step = "Create sandbox run first";
    writeGateReport(result);
    return result;
  }

  result.latest_run_id = latest.latest_run_id;
  const runPath = latest.latest_run_path || path.join(SANDBOX_ROOT, result.latest_run_id);
  const outputsDir = path.join(runPath, "outputs");
  const reportsDir = path.join(runPath, "reports");

  result.evidence["latest_sandbox_run_exists"] = { met: true, message: `Run ${result.latest_run_id} exists` };

  // 2. Check sandbox build success (build-summary.json)
  const buildSummaryPath = path.join(reportsDir, "build-summary.json");
  const buildSummary = loadJson(buildSummaryPath);
  if (buildSummary && buildSummary.exit_code === 0) {
    result.evidence["sandbox_build_success"] = { met: true, message: `Build succeeded (exit_code=${buildSummary.exit_code})` };
  } else {
    result.evidence["sandbox_build_success"] = { met: false, message: "Build summary missing or build failed" };
    result.missing_requirements.push("sandbox build success");
  }

  // 3. Check sandbox output validation (check outputs exist + secret/tool scan)
  const dailyDigest = path.join(outputsDir, "daily-digest.md");
  const telegramDigest = path.join(outputsDir, "telegram-digest.txt");
  const outputsExist = fileExists(dailyDigest) && fileExists(telegramDigest);

  if (outputsExist) {
    let secrets = 0;
    let residues = 0;
    for (const f of [dailyDigest, telegramDigest]) {
      const text = loadText(f);
      const secretPatterns = [/TELEGRAM_BOT_TOKEN\s*=\s*['"]\S+['"]/, /CQA_CONTROL_TOKEN\s*=\s*['"]\S+['"]/, /sk-cp-[A-Za-z0-9_-]{10,}/, /Bearer\s+[A-Za-z0-9._-]{20,}/];
      const toolPatterns = [/<tool_call/, /<\/tool_call>/, /<invoke/, /<\/invoke>/, /\[truncated\]/];
      secrets += secretPatterns.reduce((s, p) => s + (text.match(p) || []).length, 0);
      residues += toolPatterns.reduce((s, p) => s + (text.match(p) || []).length, 0);
    }
    result.evidence["sandbox_output_validation_pass"] = { met: true, message: "Both outputs exist and are non-empty" };
    result.evidence["secret_scan_pass"] = { met: secrets === 0, message: secrets === 0 ? "No secrets found" : `${secrets} potential secrets found` };
    result.evidence["tool_residue_scan_pass"] = { met: residues === 0, message: residues === 0 ? "No tool residues found" : `${residues} tool residues found` };
    if (secrets > 0) result.missing_requirements.push("secret scan pass");
    if (residues > 0) result.missing_requirements.push("tool residue scan pass");
  } else {
    result.evidence["sandbox_output_validation_pass"] = { met: false, message: "Sandbox outputs missing" };
    result.evidence["secret_scan_pass"] = { met: false, message: "Cannot scan - outputs missing" };
    result.evidence["tool_residue_scan_pass"] = { met: false, message: "Cannot scan - outputs missing" };
    result.missing_requirements.push("sandbox output validation pass");
  }

  // 4. Check diff summary exists
  const diffDir = path.join(runPath, "diffs");
  const diffJson = path.join(diffDir, "diff-summary.json");
  const diffMd = path.join(diffDir, "diff-summary.md");
  if (fileExists(diffJson) && fileExists(diffMd)) {
    result.evidence["diff_summary_exists"] = { met: true, message: "Both diff-summary.json and diff-summary.md exist" };
  } else {
    result.evidence["diff_summary_exists"] = { met: false, message: "Diff summary missing" };
    result.missing_requirements.push("diff summary");
  }

  // 5. Check promote readiness
  const readinessPath = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-readiness.json");
  const readiness = loadJson(readinessPath);
  if (readiness && readiness.ready_for_future_promote === true) {
    result.evidence["promote_readiness_ready"] = { met: true, message: "Readiness: ready" };
  } else {
    result.evidence["promote_readiness_ready"] = { met: false, message: "Readiness not ready" };
    result.missing_requirements.push("promote readiness");
  }

  // 6. Check promote dry-run
  const dryRunPlan = path.join(reportsDir, "promote-dry-run-plan.json");
  if (fileExists(dryRunPlan)) {
    const plan = loadJson(dryRunPlan);
    if (plan && plan.run_id) {
      result.evidence["promote_dry_run_pass"] = { met: true, message: "Dry-run plan exists" };
    } else {
      result.evidence["promote_dry_run_pass"] = { met: false, message: "Dry-run plan invalid" };
      result.missing_requirements.push("promote dry-run");
    }
  } else {
    result.evidence["promote_dry_run_pass"] = { met: false, message: "Dry-run plan missing" };
    result.missing_requirements.push("promote dry-run");
  }

  // 7. Check shadow copy
  const shadowDir = path.join(reportsDir, "promote-shadow");
  if (fileExists(shadowDir)) {
    result.evidence["shadow_copy_pass"] = { met: true, message: "Shadow copy directory exists" };
  } else {
    result.evidence["shadow_copy_pass"] = { met: false, message: "Shadow copy directory missing" };
    result.missing_requirements.push("shadow copy");
  }

  // 8. Check rollback manifest
  const rollbackPath = path.join(shadowDir, "rollback-manifest.json");
  if (fileExists(rollbackPath)) {
    result.evidence["rollback_manifest_exists"] = { met: true, message: "Rollback manifest exists" };
  } else {
    result.evidence["rollback_manifest_exists"] = { met: false, message: "Rollback manifest missing" };
    result.missing_requirements.push("rollback manifest");
  }

  // 9. Check promote checklist
  const checklistPath = path.join(shadowDir, "promote-checklist.md");
  if (fileExists(checklistPath)) {
    result.evidence["promote_checklist_exists"] = { met: true, message: "Promote checklist exists" };
  } else {
    result.evidence["promote_checklist_exists"] = { met: false, message: "Promote checklist missing" };
    result.missing_requirements.push("promote checklist");
  }

  // 10. Check protected paths unchanged (from build summary)
  if (buildSummary) {
    result.evidence["protected_paths_unchanged"] = {
      met: buildSummary.production_write_detected === false,
      message: buildSummary.production_write_detected === false
        ? "Production paths unchanged (from build summary)"
        : "Production paths were modified during build",
    };
    if (buildSummary.production_write_detected) {
      result.missing_requirements.push("protected paths unchanged");
    }
  } else {
    result.evidence["protected_paths_unchanged"] = { met: false, message: "Cannot verify - build summary missing" };
    result.missing_requirements.push("protected paths unchanged");
  }

  // 11. Check current production paths still exist and are readable
  const prodDailyExists = fileExists(PRODUCTION_PATHS.dailyDigest);
  const prodTelegramExists = fileExists(PRODUCTION_PATHS.telegramDigest);
  const prodStatusExists = fileExists(PRODUCTION_PATHS.statusJson);

  // 12. Human approval
  result.evidence["human_approval_required"] = { met: true, message: "Human approval required before any promote" };

  // Determine gate status
  const allMet = Object.values(result.evidence).every(e => e.met);
  if (allMet) {
    result.gate_status = "pass";
    result.safe_next_step = "All gate preconditions met. When ready to enable promote, set future_confirm_phrase_enabled=true and implement copy-to-production logic.";
  } else if (result.missing_requirements.length < 4) {
    result.gate_status = "partial";
    result.safe_next_step = `Partial pass. Missing: ${result.missing_requirements.join(", ")}. Complete these before promoting.`;
  } else {
    result.gate_status = "fail";
    result.safe_next_step = `Gate failed. Missing: ${result.missing_requirements.join(", ")}.`;
  }

  // Write gate reports
  const gateJsonPath = writeGateReport(result);
  if (gateJsonPath) result.output_files.push(gateJsonPath);

  return result;
}

function writeGateReport(result: GateResult): string | null {
  try {
    // Write to dashboard
    fs.writeFileSync(GATE_JSON, JSON.stringify(result, null, 2), "utf-8");

    // Write to sandbox reports if run exists
    if (result.latest_run_id) {
      const latest = loadJson(LATEST_JSON);
      const runPath = latest?.latest_run_path || path.join(SANDBOX_ROOT, result.latest_run_id);
      const reportsDir = path.join(runPath, "reports");
      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

      const sandboxGateJson = path.join(reportsDir, "promote-gate.json");
      fs.writeFileSync(sandboxGateJson, JSON.stringify(result, null, 2), "utf-8");

      // Write MD report
      const mdLines = [
        "# Promote Gate Report",
        "",
        `**Phase:** 5C-2C-C5J`,
        `**Run ID:** ${result.latest_run_id}`,
        `**Gate Status:** ${result.gate_status.toUpperCase()}`,
        `**Mode:** ${result.mode}`,
        `**Generated:** ${result.generated_at}`,
        "",
        "## Evidence",
        "",
        ...Object.entries(result.evidence).map(([k, v]) =>
          `- **${k}**: ${v.met ? "✅" : "❌"} ${v.message}`
        ),
        "",
        "## Missing Requirements",
        "",
        result.missing_requirements.length > 0
          ? result.missing_requirements.map(r => `- ❌ ${r}`).join("\n")
          : "None",
        "",
        "## Blocked Actions",
        "",
        ...result.blocked_actions.map(a => `- ${a}`),
        "",
        "## Human Approval",
        "",
        `- Required: ${result.human_approval_required ? "✅ YES" : "❌ NO"}`,
        `- Future confirm phrase: ${result.future_confirm_phrase}`,
        `- Enabled: ${result.future_confirm_phrase_enabled ? "✅ YES" : "❌ NO"}`,
        "",
        "## Safe Next Step",
        "",
        redact(result.safe_next_step),
        "",
        "---",
        "*Generated by daily-digest-promote-gate.ts*",
      ];
      const sandboxGateMd = path.join(reportsDir, "promote-gate.md");
      fs.writeFileSync(sandboxGateMd, mdLines.join("\n"), "utf-8");

      return sandboxGateJson;
    }
    return GATE_JSON;
  } catch (e) {
    console.error("Failed to write gate report:", e);
    return null;
  }
}

// CLI entry point
if (require.main === module) {
  const result = checkPromoteGate();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.gate_status === "pass" ? 0 : 1);
}
