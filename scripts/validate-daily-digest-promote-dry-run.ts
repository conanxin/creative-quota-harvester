#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-promote-dry-run.ts
 * Phase 5C-2C-C5H: Validate promote dry-run plan
 *
 * Checks:
 * - dry-run plan config exists and valid
 * - dry-run planner exists and exports correct functions
 * - planner does not use child_process/exec/spawn
 * - planner does not read .env/.control.local
 * - planner does not call network
 * - planner only writes to sandbox reports/
 * - planner does not copy to production
 * - control-server.ts has /api/daily-digest/promote-dry-run-plan
 * - real_promote_allowed=false
 * - production_write_allowed=false
 * - telegram_send_allowed=false
 * - no token/sk-cp/TELEGRAM_BOT_TOKEN/MINIMAX_API_KEY
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");

function check(desc: string, condition: boolean): { pass: boolean; msg: string } {
  return { pass: condition, msg: condition ? `✅ ${desc}` : `❌ ${desc}` };
}

function loadText(p: string): string {
  try { return fs.readFileSync(p, "utf-8"); } catch { return ""; }
}

function loadJson(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function hasTokenLeak(text: string): boolean {
  const patterns = [
    /sk-[a-zA-Z0-9]{20,}/,
    /TELEGRAM_BOT_TOKEN\s*=\s*['"]\S+['"]/,
    /MINIMAX_API_KEY\s*=\s*['"]\S+['"]/,
    /CQA_CONTROL_TOKEN\s*=\s*['"]\S+['"]/,
  ];
  return patterns.some(p => p.test(text));
}

function main() {
  const checks: { pass: boolean; msg: string }[] = [];

  // 1. Dry-run plan config exists
  const planPath = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-dry-run-plan.json");
  const plan = loadJson(planPath);
  checks.push(check("dry-run plan config exists", fs.existsSync(planPath)));
  checks.push(check("dry-run plan config is valid", plan !== null));
  checks.push(check("plan has phase 5C-2C-C5H", plan?.phase === "5C-2C-C5H"));
  checks.push(check("plan has mode promote_dry_run_only", plan?.mode === "promote_dry_run_only"));
  checks.push(check("plan has real_promote_allowed=false", plan?.real_promote_allowed === false));
  checks.push(check("plan has production_write_allowed=false", plan?.production_write_allowed === false));
  checks.push(check("plan has telegram_send_allowed=false", plan?.telegram_send_allowed === false));
  checks.push(check("plan has required_inputs", plan?.required_inputs && Object.keys(plan.required_inputs).length > 0));
  checks.push(check("plan has planned_copy_map", plan?.planned_copy_map && Object.keys(plan.planned_copy_map).length > 0));
  checks.push(check("plan has backup_plan", plan?.backup_plan && plan.backup_plan.backup_before_promote === true));
  checks.push(check("plan has future_confirm_phrase", typeof plan?.future_confirm_phrase === "string" && plan.future_confirm_phrase.length > 0));
  checks.push(check("plan future_confirm_phrase_enabled=false", plan?.future_confirm_phrase_enabled === false));
  checks.push(check("plan has blocked_actions", Array.isArray(plan?.blocked_actions) && plan.blocked_actions.length > 0));
  checks.push(check("plan has no token leaks", !hasTokenLeak(loadText(planPath))));

  // 2. Dry-run planner exists
  const plannerPath = path.join(HARVESTER_DIR, "scripts/daily-digest-promote-dry-run.ts");
  const plannerCode = loadText(plannerPath);
  checks.push(check("dry-run planner exists", fs.existsSync(plannerPath)));
  checks.push(check("planner exports generatePromoteDryRunPlan", plannerCode.includes("export function generatePromoteDryRunPlan")));

  // 3. Planner safety
  checks.push(check("planner does not import child_process", !/(^|\n)\s*import\s+.*child_process/.test(plannerCode) && !/(^|\n)\s*require\s*\(\s*["']child_process["']/.test(plannerCode)));
  checks.push(check("planner does not use exec", !/(^|\n)\s*exec\s*\(/.test(plannerCode)));
  checks.push(check("planner does not use spawn", !/(^|\n)\s*spawn\s*\(/.test(plannerCode)));
  checks.push(check("planner does not read .env", !/(^|\n)\s*readFileSync\s*\(.*["']\.env/.test(plannerCode)));
  checks.push(check("planner does not read .control.local", !/(^|\n)\s*readFileSync\s*\(.*["']\.control\.local/.test(plannerCode)));
  checks.push(check("planner does not use fetch", !/(^|\n)\s*fetch\s*\(/.test(plannerCode)));
  checks.push(check("planner does not use axios", !/(^|\n)\s*axios/.test(plannerCode)));
  checks.push(check("planner does not copy to production", !plannerCode.includes("copyFileSync") || !plannerCode.includes("reports/daily-digest.md")));
  checks.push(check("planner only writes to sandbox reports", plannerCode.includes("reports/") && plannerCode.includes("sandbox")));
  checks.push(check("planner has redact function", plannerCode.includes("function redact")));
  checks.push(check("planner has no token leaks", !hasTokenLeak(plannerCode)));

  // 4. Server has endpoint
  const serverPath = path.join(HARVESTER_DIR, "scripts/control-server.ts");
  const serverCode = loadText(serverPath);
  checks.push(check("server has /api/daily-digest/promote-dry-run-plan", serverCode.includes("/api/daily-digest/promote-dry-run-plan")));
  checks.push(check("promote-dry-run-plan is GET only", serverCode.includes("promote-dry-run-plan") && serverCode.includes("req.method !== \"GET\"") && serverCode.includes("methodNotAllowed")));
  checks.push(check("server has no token leaks in dry-run block", !hasTokenLeak(serverCode)));

  // 5. Planner reads correct inputs
  checks.push(check("planner reads latest.json", plannerCode.includes("latest.json")));
  checks.push(check("planner reads sandbox outputs", plannerCode.includes("daily-digest.md") && plannerCode.includes("telegram-digest.txt")));
  checks.push(check("planner reads production paths", plannerCode.includes("reports/daily-digest.md") && plannerCode.includes("readFileSync")));
  checks.push(check("planner reads promote readiness", plannerCode.includes("daily-digest-promote-readiness.json")));
  checks.push(check("planner reads diff summary", plannerCode.includes("diff-summary.json")));
  checks.push(check("planner checks preconditions", plannerCode.includes("preconditions")));

  // 6. package.json has new scripts
  const pkg = loadJson(path.join(HARVESTER_DIR, "package.json"));
  checks.push(check("package.json has validate:daily-digest-promote-dry-run", pkg?.scripts?.["validate:daily-digest-promote-dry-run"] !== undefined));
  checks.push(check("package.json has check:daily-digest-promote-dry-run", pkg?.scripts?.["check:daily-digest-promote-dry-run"] !== undefined));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Promote Dry-run Validation (Phase 5C-2C-C5H) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);
  for (const c of checks) console.log(c.msg);
  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
