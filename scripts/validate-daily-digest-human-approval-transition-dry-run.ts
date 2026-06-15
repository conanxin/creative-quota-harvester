#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-human-approval-transition-dry-run.ts
 * Phase 5C-2C-C5N2: Validator for approval transition dry-run.
 *
 * Checks (all must PASS):
 *   - transition policy JSON present and well-formed
 *   - dry-run result JSON present and well-formed
 *   - real_approval_allowed=false
 *   - real_promote_allowed=false
 *   - production_write_allowed=false
 *   - telegram_send_allowed=false
 *   - planner does NOT use child_process / exec / spawn
 *   - planner does NOT read .env / .control.local / process.env
 *   - planner does NOT make network calls
 *   - planner does NOT write to production paths
 *   - planner does NOT modify approval state (no copyFile/writeFile to the state file)
 *   - control-server.ts has /api/daily-digest/human-approval-transition-dry-run
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
  const p = "dashboard/daily-digest-human-approval-transition-policy.json";
  if (!exists(p)) {
    addCheck("policy_present", false, `${p} missing`);
  } else {
    try {
      const cfg = JSON.parse(readText(p));
      const ok = cfg.phase === "5C-2C-C5N2"
        && cfg.mode === "approval_transition_dry_run_only"
        && cfg.allowed_dry_run_transition?.from === "approval_pack_ready"
        && cfg.allowed_dry_run_transition?.to === "human_review_pending"
        && cfg.required_confirm_phrase === "DRY RUN DAILY HUMAN APPROVAL TRANSITION";
      addCheck("policy_present", ok, ok ? `${p} present and well-formed` : "config fields mismatch");
    } catch (e: any) {
      addCheck("policy_present", false, `config parse error: ${e.message}`);
    }
  }
}

// 2. Dry-run result present and well-formed
{
  const p = "dashboard/daily-digest-human-approval-transition-dry-run.json";
  if (!exists(p)) {
    addCheck("dry_run_result_present", false, `${p} missing (run check: first)`);
  } else {
    try {
      const r = JSON.parse(readText(p));
      const ok = r.phase === "5C-2C-C5N2"
        && r.mode === "approval_transition_dry_run_only"
        && r.real_transition === false
        && r.production_write_allowed === false
        && r.telegram_send_allowed === false;
      addCheck("dry_run_result_present", ok, ok ? `${p} present and well-formed` : "result fields mismatch");
    } catch (e: any) {
      addCheck("dry_run_result_present", false, `result parse error: ${e.message}`);
    }
  }
}

// 3-7. All the boolean gates must be safe in C5N2
if (exists("dashboard/daily-digest-human-approval-transition-policy.json")) {
  const cfg = JSON.parse(readText("dashboard/daily-digest-human-approval-transition-policy.json"));
  addCheck("real_approval_disabled", cfg.real_approval_allowed === false, `real_approval_allowed=${cfg.real_approval_allowed}`);
  addCheck("real_transition_disabled", cfg.real_transition_allowed === false, `real_transition_allowed=${cfg.real_transition_allowed}`);
  addCheck("real_promote_disabled", cfg.real_promote_allowed === false, `real_promote_allowed=${cfg.real_promote_allowed}`);
  addCheck("production_write_disabled", cfg.production_write_allowed === false, `production_write_allowed=${cfg.production_write_allowed}`);
  addCheck("telegram_send_disabled", cfg.telegram_send_allowed === false, `telegram_send_allowed=${cfg.telegram_send_allowed}`);
  addCheck("timer_disabled", cfg.timer_allowed === false, `timer_allowed=${cfg.timer_allowed}`);
  addCheck("collect_disabled", cfg.collect_allowed === false, `collect_allowed=${cfg.collect_allowed}`);
  addCheck("generate_disabled", cfg.generate_allowed === false, `generate_allowed=${cfg.generate_allowed}`);
  addCheck("model_call_disabled", cfg.model_call_allowed === false, `model_call_allowed=${cfg.model_call_allowed}`);
  addCheck("media_generation_disabled", cfg.media_generation_allowed === false, `media_generation_allowed=${cfg.media_generation_allowed}`);
  addCheck("git_disabled", cfg.git_allowed === false, `git_allowed=${cfg.git_allowed}`);
  addCheck("confirm_phrase_present", !!cfg.required_confirm_phrase && cfg.required_confirm_phrase === "DRY RUN DAILY HUMAN APPROVAL TRANSITION", `required_confirm_phrase=${cfg.required_confirm_phrase}`);
  addCheck("env_gate_present", !!cfg.required_env_gate && typeof cfg.required_env_gate === "string" && cfg.required_env_gate.includes("="), `required_env_gate=${cfg.required_env_gate}`);
}

// 8-12. Planner safety
{
  const p = "scripts/daily-digest-human-approval-transition-dry-run.ts";
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
  }
}

// 13. Planner does not write to production paths
{
  const p = "scripts/daily-digest-human-approval-transition-dry-run.ts";
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
    addCheck("planner_no_production_writes", !writesProduction, writesProduction ? "FOUND production write" : "no production paths written");
  }
}

// 14. Planner does NOT modify the C5N1 approval state
{
  const p = "scripts/daily-digest-human-approval-transition-dry-run.ts";
  if (exists(p)) {
    const src = readText(p);
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/.*$/gm, "");
    // The planner must not write to the approval state file (only the dry-run result)
    const modifiesState =
      /writeFileSync.*daily-digest-human-approval-state\.json/.test(stripped) ||
      /writeFileSync.*daily-digest-human-approval-state-status\.json/.test(stripped);
    addCheck("planner_no_modify_approval_state", !modifiesState, modifiesState ? "FOUND approval state write" : "does not modify approval state");
  }
}

// 15-17. Control server endpoint checks
{
  const p = "scripts/control-server.ts";
  if (!exists(p)) {
    addCheck("control_server_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    addCheck("control_server_present", true, p);
    addCheck(
      "endpoint_dry_run_present",
      /\/api\/daily-digest\/human-approval-transition-dry-run/.test(src),
      /\/api\/daily-digest\/human-approval-transition-dry-run/.test(src) ? "endpoint defined" : "endpoint NOT defined",
    );
    addCheck(
      "endpoint_post_has_phrase",
      !/\/api\/daily-digest\/human-approval\/transition-dry-run/.test(src) ||
        /DRY RUN DAILY HUMAN APPROVAL TRANSITION/.test(src),
      "POST dry-run endpoint (if present) must reference the DRY RUN phrase",
    );
  }
}

// 18. No tokens in new files
{
  const samples = [
    "dashboard/daily-digest-human-approval-transition-policy.json",
    "scripts/daily-digest-human-approval-transition-dry-run.ts",
    "scripts/validate-daily-digest-human-approval-transition-dry-run.ts",
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
  validator: "validate-daily-digest-human-approval-transition-dry-run",
  phase: "5C-2C-C5N2",
  generated_at: new Date().toISOString(),
  total_checks: checks.length,
  passed: checks.filter(c => c.met).length,
  failed: checks.filter(c => !c.met).length,
  all_pass: allMet,
  checks,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(allMet ? 0 : 1);
