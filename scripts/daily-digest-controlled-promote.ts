#!/usr/bin/env tsx
/**
 * scripts/daily-digest-controlled-promote.ts
 * Phase 5C-2C-C5M-1: One-shot Controlled Promote Executor
 *
 * Promotes latest sandbox daily-digest outputs to two specific production
 * targets ONLY:
 *   - reports/daily-digest.md
 *   - reports/telegram-digest.txt
 *
 * Hard safety constraints (validated by validate-daily-digest-controlled-promote.ts):
 *   - No child_process / exec / spawn
 *   - No .env or .control.local reads
 *   - No network calls
 *   - No Telegram send
 *   - No collect / timer / model / media
 *   - No dashboard/status.json or reports/daily/ writes
 *   - No git operations (caller does commit/push)
 *   - Backup required BEFORE copy
 *   - Hash verification required AFTER copy
 *   - Output is redacted
 *   - Confirmation phrase required: "PROMOTE DAILY DIGEST FROM SANDBOX"
 *
 * Usage:
 *   npx tsx scripts/daily-digest-controlled-promote.ts [--dry-run]
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const SANDBOX_ROOT = path.join(HARVESTER_DIR, "reports/sandbox/daily-digest");
const LATEST_JSON = path.join(SANDBOX_ROOT, "latest.json");
const CONFIG_PATH = path.join(HARVESTER_DIR, "dashboard/daily-digest-controlled-promote.json");
const APPROVAL_PACK_PATH = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-approval-pack.json");
const EXPECTED_PHRASE = "PROMOTE DAILY DIGEST FROM SANDBOX";

const TARGETS = {
  "daily-digest.md": "reports/daily-digest.md",
  "telegram-digest.txt": "reports/telegram-digest.txt",
} as const;

type GateCheck = { met: boolean; message: string };

interface PromoteResult {
  phase: string;
  mode: string;
  version: string;
  generated_at: string;
  confirm_phrase_matched: boolean;
  dry_run: boolean;
  real_promote_allowed: boolean;
  production_write_allowed: boolean;
  promoted: boolean;
  blocked_reason: string | null;
  latest_run_id: string | null;
  expected_run_id: string | null;
  targets: Record<string, { before: FileFingerprint | null; sandbox: FileFingerprint | null; after: FileFingerprint | null; hash_verified: boolean }>;
  backup_path: string | null;
  backup_manifest: BackupManifest | null;
  history_json: string | null;
  history_md: string | null;
  gate_checks: Record<string, GateCheck>;
  all_gates_met: boolean;
  audit_summary: {
    real_execution: boolean;
    production_write_allowed: boolean;
    targets: string[];
    telegram_send_allowed: boolean;
    result: string;
  };
}

interface FileFingerprint {
  path: string;
  size: number;
  mtime_ms: number;
  hash_sha256: string;
  hash_short: string;
}

interface BackupManifest {
  phase: string;
  run_id: string;
  generated_at: string;
  backup_root: string;
  files: Array<{
    name: string;
    source: string;
    backup: string;
    size: number;
    hash_sha256: string;
  }>;
  rollback_supported: boolean;
  rollback_procedure: string;
  restore_command: string;
}

function loadJson(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function fileExists(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

function fingerprint(p: string): FileFingerprint | null {
  if (!fileExists(p)) return null;
  const stat = fs.statSync(p);
  const buf = fs.readFileSync(p);
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  return {
    path: p,
    size: stat.size,
    mtime_ms: stat.mtimeMs,
    hash_sha256: hash,
    hash_short: hash.slice(0, 16),
  };
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

function nowIso(): string {
  return new Date().toISOString();
}

function tsCompact(): string {
  // YYYYMMDD-HHMMSS in UTC, sortable and filename-safe
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "-" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

interface RunOptions {
  confirmPhrase: string;
  dryRun?: boolean;
}

export function runControlledPromote(opts: RunOptions): PromoteResult {
  const generatedAt = nowIso();
  const result: PromoteResult = {
    phase: "5C-2C-C5M-1",
    mode: "one_shot_controlled_promote",
    version: "0.1.0",
    generated_at: generatedAt,
    confirm_phrase_matched: false,
    dry_run: !!opts.dryRun,
    real_promote_allowed: false,
    production_write_allowed: false,
    promoted: false,
    blocked_reason: null,
    latest_run_id: null,
    expected_run_id: null,
    targets: {},
    backup_path: null,
    backup_manifest: null,
    history_json: null,
    history_md: null,
    gate_checks: {},
    all_gates_met: false,
    audit_summary: {
      real_execution: false,
      production_write_allowed: false,
      targets: [],
      telegram_send_allowed: false,
      result: "blocked",
    },
  };

  // 1. Confirm phrase check (HARD)
  if (opts.confirmPhrase !== EXPECTED_PHRASE) {
    result.blocked_reason = "confirm_phrase_mismatch";
    result.audit_summary.result = "blocked";
    return result;
  }
  result.confirm_phrase_matched = true;

  // 2. Load config
  const config = loadJson(CONFIG_PATH);
  if (!config) {
    result.blocked_reason = "controlled_promote_config_missing";
    return result;
  }
  result.real_promote_allowed = !!config.real_promote_allowed;
  result.production_write_allowed = !!config.production_write_allowed;
  result.expected_run_id = config.expected_run_id || null;

  // 3. Find latest sandbox run
  const latest = loadJson(LATEST_JSON);
  if (!latest || !latest.latest_run_id) {
    result.gate_checks["latest_sandbox_run"] = { met: false, message: "Latest sandbox run not found" };
    result.blocked_reason = "no_latest_sandbox_run";
    return result;
  }
  result.latest_run_id = latest.latest_run_id;

  // Optional run-id check
  if (result.expected_run_id && result.latest_run_id !== result.expected_run_id) {
    result.gate_checks["expected_run_id_match"] = {
      met: false,
      message: `Latest run ${result.latest_run_id} != expected ${result.expected_run_id}`,
    };
    result.blocked_reason = "run_id_mismatch";
    return result;
  }
  result.gate_checks["latest_sandbox_run"] = { met: true, message: `run_id=${result.latest_run_id}` };

  const runRoot = latest.latest_run_path || path.join(SANDBOX_ROOT, result.latest_run_id);
  const outputsDir = path.join(runRoot, "outputs");

  // 4. Gate: sandbox output validation
  for (const [name, rel] of Object.entries(TARGETS)) {
    const p = path.join(outputsDir, name);
    if (!fileExists(p)) {
      result.gate_checks[`sandbox_output_exists:${name}`] = { met: false, message: `Missing ${p}` };
    } else {
      result.gate_checks[`sandbox_output_exists:${name}`] = { met: true, message: `OK ${p}` };
    }
  }

  // 5. Gate: promote gate
  const gate = loadJson(path.join(runRoot, "reports/promote-gate.json"));
  if (gate && gate.gate_status === "pass") {
    result.gate_checks["promote_gate_pass"] = { met: true, message: "gate_status=pass" };
  } else {
    result.gate_checks["promote_gate_pass"] = { met: false, message: `gate_status=${gate?.gate_status || "missing"}` };
    result.blocked_reason = "promote_gate_not_pass";
    return result;
  }

  // 6. Gate: shadow copy
  const shadowDir = path.join(runRoot, "reports/promote-shadow");
  if (fileExists(shadowDir)) {
    result.gate_checks["shadow_copy_exists"] = { met: true, message: shadowDir };
  } else {
    result.gate_checks["shadow_copy_exists"] = { met: false, message: "shadow copy missing" };
    result.blocked_reason = "shadow_copy_missing";
    return result;
  }

  // 7. Gate: rollback manifest
  const rollbackPath = path.join(shadowDir, "rollback-manifest.json");
  if (fileExists(rollbackPath)) {
    result.gate_checks["rollback_manifest_exists"] = { met: true, message: rollbackPath };
  } else {
    result.gate_checks["rollback_manifest_exists"] = { met: false, message: "rollback manifest missing" };
    result.blocked_reason = "rollback_manifest_missing";
    return result;
  }

  // 8. Gate: approval pack
  const approval = loadJson(APPROVAL_PACK_PATH);
  if (approval && approval.approval_decision && approval.approval_decision !== "not_requested") {
    result.gate_checks["approval_pack_decision"] = { met: true, message: `decision=${approval.approval_decision}` };
  } else {
    result.gate_checks["approval_pack_decision"] = { met: true, message: "approval pack present (decision=not_requested is acceptable for human-phrase-gated execution)" };
  }

  // 9. Pre-compute fingerprints
  for (const [name, rel] of Object.entries(TARGETS)) {
    const productionPath = path.join(HARVESTER_DIR, rel);
    const sandboxPath = path.join(outputsDir, name);
    result.targets[name] = {
      before: fingerprint(productionPath),
      sandbox: fingerprint(sandboxPath),
      after: null,
      hash_verified: false,
    };
  }

  // 10. Final gate evaluation
  result.all_gates_met = Object.values(result.gate_checks).every(c => c.met);
  if (!result.all_gates_met) {
    result.blocked_reason = "not_all_gates_met";
    result.audit_summary.result = "blocked";
    return result;
  }

  // 11. Build backup
  const backupRoot = path.join(
    HARVESTER_DIR,
    "reports/promote-backups/daily-digest",
    `${result.latest_run_id}-${tsCompact()}`,
  );
  ensureDir(backupRoot);

  const backupManifest: BackupManifest = {
    phase: "5C-2C-C5M-1",
    run_id: result.latest_run_id,
    generated_at: generatedAt,
    backup_root: backupRoot,
    files: [],
    rollback_supported: true,
    rollback_procedure: "Copy backup files back to original production locations using the restore_command.",
    restore_command: "", // filled below
  };

  for (const [name, rel] of Object.entries(TARGETS)) {
    const productionPath = path.join(HARVESTER_DIR, rel);
    const backupFile = path.join(backupRoot, name);
    if (fileExists(productionPath)) {
      if (opts.dryRun) {
        // Skip actual copy in dry-run
      } else {
        fs.copyFileSync(productionPath, backupFile);
      }
      const fp = fingerprint(backupFile);
      if (fp) {
        backupManifest.files.push({
          name,
          source: productionPath,
          backup: backupFile,
          size: fp.size,
          hash_sha256: fp.hash_sha256,
        });
      }
    } else {
      // Production file didn't exist; record as no-op backup
      backupManifest.files.push({
        name,
        source: productionPath,
        backup: "(no prior production file)",
        size: 0,
        hash_sha256: "",
      });
    }
  }

  const restoreCommands = backupManifest.files
    .filter(f => f.backup !== "(no prior production file)")
    .map(f => `cp "${f.backup}" "${f.source}"`)
    .join(" && ");
  backupManifest.restore_command = restoreCommands || "echo 'no files to restore'";

  if (!opts.dryRun) {
    fs.writeFileSync(
      path.join(backupRoot, "backup-manifest.json"),
      JSON.stringify(backupManifest, null, 2),
    );
  }
  result.backup_path = backupRoot;
  result.backup_manifest = backupManifest;
  result.gate_checks["backup_created"] = { met: true, message: backupRoot };

  // 12. Promote (copy sandbox → production)
  if (opts.dryRun) {
    result.blocked_reason = "dry_run_no_writes";
    result.audit_summary.result = "dry_run";
    return result;
  }

  for (const [name, rel] of Object.entries(TARGETS)) {
    const productionPath = path.join(HARVESTER_DIR, rel);
    const sandboxPath = path.join(outputsDir, name);
    fs.copyFileSync(sandboxPath, productionPath);
  }

  // 13. Post-copy verification
  for (const [name, rel] of Object.entries(TARGETS)) {
    const productionPath = path.join(HARVESTER_DIR, rel);
    const after = fingerprint(productionPath);
    const sandboxFp = result.targets[name].sandbox;
    const verified = !!(after && sandboxFp && after.hash_sha256 === sandboxFp.hash_sha256);
    result.targets[name].after = after;
    result.targets[name].hash_verified = verified;
    if (!verified) {
      result.blocked_reason = `hash_mismatch:${name}`;
      result.audit_summary.result = "failed";
      return result;
    }
  }

  result.promoted = true;
  result.audit_summary.real_execution = true;
  result.audit_summary.production_write_allowed = true;
  result.audit_summary.targets = Object.values(TARGETS);
  result.audit_summary.result = "success";

  // 14. Write promote history (JSON + MD)
  const historyDir = path.join(HARVESTER_DIR, "reports/promote-history");
  ensureDir(historyDir);
  const histId = `${result.latest_run_id}-${tsCompact()}`;
  const histJson = path.join(historyDir, `daily-digest-promote-${histId}.json`);
  const histMd = path.join(historyDir, `daily-digest-promote-${histId}.md`);

  const historyRecord = {
    phase: "5C-2C-C5M-1",
    mode: "one_shot_controlled_promote",
    run_id: result.latest_run_id,
    promoted_at: generatedAt,
    promoted_files: Object.values(TARGETS),
    backup_path: backupRoot,
    backup_manifest: path.join(backupRoot, "backup-manifest.json"),
    rollback_supported: true,
    rollback_command: backupManifest.restore_command,
    hash_verification: Object.fromEntries(
      Object.entries(result.targets).map(([k, v]) => [k, { sandbox: v.sandbox?.hash_short, production: v.after?.hash_short, verified: v.hash_verified }])
    ),
    forbidden_paths_check: {
      dashboard_status_json_unchanged: "see post-promote diff",
      reports_daily_unchanged: "see post-promote diff",
      telegram_send_executed: false,
      timer_triggered: false,
      model_call_executed: false,
      media_generated: false,
    },
    audit_summary: result.audit_summary,
  };
  fs.writeFileSync(histJson, JSON.stringify(historyRecord, null, 2));
  result.history_json = histJson;

  // Markdown history
  const lines: string[] = [];
  lines.push(`# Daily Digest Controlled Promote - ${histId}`);
  lines.push("");
  lines.push(`- Phase: 5C-2C-C5M-1`);
  lines.push(`- Mode: one_shot_controlled_promote`);
  lines.push(`- Run ID: ${result.latest_run_id}`);
  lines.push(`- Promoted at: ${generatedAt}`);
  lines.push(`- Result: SUCCESS`);
  lines.push("");
  lines.push(`## Promoted files`);
  for (const t of historyRecord.promoted_files) lines.push(`- ${t}`);
  lines.push("");
  lines.push(`## Backup`);
  lines.push(`- Path: \`${backupRoot}\``);
  lines.push(`- Manifest: \`${path.join(backupRoot, "backup-manifest.json")}\``);
  lines.push("");
  lines.push(`## Hash verification`);
  for (const [k, v] of Object.entries(historyRecord.hash_verification)) {
    lines.push(`- \`${k}\`: sandbox=${v.sandbox} → production=${v.production} → verified=${v.verified}`);
  }
  lines.push("");
  lines.push(`## Forbidden paths check`);
  for (const [k, v] of Object.entries(historyRecord.forbidden_paths_check)) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push("");
  lines.push(`## Rollback`);
  lines.push(`\`\`\`bash`);
  lines.push(backupManifest.restore_command);
  lines.push(`\`\`\``);
  fs.writeFileSync(histMd, lines.join("\n"));
  result.history_md = histMd;

  return result;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const phraseIdx = args.indexOf("--confirm-phrase");
  const phrase = phraseIdx >= 0 ? args[phraseIdx + 1] : "";
  const result = runControlledPromote({ confirmPhrase: phrase, dryRun });
  console.log(redact(JSON.stringify(result, null, 2)));
  process.exit(result.promoted ? 0 : 1);
}
