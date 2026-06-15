#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-c5n-human-decision.ts
 * Phase 5C-2C-C5N4C: Validator for human decision recorder.
 *
 * Checks (all must PASS):
 *   - human decision JSON present and well-formed
 *   - decision=keep_approved_for_future_promote_but_do_not_promote_yet
 *   - approval_state=approved_for_future_promote
 *   - c5n_frozen=true
 *   - real_promote_allowed=false
 *   - production_write_allowed=false
 *   - telegram_send_allowed=false
 *   - timer_allowed=false
 *   - rollback_requested=false
 *   - proceed_to_promote_requested=false
 *   - human_decision_required=false
 *   - next_allowed_phase contains "C5N-6-A"
 *   - recorder does NOT use child_process / exec / spawn
 *   - recorder does NOT read .env / .control.local / process.env
 *   - recorder does NOT make network calls
 *   - recorder does NOT write production paths
 *   - control-server.ts has GET /api/daily-digest/c5n-human-decision
 *   - no POST/rollback/promote endpoint
 *   - control.html has loadC5NHumanDecision
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

const decisionFile = "dashboard/daily-digest-c5n-human-decision.json";

// 1. Human decision JSON present and well-formed
if (!exists(decisionFile)) {
  addCheck("human_decision_present", false, decisionFile + " missing");
} else {
  try {
    const cfg = JSON.parse(readText(decisionFile));
    const ok = cfg.phase === "5C-2C-C5N4C"
      && cfg.mode === "human_decision_record"
      && cfg.decision === "keep_approved_for_future_promote_but_do_not_promote_yet"
      && cfg.approval_state === "approved_for_future_promote"
      && cfg.c5n_frozen === true
      && cfg.real_promote_allowed === false
      && cfg.production_write_allowed === false
      && cfg.telegram_send_allowed === false
      && cfg.timer_allowed === false
      && cfg.rollback_requested === false
      && cfg.proceed_to_promote_requested === false
      && cfg.human_decision_required === false
      && typeof cfg.next_allowed_phase === "string";
    addCheck("human_decision_present", ok, ok ? "present and well-formed" : "fields mismatch");
  } catch (e: any) {
    addCheck("human_decision_present", false, "parse error: " + e.message);
  }
}

// 2-12. Field checks
if (exists(decisionFile)) {
  const cfg = JSON.parse(readText(decisionFile));
  addCheck("decision_correct", cfg.decision === "keep_approved_for_future_promote_but_do_not_promote_yet", "decision=" + cfg.decision);
  addCheck("approval_state_correct", cfg.approval_state === "approved_for_future_promote", "approval_state=" + cfg.approval_state);
  addCheck("c5n_frozen_true", cfg.c5n_frozen === true, "c5n_frozen=" + cfg.c5n_frozen);
  addCheck("real_promote_disabled", cfg.real_promote_allowed === false, "real_promote_allowed=" + cfg.real_promote_allowed);
  addCheck("production_write_disabled", cfg.production_write_allowed === false, "production_write_allowed=" + cfg.production_write_allowed);
  addCheck("telegram_send_disabled", cfg.telegram_send_allowed === false, "telegram_send_allowed=" + cfg.telegram_send_allowed);
  addCheck("timer_disabled", cfg.timer_allowed === false, "timer_allowed=" + cfg.timer_allowed);
  addCheck("rollback_not_requested", cfg.rollback_requested === false, "rollback_requested=" + cfg.rollback_requested);
  addCheck("promote_not_requested", cfg.proceed_to_promote_requested === false, "proceed_to_promote_requested=" + cfg.proceed_to_promote_requested);
  addCheck("human_decision_not_required", cfg.human_decision_required === false, "human_decision_required=" + cfg.human_decision_required);
  addCheck("next_allowed_phase_contains_c5n6a", (cfg.next_allowed_phase || "").includes("C5N-6-A"), "next_allowed_phase=" + cfg.next_allowed_phase);
  addCheck("collect_disabled", cfg.collect_allowed === false, "collect_allowed=" + cfg.collect_allowed);
  addCheck("generate_disabled", cfg.generate_allowed === false, "generate_allowed=" + cfg.generate_allowed);
  addCheck("model_call_disabled", cfg.model_call_allowed === false, "model_call_allowed=" + cfg.model_call_allowed);
  addCheck("git_disabled", cfg.git_allowed === false, "git_allowed=" + cfg.git_allowed);
  const blocked: string[] = cfg.blocked_actions || [];
  addCheck("blocked_actions_complete", blocked.includes("production_write") && blocked.includes("telegram_send") && blocked.includes("promote") && blocked.includes("auto_rollback"), JSON.stringify(blocked));
  const boundary: any = cfg.boundary_compliance || {};
  addCheck("boundary_no_model_call", boundary.model_call_used === false, "model_call_used=" + boundary.model_call_used);
  addCheck("boundary_no_media", boundary.media_generated === false, "media_generated=" + boundary.media_generated);
  addCheck("boundary_no_sandbox_rebuild", boundary.sandbox_rebuilt === false, "sandbox_rebuilt=" + boundary.sandbox_rebuilt);
  addCheck("boundary_no_re_promote", boundary.re_promoted === false, "re_promoted=" + boundary.re_promoted);
  addCheck("boundary_no_rollback", boundary.rollback_executed === false, "rollback_executed=" + boundary.rollback_executed);
  addCheck("boundary_no_promote", boundary.promote_executed === false, "promote_executed=" + boundary.promote_executed);
  addCheck("boundary_no_approval_state_write", boundary.approval_state_modified === false, "approval_state_modified=" + boundary.approval_state_modified);
  addCheck("boundary_no_tokens", boundary.tokens_committed === false && boundary.tokens_printed === false, "tokens_committed=" + boundary.tokens_committed);
  addCheck("c5n4b_reference_present", !!cfg.c5n4b_decision_record_reference && cfg.c5n4b_decision_record_reference.commit === "112960e", "c5n4b_commit=" + cfg.c5n4b_decision_record_reference?.commit);
  addCheck("c5n5_reference_present", !!cfg.c5n5_transition_reference && cfg.c5n5_transition_reference.commit === "bb7333d", "c5n5_commit=" + cfg.c5n5_transition_reference?.commit);
}

// 13. Recorder safety
{
  const p = "scripts/daily-digest-c5n-human-decision.ts";
  if (!exists(p)) {
    addCheck("recorder_present", false, p + " missing");
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
      /child_process/.test(stripped) ? "FOUND child_process" : "no child_process",
    );
    addCheck(
      "recorder_no_exec",
      !/\bexec\s*\(/.test(stripped),
      /\bexec\s*\(/.test(stripped) ? "FOUND exec()" : "no exec()",
    );
    addCheck(
      "recorder_no_spawn",
      !/\bspawn\s*\(/.test(stripped),
      /\bspawn\s*\(/.test(stripped) ? "FOUND spawn()" : "no spawn()",
    );
    addCheck(
      "recorder_no_env_read",
      !/process\.env\./.test(stripped) && !/\.env(\.telegram)?\.(local|production)/.test(stripped),
      /process\.env\.|\.env\./.test(stripped) ? "FOUND env reference" : "no env read",
    );
    addCheck(
      "recorder_no_control_local",
      !/control\.local/.test(stripped),
      /control\.local/.test(stripped) ? "FOUND control.local" : "no control.local read",
    );
    addCheck(
      "recorder_no_network",
      !/https?:\/\//.test(stripped) && !/require\(['"](http|https|node-fetch|axios)['"]\)/.test(stripped) && !/fetch\(/.test(stripped),
      /https?:\/\//.test(stripped) ? "FOUND network" : "no network",
    );
    const writesProduction =
      /writeFileSync.*reports\/daily-digest\.md/.test(stripped) ||
      /writeFileSync.*reports\/telegram-digest\.txt/.test(stripped) ||
      /writeFileSync.*dashboard\/status\.json/.test(stripped);
    addCheck("recorder_no_production_writes", !writesProduction, writesProduction ? "FOUND production write" : "no production writes");
    const writesApprovalState = /writeFileSync.*human-approval-state/.test(stripped);
    addCheck("recorder_no_approval_state_write", !writesApprovalState, writesApprovalState ? "FOUND approval state write" : "no approval state write");
  }
}

// 14. Control server endpoint
{
  const p = "scripts/control-server.ts";
  if (!exists(p)) {
    addCheck("control_server_present", false, p + " missing");
  } else {
    const src = readText(p);
    addCheck("control_server_present", true, p);
    addCheck(
      "endpoint_get_present",
      /\/api\/daily-digest\/c5n-human-decision/.test(src),
      /\/api\/daily-digest\/c5n-human-decision/.test(src) ? "GET endpoint defined" : "GET NOT defined",
    );
    // No POST/rollback/promote endpoint for this
    addCheck("no_post_endpoint", !/POST[\s\S]{0,200}c5n-human-decision/.test(src), "no POST endpoint");
  }
}

// 15. control.html
{
  const p = "dashboard/control.html";
  if (exists(p)) {
    const src = readText(p);
    addCheck("control_html_present", true, p);
    addCheck("control_html_has_loader", /loadC5NHumanDecision/.test(src), "has loader function");
    addCheck("control_html_no_promote_button", !/<button[^>]*>(?:promote|rollback|approve|telegram)/i.test(src.replace(/\n/g, " ")), "no promote/rollback button");
  } else {
    addCheck("control_html_present", false, p + " missing");
  }
}

// 16. No tokens in new files
{
  const samples = [
    decisionFile,
    "scripts/daily-digest-c5n-human-decision.ts",
    "scripts/validate-daily-digest-c5n-human-decision.ts",
  ];
  let found = false;
  for (const f of samples) {
    if (!exists(f)) continue;
    const t = readText(f);
    if (/sk-cp-[A-Za-z0-9_-]{10,}/.test(t) || /TELEGRAM_BOT_TOKEN\s*=\s*['"][A-Za-z0-9_-]{10,}/.test(t) || /MINIMAX_API_KEY\s*=\s*['"][A-Za-z0-9_-]{10,}/.test(t) || /CQA_CONTROL_TOKEN\s*=\s*['"][A-Za-z0-9_-]{10,}/.test(t)) {
      found = true;
      addCheck("no_token:" + f, false, "token-like in " + f);
    }
  }
  if (!found) addCheck("no_tokens_in_new_files", true, "no token patterns");
}

const allMet = checks.every(c => c.met);
const summary = {
  validator: "validate-daily-digest-c5n-human-decision",
  phase: "5C-2C-C5N4C",
  generated_at: new Date().toISOString(),
  total_checks: checks.length,
  passed: checks.filter(c => c.met).length,
  failed: checks.filter(c => !c.met).length,
  all_pass: allMet,
  checks,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(allMet ? 0 : 1);