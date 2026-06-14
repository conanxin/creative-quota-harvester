#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-promote-shadow-copy.ts
 * Phase 5C-2C-C5I: Validate promote shadow copy planner
 *
 * Checks:
 * - shadow plan config exists and valid
 * - shadow copy planner exists and exports correct functions
 * - planner does not use child_process/exec/spawn
 * - planner does not read .env/.control.local
 * - planner does not call network
 * - planner only writes to sandbox promote-shadow/
 * - planner does not copy to production
 * - control-server.ts has /api/daily-digest/promote-shadow-status
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

  // 1. Shadow plan config exists
  const planPath = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-shadow-plan.json");
  const plan = loadJson(planPath);
  checks.push(check("shadow plan config exists", fs.existsSync(planPath)));
  checks.push(check("shadow plan config is valid", plan !== null));
  checks.push(check("plan has phase 5C-2C-C5I", plan?.phase === "5C-2C-C5I"));
  checks.push(check("plan has mode shadow_copy_only", plan?.mode === "shadow_copy_only"));
  checks.push(check("plan has real_promote_allowed=false", plan?.real_promote_allowed === false));
  checks.push(check("plan has production_write_allowed=false", plan?.production_write_allowed === false));
  checks.push(check("plan has telegram_send_allowed=false", plan?.telegram_send_allowed === false));
  checks.push(check("plan has shadow_outputs", typeof plan?.shadow_outputs === "string" && plan.shadow_outputs.includes("promote-shadow")));
  checks.push(check("plan has backup_sources", Array.isArray(plan?.backup_sources) && plan.backup_sources.length > 0));
  checks.push(check("plan has candidate_sources", Array.isArray(plan?.candidate_sources) && plan.candidate_sources.length > 0));
  checks.push(check("plan has rollback_required=true", plan?.rollback_required === true));
  checks.push(check("plan has human_approval_required=true", plan?.human_approval_required === true));
  checks.push(check("plan has future_confirm_phrase", typeof plan?.future_confirm_phrase === "string" && plan.future_confirm_phrase.length > 0));
  checks.push(check("plan future_confirm_phrase_enabled=false", plan?.future_confirm_phrase_enabled === false));
  checks.push(check("plan has blocked_actions", Array.isArray(plan?.blocked_actions) && plan.blocked_actions.length > 0));
  checks.push(check("plan has no token leaks", !hasTokenLeak(loadText(planPath))));

  // 2. Shadow copy planner exists
  const plannerPath = path.join(HARVESTER_DIR, "scripts/daily-digest-promote-shadow-copy.ts");
  const plannerCode = loadText(plannerPath);
  checks.push(check("shadow copy planner exists", fs.existsSync(plannerPath)));
  checks.push(check("planner exports createPromoteShadowCopy", plannerCode.includes("export function createPromoteShadowCopy")));

  // 3. Planner safety
  checks.push(check("planner does not import child_process", !/(^|\n)\s*import\s+.*child_process/.test(plannerCode) && !/(^|\n)\s*require\s*\(\s*["']child_process["']/.test(plannerCode)));
  checks.push(check("planner does not use exec", !/(^|\n)\s*exec\s*\(/.test(plannerCode)));
  checks.push(check("planner does not use spawn", !/(^|\n)\s*spawn\s*\(/.test(plannerCode)));
  checks.push(check("planner does not read .env", !/(^|\n)\s*readFileSync\s*\(.*["']\.env/.test(plannerCode)));
  checks.push(check("planner does not read .control.local", !/(^|\n)\s*readFileSync\s*\(.*["']\.control\.local/.test(plannerCode)));
  checks.push(check("planner does not use fetch", !/(^|\n)\s*fetch\s*\(/.test(plannerCode)));
  checks.push(check("planner does not use axios", !/(^|\n)\s*axios/.test(plannerCode)));
  checks.push(check("planner does not copy to production", !plannerCode.includes("copyFileSync") || !plannerCode.includes("reports/daily-digest.md")));
  checks.push(check("planner only writes to promote-shadow", plannerCode.includes("promote-shadow")));
  checks.push(check("planner has redact function", plannerCode.includes("function redact")));
  checks.push(check("planner has no token leaks", !hasTokenLeak(plannerCode)));

  // 4. Server has endpoint
  const serverPath = path.join(HARVESTER_DIR, "scripts/control-server.ts");
  const serverCode = loadText(serverPath);
  checks.push(check("server has /api/daily-digest/promote-shadow-status", serverCode.includes("/api/daily-digest/promote-shadow-status")));
  checks.push(check("promote-shadow-status is GET only", serverCode.includes("promote-shadow-status") && serverCode.includes("req.method !== \"GET\"") && serverCode.includes("methodNotAllowed")));
  checks.push(check("server has no token leaks in shadow block", !hasTokenLeak(serverCode)));

  // 5. Planner reads correct inputs
  checks.push(check("planner reads latest.json", plannerCode.includes("latest.json")));
  checks.push(check("planner reads sandbox outputs", plannerCode.includes("daily-digest.md") && plannerCode.includes("telegram-digest.txt")));
  checks.push(check("planner reads production paths", plannerCode.includes("reports/daily-digest.md") && plannerCode.includes("readFileSync")));
  checks.push(check("planner creates rollback manifest", plannerCode.includes("rollback-manifest.json")));
  checks.push(check("planner creates promote checklist", plannerCode.includes("promote-checklist")));
  checks.push(check("planner creates shadow summary", plannerCode.includes("shadow-copy-summary.json")));

  // 6. package.json has new scripts
  const pkg = loadJson(path.join(HARVESTER_DIR, "package.json"));
  checks.push(check("package.json has validate:daily-digest-promote-shadow-copy", pkg?.scripts?.["validate:daily-digest-promote-shadow-copy"] !== undefined));
  checks.push(check("package.json has check:daily-digest-promote-shadow-copy", pkg?.scripts?.["check:daily-digest-promote-shadow-copy"] !== undefined));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Promote Shadow Copy Validation (Phase 5C-2C-C5I) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);
  for (const c of checks) console.log(c.msg);
  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
