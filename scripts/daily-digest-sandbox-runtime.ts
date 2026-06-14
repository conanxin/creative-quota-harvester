#!/usr/bin/env tsx
/**
 * scripts/daily-digest-sandbox-runtime.ts
 * Phase 5C-2C-C5D: Sandbox runtime config resolver — parse, validate, resolve paths
 *
 * No execution. No builder call. No file write. No child_process. No network. No env read.
 * Reusable by builder scripts to sandbox their own execution context.
 */

import * as path from "path";
import {
  parseSandboxArgs,
  buildSandboxRuntimeConfig,
  validateSandboxFlags,
  assertSandboxOutputPath,
  assertNotProductionPath,
  SandboxArgs,
  SandboxRuntimeConfig,
  PRODUCTION_PATHS,
} from "./daily-digest-sandbox-guards";

export interface ResolvedSandboxPaths {
  /** Resolved absolute or relative output directory for sandbox mode */
  outputDir: string | null;
  /** Where the sandbox digest markdown should go (only in sandbox mode) */
  sandboxDigestMd: string | null;
  /** Where the sandbox telegram text should go (only in sandbox mode) */
  sandboxDigestTelegram: string | null;
  /** Where the sandbox status json should go (only in sandbox mode) */
  sandboxStatusJson: string | null;
  /** The run_id derived from outputDir, or null */
  runId: string | null;
}

const HARVESTER_DIR = path.resolve(__dirname, "..");

/**
 * Resolve output paths based on sandbox config.
 * In sandbox mode: all outputs go to outputDir.
 * In production mode: returns null for sandbox paths (callers use their own defaults).
 */
export function resolveSandboxPaths(
  config: SandboxRuntimeConfig
): ResolvedSandboxPaths {
  if (!config.sandboxMode || !config.outputDir) {
    return {
      outputDir: null,
      sandboxDigestMd: null,
      sandboxDigestTelegram: null,
      sandboxStatusJson: null,
      runId: null,
    };
  }

  const outputDir = path.resolve(HARVESTER_DIR, config.outputDir);

  // Validate it is within allowed sandbox area
  assertSandboxOutputPath(outputDir);

  // Derive run_id from the directory name (e.g. reports/sandbox/daily-digest/sandbox-20260614_134500/outputs/)
  const runId = path.basename(path.dirname(outputDir)) || null;

  return {
    outputDir,
    sandboxDigestMd: path.join(outputDir, "daily-digest.md"),
    sandboxDigestTelegram: path.join(outputDir, "telegram-digest.txt"),
    sandboxStatusJson: path.join(outputDir, "status.json"),
    runId,
  };
}

/**
 * Build a complete sandbox runtime from CLI argv.
 * Returns { config, resolved, validation } for easy destructuring.
 */
export function buildSandboxRuntime(
  argv: string[] = process.argv.slice(2)
): {
  config: SandboxRuntimeConfig;
  resolved: ResolvedSandboxPaths;
  validation: { valid: boolean; missing: string[] };
} {
  const args = parseSandboxArgs(argv);
  const config = buildSandboxRuntimeConfig(args);
  const validation = validateSandboxFlags(args);
  const resolved = resolveSandboxPaths(config);
  return { config, resolved, validation };
}

/**
 * Production path resolver — returns the standard production paths.
 * Builder scripts can fall back to these when not in sandbox mode.
 */
export function getProductionPaths(): {
  digestMd: string;
  digestTelegram: string;
  statusJson: string;
  dailyReportsDir: string;
} {
  return {
    digestMd: path.join(HARVESTER_DIR, "reports/daily-digest.md"),
    digestTelegram: path.join(HARVESTER_DIR, "reports/telegram-digest.txt"),
    statusJson: path.join(HARVESTER_DIR, "dashboard/status.json"),
    dailyReportsDir: path.join(HARVESTER_DIR, "reports/daily/"),
  };
}

/**
 * Unified path resolver used by builders.
 * Returns the appropriate paths for the current mode (sandbox vs production).
 * Also returns flags for side-effect controls.
 */
export function resolveBuilderPaths(
  config: SandboxRuntimeConfig
): {
  digestMd: string;
  digestTelegram: string;
  statusJson: string;
  dailyReportsDir: string;
  sandboxMode: boolean;
  collectAllowed: boolean;
  sendAllowed: boolean;
  timerAllowed: boolean;
  productionWriteAllowed: boolean;
  runId: string | null;
} {
  const prod = getProductionPaths();
  const resolved = resolveSandboxPaths(config);

  if (config.sandboxMode && resolved.outputDir) {
    // In sandbox mode: resolve all paths to outputDir, validate no production leakage
    assertNotProductionPath(resolved.sandboxDigestMd!);
    assertNotProductionPath(resolved.sandboxDigestTelegram!);
    assertNotProductionPath(resolved.sandboxStatusJson!);

    return {
      digestMd: resolved.sandboxDigestMd!,
      digestTelegram: resolved.sandboxDigestTelegram!,
      statusJson: resolved.sandboxStatusJson!,
      dailyReportsDir: path.join(resolved.outputDir!, "daily/"),
      sandboxMode: true,
      collectAllowed: false, // always false in sandbox
      sendAllowed: false, // always false in sandbox
      timerAllowed: false, // always false in sandbox
      productionWriteAllowed: false, // always false in sandbox
      runId: resolved.runId,
    };
  }

  // Production mode: return standard paths
  return {
    digestMd: prod.digestMd,
    digestTelegram: prod.digestTelegram,
    statusJson: prod.statusJson,
    dailyReportsDir: prod.dailyReportsDir,
    sandboxMode: false,
    collectAllowed: config.collectAllowed,
    sendAllowed: config.sendAllowed,
    timerAllowed: config.timerAllowed,
    productionWriteAllowed: config.productionWriteAllowed,
    runId: null,
  };
}

// If run directly, print a diagnostic notice (no execution, no file writes)
if (require.main === module) {
  const { config, resolved, validation } = buildSandboxRuntime();
  console.log("=== Daily Digest Sandbox Runtime Config ===");
  console.log("sandboxMode:", config.sandboxMode);
  console.log("outputDir:", config.outputDir);
  console.log("collectAllowed:", config.collectAllowed);
  console.log("sendAllowed:", config.sendAllowed);
  console.log("timerAllowed:", config.timerAllowed);
  console.log("productionWriteAllowed:", config.productionWriteAllowed);
  console.log("allGuardsActive:", config.allGuardsActive);
  console.log("");
  console.log("Resolved paths:", resolved);
  console.log("");
  console.log("Validation:", validation);
  console.log("");
  console.log("Production paths:", getProductionPaths());
  console.log("");
  console.log("No builder executed. No file written. No side effects.");
}
