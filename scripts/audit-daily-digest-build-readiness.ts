#!/usr/bin/env tsx
/**
 * scripts/audit-daily-digest-build-readiness.ts
 * Phase 5C-2C-C5B: Read-only readiness audit for daily digest sandbox build
 *
 * Scans codebase without executing builders, without calling models,
 * without network, without child_process, without .env reading.
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");

interface BuilderInfo {
  file: string;
  type: string;
  writes_production_paths: boolean;
  has_output_dir_param: boolean;
  has_sandbox_mode: boolean;
  collects_data: boolean;
  sends_telegram: boolean;
  calls_model: boolean;
  generates_media: boolean;
  modifies_timer: boolean;
  hardcoded_production_paths: string[];
  detected_keywords: string[];
}

interface ReadinessReport {
  phase: string;
  mode: string;
  ready_for_sandbox_build: "yes" | "no" | "partial";
  builders_detected: BuilderInfo[];
  production_write_paths: string[];
  sandbox_support: {
    supports_output_dir: boolean;
    supports_sandbox_mode: boolean;
    has_hardcoded_production_paths: boolean;
  };
  blocked_risks: {
    collect: boolean;
    telegram_send: boolean;
    timer: boolean;
    model_call: boolean;
    media_generation: boolean;
    production_write: boolean;
  };
  required_refactors_before_sandbox_execution: string[];
  safe_next_step: string;
  audit_timestamp: string;
  files_scanned: number;
}

const PRODUCTION_PATHS = [
  "reports/daily-digest.md",
  "reports/telegram-digest.txt",
  "dashboard/status.json",
  "reports/daily/",
];

const KEYWORDS = {
  daily_digest: ["daily-digest", "dailyDigest", "daily_digest"],
  telegram_digest: ["telegram-digest", "telegramDigest", "telegram_digest"],
  dashboard_status: ["dashboard/status.json", "dashboardStatus", "status.json"],
  collect: ["collect", "CQA_PROFILE", "collect-fresh"],
  send: ["CQA_ALLOW_TELEGRAM_SEND", "send-telegram", "telegram-send"],
  timer: ["timer", "systemd", "cron"],
  model: ["minimax", "openai", "completion", "generate"],
  media: ["generate-image", "generate-video", "generate-music"],
  output_dir: ["output-dir", "outputDir", "OUTPUT_DIR"],
  sandbox: ["sandbox", "SANDBOX"],
  write: ["writeFile", "mkdirSync"],
};

function scanFile(filePath: string): BuilderInfo | null {
  const content = fs.readFileSync(filePath, "utf-8");
  const basename = path.basename(filePath);
  
  // Skip non-relevant files
  if (!/\.(ts|js|json)$/.test(filePath)) return null;
  if (basename.includes("test") || basename.includes("spec")) return null;
  if (basename.includes("audit") || basename.includes("validate")) return null;
  if (basename.includes("control-server")) return null;

  // Check if file is relevant to daily digest/build
  const isRelevant = 
    Object.values(KEYWORDS).flat().some(k => content.includes(k)) ||
    basename.includes("daily") ||
    basename.includes("digest") ||
    basename.includes("dashboard") ||
    basename.includes("archive") ||
    basename.includes("report");

  if (!isRelevant) return null;

  const info: BuilderInfo = {
    file: path.relative(HARVESTER_DIR, filePath),
    type: basename.endsWith(".json") ? "config" : "script",
    writes_production_paths: false,
    has_output_dir_param: false,
    has_sandbox_mode: false,
    collects_data: false,
    sends_telegram: false,
    calls_model: false,
    generates_media: false,
    modifies_timer: false,
    hardcoded_production_paths: [],
    detected_keywords: [],
  };

  // Check production path writes
  for (const prodPath of PRODUCTION_PATHS) {
    if (content.includes(prodPath)) {
      info.hardcoded_production_paths.push(prodPath);
      // Check if it's a write operation
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.includes(prodPath) && (line.includes("writeFile") || line.includes("mkdirSync") || line.includes("fs.write"))) {
          info.writes_production_paths = true;
        }
      }
    }
  }

  // Check keywords
  for (const [category, words] of Object.entries(KEYWORDS)) {
    for (const word of words) {
      if (content.includes(word)) {
        info.detected_keywords.push(word);
        if (category === "collect") info.collects_data = true;
        if (category === "send") info.sends_telegram = true;
        if (category === "timer") info.modifies_timer = true;
        if (category === "model") info.calls_model = true;
        if (category === "media") info.generates_media = true;
        if (category === "output_dir") info.has_output_dir_param = true;
        if (category === "sandbox") info.has_sandbox_mode = true;
      }
    }
  }

  // Deduplicate keywords
  info.detected_keywords = [...new Set(info.detected_keywords)];
  info.hardcoded_production_paths = [...new Set(info.hardcoded_production_paths)];

  return info;
}

function main() {
  const report: ReadinessReport = {
    phase: "5C-2C-C5B",
    mode: "readiness_check_only",
    ready_for_sandbox_build: "no",
    builders_detected: [],
    production_write_paths: [],
    sandbox_support: {
      supports_output_dir: false,
      supports_sandbox_mode: false,
      has_hardcoded_production_paths: true,
    },
    blocked_risks: {
      collect: false,
      telegram_send: false,
      timer: false,
      model_call: false,
      media_generation: false,
      production_write: false,
    },
    required_refactors_before_sandbox_execution: [],
    safe_next_step: "",
    audit_timestamp: new Date().toISOString(),
    files_scanned: 0,
  };

  // Scan directories
  const dirsToScan = ["scripts", "src", "dashboard"];
  const filesScanned: string[] = [];

  for (const dir of dirsToScan) {
    const fullDir = path.join(HARVESTER_DIR, dir);
    if (!fs.existsSync(fullDir)) continue;

    const entries = fs.readdirSync(fullDir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      // readdirSync with recursive returns entries where parentPath is absolute
      const filePath = path.join(entry.parentPath || fullDir, entry.name);
      if (!/\.(ts|js|json)$/.test(filePath)) continue;
      filesScanned.push(filePath);
    }
  }

  // Also scan package.json
  filesScanned.push(path.join(HARVESTER_DIR, "package.json"));

  report.files_scanned = filesScanned.length;

  for (const filePath of filesScanned) {
    const info = scanFile(filePath);
    if (info) {
      report.builders_detected.push(info);
    }
  }

  // Aggregate findings
  const allProductionPaths = new Set<string>();
  let hasOutputDir = false;
  let hasSandboxMode = false;
  let hasHardcodedProductionPaths = false;

  for (const builder of report.builders_detected) {
    if (builder.writes_production_paths) {
      report.blocked_risks.production_write = true;
      hasHardcodedProductionPaths = true;
    }
    if (builder.hardcoded_production_paths.length > 0) {
      hasHardcodedProductionPaths = true;
      for (const p of builder.hardcoded_production_paths) {
        allProductionPaths.add(p);
      }
    }
    if (builder.has_output_dir_param) hasOutputDir = true;
    if (builder.has_sandbox_mode) hasSandboxMode = true;
    if (builder.collects_data) report.blocked_risks.collect = true;
    if (builder.sends_telegram) report.blocked_risks.telegram_send = true;
    if (builder.modifies_timer) report.blocked_risks.timer = true;
    if (builder.calls_model) report.blocked_risks.model_call = true;
    if (builder.generates_media) report.blocked_risks.media_generation = true;
  }

  report.production_write_paths = Array.from(allProductionPaths);
  report.sandbox_support.supports_output_dir = hasOutputDir;
  report.sandbox_support.supports_sandbox_mode = hasSandboxMode;
  report.sandbox_support.has_hardcoded_production_paths = hasHardcodedProductionPaths;

  // Determine readiness
  if (report.blocked_risks.production_write || report.blocked_risks.collect || 
      report.blocked_risks.telegram_send || report.blocked_risks.timer) {
    report.ready_for_sandbox_build = "partial";
  }

  if (hasHardcodedProductionPaths && !hasOutputDir && !hasSandboxMode) {
    report.ready_for_sandbox_build = "no";
  }

  if (!hasHardcodedProductionPaths && hasOutputDir) {
    report.ready_for_sandbox_build = "yes";
  }

  // Required refactors
  if (hasHardcodedProductionPaths) {
    report.required_refactors_before_sandbox_execution.push(
      "Refactor builders to accept --output-dir parameter instead of hardcoded production paths"
    );
  }
  if (!hasOutputDir) {
    report.required_refactors_before_sandbox_execution.push(
      "Add --output-dir / sandbox_root parameter to all builders"
    );
  }
  if (!hasSandboxMode) {
    report.required_refactors_before_sandbox_execution.push(
      "Add sandbox_mode flag to builders to restrict writes to sandbox directory"
    );
  }
  if (report.blocked_risks.collect) {
    report.required_refactors_before_sandbox_execution.push(
      "Ensure collect is disabled in sandbox mode (collect_allowed=false)"
    );
  }
  if (report.blocked_risks.telegram_send) {
    report.required_refactors_before_sandbox_execution.push(
      "Ensure Telegram send is disabled in sandbox mode (telegram_send_allowed=false)"
    );
  }
  if (report.blocked_risks.timer) {
    report.required_refactors_before_sandbox_execution.push(
      "Ensure timer modification is disabled in sandbox mode"
    );
  }

  // Safe next step
  if (report.ready_for_sandbox_build === "no") {
    report.safe_next_step = "Refactor builders to support --output-dir and sandbox mode before attempting sandbox build";
  } else if (report.ready_for_sandbox_build === "partial") {
    report.safe_next_step = "Complete required refactors (output-dir param, sandbox mode flag) then re-run readiness audit";
  } else {
    report.safe_next_step = "Builders are ready for sandbox execution. Proceed to C5C: Sandbox Digest Build (Read-only Plan)";
  }

  // Write report
  const outputDir = path.join(HARVESTER_DIR, "dashboard");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, "daily-digest-build-readiness.json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8");

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nReadiness report written to: ${outputPath}`);
  console.log(`Ready for sandbox build: ${report.ready_for_sandbox_build}`);
  console.log(`Blocked risks: ${JSON.stringify(report.blocked_risks)}`);
  console.log(`Required refactors: ${report.required_refactors_before_sandbox_execution.length}`);
}

main();
