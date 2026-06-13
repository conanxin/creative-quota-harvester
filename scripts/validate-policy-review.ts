#!/usr/bin/env tsx
/**
 * scripts/validate-policy-review.ts — Phase 5C-4
 *
 * Validates dashboard/policy-review.json:
 *  - Valid JSON
 *  - All commands reviewed (needs_policy_review === 0)
 *  - High/danger commands NOT in future_execution_candidates
 *  - Media generation commands NOT in future_execution_candidates
 *  - Timer modification commands NOT in future_execution_candidates
 *  - No secrets
 *  - All fields present
 *
 * Usage: npm run dashboard:policy:validate
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const HARVESTER_DIR = "/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester";
const REVIEW_PATH = join(HARVESTER_DIR, "dashboard", "policy-review.json");

let passes = 0;
let failures = 0;

function pass(msg: string) { console.log(`PASS  ${msg}`); passes++; }
function fail(msg: string) { console.log(`FAIL  ${msg}`); failures++; }

console.log("=== Policy Review Validation (Phase 5C-4) ===");

if (!existsSync(REVIEW_PATH)) {
  fail(`policy-review.json not found: ${REVIEW_PATH}`);
  console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
  console.log("RESULT: FAIL");
  process.exit(1);
}

const raw = readFileSync(REVIEW_PATH, "utf-8");
let review: any = null;
try {
  review = JSON.parse(raw);
  pass(`policy-review.json: valid JSON (${raw.length} chars)`);
} catch (e: any) {
  fail(`policy-review.json: JSON parse error: ${e.message}`);
  console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
  console.log("RESULT: FAIL");
  process.exit(1);
}

// No secrets
const FORBIDDEN = [
  /sk-[A-Za-z0-9_-]{20,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /TELEGRAM_BOT_TOKEN\s*=\s*[\w-]{8,}/g,
  /MINIMAX_API_KEY\s*=\s*[\w-]{8,}/g,
  /\[truncated\]/gi,
];
let anyForbidden = false;
for (const re of FORBIDDEN) {
  const m = raw.match(re);
  if (m && m.length > 0) {
    fail(`policy-review.json contains forbidden pattern: ${m[0].slice(0, 40)}`);
    anyForbidden = true;
  }
}
if (!anyForbidden) pass(`policy-review.json: no secrets / tokens / [truncated]`);

// Required fields
const requiredTop = ["version", "phase", "generated_at", "total_commands", "classified", "needs_policy_review", "risk_counts", "execution_mode_counts", "source_counts", "all_commands_reviewed", "future_execution_candidates", "never_execute"];
for (const f of requiredTop) {
  if (review[f] === undefined) {
    fail(`policy-review.json missing field: ${f}`);
  } else {
    pass(`policy-review.json has field: ${f}`);
  }
}

// needs_policy_review must be 0
if (review.needs_policy_review === 0) {
  pass(`needs_policy_review === 0 (all commands reviewed)`);
} else {
  fail(`needs_policy_review === ${review.needs_policy_review} (expected 0)`);
}

// all_commands_reviewed must be true
if (review.all_commands_reviewed === true) {
  pass(`all_commands_reviewed === true`);
} else {
  fail(`all_commands_reviewed === ${review.all_commands_reviewed} (expected true)`);
}

// version and phase
if (review.version === "0.4.0") pass(`version === 0.4.0`);
else fail(`version === ${review.version} (expected 0.4.0)`);

if (review.phase === "5C-4") pass(`phase === 5C-4`);
else fail(`phase === ${review.phase} (expected 5C-4)`);

// total_commands > 0
if (review.total_commands > 0) pass(`total_commands = ${review.total_commands}`);
else fail(`total_commands = ${review.total_commands} (expected > 0)`);

// classified === total_commands
if (review.classified === review.total_commands) {
  pass(`classified === total_commands (${review.classified})`);
} else {
  fail(`classified (${review.classified}) !== total_commands (${review.total_commands})`);
}

// risk_counts sum === total
const riskSum = (review.risk_counts?.safe || 0) + (review.risk_counts?.medium || 0) + (review.risk_counts?.high || 0) + (review.risk_counts?.danger || 0);
if (riskSum === review.total_commands) {
  pass(`risk_counts sum = ${riskSum} === total_commands`);
} else {
  fail(`risk_counts sum = ${riskSum} !== total_commands = ${review.total_commands}`);
}

// execution_mode_counts sum === total
const modeSum = (review.execution_mode_counts?.safe_readonly || 0) + (review.execution_mode_counts?.dry_run_only || 0) + (review.execution_mode_counts?.disabled || 0);
if (modeSum === review.total_commands) {
  pass(`execution_mode_counts sum = ${modeSum} === total_commands`);
} else {
  fail(`execution_mode_counts sum = ${modeSum} !== total_commands = ${review.total_commands}`);
}

// source_counts sum === total
const sourceSum = (review.source_counts?.["package-script"] || 0) + (review.source_counts?.manual || 0) + (review.source_counts?.generated || 0);
if (sourceSum === review.total_commands) {
  pass(`source_counts sum = ${sourceSum} === total_commands`);
} else {
  fail(`source_counts sum = ${sourceSum} !== total_commands = ${review.total_commands}`);
}

// Future execution candidates: no high/danger/media/timer
let futureOk = true;
for (const c of review.future_execution_candidates || []) {
  const r = (c.risk || "").toLowerCase();
  if (r === "high" || r === "danger") {
    fail(`Future candidate ${c.id} has risk=${r} (high/danger not allowed)`);
    futureOk = false;
  }
  if (c.reason && (c.reason.includes("calls_model") || c.reason.includes("generates_media") || c.reason.includes("modifies_timer"))) {
    fail(`Future candidate ${c.id} has media/timer/model reason: ${c.reason}`);
    futureOk = false;
  }
}
if (futureOk) pass("future_execution_candidates: no high/danger/media/timer");

// Never execute: must contain high/danger/media/timer/disabled
let neverOk = true;
const highDanger = (review.risk_counts?.high || 0) + (review.risk_counts?.danger || 0);
const disabled = review.execution_mode_counts?.disabled || 0;
const expectedNever = highDanger + disabled; // approximation
if (review.never_execute.length < expectedNever) {
  fail(`never_execute count (${review.never_execute.length}) < expected (${expectedNever})`);
  neverOk = false;
}
for (const c of review.never_execute || []) {
  const r = (c.risk || "").toLowerCase();
  if (r !== "high" && r !== "danger" && !c.reason.includes("disabled") && !c.reason.includes("calls_model") && !c.reason.includes("generates_media") && !c.reason.includes("modifies_timer")) {
    fail(`never_execute ${c.id}: risk=${r}, reason=${c.reason} — unclear why never execute`);
    neverOk = false;
  }
}
if (neverOk) pass("never_execute: contains high/danger/media/timer/disabled");

console.log(`\nSummary: PASS=${passes}  FAIL=${failures}`);
if (failures > 0) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
process.exit(0);
