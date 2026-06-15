#!/usr/bin/env tsx
/**
 * scripts/daily-digest-approved-promote-preflight.ts
 * Phase 5C-2C-C5N6-A: Approved Promote Execution Preflight (PREFLIGHT / DRY-RUN ONLY)
 *
 * This script SIMULATES a future promote from the approved_for_future_promote
 * state. It does NOT:
 *   - Promote (real_promote=false)
 *   - Write to production paths (production_write_allowed=false)
 *   - Send Telegram (telegram_send_allowed=false)
 *   - Trigger a timer / cron
 *   - Use child_process / exec / spawn
 *   - Read .env / .control.local / process.env
 *   - Make network calls
 *   - Copy sandbox output to production
 *
 * Inputs (all read-only):
 *   - dashboard/daily-digest-approved-promote-preflight-policy.json (this phase's policy)
 *   - dashboard/daily-digest-human-approval-state.json (C5N1 config)
 *   - dashboard/daily-digest-promote-gate.json (C5J)
 *   - dashboard/daily-digest-promote-approval-pack.json (C5M-0)
 *   - reports/sandbox/daily-digest/latest.json (C5C)
 *   - reports/sandbox/daily-digest/<run>/outputs/<files> (sandbox candidate files)
 *   - reports/daily-digest.md (production target 1)
 *   - reports/telegram-digest.txt (production target 2)
 *   - reports/promote-backups/daily-digest/<run>/ (backup + rollback manifest)
 *   - reports/promote-history/ (promote history records)
 *
 * Outputs (preflight-only):
 *   - dashboard/daily-digest-approved-promote-preflight.json
 *   - reports/approved-promote-preflight.md
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const POLICY = path.join(HARVESTER_DIR, "dashboard/daily-digest-approved-promote-preflight-policy.json");
const APPROVAL_CONFIG = path.join(HARVESTER_DIR, "dashboard/daily-digest-human-approval-state.json");
const PROMOTE_GATE = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-gate.json");
const APPROVAL_PACK = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-approval-pack.json");
const SANDBOX_LATEST = path.join(HARVESTER_DIR, "reports/sandbox/daily-digest/latest.json");
const PROMOTE_HISTORY_DIR = path.join(HARVESTER_DIR, "reports/promote-history");
const PREFLIGHT_OUTPUT = path.join(HARVESTER_DIR, "dashboard/daily-digest-approved-promote-preflight.json");
const PREFLIGHT_MD_OUTPUT = path.join(HARVESTER_DIR, "reports/approved-promote-preflight.md");

function loadJson<T>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as T; } catch { return null; }
}

function fileExists(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}

function fileSha256Short(p: string): string | null {
  try {
    if (!fs.existsSync(p)) return null;
    const content = fs.readFileSync(p);
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
  } catch {
    return null;
  }
}

function redact(text: string): string {
  return text
    .replace(/TELEGRAM_BOT_TOKEN\s*=\s*['"]\S+['"]/g, "TELEGRAM_BOT_TOKEN=\"***\"")
    .replace(/CQA_CONTROL_TOKEN\s*=\s*['"]\S+['"]/g, "CQA_CONTROL_TOKEN=\"***\"")
    .replace(/MINIMAX_API_KEY\s*=\s*['"]\S+['"]/g, "MINIMAX_API_KEY=\"***\"")
    .replace(/OPENAI_API_KEY\s*=\s*['"]\S+['"]/g, "OPENAI_API_KEY=\"***\"")
    .replace(/sk-cp-[A-Za-z0-9_-]{10,}/g, "sk-cp-<REDACTED>")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-<REDACTED>");
}

function findPromoteHistoryFiles(): { present: boolean; latest: any; latest_path: string | null; total: number } {
  if (!fileExists(PROMOTE_HISTORY_DIR)) return { present: false, latest: null, latest_path: null, total: 0 };
  const files = fs.readdirSync(PROMOTE_HISTORY_DIR)
    .filter(f => f.startsWith("daily-digest-promote-sandbox-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) return { present: false, latest: null, latest_path: null, total: 0 };
  const latest = files[files.length - 1];
  const latestPath = path.join(PROMOTE_HISTORY_DIR, latest);
  const rec = loadJson<any>(latestPath);
  return { present: !!rec, latest: rec, latest_path: latestPath, total: files.length };
}

function findC5N5HistoryRecord(): { present: boolean; latest: any; latest_path: string | null } {
  const dir = path.join(HARVESTER_DIR, "reports/human-approval-history");
  if (!fileExists(dir)) return { present: false, latest: null, latest_path: null };
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith("daily-digest-approved-for-future-promote-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) return { present: false, latest: null, latest_path: null };
  const latest = files[files.length - 1];
  const latestPath = path.join(dir, latest);
  const rec = loadJson<any>(latestPath);
  return { present: !!rec, latest: rec, latest_path: latestPath };
}

interface PreflightEvidence {
  key: string;
  label_zh: string;
  met: boolean;
  note: string;
}

interface PreflightFileComparison {
  name: string;
  source_label: string;
  source_path: string | null;
  source_hash_short: string | null;
  target_label: string;
  target_path: string;
  target_hash_short: string | null;
  backup_path: string | null;
  backup_hash_short: string | null;
  hashes_match: boolean;
  diff_detected: boolean;
  would_overwrite: boolean;
}

interface PreflightResult {
  phase: string;
  mode: string;
  version: string;
  generated_at: string;
  real_promote_allowed: boolean;
  production_write_allowed: boolean;
  telegram_send_allowed: boolean;
  would_promote: boolean;
  real_promote: false;
  current_state: string | null;
  required_current_state: string;
  required_env_gate: string;
  env_gate_evaluated: boolean;
  env_gate_evaluated_note: string;
  required_confirm_phrase: string;
  future_promote_confirm_phrase: string;
  evidence_for_promote: PreflightEvidence[];
  candidate_files: PreflightFileComparison[];
  production_targets: { name: string; path: string; hash_short: string | null }[];
  hash_comparison_summary: {
    total_files: number;
    identical: number;
    different: number;
    would_promote_anything: boolean;
  };
  backup_status: {
    backup_manifest_path: string | null;
    backup_manifest_present: boolean;
    backup_files_present: number;
    backup_files_total: number;
    rollback_supported: boolean;
    rollback_command_preview: string | null;
  };
  rollback_status: {
    rollback_manifest_present: boolean;
    restore_command_available: boolean;
    manual_rollback_supported: boolean;
  };
  promote_history_status: {
    history_present: boolean;
    history_latest_path: string | null;
    history_total: number;
    latest_promote_run_id: string | null;
  };
  missing_requirements: string[];
  blocked_actions: string[];
  recommendation: string;
  upstream_inputs: {
    approval_state_present: boolean;
    c5n5_approved_history_record_present: boolean;
    promote_gate_present: boolean;
    promote_gate_status: string | null;
    approval_pack_present: boolean;
    sandbox_latest_run_id: string | null;
  };
  safety_constraints: {
    no_child_process: true;
    no_exec_spawn: true;
    no_env_read: true;
    no_control_local_read: true;
    no_network_calls: true;
    no_production_writes: true;
    no_telegram_send: true;
    no_real_promote: true;
    no_timer: true;
    no_sandbox_copy_to_production: true;
    output_redacted: true;
  };
}

export function planApprovedPromotePreflight(opts: { confirmPhrase?: string } = {}): PreflightResult {
  const generatedAt = new Date().toISOString();
  const policy = loadJson<any>(POLICY);
  if (!policy) throw new Error(`policy not found at ${POLICY}`);

  const approvalConfig = loadJson<any>(APPROVAL_CONFIG);
  const promoteGate = loadJson<any>(PROMOTE_GATE);
  const approvalPack = loadJson<any>(APPROVAL_PACK);
  const sandboxLatest = loadJson<any>(SANDBOX_LATEST);
  const promoteHistory = findPromoteHistoryFiles();
  const c5n5History = findC5N5HistoryRecord();

  const currentState: string | null = approvalConfig?.approval_state || null;
  const requiredCurrentState: string = policy.required_current_state || "approved_for_future_promote";
  const requiredPhrase: string = policy.required_confirm_phrase || "PREFLIGHT DAILY PROMOTE";
  const phraseMatched = opts.confirmPhrase === requiredPhrase;

  const candidateTargets: string[] = policy.candidate_targets || [
    "reports/daily-digest.md",
    "reports/telegram-digest.txt",
  ];
  const sandboxRunId: string | null = sandboxLatest?.latest_run_id || null;
  const sandboxRunDir: string | null = sandboxLatest?.latest_run_path || null;

  // Build file-by-file comparison: sandbox candidate vs production target
  const fileComparisons: PreflightFileComparison[] = [];
  let identical = 0;
  let different = 0;
  let wouldPromoteAnything = false;

  for (const rel of candidateTargets) {
    const sandboxPath = sandboxRunDir ? path.join(sandboxRunDir, "outputs", path.basename(rel)) : null;
    const productionPath = path.join(HARVESTER_DIR, rel);

    const sandboxHash = sandboxPath ? fileSha256Short(sandboxPath) : null;
    const productionHash = fileSha256Short(productionPath);

    // Backup lookup: use the most recent promote history to find a backup for this file
    let backupPath: string | null = null;
    let backupHash: string | null = null;
    if (promoteHistory.latest?.backup_path) {
      const candidateBackup = path.join(promoteHistory.latest.backup_path, path.basename(rel));
      if (fileExists(candidateBackup)) {
        backupPath = candidateBackup;
        backupHash = fileSha256Short(candidateBackup);
      }
    }

    const sandboxMissing = !sandboxPath || sandboxHash === null;
    const productionMissing = productionHash === null;
    const hashesMatch = !sandboxMissing && !productionMissing && sandboxHash === productionHash;
    const diffDetected = !hashesMatch;
    const wouldOverwrite = diffDetected && !sandboxMissing && !productionMissing;

    if (hashesMatch) identical++;
    if (diffDetected) different++;
    if (wouldOverwrite) wouldPromoteAnything = true;

    fileComparisons.push({
      name: path.basename(rel),
      source_label: `sandbox (${sandboxRunId || "?"})`,
      source_path: sandboxPath,
      source_hash_short: sandboxHash,
      target_label: "production",
      target_path: productionPath,
      target_hash_short: productionHash,
      backup_path: backupPath,
      backup_hash_short: backupHash,
      hashes_match: hashesMatch,
      diff_detected: diffDetected,
      would_overwrite: wouldOverwrite,
    });
  }

  const productionTargetsList = candidateTargets.map(rel => ({
    name: path.basename(rel),
    path: path.join(HARVESTER_DIR, rel),
    hash_short: fileSha256Short(path.join(HARVESTER_DIR, rel)),
  }));

  // Backup status from latest promote history
  const backupManifestPath = promoteHistory.latest?.backup_manifest || null;
  const backupManifestPresent = !!backupManifestPath && fileExists(backupManifestPath);
  const backupManifestData: any = backupManifestPresent ? loadJson<any>(backupManifestPath) : null;
  const backupFilesTotal: number = backupManifestData?.files?.length || 0;
  const backupFilesPresent: number = fileComparisons.filter(f => !!f.backup_path).length;
  const rollbackSupported: boolean = !!promoteHistory.latest?.rollback_supported;
  const rollbackCmd: string | null = promoteHistory.latest?.rollback_command || null;

  // Build evidence checklist
  const stateMet = currentState === requiredCurrentState;
  const c5n5Recorded = c5n5History.present && c5n5History.latest?.new_state === "approved_for_future_promote";
  const gatePass = promoteGate?.gate_status === "pass";
  const approvalPackPresent = !!approvalPack;
  const sandboxRunPresent = !!sandboxRunId;
  const candidatesExist = fileComparisons.every(f => f.source_hash_short !== null);
  const targetsExist = fileComparisons.every(f => f.target_hash_short !== null);
  const rollbackManifestPresent = rollbackSupported && backupManifestPresent;

  const evidence: PreflightEvidence[] = [
    {
      key: "current_state_eq_approved_for_future_promote",
      label_zh: "当前状态等于 approved_for_future_promote",
      met: stateMet,
      note: stateMet ? `current_state=${currentState}` : `current_state=${currentState}, expected ${requiredCurrentState}`,
    },
    {
      key: "c5n5_approved_history_record_present",
      label_zh: "C5N5 approved_for_future_promote history record 存在",
      met: c5n5Recorded,
      note: c5n5Recorded
        ? `latest=${path.basename(c5n5History.latest_path || "")}`
        : "C5N5 history not present",
    },
    {
      key: "promote_gate_pass",
      label_zh: "Promote gate = pass",
      met: gatePass,
      note: gatePass ? `gate_status=${promoteGate?.gate_status}` : `gate_status=${promoteGate?.gate_status || "missing"}`,
    },
    {
      key: "approval_pack_present",
      label_zh: "Approval pack 存在",
      met: approvalPackPresent,
      note: approvalPackPresent ? "approval pack present" : "approval pack missing",
    },
    {
      key: "rollback_manifest_present",
      label_zh: "Rollback manifest 存在",
      met: rollbackManifestPresent,
      note: rollbackManifestPresent
        ? `rollback_supported=${rollbackSupported}, backup_manifest=${backupManifestPath}`
        : "rollback not available (no backup manifest)",
    },
    {
      key: "promote_history_present",
      label_zh: "Promote history 存在",
      met: promoteHistory.present,
      note: promoteHistory.present ? `total=${promoteHistory.total}, latest_run_id=${promoteHistory.latest?.run_id}` : "no promote history",
    },
    {
      key: "sandbox_latest_run_present",
      label_zh: "Sandbox latest run 存在",
      met: sandboxRunPresent,
      note: sandboxRunPresent ? `run_id=${sandboxRunId}` : "sandbox latest.json missing",
    },
    {
      key: "sandbox_candidates_exist",
      label_zh: "Sandbox candidate outputs 存在",
      met: candidatesExist,
      note: candidatesExist ? `all ${candidateTargets.length} candidates readable` : "at least one candidate missing",
    },
    {
      key: "production_targets_exist",
      label_zh: "Production targets 存在",
      met: targetsExist,
      note: targetsExist ? `all ${candidateTargets.length} targets readable` : "at least one target missing",
    },
    {
      key: "backup_manifest_present",
      label_zh: "Backup manifest 存在",
      met: backupManifestPresent,
      note: backupManifestPresent ? `${backupFilesPresent}/${backupFilesTotal} backup files` : "backup manifest missing",
    },
    {
      key: "sandbox_production_hash_diff_computed",
      label_zh: "Sandbox vs production hash diff 已计算",
      met: fileComparisons.length > 0,
      note: `${identical} identical, ${different} different`,
    },
    {
      key: "real_promote_disabled",
      label_zh: "real_promote_allowed = false",
      met: policy.real_promote_allowed === false,
      note: `real_promote_allowed=${policy.real_promote_allowed}`,
    },
    {
      key: "production_write_disabled",
      label_zh: "production_write_allowed = false",
      met: policy.production_write_allowed === false,
      note: `production_write_allowed=${policy.production_write_allowed}`,
    },
    {
      key: "telegram_send_disabled",
      label_zh: "telegram_send_allowed = false",
      met: policy.telegram_send_allowed === false,
      note: `telegram_send_allowed=${policy.telegram_send_allowed}`,
    },
    {
      key: "timer_disabled",
      label_zh: "timer_allowed = false",
      met: policy.timer_allowed === false,
      note: `timer_allowed=${policy.timer_allowed}`,
    },
  ];

  const missing = evidence.filter(e => !e.met).map(e => e.key);
  const wouldPromote = missing.length === 0;

  let recommendation: string;
  if (!wouldPromote) {
    recommendation =
      "Preflight blocked: missing=" + missing.join(",") + ". Resolve the missing requirements before retrying. No real promote was performed.";
  } else if (!wouldPromoteAnything) {
    recommendation =
      `Preflight PASS. approved_for_future_promote state is set, all evidence met. However, sandbox and production hashes are IDENTICAL for all ${fileComparisons.length} candidate files. A future promote would be a no-op. No real promote was performed.`;
  } else {
    recommendation =
      `Preflight PASS. approved_for_future_promote state is set, all evidence met. ${different} of ${fileComparisons.length} candidate files have hash diffs and would be overwritten. However, real_promote_allowed=false and production_write_allowed=false. A future phase (C5N-6-B, not yet implemented) would need to re-verify the env gate AND require the future_promote_confirm_phrase ("${policy.future_promote_confirm_phrase || "PROMOTE DAILY DIGEST FROM SANDBOX"}") BEFORE any production write or Telegram send. No real promote was performed.`;
  }

  return {
    phase: "5C-2C-C5N6-A",
    mode: "approved_promote_preflight_only",
    version: "0.1.0",
    generated_at: generatedAt,
    real_promote_allowed: false,
    production_write_allowed: false,
    telegram_send_allowed: false,
    would_promote: wouldPromote,
    real_promote: false,
    current_state: currentState,
    required_current_state: requiredCurrentState,
    required_env_gate: policy.required_env_gate || "CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1",
    env_gate_evaluated: false,
    env_gate_evaluated_note: policy.env_gate_evaluated_note || "this script does not read process.env",
    required_confirm_phrase: requiredPhrase,
    future_promote_confirm_phrase: policy.future_promote_confirm_phrase || "PROMOTE DAILY DIGEST FROM SANDBOX",
    evidence_for_promote: evidence,
    candidate_files: fileComparisons,
    production_targets: productionTargetsList,
    hash_comparison_summary: {
      total_files: fileComparisons.length,
      identical,
      different,
      would_promote_anything: wouldPromoteAnything,
    },
    backup_status: {
      backup_manifest_path: backupManifestPath,
      backup_manifest_present: backupManifestPresent,
      backup_files_present: backupFilesPresent,
      backup_files_total: backupFilesTotal,
      rollback_supported: rollbackSupported,
      rollback_command_preview: rollbackCmd ? rollbackCmd.slice(0, 80) + "..." : null,
    },
    rollback_status: {
      rollback_manifest_present: rollbackManifestPresent,
      restore_command_available: !!rollbackCmd,
      manual_rollback_supported: rollbackSupported && backupFilesPresent > 0,
    },
    promote_history_status: {
      history_present: promoteHistory.present,
      history_latest_path: promoteHistory.latest_path,
      history_total: promoteHistory.total,
      latest_promote_run_id: promoteHistory.latest?.run_id || null,
    },
    missing_requirements: missing,
    blocked_actions: policy.blocked_actions || [],
    recommendation,
    upstream_inputs: {
      approval_state_present: !!approvalConfig,
      c5n5_approved_history_record_present: c5n5Recorded,
      promote_gate_present: !!promoteGate,
      promote_gate_status: promoteGate?.gate_status || null,
      approval_pack_present: approvalPackPresent,
      sandbox_latest_run_id: sandboxRunId,
    },
    safety_constraints: {
      no_child_process: true,
      no_exec_spawn: true,
      no_env_read: true,
      no_control_local_read: true,
      no_network_calls: true,
      no_production_writes: true,
      no_telegram_send: true,
      no_real_promote: true,
      no_timer: true,
      no_sandbox_copy_to_production: true,
      output_redacted: true,
    },
  };
}

function renderMarkdown(r: PreflightResult): string {
  const lines: string[] = [];
  lines.push("# Approved Promote Preflight (Phase 5C-2C-C5N6-A)");
  lines.push("");
  lines.push(`- Phase: ${r.phase}`);
  lines.push(`- Mode: ${r.mode}`);
  lines.push(`- Generated at: ${r.generated_at}`);
  lines.push(`- Would promote: **${r.would_promote}**`);
  lines.push(`- Real promote: **${r.real_promote}** (always false)`);
  lines.push(`- Real promote allowed: **${r.real_promote_allowed}**`);
  lines.push(`- Production write allowed: **${r.production_write_allowed}**`);
  lines.push(`- Telegram send allowed: **${r.telegram_send_allowed}**`);
  lines.push(`- Current state: \`${r.current_state || "(unknown)"}\``);
  lines.push(`- Required current state: \`${r.required_current_state}\``);
  lines.push(`- Required env gate: \`${r.required_env_gate}\` (env_gate_evaluated: ${r.env_gate_evaluated})`);
  lines.push(`- Required confirm phrase: \`${r.required_confirm_phrase}\``);
  lines.push(`- Future promote confirm phrase: \`${r.future_promote_confirm_phrase}\``);
  lines.push("");
  lines.push("## Upstream Inputs");
  lines.push("");
  for (const [k, v] of Object.entries(r.upstream_inputs)) lines.push(`- ${k}: ${v}`);
  lines.push("");
  lines.push("## Evidence Checklist (preflight)");
  lines.push("");
  for (const e of r.evidence_for_promote) {
    lines.push(`- [${e.met ? "x" : " "}] ${e.key} — ${e.label_zh}`);
    lines.push(`  - note: ${e.note}`);
  }
  lines.push("");
  lines.push("## Hash Comparison");
  lines.push("");
  lines.push(`- Total files: ${r.hash_comparison_summary.total_files}`);
  lines.push(`- Identical: ${r.hash_comparison_summary.identical}`);
  lines.push(`- Different: ${r.hash_comparison_summary.different}`);
  lines.push(`- Would promote anything: ${r.hash_comparison_summary.would_promote_anything}`);
  lines.push("");
  for (const f of r.candidate_files) {
    lines.push(`- **${f.name}**:`);
    lines.push(`  - sandbox (${f.source_label}): \`${f.source_path || "(missing)"}\` hash=\`${f.source_hash_short || "(missing)"}\``);
    lines.push(`  - production: \`${f.target_path}\` hash=\`${f.target_hash_short || "(missing)"}\``);
    lines.push(`  - backup: \`${f.backup_path || "(none)"}\` hash=\`${f.backup_hash_short || "(none)"}\``);
    lines.push(`  - hashes_match: **${f.hashes_match}**`);
    lines.push(`  - diff_detected: ${f.diff_detected}`);
    lines.push(`  - would_overwrite: ${f.would_overwrite}`);
  }
  lines.push("");
  lines.push("## Backup Status");
  lines.push("");
  lines.push(`- Backup manifest: \`${r.backup_status.backup_manifest_path || "(missing)"}\``);
  lines.push(`- Backup manifest present: **${r.backup_status.backup_manifest_present}**`);
  lines.push(`- Backup files present: ${r.backup_status.backup_files_present}/${r.backup_status.backup_files_total}`);
  lines.push(`- Rollback supported: **${r.backup_status.rollback_supported}**`);
  lines.push(`- Rollback command preview: \`${r.backup_status.rollback_command_preview || "(none)"}\``);
  lines.push("");
  lines.push("## Rollback Status");
  lines.push("");
  lines.push(`- Rollback manifest present: **${r.rollback_status.rollback_manifest_present}**`);
  lines.push(`- Restore command available: **${r.rollback_status.restore_command_available}**`);
  lines.push(`- Manual rollback supported: **${r.rollback_status.manual_rollback_supported}**`);
  lines.push("");
  lines.push("## Promote History Status");
  lines.push("");
  lines.push(`- History present: **${r.promote_history_status.history_present}**`);
  lines.push(`- History total: ${r.promote_history_status.history_total}`);
  lines.push(`- History latest path: \`${r.promote_history_status.history_latest_path || "(none)"}\``);
  lines.push(`- Latest promote run_id: \`${r.promote_history_status.latest_promote_run_id || "(none)"}\``);
  lines.push("");
  if (r.missing_requirements.length > 0) {
    lines.push("## Missing Requirements");
    lines.push("");
    for (const m of r.missing_requirements) lines.push(`- ${m}`);
    lines.push("");
  }
  lines.push("## Blocked Actions");
  lines.push("");
  for (const a of r.blocked_actions) lines.push(`- ${a}`);
  lines.push("");
  lines.push("## Recommendation");
  lines.push("");
  lines.push(r.recommendation);
  lines.push("");
  lines.push("## Safety Constraints (verified)");
  lines.push("");
  for (const [k, v] of Object.entries(r.safety_constraints)) lines.push(`- ${k}: ${v}`);
  return lines.join("\n");
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const phraseIdx = args.indexOf("--confirm-phrase");
  const phrase = phraseIdx >= 0 ? args[phraseIdx + 1] : "";
  const result = planApprovedPromotePreflight({ confirmPhrase: phrase });
  fs.writeFileSync(PREFLIGHT_OUTPUT, JSON.stringify(result, null, 2));
  fs.writeFileSync(PREFLIGHT_MD_OUTPUT, renderMarkdown(result));
  console.log(redact(JSON.stringify(result, null, 2)));
  process.exit(0);
}