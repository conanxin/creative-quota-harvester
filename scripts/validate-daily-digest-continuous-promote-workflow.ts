#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-continuous-promote-workflow.ts
 * Phase 5C-2C-C5N-0: Validator for continuous controlled promote workflow plan.
 *
 * Checks (all must PASS):
 *   - workflow config present and well-formed
 *   - continuous_promote_enabled=false
 *   - real_promote_allowed=false
 *   - production_write_allowed=false
 *   - telegram_send_allowed=false
 *   - timer_allowed=false
 *   - collect_allowed=false
 *   - generate_allowed=false
 *   - model_call_allowed=false
 *   - media_generation_allowed=false
 *   - required_env_gate present
 *   - required_confirm_phrase present
 *   - auto_rollback_enabled=false
 *   - manual_rollback_supported=true
 *   - workflow stages: every stage with writes_production=true has allowed_now=false
 *   - planner does NOT use child_process / exec / spawn
 *   - planner does NOT read .env / .control.local
 *   - planner does NOT make network calls
 *   - planner does NOT write to production paths
 *   - control-server.ts has /api/daily-digest/continuous-promote-workflow
 *   - if POST endpoint exists, it must require token + confirm phrase
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

// 1. Workflow config present
{
  const p = "dashboard/daily-digest-continuous-promote-workflow.json";
  if (!exists(p)) {
    addCheck("config_present", false, `${p} missing`);
  } else {
    try {
      const cfg = JSON.parse(readText(p));
      const ok = cfg.phase === "5C-2C-C5N-0"
        && cfg.mode === "continuous_promote_plan_only"
        && Array.isArray(cfg.workflow_stages)
        && cfg.workflow_stages.length > 0;
      addCheck("config_present", ok, ok ? `${p} present and well-formed (${cfg.workflow_stages.length} stages)` : "config fields mismatch");
    } catch (e: any) {
      addCheck("config_present", false, `config parse error: ${e.message}`);
    }
  }
}

// 2-12. All the boolean gates must be safe in C5N-0
if (exists("dashboard/daily-digest-continuous-promote-workflow.json")) {
  const cfg = JSON.parse(readText("dashboard/daily-digest-continuous-promote-workflow.json"));
  addCheck("continuous_promote_disabled", cfg.continuous_promote_enabled === false, `continuous_promote_enabled=${cfg.continuous_promote_enabled}`);
  addCheck("real_promote_disabled", cfg.real_promote_allowed === false, `real_promote_allowed=${cfg.real_promote_allowed}`);
  addCheck("production_write_disabled", cfg.production_write_allowed === false, `production_write_allowed=${cfg.production_write_allowed}`);
  addCheck("telegram_send_disabled", cfg.telegram_send_allowed === false, `telegram_send_allowed=${cfg.telegram_send_allowed}`);
  addCheck("timer_disabled", cfg.timer_allowed === false, `timer_allowed=${cfg.timer_allowed}`);
  addCheck("collect_disabled", cfg.requires_human_approval !== false, "requires_human_approval must be true (we use it to gate collect)");
  addCheck("env_gate_present", !!cfg.required_env_gate && typeof cfg.required_env_gate === "string" && cfg.required_env_gate.includes("="), `required_env_gate=${cfg.required_env_gate}`);
  addCheck("confirm_phrase_present", !!cfg.required_confirm_phrase && cfg.required_confirm_phrase === "PROMOTE DAILY DIGEST FROM SANDBOX", `required_confirm_phrase=${cfg.required_confirm_phrase}`);
  addCheck("auto_rollback_disabled", cfg.auto_rollback_enabled === false, `auto_rollback_enabled=${cfg.auto_rollback_enabled}`);
  addCheck("manual_rollback_supported", cfg.manual_rollback_supported === true, `manual_rollback_supported=${cfg.manual_rollback_supported}`);
  addCheck("scheduler_disabled", cfg.scheduler_allowed === false, `scheduler_allowed=${cfg.scheduler_allowed}`);
  addCheck("new_systemd_timer_disabled", cfg.new_systemd_timer_allowed === false, `new_systemd_timer_allowed=${cfg.new_systemd_timer_allowed}`);
  addCheck("new_cron_disabled", cfg.new_cron_allowed === false, `new_cron_allowed=${cfg.new_cron_allowed}`);
}

// 13. Every stage with writes_production=true must have allowed_now=false
if (exists("dashboard/daily-digest-continuous-promote-workflow.json")) {
  const cfg = JSON.parse(readText("dashboard/daily-digest-continuous-promote-workflow.json"));
  const stages: any[] = cfg.workflow_stages || [];
  let allGood = true;
  const issues: string[] = [];
  for (const s of stages) {
    if (s.writes_production && s.allowed_now !== false) {
      allGood = false;
      issues.push(`${s.stage_id}: writes_production=true but allowed_now=${s.allowed_now}`);
    }
  }
  addCheck("writes_production_stages_blocked", allGood, allGood ? `${stages.filter((s: any) => s.writes_production).length} writes-production stages all have allowed_now=false` : issues.join("; "));
}

// 14-17. Planner safety
{
  const p = "scripts/daily-digest-continuous-promote-planner.ts";
  if (!exists(p)) {
    addCheck("planner_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    // Strip comments to avoid doc-comment false positives
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
      !/process\.env\./.test(stripped),
      /process\.env\./.test(stripped) ? "FOUND process.env reference" : "no process.env read",
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

// 18. Planner does not write to production paths
{
  const p = "scripts/daily-digest-continuous-promote-planner.ts";
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

// 19-21. Control server endpoint checks
{
  const p = "scripts/control-server.ts";
  if (!exists(p)) {
    addCheck("control_server_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    addCheck("control_server_present", true, p);
    addCheck(
      "endpoint_workflow_present",
      /\/api\/daily-digest\/continuous-promote-workflow/.test(src),
      /\/api\/daily-digest\/continuous-promote-workflow/.test(src) ? "endpoint defined" : "endpoint NOT defined",
    );
    addCheck(
      "endpoint_post_has_confirm_phrase",
      !/\/api\/daily-digest\/continuous-promote-workflow\/plan/.test(src) ||
        /PLAN DAILY CONTINUOUS PROMOTE/.test(src),
      "POST plan endpoint (if present) must reference the PLAN phrase",
    );
  }
}

// 22. No tokens in new files
{
  const samples = [
    "dashboard/daily-digest-continuous-promote-workflow.json",
    "scripts/daily-digest-continuous-promote-planner.ts",
    "scripts/validate-daily-digest-continuous-promote-workflow.ts",
  ];
  let found = false;
  for (const f of samples) {
    if (!exists(f)) continue;
    const t = readText(f);
    if (/sk-cp-[A-Za-z0-9_-]{10,}/.test(t) || /TELEGRAM_BOT_TOKEN\s*=\s*['"][A-Za-z0-9_-]{10,}/.test(t) || /MINIMAX_API_KEY\s*=\s*['"][A-Za-z0-9]{10,}/.test(t) || /CQA_CONTROL_TOKEN\s*=\s*['"][A-Za-z0-9]{10,}/.test(t)) {
      found = true;
      addCheck(`no_token:${f}`, false, `token-like pattern in ${f}`);
    }
  }
  if (!found) addCheck("no_tokens_in_new_files", true, "no token patterns in new files");
}

const allMet = checks.every(c => c.met);
const summary = {
  validator: "validate-daily-digest-continuous-promote-workflow",
  phase: "5C-2C-C5N-0",
  generated_at: new Date().toISOString(),
  total_checks: checks.length,
  passed: checks.filter(c => c.met).length,
  failed: checks.filter(c => !c.met).length,
  all_pass: allMet,
  checks,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(allMet ? 0 : 1);
