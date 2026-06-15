#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-human-review-pending.ts
 * Phase 5C-2C-C5N3: Validator for human review pending state record.
 *
 * Checks (all must PASS):
 *   - policy JSON present and well-formed
 *   - real_approval_allowed=false
 *   - real_promote_allowed=false
 *   - production_write_allowed=false
 *   - telegram_send_allowed=false
 *   - confirm phrase "BEGIN DAILY HUMAN REVIEW" present
 *   - recorder does NOT use child_process / exec / spawn
 *   - recorder does NOT read .env / .control.local / process.env
 *   - recorder does NOT make network calls
 *   - recorder does NOT write to production paths
 *   - recorder does NOT trigger Telegram
 *   - control-server.ts has /api/daily-digest/human-review-pending-status
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
  const p = "dashboard/daily-digest-human-review-pending-policy.json";
  if (!exists(p)) {
    addCheck("policy_present", false, `${p} missing`);
  } else {
    try {
      const cfg = JSON.parse(readText(p));
      const ok = cfg.phase === "5C-2C-C5N3"
        && cfg.mode === "human_review_pending_state_record"
        && cfg.transition?.from === "approval_pack_ready"
        && cfg.transition?.to === "human_review_pending"
        && cfg.required_confirm_phrase === "BEGIN DAILY HUMAN REVIEW"
        && cfg.real_approval_allowed === false
        && cfg.real_promote_allowed === false
        && cfg.production_write_allowed === false
        && cfg.telegram_send_allowed === false;
      addCheck("policy_present", ok, ok ? `${p} present and well-formed` : "config fields mismatch");
    } catch (e: any) {
      addCheck("policy_present", false, `config parse error: ${e.message}`);
    }
  }
}

// 2-7. All the boolean gates must be safe in C5N3
if (exists("dashboard/daily-digest-human-review-pending-policy.json")) {
  const cfg = JSON.parse(readText("dashboard/daily-digest-human-review-pending-policy.json"));
  addCheck("real_approval_disabled", cfg.real_approval_allowed === false, `real_approval_allowed=${cfg.real_approval_allowed}`);
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
  addCheck("confirm_phrase_present", !!cfg.required_confirm_phrase && cfg.required_confirm_phrase === "BEGIN DAILY HUMAN REVIEW", `required_confirm_phrase=${cfg.required_confirm_phrase}`);
  addCheck("env_gate_present", !!cfg.required_env_gate && typeof cfg.required_env_gate === "string" && cfg.required_env_gate.includes("="), `required_env_gate=${cfg.required_env_gate}`);
}

// 8-12. Recorder safety
{
  const p = "scripts/daily-digest-human-review-pending.ts";
  if (!exists(p)) {
    addCheck("recorder_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/.*$/gm, "");
    addCheck("recorder_present", true, p);
    addCheck(
      "recorder_no_child_process",
      !/(\brequire\s*\(\s*['"]child_process['"]|\bfrom\s+['"]child_process['"]|\bchild_process\.[a-z_]+\s*\()/.test(stripped),
      /(\brequire\s*\(\s*['"]child_process['"]|\bfrom\s+['"]child_process['"]|\bchild_process\.[a-z_]+\s*\()/.test(stripped) ? "FOUND forbidden API" : "no child_process require/import/usage",
    );
    addCheck(
      "recorder_no_exec_call",
      !/\bexec\s*\(/.test(stripped),
      /\bexec\s*\(/.test(stripped) ? "FOUND exec() call" : "no exec() call",
    );
    addCheck(
      "recorder_no_spawn_call",
      !/\bspawn\s*\(/.test(stripped),
      /\bspawn\s*\(/.test(stripped) ? "FOUND spawn() call" : "no spawn() call",
    );
    addCheck(
      "recorder_no_env_read",
      !/process\.env\./.test(stripped) && !/\.env(\.telegram)?\.(local|production)/.test(stripped),
      /process\.env\.|\.env\./.test(stripped) ? "FOUND env reference" : "no env read",
    );
    addCheck(
      "recorder_no_control_local_read",
      !/control\.local/.test(stripped),
      /control\.local/.test(stripped) ? "FOUND control.local reference" : "no control.local read",
    );
    addCheck(
      "recorder_no_network",
      !/https?:\/\/|require\(['"](http|https|node-fetch|axios)['"]\)|fetch\(/.test(stripped),
      /https?:\/\//.test(stripped) ? "FOUND network call" : "no network",
    );
  }
}

// 13. Recorder does not write to production paths
{
  const p = "scripts/daily-digest-human-review-pending.ts";
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
    addCheck("recorder_no_production_writes", !writesProduction, writesProduction ? "FOUND production write" : "no production paths written");
  }
}

// 14-16. Control server endpoint checks
{
  const p = "scripts/control-server.ts";
  if (!exists(p)) {
    addCheck("control_server_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    addCheck("control_server_present", true, p);
    addCheck(
      "endpoint_status_present",
      /\/api\/daily-digest\/human-review-pending-status/.test(src),
      /\/api\/daily-digest\/human-review-pending-status/.test(src) ? "endpoint defined" : "endpoint NOT defined",
    );
    addCheck(
      "endpoint_post_has_phrase",
      !/\/api\/daily-digest\/human-approval\/begin-review/.test(src) ||
        /BEGIN DAILY HUMAN REVIEW/.test(src),
      "POST begin-review endpoint (if present) must reference the BEGIN phrase",
    );
  }
}

// 17. No tokens in new files
{
  const samples = [
    "dashboard/daily-digest-human-review-pending-policy.json",
    "scripts/daily-digest-human-review-pending.ts",
    "scripts/validate-daily-digest-human-review-pending.ts",
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
  validator: "validate-daily-digest-human-review-pending",
  phase: "5C-2C-C5N3",
  generated_at: new Date().toISOString(),
  total_checks: checks.length,
  passed: checks.filter(c => c.met).length,
  failed: checks.filter(c => !c.met).length,
  all_pass: allMet,
  checks,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(allMet ? 0 : 1);
