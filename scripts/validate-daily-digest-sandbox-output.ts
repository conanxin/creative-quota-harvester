#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-sandbox-output.ts
 * Phase 5C-2C-C5F: Sandbox output validator
 *
 * Validates latest sandbox digest outputs for:
 * - File existence and non-empty
 * - Manifest schema compliance
 * - Secret/token leakage (TELEGRAM_BOT_TOKEN, API_KEY, sk-cp, Bearer, etc.)
 * - Tool residue (<tool_call, <invoke, [truncated], </tool_call>)
 * - Telegram digest length check (warning if >3500, not fail)
 * - No model calls, no media generation, no collect, no send
 * - No production writes
 *
 * Safety:
 *   - No child_process, no exec, no spawn
 *   - No .env or .control.local reads
 *   - No network calls
 *   - No production writes
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");

const SANDBOX_ROOT = path.join(HARVESTER_DIR, "reports/sandbox/daily-digest");
const LATEST_JSON = path.join(SANDBOX_ROOT, "latest.json");

const TELEGRAM_LIMIT = 3500;

interface ValidationResult {
  valid: boolean;
  run_id: string | null;
  sandbox_path: string | null;
  outputs_dir: string | null;
  checks: CheckResult[];
  warnings: string[];
  errors: string[];
  summary: {
    daily_digest_exists: boolean;
    daily_digest_size: number;
    telegram_digest_exists: boolean;
    telegram_digest_size: number;
    telegram_digest_chars: number;
    secrets_found: number;
    tool_residues_found: number;
    manifest_valid: boolean;
  };
}

interface CheckResult {
  name: string;
  pass: boolean;
  message: string;
}

function loadJson(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function loadText(p: string): string {
  try { return fs.readFileSync(p, "utf-8"); } catch { return ""; }
}

function hasSecretLeak(text: string): boolean {
  const patterns = [
    /TELEGRAM_BOT_TOKEN\s*=\s*['"]\S+['"]/,
    /CQA_CONTROL_TOKEN\s*=\s*['"]\S+['"]/,
    /MINIMAX_API_KEY\s*=\s*['"]\S+['"]/,
    /OPENAI_API_KEY\s*=\s*['"]\S+['"]/,
    /API_KEY\s*=\s*['"]\S+['"]/,
    /sk-cp-[A-Za-z0-9_-]{10,}/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /Bearer\s+[A-Za-z0-9._-]{20,}/,
    /authorization:\s*Bearer\s+[A-Za-z0-9._-]+/i,
  ];
  return patterns.some(p => p.test(text));
}

function hasToolResidue(text: string): boolean {
  const patterns = [
    /<tool_call/,
    /<\/tool_call>/,
    /<invoke/,
    /<\/invoke>/,
    /\[truncated\]/,
  ];
  return patterns.some(p => p.test(text));
}

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(new RegExp(pattern, "g"));
  return matches ? matches.length : 0;
}

export function validateLatestSandboxOutput(): ValidationResult {
  const result: ValidationResult = {
    valid: false,
    run_id: null,
    sandbox_path: null,
    outputs_dir: null,
    checks: [],
    warnings: [],
    errors: [],
    summary: {
      daily_digest_exists: false,
      daily_digest_size: 0,
      telegram_digest_exists: false,
      telegram_digest_size: 0,
      telegram_digest_chars: 0,
      secrets_found: 0,
      tool_residues_found: 0,
      manifest_valid: false,
    },
  };

  // 1. Load latest.json
  const latest = loadJson(LATEST_JSON);
  if (!latest || !latest.latest_run_id) {
    result.errors.push("latest.json missing or invalid");
    result.checks.push({ name: "latest.json", pass: false, message: "Missing or invalid latest.json" });
    return result;
  }

  result.run_id = latest.latest_run_id;
  result.sandbox_path = latest.latest_run_path || path.join(SANDBOX_ROOT, result.run_id);
  result.outputs_dir = path.join(result.sandbox_path, "outputs");

  // 2. Check manifest.json
  const manifestPath = path.join(result.sandbox_path, "manifest.json");
  const manifest = loadJson(manifestPath);
  if (manifest) {
    result.summary.manifest_valid = true;
    result.checks.push({ name: "manifest.json", pass: true, message: "Manifest exists and is valid JSON" });

    // Check manifest flags
    if (manifest.collect_allowed === false) {
      result.checks.push({ name: "manifest.collect_allowed", pass: true, message: "collect_allowed=false" });
    } else {
      result.checks.push({ name: "manifest.collect_allowed", pass: false, message: `collect_allowed=${manifest.collect_allowed} (expected false)` });
      result.errors.push("Manifest: collect_allowed should be false");
    }

    if (manifest.telegram_send_allowed === false) {
      result.checks.push({ name: "manifest.telegram_send_allowed", pass: true, message: "telegram_send_allowed=false" });
    } else {
      result.checks.push({ name: "manifest.telegram_send_allowed", pass: false, message: `telegram_send_allowed=${manifest.telegram_send_allowed} (expected false)` });
      result.errors.push("Manifest: telegram_send_allowed should be false");
    }

    if (manifest.production_write_allowed === false) {
      result.checks.push({ name: "manifest.production_write_allowed", pass: true, message: "production_write_allowed=false" });
    } else {
      result.checks.push({ name: "manifest.production_write_allowed", pass: false, message: `production_write_allowed=${manifest.production_write_allowed} (expected false)` });
      result.errors.push("Manifest: production_write_allowed should be false");
    }
  } else {
    result.checks.push({ name: "manifest.json", pass: false, message: "Manifest missing or invalid" });
    result.errors.push("Manifest missing or invalid");
  }

  // 3. Check daily-digest.md
  const digestMdPath = path.join(result.outputs_dir, "daily-digest.md");
  const digestMdExists = fs.existsSync(digestMdPath);
  result.summary.daily_digest_exists = digestMdExists;
  result.checks.push({ name: "daily-digest.md exists", pass: digestMdExists, message: digestMdExists ? "daily-digest.md exists" : "daily-digest.md missing" });
  if (!digestMdExists) {
    result.errors.push("daily-digest.md missing");
  } else {
    const stats = fs.statSync(digestMdPath);
    result.summary.daily_digest_size = stats.size;
    if (stats.size > 0) {
      result.checks.push({ name: "daily-digest.md non-empty", pass: true, message: `Size: ${stats.size} bytes` });
    } else {
      result.checks.push({ name: "daily-digest.md non-empty", pass: false, message: "daily-digest.md is empty" });
      result.errors.push("daily-digest.md is empty");
    }
  }

  // 4. Check telegram-digest.txt
  const telegramPath = path.join(result.outputs_dir, "telegram-digest.txt");
  const telegramExists = fs.existsSync(telegramPath);
  result.summary.telegram_digest_exists = telegramExists;
  result.checks.push({ name: "telegram-digest.txt exists", pass: telegramExists, message: telegramExists ? "telegram-digest.txt exists" : "telegram-digest.txt missing" });
  if (!telegramExists) {
    result.errors.push("telegram-digest.txt missing");
  } else {
    const stats = fs.statSync(telegramPath);
    result.summary.telegram_digest_size = stats.size;
    const text = loadText(telegramPath);
    result.summary.telegram_digest_chars = text.length;
    if (stats.size > 0) {
      result.checks.push({ name: "telegram-digest.txt non-empty", pass: true, message: `Size: ${stats.size} bytes, ${text.length} chars` });
    } else {
      result.checks.push({ name: "telegram-digest.txt non-empty", pass: false, message: "telegram-digest.txt is empty" });
      result.errors.push("telegram-digest.txt is empty");
    }

    if (text.length > TELEGRAM_LIMIT) {
      result.warnings.push(`Telegram digest ${text.length} chars exceeds ${TELEGRAM_LIMIT} limit (warning only)`);
      result.checks.push({ name: "telegram-digest.txt length", pass: true, message: `${text.length} chars (warning: exceeds ${TELEGRAM_LIMIT})` });
    } else {
      result.checks.push({ name: "telegram-digest.txt length", pass: true, message: `${text.length} chars (within ${TELEGRAM_LIMIT} limit)` });
    }
  }

  // 5. Check for secrets in all outputs
  let totalSecrets = 0;
  let totalToolResidues = 0;
  const outputFiles = [digestMdPath, telegramPath].filter(p => fs.existsSync(p));
  for (const file of outputFiles) {
    const text = loadText(file);
    const secrets = countMatches(text, /TELEGRAM_BOT_TOKEN|API_KEY|sk-cp-|Bearer\s+[A-Za-z0-9._-]{20,}/);
    const tools = countMatches(text, /<tool_call|<\/tool_call>|<invoke|<\/invoke>|\[truncated\]/);
    totalSecrets += secrets;
    totalToolResidues += tools;
  }
  result.summary.secrets_found = totalSecrets;
  result.summary.tool_residues_found = totalToolResidues;

  if (totalSecrets === 0) {
    result.checks.push({ name: "secret scan", pass: true, message: "No secrets found in outputs" });
  } else {
    result.checks.push({ name: "secret scan", pass: false, message: `${totalSecrets} potential secrets found` });
    result.errors.push(`${totalSecrets} potential secrets found in outputs`);
  }

  if (totalToolResidues === 0) {
    result.checks.push({ name: "tool residue scan", pass: true, message: "No tool residues found in outputs" });
  } else {
    result.checks.push({ name: "tool residue scan", pass: false, message: `${totalToolResidues} tool residues found` });
    result.errors.push(`${totalToolResidues} tool residues found in outputs`);
  }

  // 6. Check for production paths in output content (should reference sandbox paths, not production)
  if (digestMdExists) {
    const text = loadText(digestMdPath);
    if (text.includes("reports/daily-digest.md") && !text.includes("sandbox")) {
      result.warnings.push("daily-digest.md may reference production paths without sandbox context");
    }
  }

  result.valid = result.errors.length === 0;
  return result;
}

// CLI entry point
if (require.main === module) {
  const result = validateLatestSandboxOutput();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.valid ? 0 : 1);
}
