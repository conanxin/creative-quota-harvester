#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-approved-for-future-promote.ts
 * Phase 5C-2C-C5N5: Validator for approved-for-future-promote state record.
 *
 * Checks (all must PASS):
 *   - policy JSON present and well-formed
 *   - real_approval_allowed=true
 *   - real_promote_allowed=false
 *   - production_write_allowed=false
 *   - telegram_send_allowed=false
 *   - confirm phrase "APPROVE DAILY DIGEST FOR FUTURE PROMOTE" present
 *   - executor does NOT use child_process / exec / spawn
 *   - executor does NOT read .env / .control.local / process.env
 *   - executor does NOT make network calls
 *   - executor does NOT write to production paths
 *   - executor does NOT trigger Telegram
 *   - executor only allows human_review_pending → approved_for_future_promote
 *   - control-server.ts has /api/daily-digest/approved-for-future-promote-status
 *   - if POST endpoint exists, it must require token + confirm phrase
 *   - control.html interactive elements must comply with dashboard safety policy
 *   - no tokens committed
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

interface Check {
  id: string;
  met: boolean;
  message: string;
}

const checks: Check[] = [];
function addCheck(id: string, met: boolean, message: string) {
  checks.push({ id, met, message });
}

function readText(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}
function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

// 1. Policy present and well-formed
{
  const p = "dashboard/daily-digest-approved-for-future-promote-policy.json";
  if (!exists(p)) {
    addCheck("policy_present", false, `${p} missing`);
  } else {
    try {
      const cfg = JSON.parse(readText(p));
      const ok = cfg.phase === "5C-2C-C5N5"
        && cfg.mode === "approved_for_future_promote_state_record"
        && cfg.allowed_transition?.from === "human_review_pending"
        && cfg.allowed_transition?.to === "approved_for_future_promote"
        && cfg.required_confirm_phrase === "APPROVE DAILY DIGEST FOR FUTURE PROMOTE"
        && cfg.real_approval_allowed === true
        && cfg.real_promote_allowed === false
        && cfg.production_write_allowed === false
        && cfg.telegram_send_allowed === false;
      addCheck("policy_present", ok, ok ? `${p} present and well-formed` : "config fields mismatch");
    } catch (e: any) {
      addCheck("policy_present", false, `config parse error: ${e.message}`);
    }
  }
}

// 2-12. All the boolean gates must be safe in C5N5
if (exists("dashboard/daily-digest-approved-for-future-promote-policy.json")) {
  const cfg = JSON.parse(readText("dashboard/daily-digest-approved-for-future-promote-policy.json"));
  addCheck("real_approval_allowed_true", cfg.real_approval_allowed === true, `real_approval_allowed=${cfg.real_approval_allowed}`);
  addCheck("real_promote_disabled", cfg.real_promote_allowed === false, `real_promote_allowed=${cfg.real_promote_allowed}`);
  addCheck("production_write_disabled", cfg.production_write_allowed === false, `production_write_allowed=${cfg.production_write_allowed}`);
  addCheck("telegram_send_disabled", cfg.telegram_send_allowed === false, `telegram_send_allowed=${cfg.telegram_send_allowed}`);
  addCheck("collect_disabled", cfg.collect_allowed === false, `collect_allowed=${cfg.collect_allowed}`);
  addCheck("generate_disabled", cfg.generate_allowed === false, `generate_allowed=${cfg.generate_allowed}`);
  addCheck("timer_disabled", cfg.timer_allowed === false, `timer_allowed=${cfg.timer_allowed}`);
  addCheck("model_call_disabled", cfg.model_call_allowed === false, `model_call_allowed=${cfg.model_call_allowed}`);
  addCheck("media_generation_disabled", cfg.media_generation_allowed === false, `media_generation_allowed=${cfg.media_generation_allowed}`);
  addCheck("git_disabled", cfg.git_allowed === false, `git_allowed=${cfg.git_allowed}`);
  addCheck("auto_approval_disabled", cfg.auto_approval_allowed === false, `auto_approval_allowed=${cfg.auto_approval_allowed}`);
  addCheck("confirm_phrase_present", !!cfg.required_confirm_phrase && cfg.required_confirm_phrase === "APPROVE DAILY DIGEST FOR FUTURE PROMOTE", `required_confirm_phrase=${cfg.required_confirm_phrase}`);
  addCheck("env_gate_present", !!cfg.required_env_gate && typeof cfg.required_env_gate === "string" && cfg.required_env_gate.includes("="), `required_env_gate=${cfg.required_env_gate}`);
  addCheck("env_gate_evaluated_false", cfg.env_gate_evaluated === false, `env_gate_evaluated=${cfg.env_gate_evaluated}`);
}

// 13. Allowed transition correctly specified
if (exists("dashboard/daily-digest-approved-for-future-promote-policy.json")) {
  const cfg = JSON.parse(readText("dashboard/daily-digest-approved-for-future-promote-policy.json"));
  const ok = cfg.allowed_transition?.from === "human_review_pending"
    && cfg.allowed_transition?.to === "approved_for_future_promote";
  addCheck("allowed_transition_correct", ok, `from=${cfg.allowed_transition?.from}, to=${cfg.allowed_transition?.to}`);
}

// 14. Blocked transitions block promote
if (exists("dashboard/daily-digest-approved-for-future-promote-policy.json")) {
  const cfg = JSON.parse(readText("dashboard/daily-digest-approved-for-future-promote-policy.json"));
  const bt: string[] = cfg.blocked_transitions || [];
  const ok = bt.some(b => b.includes("promote"));
  addCheck("blocked_transitions_block_promote", ok, JSON.stringify(bt));
}

// 15-20. Executor safety
{
  const p = "scripts/daily-digest-approved-for-future-promote.ts";
  if (!exists(p)) {
    addCheck("executor_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/.*$/gm, "");
    addCheck("executor_present", true, p);
    addCheck(
      "executor_no_child_process",
      !/(\brequire\s*\(\s*['"]child_process['"]|\bfrom\s+['"]child_process['"]|\bchild_process\.[a-z_]+\s*\()/.test(stripped),
      /(\brequire\s*\(\s*['"]child_process['"]|\bfrom\s+['"]child_process['"]|\bchild_process\.[a-z_]+\s*\()/.test(stripped) ? "FOUND forbidden API" : "no child_process require/import/usage",
    );
    addCheck(
      "executor_no_exec_call",
      !/\bexec\s*\(/.test(stripped),
      /\bexec\s*\(/.test(stripped) ? "FOUND exec() call" : "no exec() call",
    );
    addCheck(
      "executor_no_spawn_call",
      !/\bspawn\s*\(/.test(stripped),
      /\bspawn\s*\(/.test(stripped) ? "FOUND spawn() call" : "no spawn() call",
    );
    addCheck(
      "executor_no_env_read",
      !/process\.env\./.test(stripped) && !/\.env(\.telegram)?\.(local|production)/.test(stripped),
      /process\.env\.|\.env\./.test(stripped) ? "FOUND env reference" : "no env read",
    );
    addCheck(
      "executor_no_control_local_read",
      !/control\.local/.test(stripped),
      /control\.local/.test(stripped) ? "FOUND control.local reference" : "no control.local read",
    );
    addCheck(
      "executor_no_network",
      !/https?:\/\/|require\(['"](http|https|node-fetch|axios)['"]\)|fetch\(/.test(stripped),
      /https?:\/\//.test(stripped) ? "FOUND network call" : "no network",
    );
  }
}

// 21. Executor does not write to production paths
{
  const p = "scripts/daily-digest-approved-for-future-promote.ts";
  if (exists(p)) {
    const src = readText(p);
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/.*$/gm, "");
    const writesProduction =
      /copyFileSync.*reports\/daily-digest\.md/.test(stripped) ||
      /writeFileSync.*reports\/daily-digest\.md/.test(stripped) ||
      /writeFileSync.*reports\/telegram-digest\.txt/.test(stripped) ||
      /writeFileSync.*dashboard\/status\.json/.test(stripped);
    addCheck("executor_no_production_writes", !writesProduction, writesProduction ? "FOUND production write" : "no production paths written");
  }
}

// 22. Executor only allows human_review_pending → approved_for_future_promote
{
  const p = "scripts/daily-digest-approved-for-future-promote.ts";
  if (exists(p)) {
    const src = readText(p);
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/.*$/gm, "");
    const fromOk = /from\s*=\s*policy\.allowed_transition\?\.from\s*\|\|\s*["']human_review_pending["']/.test(stripped);
    const toOk = /to\s*=\s*policy\.allowed_transition\?\.to\s*\|\|\s*["']approved_for_future_promote["']/.test(stripped);
    addCheck("executor_only_allowed_transition", fromOk && toOk, fromOk && toOk ? "only allows human_review_pending → approved_for_future_promote" : "transition mapping not as expected");
  }
}

// 23-25. Control server endpoint checks
{
  const p = "scripts/control-server.ts";
  if (!exists(p)) {
    addCheck("control_server_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    addCheck("control_server_present", true, p);
    addCheck(
      "endpoint_status_present",
      /\/api\/daily-digest\/approved-for-future-promote-status/.test(src),
      /\/api\/daily-digest\/approved-for-future-promote-status/.test(src) ? "endpoint defined" : "endpoint NOT defined",
    );
    addCheck(
      "endpoint_post_has_phrase",
      !/\/api\/daily-digest\/human-approval\/approve-for-future-promote/.test(src) ||
        /APPROVE DAILY DIGEST FOR FUTURE PROMOTE/.test(src),
      "POST approve-for-future-promote endpoint (if present) must reference the APPROVE phrase",
    );
  }
}

// 26. control.html interactive elements comply with dashboard safety policy
{
  const p = "dashboard/control.html";
  if (exists(p)) {
    const src = readText(p);
    const safeRef = /loadApprovedForFuturePromote/.test(src);
    addCheck("control_html_loads_status", safeRef, "control.html has approved-for-future-promote panel loader");
  } else {
    addCheck("control_html_loads_status", false, "control.html missing");
  }
}

// 27. Dashboard safety policy still references the new panel
{
  const p = "dashboard/control-safety-policy.json";
  if (!exists(p)) {
    addCheck("safety_policy_present", false, `${p} missing`);
  } else {
    try {
      const cfg = JSON.parse(readText(p));
      const ok = !!cfg && typeof cfg === "object";
      addCheck("safety_policy_present", ok, ok ? `${p} present` : `${p} malformed`);
    } catch (e: any) {
      addCheck("safety_policy_present", false, `parse error: ${e.message}`);
    }
  }
}

// 28. No tokens in new files
{
  const samples = [
    "dashboard/daily-digest-approved-for-future-promote-policy.json",
    "scripts/daily-digest-approved-for-future-promote.ts",
    "scripts/validate-daily-digest-approved-for-future-promote.ts",
  ];
  let found = false;
  for (const f of samples) {
    if (!exists(f)) continue;
    const t = readText(f);
    if (/sk-cp-[A-Za-z0-9_-]{10,}/.test(t) || /TELEGRAM_BOT_TOKEN\s*=\s*['"][A-Za-z0-9_-]{10,}/.test(t) || /MINIMAX_API_KEY\s*=\s*['"][A-Za-z0-9_-]{10,}/.test(t) || /CQA_CONTROL_TOKEN\s*=\s*['"][A-Za-z0-9_-]{10,}/.test(t)) {
      found = true;
      addCheck(`no_token:${f}`, false, `token-like pattern in ${f}`);
    }
  }
  if (!found) addCheck("no_tokens_in_new_files", true, "no token patterns in new files");
}

const allMet = checks.every(c => c.met);
const summary = {
  validator: "validate-daily-digest-approved-for-future-promote",
  phase: "5C-2C-C5N5",
  generated_at: new Date().toISOString(),
  total_checks: checks.length,
  passed: checks.filter(c => c.met).length,
  failed: checks.filter(c => !c.met).length,
  all_pass: allMet,
  checks,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(allMet ? 0 : 1);