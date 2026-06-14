#!/usr/bin/env tsx
/**
 * scripts/daily-digest-sandbox-guards.ts
 * Phase 5C-2C-C5C: Pure sandbox guard functions — no execution, no side effects
 */

import * as path from "path";

export const PRODUCTION_PATHS = [
  "reports/daily-digest.md",
  "reports/telegram-digest.txt",
  "dashboard/status.json",
  "reports/daily/",
];

export const SANBOX_ROOT_PATTERN = /^reports\/sandbox\/daily-digest\/sandbox-\d{8}_\d{6}\/outputs\//;

export interface SandboxArgs {
  sandbox: boolean;
  outputDir: string | null;
  noCollect: boolean;
  noSend: boolean;
  noTimer: boolean;
  noProductionWrite: boolean;
}

export interface SandboxRuntimeConfig {
  sandboxMode: boolean;
  outputDir: string | null;
  collectAllowed: boolean;
  sendAllowed: boolean;
  timerAllowed: boolean;
  productionWriteAllowed: boolean;
  allGuardsActive: boolean;
}

/**
 * Check if a path is within the allowed sandbox output directory
 */
export function isSandboxPath(filePath: string): boolean {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  return SANBOX_ROOT_PATTERN.test(normalized) || normalized.includes("reports/sandbox/daily-digest/");
}

/**
 * Assert that a path is a sandbox output path (throws if not)
 */
export function assertSandboxOutputPath(filePath: string): void {
  if (!isSandboxPath(filePath)) {
    throw new Error(`SANDBOX_VIOLATION: Path "${filePath}" is not a sandbox output path. Must be under "reports/sandbox/daily-digest/<run_id>/outputs/"`);
  }
}

/**
 * Assert that a path is NOT a production path (throws if it is)
 */
export function assertNotProductionPath(filePath: string): void {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  for (const prod of PRODUCTION_PATHS) {
    if (normalized.includes(prod) || normalized === prod) {
      throw new Error(`PRODUCTION_VIOLATION: Path "${filePath}" is a protected production path. Writing is blocked in sandbox mode.`);
    }
  }
}

/**
 * Parse CLI args for sandbox flags
 */
export function parseSandboxArgs(argv: string[]): SandboxArgs {
  const args: SandboxArgs = {
    sandbox: false,
    outputDir: null,
    noCollect: false,
    noSend: false,
    noTimer: false,
    noProductionWrite: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--sandbox":
        args.sandbox = true;
        break;
      case "--output-dir":
        args.outputDir = argv[i + 1] || null;
        i++;
        break;
      case "--no-collect":
        args.noCollect = true;
        break;
      case "--no-send":
        args.noSend = true;
        break;
      case "--no-timer":
        args.noTimer = true;
        break;
      case "--no-production-write":
        args.noProductionWrite = true;
        break;
    }
  }

  return args;
}

/**
 * Build sandbox runtime config from parsed args
 */
export function buildSandboxRuntimeConfig(args: SandboxArgs): SandboxRuntimeConfig {
  const allGuardsActive = args.sandbox &&
    args.outputDir !== null &&
    args.noCollect &&
    args.noSend &&
    args.noTimer &&
    args.noProductionWrite;

  return {
    sandboxMode: args.sandbox,
    outputDir: args.outputDir,
    collectAllowed: !args.noCollect,
    sendAllowed: !args.noSend,
    timerAllowed: !args.noTimer,
    productionWriteAllowed: !args.noProductionWrite,
    allGuardsActive,
  };
}

/**
 * Validate that all required sandbox flags are present
 */
export function validateSandboxFlags(args: SandboxArgs): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!args.sandbox) missing.push("--sandbox");
  if (!args.outputDir) missing.push("--output-dir");
  if (!args.noCollect) missing.push("--no-collect");
  if (!args.noSend) missing.push("--no-send");
  if (!args.noTimer) missing.push("--no-timer");
  if (!args.noProductionWrite) missing.push("--no-production-write");

  return { valid: missing.length === 0, missing };
}

// If run directly, print a notice (no execution)
if (require.main === module) {
  console.log("daily-digest-sandbox-guards.ts: Pure helper functions for sandbox validation.");
  console.log("No builder execution. No file writes. No side effects.");
  console.log("Import from builder scripts to use guards.");
}
