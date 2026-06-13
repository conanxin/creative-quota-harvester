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
const requiredTop = ["version", "phase", "generated_at", "total_commands", "classified", "needs_policy_review", "risk_counts", "execution_mode_counts", "source_counts", "all_commands_reviewed", "future_execution_candidates", "never_execute", "real_execution_supported_count", "confirmed_low_risk_count", "confirmed_low_risk_enabled"];
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

// execution_mode_counts sum === total (includes confirmed_low_risk)
const modeSum = (review.execution_mode_counts?.safe_readonly || 0) + (review.execution_mode_counts?.dry_run_only || 0) + (review.execution_mode_counts?.confirmed_low_risk || 0) + (review.execution_mode_counts?.disabled || 0);
if (modeSum === review.total_commands) {
  pass(`execution_mode_counts sum = ${modeSum} === total_commands`);
} else {
  fail(`execution_mode_counts sum = ${modeSum} !== total_commands = ${review.total_commands}`);
}

// Load allowlist for expected confirmed_low_risk count
const allowlistPath = join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json");
let expectedLowRiskCount = 5;
try {
  const al = JSON.parse(readFileSync(allowlistPath, "utf-8"));
  expectedLowRiskCount = al.allowed_scripts?.length || 5;
  pass(`allowlist loaded: ${expectedLowRiskCount} allowed scripts`);
} catch {
  pass("allowlist not found, using default 5");
}

// real_execution_supported_count must equal confirmed_low_risk_count
if (review.real_execution_supported_count === review.confirmed_low_risk_count) {
  pass(`real_execution_supported_count (${review.real_execution_supported_count}) === confirmed_low_risk_count (${review.confirmed_low_risk_count})`);
} else {
  fail(`real_execution_supported_count (${review.real_execution_supported_count}) !== confirmed_low_risk_count (${review.confirmed_low_risk_count})`);
}

// confirmed_low_risk_count must match allowlist size
if (review.confirmed_low_risk_count === expectedLowRiskCount) {
  pass(`confirmed_low_risk_count === ${expectedLowRiskCount} (Phase 5C-2C allowlist)`);
} else {
  fail(`confirmed_low_risk_count === ${review.confirmed_low_risk_count} (expected ${expectedLowRiskCount})`);
}

// confirmed_low_risk_enabled commands must all be safe, no model/media/timer, require confirm
let confirmedOk = true;
for (const c of review.confirmed_low_risk_enabled || []) {
  if ((c.risk || "").toLowerCase() !== "safe") {
    fail(`confirmed_low_risk ${c.id}: risk=${c.risk} (expected safe)`);
    confirmedOk = false;
  }
  if (!c.confirmation_phrase || c.confirmation_phrase === "") {
    fail(`confirmed_low_risk ${c.id}: missing confirmation_phrase`);
    confirmedOk = false;
  }
}
if (confirmedOk) pass(`confirmed_low_risk_enabled: all safe, all have confirmation_phrase`);

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

// Never execute: dynamic check based on catalog
// Load catalog for precise validation
const CATALOG_PATH = join(HARVESTER_DIR, "dashboard", "control-catalog.json");
let catalog: any = null;
try {
  catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
  pass("control-catalog.json loaded for never_execute validation");
} catch (e: any) {
  fail(`control-catalog.json load failed: ${e.message}`);
}

let neverOk = true;
if (catalog) {
  const allCmds: any[] = [];
  for (const g of catalog.command_groups || []) {
    for (const c of g.commands || []) allCmds.push(c);
  }
  
  // Calculate expected never_execute from catalog
  const expectedNever = allCmds.filter((c: any) => {
    const r = (c.risk_level || "").toLowerCase();
    return r === "high" || r === "danger" || c.calls_model || c.generates_media || c.modifies_timer || c.execution_mode === "disabled";
  }).length;
  
  if (review.never_execute.length === expectedNever) {
    pass(`never_execute count (${review.never_execute.length}) === catalog-derived expected (${expectedNever})`);
  } else {
    fail(`never_execute count (${review.never_execute.length}) !== expected (${expectedNever})`);
    neverOk = false;
  }
  
  // Verify real_execution_supported=true commands are in allowlist
  const allowlistPath = join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json");
  let allowlist: string[] = [];
  try {
    const al = JSON.parse(readFileSync(allowlistPath, "utf-8"));
    allowlist = al.allowed_scripts || [];
  } catch {}
  
  const realExecCmds = allCmds.filter((c: any) => c.real_execution_supported === true);
  for (const c of realExecCmds) {
    const scriptName = c.script_name || c.id?.replace(/_/g, ":") || c.id;
    if (!allowlist.includes(scriptName)) {
      fail(`real_execution_supported=true command ${c.id} not in control-execution-allowlist.json`);
      neverOk = false;
    }
    if (c.risk_level !== "safe") {
      fail(`real_execution_supported=true command ${c.id} risk_level=${c.risk_level} (expected safe)`);
      neverOk = false;
    }
    if (c.execution_mode !== "confirmed_low_risk") {
      fail(`real_execution_supported=true command ${c.id} execution_mode=${c.execution_mode} (expected confirmed_low_risk)`);
      neverOk = false;
    }
    if (c.calls_model) {
      fail(`real_execution_supported=true command ${c.id} calls_model=true`);
      neverOk = false;
    }
    if (c.generates_media) {
      fail(`real_execution_supported=true command ${c.id} generates_media=true`);
      neverOk = false;
    }
    if (c.modifies_timer) {
      fail(`real_execution_supported=true command ${c.id} modifies_timer=true`);
      neverOk = false;
    }
  }
  if (realExecCmds.length > 0) {
    pass(`All ${realExecCmds.length} real_execution_supported=true commands validated against allowlist and safety constraints`);
  }
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
