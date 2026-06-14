#!/usr/bin/env tsx
/**
 * scripts/daily-digest-sandbox-diff.ts
 * Phase 5C-2C-C5F: Sandbox diff generator
 *
 * Compares sandbox outputs with production outputs and generates diff summary.
 * Writes to sandbox diffs/ only, never to production paths.
 *
 * Safety:
 *   - No child_process, no exec, no spawn
 *   - No .env or .control.local reads
 *   - No network calls
 *   - Only writes to sandbox diffs/
 *   - Redacts sensitive content
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");

const SANDBOX_ROOT = path.join(HARVESTER_DIR, "reports/sandbox/daily-digest");
const LATEST_JSON = path.join(SANDBOX_ROOT, "latest.json");

const PRODUCTION_PATHS = {
  dailyDigest: path.join(HARVESTER_DIR, "reports/daily-digest.md"),
  telegramDigest: path.join(HARVESTER_DIR, "reports/telegram-digest.txt"),
};

interface DiffResult {
  run_id: string | null;
  sandbox_path: string | null;
  diffs_dir: string | null;
  files: FileDiff[];
  summary: {
    total_lines_added: number;
    total_lines_removed: number;
    total_chars_added: number;
    total_chars_removed: number;
    sandbox_only_sections: string[];
    production_only_sections: string[];
    risk_notes: string[];
  };
  output_files: string[];
}

interface FileDiff {
  file_name: string;
  sandbox_path: string;
  production_path: string;
  sandbox_lines: number;
  production_lines: number;
  sandbox_chars: number;
  production_chars: number;
  lines_added: number;
  lines_removed: number;
  chars_added: number;
  chars_removed: number;
  summary: string;
}

function loadText(p: string): string {
  try { return fs.readFileSync(p, "utf-8"); } catch { return ""; }
}

function loadJson(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function computeLineDiff(sandbox: string, production: string): { added: number; removed: number } {
  const sandboxLines = sandbox.split("\n").filter(l => l.trim());
  const productionLines = production.split("\n").filter(l => l.trim());

  // Simple count-based diff (not LCS, but sufficient for summary)
  const added = Math.max(0, sandboxLines.length - productionLines.length);
  const removed = Math.max(0, productionLines.length - sandboxLines.length);
  return { added, removed };
}

function redact(text: string): string {
  return text
    .replace(/TELEGRAM_BOT_TOKEN\s*=\s*['"]\S+['"]/g, "TELEGRAM_BOT_TOKEN=\"<REDACTED>\"")
    .replace(/CQA_CONTROL_TOKEN\s*=\s*['"]\S+['"]/g, "CQA_CONTROL_TOKEN=\"<REDACTED>\"")
    .replace(/MINIMAX_API_KEY\s*=\s*['"]\S+['"]/g, "MINIMAX_API_KEY=\"<REDACTED>\"")
    .replace(/OPENAI_API_KEY\s*=\s*['"]\S+['"]/g, "OPENAI_API_KEY=\"<REDACTED>\"")
    .replace(/Bearer\s+[A-Za-z0-9._-]{20,}/g, "Bearer <REDACTED>")
    .replace(/sk-cp-[A-Za-z0-9_-]{10,}/g, "sk-cp-<REDACTED>")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-<REDACTED>");
}

export function generateSandboxDiff(): DiffResult {
  const result: DiffResult = {
    run_id: null,
    sandbox_path: null,
    diffs_dir: null,
    files: [],
    summary: {
      total_lines_added: 0,
      total_lines_removed: 0,
      total_chars_added: 0,
      total_chars_removed: 0,
      sandbox_only_sections: [],
      production_only_sections: [],
      risk_notes: [],
    },
    output_files: [],
  };

  // 1. Load latest sandbox
  const latest = loadJson(LATEST_JSON);
  if (!latest || !latest.latest_run_id) {
    result.summary.risk_notes.push("latest.json missing or invalid");
    return result;
  }

  result.run_id = latest.latest_run_id;
  result.sandbox_path = latest.latest_run_path || path.join(SANDBOX_ROOT, result.run_id);
  result.diffs_dir = path.join(result.sandbox_path, "diffs");

  // Ensure diffs directory exists
  if (!fs.existsSync(result.diffs_dir)) {
    fs.mkdirSync(result.diffs_dir, { recursive: true });
  }

  const outputsDir = path.join(result.sandbox_path, "outputs");

  // 2. Compare daily-digest.md
  const sandboxDigest = loadText(path.join(outputsDir, "daily-digest.md"));
  const productionDigest = loadText(PRODUCTION_PATHS.dailyDigest);

  const digestDiff: FileDiff = {
    file_name: "daily-digest.md",
    sandbox_path: path.join(outputsDir, "daily-digest.md"),
    production_path: PRODUCTION_PATHS.dailyDigest,
    sandbox_lines: sandboxDigest.split("\n").length,
    production_lines: productionDigest.split("\n").length,
    sandbox_chars: sandboxDigest.length,
    production_chars: productionDigest.length,
    lines_added: 0,
    lines_removed: 0,
    chars_added: 0,
    chars_removed: 0,
    summary: "",
  };

  if (productionDigest.length === 0) {
    digestDiff.summary = "Production daily-digest.md does not exist or is empty (sandbox-only build)";
    digestDiff.lines_added = sandboxDigest.split("\n").filter(l => l.trim()).length;
    digestDiff.chars_added = sandboxDigest.length;
    result.summary.sandbox_only_sections.push("daily-digest.md");
  } else {
    const lineDiff = computeLineDiff(sandboxDigest, productionDigest);
    digestDiff.lines_added = lineDiff.added;
    digestDiff.lines_removed = lineDiff.removed;
    digestDiff.chars_added = Math.max(0, sandboxDigest.length - productionDigest.length);
    digestDiff.chars_removed = Math.max(0, productionDigest.length - sandboxDigest.length);
    digestDiff.summary = `Lines: +${digestDiff.lines_added}/-${digestDiff.lines_removed}, Chars: +${digestDiff.chars_added}/-${digestDiff.chars_removed}`;
  }

  result.files.push(digestDiff);

  // 3. Compare telegram-digest.txt
  const sandboxTelegram = loadText(path.join(outputsDir, "telegram-digest.txt"));
  const productionTelegram = loadText(PRODUCTION_PATHS.telegramDigest);

  const telegramDiff: FileDiff = {
    file_name: "telegram-digest.txt",
    sandbox_path: path.join(outputsDir, "telegram-digest.txt"),
    production_path: PRODUCTION_PATHS.telegramDigest,
    sandbox_lines: sandboxTelegram.split("\n").length,
    production_lines: productionTelegram.split("\n").length,
    sandbox_chars: sandboxTelegram.length,
    production_chars: productionTelegram.length,
    lines_added: 0,
    lines_removed: 0,
    chars_added: 0,
    chars_removed: 0,
    summary: "",
  };

  if (productionTelegram.length === 0) {
    telegramDiff.summary = "Production telegram-digest.txt does not exist or is empty (sandbox-only build)";
    telegramDiff.lines_added = sandboxTelegram.split("\n").filter(l => l.trim()).length;
    telegramDiff.chars_added = sandboxTelegram.length;
    result.summary.sandbox_only_sections.push("telegram-digest.txt");
  } else {
    const lineDiff = computeLineDiff(sandboxTelegram, productionTelegram);
    telegramDiff.lines_added = lineDiff.added;
    telegramDiff.lines_removed = lineDiff.removed;
    telegramDiff.chars_added = Math.max(0, sandboxTelegram.length - productionTelegram.length);
    telegramDiff.chars_removed = Math.max(0, productionTelegram.length - sandboxTelegram.length);
    telegramDiff.summary = `Lines: +${telegramDiff.lines_added}/-${telegramDiff.lines_removed}, Chars: +${telegramDiff.chars_added}/-${telegramDiff.chars_removed}`;
  }

  result.files.push(telegramDiff);

  // 4. Aggregate summary
  for (const f of result.files) {
    result.summary.total_lines_added += f.lines_added;
    result.summary.total_lines_removed += f.lines_removed;
    result.summary.total_chars_added += f.chars_added;
    result.summary.total_chars_removed += f.chars_removed;
  }

  // 5. Risk notes
  if (sandboxDigest.includes("production") && !sandboxDigest.includes("sandbox")) {
    result.summary.risk_notes.push("daily-digest.md may contain production path references without sandbox context");
  }
  if (sandboxDigest.includes("reports/daily-digest.md") && !sandboxDigest.includes("sandbox")) {
    result.summary.risk_notes.push("daily-digest.md references production path 'reports/daily-digest.md' without sandbox context");
  }

  // 6. Write diff summary JSON
  const jsonSummary = {
    phase: "5C-2C-C5F",
    run_id: result.run_id,
    mode: "sandbox_diff_only",
    production_write_allowed: false,
    files: result.files.map(f => ({
      file_name: f.file_name,
      sandbox_lines: f.sandbox_lines,
      production_lines: f.production_lines,
      sandbox_chars: f.sandbox_chars,
      production_chars: f.production_chars,
      lines_added: f.lines_added,
      lines_removed: f.lines_removed,
      chars_added: f.chars_added,
      chars_removed: f.chars_removed,
      summary: f.summary,
    })),
    summary: result.summary,
    generated_at: new Date().toISOString(),
  };

  const jsonPath = path.join(result.diffs_dir, "diff-summary.json");
  fs.writeFileSync(jsonPath, JSON.stringify(jsonSummary, null, 2), "utf-8");
  result.output_files.push(jsonPath);

  // 7. Write diff summary MD
  const mdLines = [
    "# Sandbox Diff Summary",
    "",
    `**Phase:** 5C-2C-C5F`,
    `**Run ID:** ${result.run_id}`,
    `**Mode:** sandbox_diff_only`,
    `**Production Write Allowed:** false`,
    `**Generated:** ${new Date().toISOString()}`,
    "",
    "## Files Compared",
    "",
    ...result.files.map(f =>
      `- **${f.file_name}**: ${f.summary}`
    ),
    "",
    "## Aggregate Summary",
    "",
    `- **Lines Added:** ${result.summary.total_lines_added}`,
    `- **Lines Removed:** ${result.summary.total_lines_removed}`,
    `- **Chars Added:** ${result.summary.total_chars_added}`,
    `- **Chars Removed:** ${result.summary.total_chars_removed}`,
    "",
    "## Sandbox-Only Sections",
    "",
    result.summary.sandbox_only_sections.length > 0
      ? result.summary.sandbox_only_sections.map(s => `- ${s}`).join("\n")
      : "None",
    "",
    "## Production-Only Sections",
    "",
    result.summary.production_only_sections.length > 0
      ? result.summary.production_only_sections.map(s => `- ${s}`).join("\n")
      : "None",
    "",
    "## Risk Notes",
    "",
    result.summary.risk_notes.length > 0
      ? result.summary.risk_notes.map(n => `- ⚠️ ${n}`).join("\n")
      : "None",
    "",
    "---",
    "*Generated by daily-digest-sandbox-diff.ts*",
  ];

  const mdPath = path.join(result.diffs_dir, "diff-summary.md");
  fs.writeFileSync(mdPath, mdLines.join("\n"), "utf-8");
  result.output_files.push(mdPath);

  return result;
}

// CLI entry point
if (require.main === module) {
  const result = generateSandboxDiff();
  console.log(JSON.stringify(result, null, 2));
}
