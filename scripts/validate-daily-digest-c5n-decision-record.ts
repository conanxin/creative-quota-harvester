#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-c5n-decision-record.ts
 * Phase 5C-2C-C5N4B: Validator for freeze & decision record.
 *
 * Checks (all must PASS):
 *   - decision record JSON present and well-formed
 *   - frozen=true
 *   - approval_state=approved_for_future_promote
 *   - dry_run_boundary_breach=false
 *   - production_write_allowed=false
 *   - telegram_send_allowed=false
 *   - timer_allowed=false
 *   - generator does NOT use child_process / exec / spawn
 *   - generator does NOT read .env / .control.local / process.env
 *   - generator does NOT make network calls
 *   - generator does NOT write production paths
 *   - generator does NOT modify approval state
 *   - control-server.ts has /api/daily-digest/c5n-decision-record
 *   - control.html has loadC5NDecisionRecord
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

const decisionFile = "dashboard/daily-digest-c5n-decision-record.json";

// 1. Decision record present and well-formed
{
  if (!exists(decisionFile)) {
    addCheck("decision_record_present", false, `${decisionFile} missing`);
  } else {
    try {
      const cfg = JSON.parse(readText(decisionFile));
      const ok = cfg.phase === "5C-2C-C5N4B"
        && cfg.mode === "freeze_and_decide"
        && cfg.frozen === true
        && cfg.approval_state === "approved_for_future_promote"
        && cfg.dry_run_boundary_breach === false
        && cfg.promote_block_status?.real_promote_allowed === false
        && cfg.promote_block_status?.production_write_allowed === false
        && cfg.promote_block_status?.telegram_send_allowed === false
        && cfg.promote_block_status?.timer_allowed === false
        && cfg.human_decision_required === true
        && Array.isArray(cfg.decision_options) && cfg.decision_options.length >= 3
        && typeof cfg.default_recommendation === "string";
      addCheck("decision_record_present", ok, ok ? `${decisionFile} present and well-formed` : "fields mismatch");
    } catch (e: any) {
      addCheck("decision_record_present", false, `parse error: ${e.message}`);
    }
  }
}

// 2-3. Boolean gates
if (exists(decisionFile)) {
  const cfg = JSON.parse(readText(decisionFile));
  addCheck("frozen_true", cfg.frozen === true, `frozen=${cfg.frozen}`);
  addCheck("approval_state_correct", cfg.approval_state === "approved_for_future_promote", `approval_state=${cfg.approval_state}`);
  addCheck("dry_run_breach_false", cfg.dry_run_boundary_breach === false, `dry_run_boundary_breach=${cfg.dry_run_boundary_breach}`);
  const pbs = cfg.promote_block_status || {};
  addCheck("real_promote_disabled", pbs.real_promote_allowed === false, `real_promote_allowed=${pbs.real_promote_allowed}`);
  addCheck("production_write_disabled", pbs.production_write_allowed === false, `production_write_allowed=${pbs.production_write_allowed}`);
  addCheck("telegram_send_disabled", pbs.telegram_send_allowed === false, `telegram_send_allowed=${pbs.telegram_send_allowed}`);
  addCheck("timer_disabled", pbs.timer_allowed === false, `timer_allowed=${pbs.timer_allowed}`);
  addCheck("model_call_disabled", pbs.model_call_allowed === false, `model_call_allowed=${pbs.model_call_allowed}`);
  addCheck("media_gen_disabled", pbs.media_generation_allowed === false, `media_generation_allowed=${pbs.media_generation_allowed}`);
  addCheck("collect_disabled", pbs.collect_allowed === false, `collect_allowed=${pbs.collect_allowed}`);
  addCheck("generate_disabled", pbs.generate_allowed === false, `generate_allowed=${pbs.generate_allowed}`);
  addCheck("git_disabled", pbs.git_allowed === false, `git_allowed=${pbs.git_allowed}`);
  addCheck("auto_promote_disabled", pbs.auto_promote_allowed === false, `auto_promote_allowed=${pbs.auto_promote_allowed}`);
  addCheck("human_decision_required", cfg.human_decision_required === true, `human_decision_required=${cfg.human_decision_required}`);
  addCheck("approval_state_origin_present", !!cfg.approval_state_origin && cfg.approval_state_origin.commit === "bb7333d", `approval_state_origin.commit=${cfg.approval_state_origin?.commit}`);
  const blocked: string[] = cfg.blocked_actions || [];
  addCheck("blocked_actions_include_promote", blocked.includes("production_write") && blocked.includes("telegram_send") && blocked.includes("promote") && blocked.includes("rollback") && blocked.includes("approval_state_modification"), JSON.stringify(blocked));
  addCheck("decision_options_count_3", Array.isArray(cfg.decision_options) && cfg.decision_options.length === 3, `decision_options.length=${cfg.decision_options?.length}`);
  addCheck("phase_progression_no_automatic", cfg.phase_progression_rules?.no_automatic_transitions === true && cfg.phase_progression_rules?.all_transitions_require_human_initiation === true, "phase_progression_rules.no_automatic_transitions/all_transitions_require_human_initiation");
}

// 4. Generator safety
{
  const p = "scripts/daily-digest-c5n-decision-record.ts";
  if (!exists(p)) {
    addCheck("generator_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/.*$/gm, "");
    addCheck("generator_present", true, p);
    addCheck(
      "generator_no_child_process",
      !/(\brequire\s*\(\s*['"]child_process['"]|\bfrom\s+['"]child_process['"]|\bchild_process\.[a-z_]+\s*\()/.test(stripped),
      /(\brequire\s*\(\s*['"]child_process['"]|\bfrom\s+['"]child_process['"]|\bchild_process\.[a-z_]+\s*\()/.test(stripped) ? "FOUND forbidden API" : "no child_process require/import/usage",
    );
    addCheck(
      "generator_no_exec_call",
      !/\bexec\s*\(/.test(stripped),
      /\bexec\s*\(/.test(stripped) ? "FOUND exec() call" : "no exec() call",
    );
    addCheck(
      "generator_no_spawn_call",
      !/\bspawn\s*\(/.test(stripped),
      /\bspawn\s*\(/.test(stripped) ? "FOUND spawn() call" : "no spawn() call",
    );
    addCheck(
      "generator_no_env_read",
      !/process\.env\./.test(stripped) && !/\.env(\.telegram)?\.(local|production)/.test(stripped),
      /process\.env\.|\.env\./.test(stripped) ? "FOUND env reference" : "no env read",
    );
    addCheck(
      "generator_no_control_local_read",
      !/control\.local/.test(stripped),
      /control\.local/.test(stripped) ? "FOUND control.local reference" : "no control.local read",
    );
    addCheck(
      "generator_no_network",
      !/https?:\/\/|require\(['"](http|https|node-fetch|axios)['"]\)|fetch\(/.test(stripped),
      /https?:\/\//.test(stripped) ? "FOUND network call" : "no network",
    );
    // Generator does NOT write to production paths
    const writesProduction =
      /writeFileSync.*reports\/daily-digest\.md/.test(stripped) ||
      /writeFileSync.*reports\/telegram-digest\.txt/.test(stripped) ||
      /writeFileSync.*dashboard\/status\.json/.test(stripped) ||
      /copyFileSync.*reports\/daily-digest\.md/.test(stripped) ||
      /copyFileSync.*reports\/telegram-digest\.txt/.test(stripped);
    addCheck("generator_no_production_writes", !writesProduction, writesProduction ? "FOUND production write" : "no production paths written");
    // Generator does NOT modify approval state
    const writesApprovalState = /writeFileSync.*human-approval-state/.test(stripped);
    addCheck("generator_no_approval_state_write", !writesApprovalState, writesApprovalState ? "FOUND approval state write" : "no approval state write");
  }
}

// 5. Control server endpoint
{
  const p = "scripts/control-server.ts";
  if (!exists(p)) {
    addCheck("control_server_present", false, `${p} missing`);
  } else {
    const src = readText(p);
    addCheck("control_server_present", true, p);
    addCheck(
      "endpoint_c5n_decision_record_get_present",
      /\/api\/daily-digest\/c5n-decision-record/.test(src),
      /\/api\/daily-digest\/c5n-decision-record/.test(src) ? "GET endpoint defined" : "GET endpoint NOT defined",
    );
    // No execute/POST/rollback endpoint
    addCheck(
      "no_post_endpoint_for_decision_record",
      !/case "\/api\/daily-digest\/c5n-decision-record".*POST/.test(src.replace(/\n/g, ' ')) && !/POST[\s\S]*c5n-decision-record/.test(src),
      "no POST/execute/rollback endpoint defined",
    );
  }
}

// 6. control.html
{
  const p = "dashboard/control.html";
  if (exists(p)) {
    const src = readText(p);
    addCheck("control_html_loads_decision_record", /loadC5NDecisionRecord/.test(src), "control.html has decision record panel loader");
    // Should not have button elements triggering promote/rollback
    const htmlNoPromoteButton = !/<button[^>]*>(promote|rollback|approve|telegram)/i.test(src.replace(/\n/g, ' '));
    addCheck("control_html_no_promote_button", htmlNoPromoteButton, htmlNoPromoteButton ? "no promote/rollback button" : "FOUND button");
  } else {
    addCheck("control_html_loads_decision_record", false, "control.html missing");
  }
}

// 7. No tokens in new files
{
  const samples = [
    decisionFile,
    "scripts/daily-digest-c5n-decision-record.ts",
    "scripts/validate-daily-digest-c5n-decision-record.ts",
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
  validator: "validate-daily-digest-c5n-decision-record",
  phase: "5C-2C-C5N4B",
  generated_at: new Date().toISOString(),
  total_checks: checks.length,
  passed: checks.filter(c => c.met).length,
  failed: checks.filter(c => !c.met).length,
  all_pass: allMet,
  checks,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(allMet ? 0 : 1);
