/**
 * scripts/daily-digest-sandbox-manager.ts
 * Phase 5C-2C-C5: Sandbox Directory Creation
 *
 * Creates sandbox run directories for daily digest without:
 *   - building digest
 *   - writing production files
 *   - collecting data
 *   - sending Telegram
 *   - modifying timer
 *   - calling models
 *   - generating media
 *
 * Safety: All writes restricted to reports/sandbox/daily-digest/
 */

import * as fs from "fs";
import * as path from "path";

const SANDBOX_ROOT = path.resolve(__dirname, "../reports/sandbox/daily-digest");
const LATEST_JSON = path.join(SANDBOX_ROOT, "latest.json");

export interface SandboxRun {
  run_id: string;
  created_at: string;
  mode: string;
  real_digest_build: boolean;
  collect_allowed: boolean;
  telegram_send_allowed: boolean;
  production_write_allowed: boolean;
  protected_paths: string[];
  sandbox_root: string;
  next_allowed_stage: string;
  inputs_dir: string;
  outputs_dir: string;
  reports_dir: string;
  diffs_dir: string;
  logs_dir: string;
}

export interface CreateSandboxResult {
  success: boolean;
  run_id: string | null;
  sandbox_path: string | null;
  error: string | null;
  created_dirs: string[];
  manifest_written: boolean;
  latest_json_updated: boolean;
}

/**
 * Create a new sandbox run directory.
 * All writes are restricted to reports/sandbox/daily-digest/
 */
export function createSandboxRun(): CreateSandboxResult {
  const result: CreateSandboxResult = {
    success: false,
    run_id: null,
    sandbox_path: null,
    error: null,
    created_dirs: [],
    manifest_written: false,
    latest_json_updated: false,
  };

  try {
    // Ensure sandbox root exists
    if (!fs.existsSync(SANDBOX_ROOT)) {
      fs.mkdirSync(SANDBOX_ROOT, { recursive: true });
    }

    // Generate run_id with timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:T]/g, "-").split(".")[0];
    const runId = `sandbox-${timestamp}`;
    const runPath = path.join(SANDBOX_ROOT, runId);

    // Create subdirectories
    const dirs = ["inputs", "outputs", "reports", "diffs", "logs"];
    for (const dir of dirs) {
      const dirPath = path.join(runPath, dir);
      fs.mkdirSync(dirPath, { recursive: true });
      result.created_dirs.push(dirPath);
    }

    // Build manifest
    const run: SandboxRun = {
      run_id: runId,
      created_at: now.toISOString(),
      mode: "sandbox_directory_only",
      real_digest_build: false,
      collect_allowed: false,
      telegram_send_allowed: false,
      production_write_allowed: false,
      protected_paths: [
        "reports/daily-digest.md",
        "reports/telegram-digest.txt",
        "dashboard/status.json",
        "reports/daily/",
      ],
      sandbox_root: runPath,
      next_allowed_stage: "sandbox_build_readiness",
      inputs_dir: path.join(runPath, "inputs"),
      outputs_dir: path.join(runPath, "outputs"),
      reports_dir: path.join(runPath, "reports"),
      diffs_dir: path.join(runPath, "diffs"),
      logs_dir: path.join(runPath, "logs"),
    };

    // Write manifest
    const manifestPath = path.join(runPath, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(run, null, 2), "utf-8");
    result.manifest_written = true;

    // Write latest.json
    const latest = {
      latest_run_id: runId,
      latest_run_path: runPath,
      updated_at: now.toISOString(),
      total_runs: countExistingRuns(),
    };
    fs.writeFileSync(LATEST_JSON, JSON.stringify(latest, null, 2), "utf-8");
    result.latest_json_updated = true;

    result.success = true;
    result.run_id = runId;
    result.sandbox_path = runPath;

    return result;
  } catch (err: any) {
    result.error = err.message || "unknown";
    return result;
  }
}

/**
 * Read sandbox status (latest.json + recent manifests)
 */
export function readSandboxStatus(): {
  latest: any | null;
  recent_runs: any[];
  total_runs: number;
  sandbox_root: string;
} {
  let latest = null;
  const recentRuns: any[] = [];

  if (fs.existsSync(LATEST_JSON)) {
    try {
      latest = JSON.parse(fs.readFileSync(LATEST_JSON, "utf-8"));
    } catch {
      latest = null;
    }
  }

  if (fs.existsSync(SANDBOX_ROOT)) {
    const entries = fs.readdirSync(SANDBOX_ROOT, { withFileTypes: true });
    const runDirs = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("sandbox-"))
      .map((e) => e.name)
      .sort()
      .reverse()
      .slice(0, 5);

    for (const dir of runDirs) {
      const manifestPath = path.join(SANDBOX_ROOT, dir, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          recentRuns.push(manifest);
        } catch {
          // skip corrupt manifest
        }
      }
    }
  }

  return {
    latest,
    recent_runs: recentRuns,
    total_runs: countExistingRuns(),
    sandbox_root: SANDBOX_ROOT,
  };
}

function countExistingRuns(): number {
  if (!fs.existsSync(SANDBOX_ROOT)) return 0;
  const entries = fs.readdirSync(SANDBOX_ROOT, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && e.name.startsWith("sandbox-")).length;
}

// CLI entry point
if (require.main === module) {
  const command = process.argv[2];
  if (command === "create") {
    const result = createSandboxRun();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  } else if (command === "status") {
    const status = readSandboxStatus();
    console.log(JSON.stringify(status, null, 2));
    process.exit(0);
  } else {
    console.error("Usage: tsx daily-digest-sandbox-manager.ts [create|status]");
    process.exit(1);
  }
}
