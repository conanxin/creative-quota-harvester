#!/usr/bin/env tsx
/**
 * scripts/daily-digest-sandbox-build-pilot.ts
 * Phase 5C-2C-C5E: Pilot Sandbox Digest Build Execution
 *
 * Executes pilot builder (telegram-daily-digest.ts) in sandbox mode only.
 * Creates a sandbox run, records protected path hashes, executes builder,
 * verifies no production writes, and writes build summary.
 *
 * Safety:
 *   - Only writes to reports/sandbox/daily-digest/<run_id>/
 *   - Protected paths checked before/after execution
 *   - No model calls, no media generation, no collect, no send, no timer
 *   - spawn() with shell=false, fixed args only
 *   - No .env / .control.local reads
 *   - No exec, no shell=true, no shell string construction
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { createSandboxRun } from "./daily-digest-sandbox-manager";

const HARVESTER_DIR = path.resolve(__dirname, "..");

const PROTECTED_PATHS = [
  path.join(HARVESTER_DIR, "reports/daily-digest.md"),
  path.join(HARVESTER_DIR, "reports/telegram-digest.txt"),
  path.join(HARVESTER_DIR, "dashboard/status.json"),
  path.join(HARVESTER_DIR, "reports/daily/"),
];

const MAX_RUNTIME_MS = 60000;
const MAX_OUTPUT_CHARS = 12000;

interface PathHash {
  file: string;
  exists: boolean;
  mtime: number;
  size: number;
  hash: string | null;
}

interface BuildResult {
  success: boolean;
  run_id: string | null;
  sandbox_path: string | null;
  outputs_dir: string | null;
  exit_code: number | null;
  timed_out: boolean;
  duration_ms: number;
  stdout_tail: string;
  stderr_tail: string;
  protected_paths_before: PathHash[];
  protected_paths_after: PathHash[];
  protected_paths_changed: boolean;
  changed_files: string[];
  output_files: string[];
  error: string | null;
  build_summary_path: string | null;
  log_path: string | null;
}

function computeFileHash(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(filePath);
      return crypto.createHash("sha256").update(entries.join("\n")).digest("hex");
    }
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch {
    return null;
  }
}

function getPathHash(filePath: string): PathHash {
  const exists = fs.existsSync(filePath);
  let mtime = 0;
  let size = 0;
  if (exists) {
    try {
      const stat = fs.statSync(filePath);
      mtime = stat.mtimeMs;
      size = stat.size;
    } catch {}
  }
  return {
    file: filePath,
    exists,
    mtime,
    size,
    hash: computeFileHash(filePath),
  };
}

function hashPaths(paths: string[]): PathHash[] {
  return paths.map(getPathHash);
}

function comparePathHashes(
  before: PathHash[],
  after: PathHash[]
): { changed: boolean; changedFiles: string[] } {
  const changedFiles: string[] = [];
  for (let i = 0; i < before.length; i++) {
    const b = before[i];
    const a = after[i];
    if (b.exists !== a.exists || b.mtime !== a.mtime || b.size !== a.size || b.hash !== a.hash) {
      changedFiles.push(b.file);
    }
  }
  return { changed: changedFiles.length > 0, changedFiles };
}

function truncateOutput(output: string, maxChars: number): string {
  if (output.length <= maxChars) return output;
  const half = Math.floor(maxChars / 2);
  return (
    output.slice(0, half) +
    "\n... [truncated: " +
    (output.length - maxChars) +
    " chars omitted] ...\n" +
    output.slice(-half)
  );
}

function redactOutput(output: string): string {
  // Telegram tokens
  output = output.replace(/[0-9]{8,12}:[A-Za-z0-9_-]{25,}/g, "<REDACTED_TELEGRAM_TOKEN>");
  // API keys
  output = output.replace(/sk-[A-Za-z0-9_-]{20,}/g, "<REDACTED_API_KEY>");
  // Bearer tokens
  output = output.replace(/(authorization:\s*bearer\s+)[A-Za-z0-9._-]+/gi, "$1<REDACTED>");
  return output;
}

function listOutputFiles(outputsDir: string): string[] {
  if (!fs.existsSync(outputsDir)) return [];
  try {
    return fs.readdirSync(outputsDir).map((f) => path.join(outputsDir, f));
  } catch {
    return [];
  }
}

export async function runSandboxBuildPilot(): Promise<BuildResult> {
  const result: BuildResult = {
    success: false,
    run_id: null,
    sandbox_path: null,
    outputs_dir: null,
    exit_code: null,
    timed_out: false,
    duration_ms: 0,
    stdout_tail: "",
    stderr_tail: "",
    protected_paths_before: [],
    protected_paths_after: [],
    protected_paths_changed: false,
    changed_files: [],
    output_files: [],
    error: null,
    build_summary_path: null,
    log_path: null,
  };

  // 1. Create sandbox run
  const sandboxResult = createSandboxRun();
  if (!sandboxResult.success || !sandboxResult.run_id) {
    result.error = sandboxResult.error || "sandbox_creation_failed";
    return result;
  }

  result.run_id = sandboxResult.run_id;
  result.sandbox_path = sandboxResult.sandbox_path;
  result.outputs_dir = sandboxResult.sandbox_path
    ? path.join(sandboxResult.sandbox_path, "outputs")
    : null;

  // 2. Record protected path hashes before execution
  result.protected_paths_before = hashPaths(PROTECTED_PATHS);

  // 3. Execute pilot builder with sandbox flags
  const builderPath = path.join(HARVESTER_DIR, "src/reports/telegram-daily-digest.ts");
  const outputDirArg = result.outputs_dir
    ? path.relative(HARVESTER_DIR, result.outputs_dir)
    : "";

  const args = [
    builderPath,
    "--sandbox",
    "--output-dir",
    outputDirArg,
    "--no-collect",
    "--no-send",
    "--no-timer",
    "--no-production-write",
  ];

  const startTime = Date.now();
  let stdout = "";
  let stderr = "";

  try {
    const child = spawn("npx", ["tsx", ...args], {
      cwd: HARVESTER_DIR,
      shell: false,
      env: { ...process.env, CQA_ALLOW_TELEGRAM_SEND: "0", CQA_ALLOW_GENERATION: "0" },
      timeout: MAX_RUNTIME_MS,
    });

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const exitCode = await new Promise<number>((resolve) => {
      child.on("close", (code) => resolve(code ?? 1));
      child.on("error", () => resolve(1));
    });

    result.duration_ms = Date.now() - startTime;
    result.exit_code = exitCode;
    result.timed_out = result.duration_ms >= MAX_RUNTIME_MS;
  } catch (err: any) {
    result.error = err.message || "spawn_error";
    result.duration_ms = Date.now() - startTime;
    return result;
  }

  // 4. Redact and truncate output
  stdout = redactOutput(stdout);
  stderr = redactOutput(stderr);
  result.stdout_tail = truncateOutput(stdout, MAX_OUTPUT_CHARS);
  result.stderr_tail = truncateOutput(stderr, MAX_OUTPUT_CHARS);

  // 5. Record protected path hashes after execution
  result.protected_paths_after = hashPaths(PROTECTED_PATHS);

  const comparison = comparePathHashes(
    result.protected_paths_before,
    result.protected_paths_after
  );
  result.protected_paths_changed = comparison.changed;
  result.changed_files = comparison.changedFiles;

  if (result.protected_paths_changed) {
    result.error = `PRODUCTION_VIOLATION: Protected paths were modified during sandbox build: ${result.changed_files.join(", ")}`;
    return result;
  }

  // 6. List output files in sandbox outputs dir
  result.output_files = result.outputs_dir ? listOutputFiles(result.outputs_dir) : [];

  // 7. Write build summary to sandbox reports dir
  if (result.sandbox_path) {
    const reportsDir = path.join(result.sandbox_path, "reports");
    const summaryPath = path.join(reportsDir, "build-summary.json");
    const logPath = path.join(result.sandbox_path, "logs", "build.log");

    const summary = {
      phase: "5C-2C-C5E",
      run_id: result.run_id,
      sandbox_path: result.sandbox_path,
      mode: "pilot_sandbox_build",
      real_execution: true,
      production_write_allowed: false,
      production_write_detected: result.protected_paths_changed,
      changed_files: result.changed_files,
      output_files: result.output_files,
      exit_code: result.exit_code,
      timed_out: result.timed_out,
      duration_ms: result.duration_ms,
      protected_paths_before: result.protected_paths_before.map((p) => ({
        file: path.relative(HARVESTER_DIR, p.file),
        exists: p.exists,
        mtime: p.mtime,
        size: p.size,
      })),
      protected_paths_after: result.protected_paths_after.map((p) => ({
        file: path.relative(HARVESTER_DIR, p.file),
        exists: p.exists,
        mtime: p.mtime,
        size: p.size,
      })),
      stdout_length: stdout.length,
      stderr_length: stderr.length,
      build_timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
    fs.writeFileSync(logPath, `STDOUT:\n${result.stdout_tail}\n\nSTDERR:\n${result.stderr_tail}\n`, "utf-8");

    result.build_summary_path = summaryPath;
    result.log_path = logPath;
  }

  result.success = result.exit_code === 0 && !result.protected_paths_changed && !result.timed_out;
  return result;
}

// CLI entry point
if (require.main === module) {
  runSandboxBuildPilot().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
