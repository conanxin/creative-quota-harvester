#!/usr/bin/env tsx
/**
 * scripts/build-policy-review.ts — Phase 5C-4
 *
 * Builds dashboard/policy-review.json from the current control catalog.
 * Analyzes risk distribution, execution modes, and future execution candidates.
 *
 * Usage: npm run dashboard:policy:build
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const HARVESTER_DIR = "/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester";
const CATALOG_PATH = join(HARVESTER_DIR, "dashboard", "control-catalog.json");
const ALLOWLIST_PATH = join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json");
const REVIEW_PATH = join(HARVESTER_DIR, "dashboard", "policy-review.json");

interface Command {
  id: string;
  label_zh: string;
  risk_level: string;
  execution_mode: string;
  real_execution_supported: boolean;
  calls_model: boolean;
  generates_media: boolean;
  modifies_timer: boolean;
  public_safe: boolean;
  requires_confirm: boolean;
  source?: string;
  needs_policy_review?: boolean;
}

interface PolicyReview {
  version: string;
  phase: string;
  generated_at: string;
  total_commands: number;
  classified: number;
  needs_policy_review: number;
  risk_counts: {
    safe: number;
    medium: number;
    high: number;
    danger: number;
  };
  execution_mode_counts: {
    safe_readonly: number;
    dry_run_only: number;
    confirmed_low_risk: number;
    disabled: number;
  };
  source_counts: {
    "package-script": number;
    manual: number;
    generated: number;
  };
  all_commands_reviewed: boolean;
  risk_groups: Array<{
    risk: string;
    count: number;
    execution_mode: string;
    examples: string[];
  }>;
  execution_matrix: Array<{
    mode: string;
    count: number;
    can_real_execute: boolean;
    description: string;
  }>;
  real_execution_supported_count: number;
  confirmed_low_risk_count: number;
  confirmed_low_risk_enabled: Array<{
    id: string;
    label_zh: string;
    risk: string;
    confirmation_phrase: string;
  }>;
  future_execution_candidates: Array<{
    id: string;
    label_zh: string;
    risk: string;
    execution_mode: string;
    reason: string;
  }>;
  never_execute: Array<{
    id: string;
    label_zh: string;
    risk: string;
    reason: string;
  }>;
  notes: string;
}

function main() {
  const raw = readFileSync(CATALOG_PATH, "utf-8");
  const catalog = JSON.parse(raw);

  const allCommands: Command[] = [];
  for (const group of catalog.command_groups || []) {
    for (const cmd of group.commands || []) {
      allCommands.push(cmd);
    }
  }

  const total = allCommands.length;
  const classified = allCommands.filter(c => !c.needs_policy_review).length;
  const needsReview = allCommands.filter(c => c.needs_policy_review).length;

  const riskCounts = { safe: 0, medium: 0, high: 0, danger: 0 };
  const modeCounts = { safe_readonly: 0, dry_run_only: 0, confirmed_low_risk: 0, disabled: 0 };
  const sourceCounts = { "package-script": 0, manual: 0, generated: 0 };

  for (const cmd of allCommands) {
    const r = (cmd.risk_level || "safe").toLowerCase();
    if (r in riskCounts) riskCounts[r as keyof typeof riskCounts]++;
    const m = (cmd.execution_mode || "disabled").toLowerCase();
    if (m === "safe_readonly") modeCounts.safe_readonly++;
    else if (m === "dry_run_only") modeCounts.dry_run_only++;
    else if (m === "confirmed_low_risk") modeCounts.confirmed_low_risk++;
    else modeCounts.disabled++;
    const s = (cmd.source || "unknown") as keyof typeof sourceCounts;
    if (s in sourceCounts) sourceCounts[s]++;
  }

  // Risk groups with examples
  const riskGroupMap: Record<string, { count: number; execution_mode: string; examples: string[] }> = {};
  for (const cmd of allCommands) {
    const r = (cmd.risk_level || "safe").toLowerCase();
    if (!riskGroupMap[r]) {
      riskGroupMap[r] = { count: 0, execution_mode: cmd.execution_mode, examples: [] };
    }
    riskGroupMap[r].count++;
    if (riskGroupMap[r].examples.length < 3) {
      riskGroupMap[r].examples.push(cmd.label_zh || cmd.id);
    }
  }
  const riskGroups = Object.entries(riskGroupMap).map(([risk, data]) => ({
    risk,
    count: data.count,
    execution_mode: data.execution_mode,
    examples: data.examples,
  }));

  // Execution matrix
  const modeMap: Record<string, { count: number; can_real_execute: boolean; description: string }> = {
    safe_readonly: { count: 0, can_real_execute: false, description: "Read-only queries. No side effects. Cannot execute directly (use safe-readonly API instead)." },
    dry_run_only: { count: 0, can_real_execute: false, description: "Dry-run only. Simulation without execution." },
    confirmed_low_risk: { count: 0, can_real_execute: true, description: "Confirmed low-risk execution. Requires explicit confirmation phrase. 5 canary commands only." },
    disabled: { count: 0, can_real_execute: false, description: "Disabled. Cannot execute in any mode." },
  };
  for (const cmd of allCommands) {
    const m = (cmd.execution_mode || "disabled").toLowerCase();
    if (m in modeMap) modeMap[m].count++;
    else modeMap.disabled.count++;
  }
  const executionMatrix = Object.entries(modeMap).map(([mode, data]) => ({
    mode,
    count: data.count,
    can_real_execute: data.can_real_execute,
    description: data.description,
  }));

  // Confirmed low-risk enabled commands (from allowlist)
  const confirmedLowRisk = allCommands
    .filter(cmd => cmd.execution_mode === "confirmed_low_risk" && cmd.real_execution_supported === true)
    .map(cmd => ({
      id: cmd.id,
      label_zh: cmd.label_zh,
      risk: cmd.risk_level,
      confirmation_phrase: cmd.confirmation_phrase || "EXECUTE LOW RISK",
    }));

  const realExecutionCount = allCommands.filter(cmd => cmd.real_execution_supported === true).length;

  // Future execution candidates: safe + medium, dry_run_only or safe_readonly, no model/media/timer
  // Exclude confirmed_low_risk (they already have real execution enabled)
  const futureCandidates = allCommands
    .filter(cmd => {
      const r = (cmd.risk_level || "").toLowerCase();
      return (r === "safe" || r === "medium") &&
        !cmd.calls_model &&
        !cmd.generates_media &&
        !cmd.modifies_timer &&
        (cmd.execution_mode === "dry_run_only" || cmd.execution_mode === "safe_readonly");
    })
    .map(cmd => ({
      id: cmd.id,
      label_zh: cmd.label_zh,
      risk: cmd.risk_level,
      execution_mode: cmd.execution_mode,
      reason: `Low-risk, no model/media/timer, mode=${cmd.execution_mode}`,
    }));

  // Never execute: high, danger, calls_model, generates_media, modifies_timer, or disabled
  // Also includes confirmed_low_risk? No — they are already enabled for real execution.
  const neverExecute = allCommands
    .filter(cmd => {
      const r = (cmd.risk_level || "").toLowerCase();
      return r === "high" || r === "danger" || cmd.calls_model || cmd.generates_media || cmd.modifies_timer || cmd.execution_mode === "disabled";
    })
    .map(cmd => ({
      id: cmd.id,
      label_zh: cmd.label_zh,
      risk: cmd.risk_level,
      reason: cmd.calls_model ? "calls_model" : cmd.generates_media ? "generates_media" : cmd.modifies_timer ? "modifies_timer" : cmd.execution_mode === "disabled" ? "execution_mode=disabled" : `risk=${cmd.risk_level}`,
    }));

  const review: PolicyReview = {
    version: "0.4.0",
    phase: "5C-4",
    generated_at: new Date().toISOString().slice(0, 19) + "Z",
    total_commands: total,
    classified: classified,
    needs_policy_review: needsReview,
    risk_counts: riskCounts,
    execution_mode_counts: modeCounts,
    source_counts: sourceCounts,
    all_commands_reviewed: needsReview === 0,
    risk_groups: riskGroups,
    execution_matrix: executionMatrix,
    real_execution_supported_count: realExecutionCount,
    confirmed_low_risk_count: confirmedLowRisk.length,
    confirmed_low_risk_enabled: confirmedLowRisk,
    future_execution_candidates: futureCandidates,
    never_execute: neverExecute,
    notes: "Phase 5C-4 Policy Review + 5C-2C-A Canary. All commands classified. 5 confirmed_low_risk commands enabled for real execution. No commands need policy review. High/danger/media/timer/disabled commands never execute from public UI. Safe/medium dry_run_only commands may be candidates for future confirmed execution.",
  };

  writeFileSync(REVIEW_PATH, JSON.stringify(review, null, 2));
  console.log(`Policy review built: ${total} commands, ${needsReview} need review, ${futureCandidates.length} future candidates, ${neverExecute.length} never execute.`);
  console.log(`Written to: ${REVIEW_PATH}`);
}

main();
