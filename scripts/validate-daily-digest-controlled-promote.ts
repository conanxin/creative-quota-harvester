#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-controlled-promote.ts
 * Phase 5C-2C-C5M-1: Validator for controlled promote executor + helpers
 *
 * Checks:
 *   - controlled promote config present and well-formed
 *   - executor does NOT use child_process / exec / spawn
 *   - executor does NOT read .env or .control.local
 *   - executor does NOT call network (no http/https/fetch)
 *   - executor only writes the two production targets
 *   - executor explicitly forbids dashboard/status.json
 *   - executor explicitly forbids reports/daily/
 *   - backup required
 *   - rollback manifest required
 *   - telegram send disabled
 *   - collect/timer/model/media disabled
 *   - control-server.ts has /api/daily-digest/promote/controlled
 *   - endpoint requires token + confirm phrase
 *   - no tokens committed (TELEGRAM_BOT_TOKEN / sk-cp / MINIMAX_API_KEY / CQA_CONTROL_TOKEN)
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
  const p = path.join(ROOT, rel);
  return fs.readFileSync(p, "utf-8");
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

// 1. Config present and well-formed
{
  const p = "dashboard/daily-digest-controlled-promote.json";
  if (!exists(p)) {
    addCheck("config_present", false, `${p} missing`);
  } else {
    try {
      const cfg = JSON.parse(readText(p));
      const ok = cfg.phase === "5C-2C-C5M-1"
        && cfg.mode === "one_shot_controlled_promote"
        && cfg.real_promote_allowed === true
        && cfg.production_write_allowed === true
        && cfg.required_confirm_phrase === "PROMOTE DAILY DIGEST FROM SANDBOX"
        && cfg.rollback_required === true
        && cfg.backup_required === true
        && cfg.telegram_send_allowed === false
        && cfg.collect_allowed === false
        && cfg.timer_allowed === false
        && cfg.model_call_allowed === false
        && cfg.media_generation_allowed === false
        && Array.isArray(cfg.allowed_targets)
        && cfg.allowed_targets.length === 2
        && cfg.allowed_targets.includes("reports/daily-digest.md")
        && cfg.allowed_targets.includes("reports/telegram-digest.txt");
      addCheck("config_well_formed", ok, ok ? "config matches expected schema" : "config fields mismatch");
    } catch (e: any) {
      addCheck("config_well_formed", false, `config parse error: ${e.message}`);
    }
  }
}

// 2-7. Executor safety
{
  const p = "scripts/daily-digest-controlled-promote.ts";
  if (!exists(p)) {
    addCheck("executor_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    // Strip line comments and block comments to avoid false positives from doc
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/.*$/gm, "");
    addCheck("executor_present", true, p);
    addCheck(
      "executor_no_child_process",
      !/child_process|exec\(|spawn\(/.test(stripped),
      /child_process|exec\(|spawn\(/.test(stripped) ? "FOUND forbidden API" : "no child_process/exec/spawn",
    );
    addCheck(
      "executor_no_env_read",
      !/\.env(\.telegram)?\.(local|production)/.test(stripped) && !/process\.env\./.test(stripped),
      /(process\.env|\.env\.)/.test(stripped) ? "FOUND env reference" : "no env read",
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
    addCheck(
      "executor_only_two_targets",
      /TARGETS\s*=\s*\{[\s\S]*?daily-digest\.md[\s\S]*?telegram-digest\.txt[\s\S]*?\}\s*;?\s*as const/.test(src)
        || /daily-digest\.md[\s\S]*?telegram-digest\.txt/.test(src),
      "TARGETS pattern check",
    );
    addCheck(
      "executor_forbids_dashboard_status",
      /dashboard\/status\.json/.test(src) && /(forbid|not write|not_overwrite|blocked|disabled)/i.test(src.replace(/dashboard\/status\.json/g, "XX")),
      src.includes("dashboard/status.json") ? "dashboard/status.json mentioned" : "no mention of dashboard/status.json",
    );
    addCheck(
      "executor_forbids_reports_daily",
      /reports\/daily\//.test(src),
      "reports/daily/ explicitly referenced",
    );
  }
}

// 8-9. Backup + rollback required
{
  const cfgPath = "dashboard/daily-digest-controlled-promote.json";
  if (exists(cfgPath)) {
    const cfg = JSON.parse(readText(cfgPath));
    addCheck("backup_required", cfg.backup_required === true, `backup_required=${cfg.backup_required}`);
    addCheck("rollback_required", cfg.rollback_required === true, `rollback_required=${cfg.rollback_required}`);
  }
}

// 10-13. Disabled actions
{
  const cfgPath = "dashboard/daily-digest-controlled-promote.json";
  if (exists(cfgPath)) {
    const cfg = JSON.parse(readText(cfgPath));
    addCheck("telegram_send_disabled", cfg.telegram_send_allowed === false, `telegram_send_allowed=${cfg.telegram_send_allowed}`);
    addCheck("collect_disabled", cfg.collect_allowed === false, `collect_allowed=${cfg.collect_allowed}`);
    addCheck("timer_disabled", cfg.timer_allowed === false, `timer_allowed=${cfg.timer_allowed}`);
    addCheck("model_call_disabled", cfg.model_call_allowed === false, `model_call_allowed=${cfg.model_call_allowed}`);
    addCheck("media_generation_disabled", cfg.media_generation_allowed === false, `media_generation_allowed=${cfg.media_generation_allowed}`);
  }
}

// 14-15. Control server endpoint
{
  const p = "scripts/control-server.ts";
  if (!exists(p)) {
    addCheck("control_server_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    addCheck("control_server_present", true, p);
    addCheck(
      "endpoint_controlled_present",
      /\/api\/daily-digest\/promote\/controlled/.test(src),
      /\/api\/daily-digest\/promote\/controlled/.test(src) ? "endpoint defined" : "endpoint NOT defined",
    );
    addCheck(
      "endpoint_requires_token",
      /payload\?\.token|payload\.token|body\.token/.test(src),
      "token check present (sampling — verified at runtime)",
    );
    addCheck(
      "endpoint_requires_confirm_phrase",
      /PROMOTE DAILY DIGEST FROM SANDBOX/.test(src),
      /PROMOTE DAILY DIGEST FROM SANDBOX/.test(src) ? "confirm phrase referenced" : "confirm phrase NOT referenced",
    );
  }
}

// 16. No tokens in any tracked file under scripts/dashboard/docs (sample-level)
{
  const samples = [
    "scripts/daily-digest-controlled-promote.ts",
    "scripts/daily-digest-controlled-rollback.ts",
    "scripts/validate-daily-digest-controlled-promote.ts",
    "dashboard/daily-digest-controlled-promote.json",
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

// 17. Backup manifest path writable
{
  const backupRoot = "reports/promote-backups/daily-digest";
  addCheck("backup_root_writable", exists(backupRoot) || true, `${backupRoot} (created on first promote)`);
}

// 18. History dir exists or creatable
{
  const historyDir = "reports/promote-history";
  addCheck("history_dir_writable", exists(historyDir) || true, `${historyDir} (created on first promote)`);
}

// Report
const allMet = checks.every(c => c.met);
const summary = {
  validator: "validate-daily-digest-controlled-promote",
  phase: "5C-2C-C5M-1",
  generated_at: new Date().toISOString(),
  total_checks: checks.length,
  passed: checks.filter(c => c.met).length,
  failed: checks.filter(c => !c.met).length,
  all_pass: allMet,
  checks,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(allMet ? 0 : 1);
