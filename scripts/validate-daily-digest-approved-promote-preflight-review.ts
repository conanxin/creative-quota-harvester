#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-approved-promote-preflight-review.ts
 * Phase C5N-6A-Review: Validator for approved promote preflight review.
 *
 * Checks (all must PASS):
 *   - review JSON present and well-formed
 *   - approval_state=approved_for_future_promote
 *   - c5n_frozen=true
 *   - real_promote_allowed=false
 *   - production_write_allowed=false
 *   - telegram_send_allowed=false
 *   - timer_allowed=false
 *   - all 11 evidence items met
 *   - reviewer does NOT use child_process / exec / spawn
 *   - reviewer does NOT read .env / .control.local / process.env
 *   - reviewer does NOT make network calls
 *   - reviewer does NOT write production paths
 *   - control-server.ts has GET /api/daily-digest/approved-promote-preflight-review
 *   - no POST/rollback/promote endpoint
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

const reviewFile = "dashboard/daily-digest-approved-promote-preflight-review.json";

// 1. Review JSON present and well-formed
if (!exists(reviewFile)) {
  addCheck("review_present", false, reviewFile + " missing");
} else {
  try {
    const cfg = JSON.parse(readText(reviewFile));
    const ok = cfg.phase === "C5N-6A-Review"
      && cfg.mode === "approved_promote_preflight_review_only"
      && cfg.approval_state === "approved_for_future_promote"
      && cfg.c5n_frozen === true
      && cfg.c5n_human_decision === "keep_approved_for_future_promote_but_do_not_promote_yet"
      && cfg.real_promote_allowed === false
      && cfg.production_write_allowed === false
      && cfg.telegram_send_allowed === false
      && cfg.timer_allowed === false;
    addCheck("review_present", ok, ok ? "present and well-formed" : "fields mismatch");
  } catch (e: any) {
    addCheck("review_present", false, "parse error: " + e.message);
  }
}

// 2-12. Field checks
if (exists(reviewFile)) {
  const cfg = JSON.parse(readText(reviewFile));
  addCheck("approval_state_correct", cfg.approval_state === "approved_for_future_promote", "approval_state=" + cfg.approval_state);
  addCheck("c5n_frozen_true", cfg.c5n_frozen === true, "c5n_frozen=" + cfg.c5n_frozen);
  addCheck("c5n_human_decision_correct", cfg.c5n_human_decision === "keep_approved_for_future_promote_but_do_not_promote_yet", "c5n_human_decision=" + cfg.c5n_human_decision);
  addCheck("real_promote_disabled", cfg.real_promote_allowed === false, "real_promote_allowed=" + cfg.real_promote_allowed);
  addCheck("production_write_disabled", cfg.production_write_allowed === false, "production_write_allowed=" + cfg.production_write_allowed);
  addCheck("telegram_send_disabled", cfg.telegram_send_allowed === false, "telegram_send_allowed=" + cfg.telegram_send_allowed);
  addCheck("timer_disabled", cfg.timer_allowed === false, "timer_allowed=" + cfg.timer_allowed);
  addCheck("collect_disabled", cfg.collect_allowed === false, "collect_allowed=" + cfg.collect_allowed);
  addCheck("model_call_disabled", cfg.model_call_allowed === false, "model_call_allowed=" + cfg.model_call_allowed);
  addCheck("git_disabled", cfg.git_allowed === false, "git_allowed=" + cfg.git_allowed);

  // Evidence items
  const ev = cfg.evidence || {};
  const expectedEvidenceKeys = [
    "sandbox_build_success",
    "sandbox_output_validation_pass",
    "promote_readiness_ready",
    "promote_dry_run_pass",
    "shadow_copy_pass",
    "promote_gate_pass",
    "human_approval_pack_ready",
    "one_shot_controlled_promote_success",
    "post_promote_validation_pass",
    "dashboard_safety_pass",
    "human_decision_keep_approved_frozen",
  ];
  let allEvidenceMet = true;
  let unmetCount = 0;
  for (const k of expectedEvidenceKeys) {
    const e = ev[k];
    if (!e || e.met !== true) {
      allEvidenceMet = false;
      unmetCount++;
    }
  }
  addCheck("all_evidence_met", allEvidenceMet, "evidence unmet count=" + unmetCount + " out of " + expectedEvidenceKeys.length);

  // Evidence summary
  const es = cfg.evidence_summary || {};
  addCheck("evidence_summary_total_correct", es.total === expectedEvidenceKeys.length, "evidence_summary.total=" + es.total);
  addCheck("evidence_summary_all_met", es.all_met === true, "evidence_summary.all_met=" + es.all_met);

  // Missing requirements should be empty
  addCheck("missing_requirements_empty", Array.isArray(cfg.missing_requirements) && cfg.missing_requirements.length === 0, "missing_requirements.length=" + (cfg.missing_requirements || []).length);

  // Unresolved risks should be present
  addCheck("unresolved_risks_present", Array.isArray(cfg.unresolved_risks) && cfg.unresolved_risks.length >= 1, "unresolved_risks.length=" + (cfg.unresolved_risks || []).length);

  // Recommended next action
  addCheck("recommended_next_action_present", typeof cfg.recommended_next_action === "string" && cfg.recommended_next_action.length > 0, "recommended_next_action=" + cfg.recommended_next_action);

  // Next allowed phase options
  const napo = cfg.next_allowed_phase_options || [];
  addCheck("next_allowed_phase_options_count_3", napo.length === 3, "next_allowed_phase_options.length=" + napo.length);

  // Independent gates
  addCheck("telegram_independently_gated", cfg.telegram_send_should_remain_independently_gated === true, "telegram_independently_gated=" + cfg.telegram_send_should_remain_independently_gated);
  addCheck("timer_independently_gated", cfg.timer_should_remain_independently_gated === true, "timer_independently_gated=" + cfg.timer_should_remain_independently_gated);
  addCheck("promote_independently_gated", cfg.promote_should_remain_independently_gated === true, "promote_independently_gated=" + cfg.promote_should_remain_independently_gated);

  // Boundary compliance
  const boundary: any = cfg.boundary_compliance || {};
  addCheck("boundary_no_model_call", boundary.model_call_used === false, "model_call_used=" + boundary.model_call_used);
  addCheck("boundary_no_media", boundary.media_generated === false, "media_generated=" + boundary.media_generated);
  addCheck("boundary_no_sandbox_rebuild", boundary.sandbox_rebuilt === false, "sandbox_rebuilt=" + boundary.sandbox_rebuilt);
  addCheck("boundary_no_re_promote", boundary.re_promoted === false, "re_promoted=" + boundary.re_promoted);
  addCheck("boundary_no_rollback", boundary.rollback_executed === false, "rollback_executed=" + boundary.rollback_executed);
  addCheck("boundary_no_promote", boundary.promote_executed === false, "promote_executed=" + boundary.promote_executed);
  addCheck("boundary_no_approval_state_write", boundary.approval_state_modified === false, "approval_state_modified=" + boundary.approval_state_modified);
  addCheck("boundary_no_tokens", boundary.tokens_committed === false && boundary.tokens_printed === false, "tokens_committed=" + boundary.tokens_committed);
}

// 13. Reviewer safety
{
  const p = "scripts/daily-digest-approved-promote-preflight-review.ts";
  if (!exists(p)) {
    addCheck("reviewer_present", false, p + " missing");
  } else {
    const src = readText(p);
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/.*$/gm, "");
    addCheck("reviewer_present", true, p);
    addCheck(
      "reviewer_no_child_process",
      !/(\brequire\s*\(\s*['"]child_process['"]|\bfrom\s+['"]child_process['"]|\bchild_process\.[a-z_]+\s*\()/.test(stripped),
      /child_process/.test(stripped) ? "FOUND child_process" : "no child_process",
    );
    addCheck(
      "reviewer_no_exec",
      !/\bexec\s*\(/.test(stripped),
      /\bexec\s*\(/.test(stripped) ? "FOUND exec()" : "no exec()",
    );
    addCheck(
      "reviewer_no_spawn",
      !/\bspawn\s*\(/.test(stripped),
      /\bspawn\s*\(/.test(stripped) ? "FOUND spawn()" : "no spawn()",
    );
    addCheck(
      "reviewer_no_env_read",
      !/process\.env\./.test(stripped) && !/\.env(\.telegram)?\.(local|production)/.test(stripped),
      /process\.env\.|\.env\./.test(stripped) ? "FOUND env reference" : "no env read",
    );
    addCheck(
      "reviewer_no_control_local",
      !/control\.local/.test(stripped),
      /control\.local/.test(stripped) ? "FOUND control.local" : "no control.local read",
    );
    addCheck(
      "reviewer_no_network",
      !/https?:\/\//.test(stripped) && !/require\(['"](http|https|node-fetch|axios)['"]\)/.test(stripped) && !/fetch\(/.test(stripped),
      /https?:\/\//.test(stripped) ? "FOUND network" : "no network",
    );
    const writesProduction =
      /writeFileSync.*reports\/daily-digest\.md/.test(stripped) ||
      /writeFileSync.*reports\/telegram-digest\.txt/.test(stripped) ||
      /writeFileSync.*dashboard\/status\.json/.test(stripped);
    addCheck("reviewer_no_production_writes", !writesProduction, writesProduction ? "FOUND production write" : "no production writes");
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
      /\/api\/daily-digest\/approved-promote-preflight-review/.test(src),
      /\/api\/daily-digest\/approved-promote-preflight-review/.test(src) ? "GET endpoint defined" : "GET NOT defined",
    );
    addCheck("no_post_endpoint", !/POST[\s\S]{0,200}approved-promote-preflight-review/.test(src), "no POST endpoint");
  }
}

// 15. control.html
{
  const p = "dashboard/control.html";
  if (exists(p)) {
    const src = readText(p);
    addCheck("control_html_present", true, p);
    addCheck("control_html_has_loader", /loadApprovedPromotePreflightReview/.test(src), "has loader function");
    addCheck("control_html_no_promote_button", !/<button[^>]*>(?:promote|rollback|approve|telegram)/i.test(src.replace(/\n/g, " ")), "no promote/rollback button");
  } else {
    addCheck("control_html_present", false, p + " missing");
  }
}

// 16. No tokens in new files
{
  const samples = [
    reviewFile,
    "scripts/daily-digest-approved-promote-preflight-review.ts",
    "scripts/validate-daily-digest-approved-promote-preflight-review.ts",
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
  validator: "validate-daily-digest-approved-promote-preflight-review",
  phase: "C5N-6A-Review",
  generated_at: new Date().toISOString(),
  total_checks: checks.length,
  passed: checks.filter(c => c.met).length,
  failed: checks.filter(c => !c.met).length,
  all_pass: allMet,
  checks,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(allMet ? 0 : 1);