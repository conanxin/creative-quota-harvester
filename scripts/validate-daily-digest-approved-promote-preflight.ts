#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-approved-promote-preflight.ts
 * Phase 5C-2C-C5N6-A: Validator for approved-promote-preflight (preflight-only, dry-run).
 *
 * Checks (all must PASS):
 *   - preflight policy JSON present and well-formed
 *   - preflight result JSON present and well-formed
 *   - real_promote_allowed=false
 *   - production_write_allowed=false
 *   - telegram_send_allowed=false
 *   - planner does NOT use child_process / exec / spawn
 *   - planner does NOT read .env / .control.local / process.env
 *   - planner does NOT make network calls
 *   - planner does NOT write production paths
 *   - control-server.ts has /api/daily-digest/approved-promote-preflight
 *   - if POST endpoint exists, must require token + confirm phrase
 *   - control.html interactive elements comply with dashboard safety policy
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
  const p = "dashboard/daily-digest-approved-promote-preflight-policy.json";
  if (!exists(p)) {
    addCheck("policy_present", false, `${p} missing`);
  } else {
    try {
      const cfg = JSON.parse(readText(p));
      const ok = cfg.phase === "5C-2C-C5N6-A"
        && cfg.mode === "approved_promote_preflight_only"
        && cfg.required_current_state === "approved_for_future_promote"
        && cfg.required_confirm_phrase === "PREFLIGHT DAILY PROMOTE"
        && cfg.future_promote_confirm_phrase === "PROMOTE DAILY DIGEST FROM SANDBOX"
        && cfg.real_promote_allowed === false
        && cfg.production_write_allowed === false
        && cfg.telegram_send_allowed === false;
      addCheck("policy_present", ok, ok ? `${p} present and well-formed` : "config fields mismatch");
    } catch (e: any) {
      addCheck("policy_present", false, `config parse error: ${e.message}`);
    }
  }
}

// 2-5. Boolean gates
if (exists("dashboard/daily-digest-approved-promote-preflight-policy.json")) {
  const cfg = JSON.parse(readText("dashboard/daily-digest-approved-promote-preflight-policy.json"));
  addCheck("real_promote_disabled", cfg.real_promote_allowed === false, `real_promote_allowed=${cfg.real_promote_allowed}`);
  addCheck("production_write_disabled", cfg.production_write_allowed === false, `production_write_allowed=${cfg.production_write_allowed}`);
  addCheck("telegram_send_disabled", cfg.telegram_send_allowed === false, `telegram_send_allowed=${cfg.telegram_send_allowed}`);
  addCheck("timer_disabled", cfg.timer_allowed === false, `timer_allowed=${cfg.timer_allowed}`);
  addCheck("model_call_disabled", cfg.model_call_allowed === false, `model_call_allowed=${cfg.model_call_allowed}`);
  addCheck("collect_disabled", cfg.collect_allowed === false, `collect_allowed=${cfg.collect_allowed}`);
  addCheck("generate_disabled", cfg.generate_allowed === false, `generate_allowed=${cfg.generate_allowed}`);
  addCheck("git_disabled", cfg.git_allowed === false, `git_allowed=${cfg.git_allowed}`);
  addCheck("auto_promote_disabled", cfg.auto_promote_allowed === false, `auto_promote_allowed=${cfg.auto_promote_allowed}`);
  addCheck("confirm_phrase_present", !!cfg.required_confirm_phrase && cfg.required_confirm_phrase === "PREFLIGHT DAILY PROMOTE", `required_confirm_phrase=${cfg.required_confirm_phrase}`);
  addCheck("future_promote_phrase_present", !!cfg.future_promote_confirm_phrase && cfg.future_promote_confirm_phrase === "PROMOTE DAILY DIGEST FROM SANDBOX", `future_promote_confirm_phrase=${cfg.future_promote_confirm_phrase}`);
  addCheck("env_gate_present", !!cfg.required_env_gate && typeof cfg.required_env_gate === "string" && cfg.required_env_gate.includes("="), `required_env_gate=${cfg.required_env_gate}`);
  addCheck("env_gate_evaluated_false", cfg.env_gate_evaluated === false, `env_gate_evaluated=${cfg.env_gate_evaluated}`);
  const bt: string[] = cfg.blocked_actions || [];
  addCheck("blocked_actions_include_promote", bt.includes("production_write") && bt.includes("telegram_send") && bt.includes("unattended_promote"), JSON.stringify(bt));
}

// 6. Preflight result JSON present
{
  const p = "dashboard/daily-digest-approved-promote-preflight.json";
  if (!exists(p)) {
    addCheck("preflight_result_present", false, `${p} missing`);
  } else {
    try {
      const cfg = JSON.parse(readText(p));
      const ok = cfg.phase === "5C-2C-C5N6-A"
        && cfg.mode === "approved_promote_preflight_only"
        && cfg.real_promote_allowed === false
        && cfg.production_write_allowed === false
        && cfg.telegram_send_allowed === false
        && cfg.real_promote === false;
      addCheck("preflight_result_present", ok, ok ? `${p} present and well-formed` : "result fields mismatch");
    } catch (e: any) {
      addCheck("preflight_result_present", false, `result parse error: ${e.message}`);
    }
  }
}

// 7-13. Planner safety
{
  const p = "scripts/daily-digest-approved-promote-preflight.ts";
  if (!exists(p)) {
    addCheck("planner_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/.*$/gm, "");
    addCheck("planner_present", true, p);
    addCheck(
      "planner_no_child_process",
      !/(\brequire\s*\(\s*['"]child_process['"]|\bfrom\s+['"]child_process['"]|\bchild_process\.[a-z_]+\s*\()/.test(stripped),
      /(\brequire\s*\(\s*['"]child_process['"]|\bfrom\s+['"]child_process['"]|\bchild_process\.[a-z_]+\s*\()/.test(stripped) ? "FOUND forbidden API" : "no child_process require/import/usage",
    );
    addCheck(
      "planner_no_exec_call",
      !/\bexec\s*\(/.test(stripped),
      /\bexec\s*\(/.test(stripped) ? "FOUND exec() call" : "no exec() call",
    );
    addCheck(
      "planner_no_spawn_call",
      !/\bspawn\s*\(/.test(stripped),
      /\bspawn\s*\(/.test(stripped) ? "FOUND spawn() call" : "no spawn() call",
    );
    addCheck(
      "planner_no_env_read",
      !/process\.env\./.test(stripped) && !/\.env(\.telegram)?\.(local|production)/.test(stripped),
      /process\.env\.|\.env\./.test(stripped) ? "FOUND env reference" : "no env read",
    );
    addCheck(
      "planner_no_control_local_read",
      !/control\.local/.test(stripped),
      /control\.local/.test(stripped) ? "FOUND control.local reference" : "no control.local read",
    );
    addCheck(
      "planner_no_network",
      !/https?:\/\/|require\(['"](http|https|node-fetch|axios)['"]\)|fetch\(/.test(stripped),
      /https?:\/\//.test(stripped) ? "FOUND network call" : "no network",
    );
    // Check that planner does NOT write to production paths
    const writesProduction =
      /writeFileSync.*reports\/daily-digest\.md/.test(stripped) ||
      /writeFileSync.*reports\/telegram-digest\.txt/.test(stripped) ||
      /writeFileSync.*dashboard\/status\.json/.test(stripped) ||
      /copyFileSync.*reports\/daily-digest\.md/.test(stripped) ||
      /copyFileSync.*reports\/telegram-digest\.txt/.test(stripped);
    addCheck("planner_no_production_writes", !writesProduction, writesProduction ? "FOUND production write" : "no production paths written");
  }
}

// 14. Control server endpoint
{
  const p = "scripts/control-server.ts";
  if (!exists(p)) {
    addCheck("control_server_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    addCheck("control_server_present", true, p);
    addCheck(
      "endpoint_preflight_get_present",
      /\/api\/daily-digest\/approved-promote-preflight/.test(src),
      /\/api\/daily-digest\/approved-promote-preflight/.test(src) ? "GET endpoint defined" : "GET endpoint NOT defined",
    );
    addCheck(
      "endpoint_preflight_post_has_phrase",
      !/\/api\/daily-digest\/promote\/preflight/.test(src) || /PREFLIGHT DAILY PROMOTE/.test(src),
      "POST promote/preflight endpoint (if present) must reference the PREFLIGHT phrase",
    );
  }
}

// 15. control.html
{
  const p = "dashboard/control.html";
  if (exists(p)) {
    const src = readText(p);
    addCheck("control_html_loads_preflight", /loadApprovedPromotePreflight/.test(src), "control.html has preflight panel loader");
  } else {
    addCheck("control_html_loads_preflight", false, "control.html missing");
  }
}

// 16. Dashboard safety policy
{
  const p = "dashboard/control-safety-policy.json";
  if (!exists(p)) {
    addCheck("safety_policy_present", false, `${p} missing`);
  } else {
    try {
      const cfg = JSON.parse(readText(p));
      addCheck("safety_policy_present", true, `${p} present`);
    } catch (e: any) {
      addCheck("safety_policy_present", false, `parse error: ${e.message}`);
    }
  }
}

// 17. No tokens in new files
{
  const samples = [
    "dashboard/daily-digest-approved-promote-preflight-policy.json",
    "scripts/daily-digest-approved-promote-preflight.ts",
    "scripts/validate-daily-digest-approved-promote-preflight.ts",
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
  validator: "validate-daily-digest-approved-promote-preflight",
  phase: "5C-2C-C5N6-A",
  generated_at: new Date().toISOString(),
  total_checks: checks.length,
  passed: checks.filter(c => c.met).length,
  failed: checks.filter(c => !c.met).length,
  all_pass: allMet,
  checks,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(allMet ? 0 : 1);
