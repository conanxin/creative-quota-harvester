#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-promote-execution-review.ts
 * Phase 5C-2C-C5K: Validate promote execution review
 *
 * Checks:
 * - design config exists and valid
 * - reviewer exists and exports correct functions
 * - reviewer does not use child_process/exec/spawn
 * - reviewer does not read .env/.control.local
 * - reviewer does not call network
 * - reviewer does not copy to production
 * - control-server.ts has /api/daily-digest/promote-execution-review
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

  // 1. Design config exists
  const configPath = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-execution-design.json");
  const config = loadJson(configPath);
  checks.push(check("design config exists", fs.existsSync(configPath)));
  checks.push(check("design config is valid", config !== null));
  checks.push(check("config has phase 5C-2C-C5K", config?.phase === "5C-2C-C5K"));
  checks.push(check("config has mode promote_execution_design_only", config?.mode === "promote_execution_design_only"));
  checks.push(check("config has real_promote_allowed=false", config?.real_promote_allowed === false));
  checks.push(check("config has production_write_allowed=false", config?.production_write_allowed === false));
  checks.push(check("config has telegram_send_allowed=false", config?.telegram_send_allowed === false));
  checks.push(check("config has required_confirm_phrase", typeof config?.required_confirm_phrase === "string" && config.required_confirm_phrase.length > 0));
  checks.push(check("config has required_human_approval=true", config?.required_human_approval === true));
  checks.push(check("config has required_evidence", config?.required_evidence && Object.keys(config.required_evidence).length > 0));
  checks.push(check("config has proposed_execution_steps", Array.isArray(config?.proposed_execution_steps) && config.proposed_execution_steps.length > 0));
  checks.push(check("config has rollback_steps", Array.isArray(config?.rollback_steps) && config.rollback_steps.length > 0));
  checks.push(check("config has blocked_in_this_phase", Array.isArray(config?.blocked_in_this_phase) && config.blocked_in_this_phase.length > 0));
  checks.push(check("config has no token leaks", !hasTokenLeak(loadText(configPath))));

  // 2. Reviewer exists
  const reviewerPath = path.join(HARVESTER_DIR, "scripts/daily-digest-promote-execution-review.ts");
  const reviewerCode = loadText(reviewerPath);
  checks.push(check("execution reviewer exists", fs.existsSync(reviewerPath)));
  checks.push(check("reviewer exports reviewPromoteExecution", reviewerCode.includes("export function reviewPromoteExecution")));

  // 3. Reviewer safety
  checks.push(check("reviewer does not import child_process", !/(^|\n)\s*import\s+.*child_process/.test(reviewerCode) && !/(^|\n)\s*require\s*\(\s*["']child_process["']/.test(reviewerCode)));
  checks.push(check("reviewer does not use exec", !/(^|\n)\s*exec\s*\(/.test(reviewerCode)));
  checks.push(check("reviewer does not use spawn", !/(^|\n)\s*spawn\s*\(/.test(reviewerCode)));
  checks.push(check("reviewer does not read .env", !/(^|\n)\s*readFileSync\s*\(.*["']\.env/.test(reviewerCode)));
  checks.push(check("reviewer does not read .control.local", !/(^|\n)\s*readFileSync\s*\(.*["']\.control\.local/.test(reviewerCode)));
  checks.push(check("reviewer does not use fetch", !/(^|\n)\s*fetch\s*\(/.test(reviewerCode)));
  checks.push(check("reviewer does not use axios", !/(^|\n)\s*axios/.test(reviewerCode)));
  checks.push(check("reviewer does not copy to production", !reviewerCode.includes("copyFileSync")));
  checks.push(check("reviewer has redact function", reviewerCode.includes("function redact")));
  checks.push(check("reviewer has no token leaks", !hasTokenLeak(reviewerCode)));

  // 4. Server has endpoint
  const serverPath = path.join(HARVESTER_DIR, "scripts/control-server.ts");
  const serverCode = loadText(serverPath);
  checks.push(check("server has /api/daily-digest/promote-execution-review", serverCode.includes("/api/daily-digest/promote-execution-review")));
  checks.push(check("promote-execution-review is GET only", serverCode.includes("promote-execution-review") && serverCode.includes("req.method !== \"GET\"") && serverCode.includes("methodNotAllowed")));
  checks.push(check("server has no token leaks in review block", !hasTokenLeak(serverCode)));

  // 5. Reviewer reads correct inputs
  checks.push(check("reviewer reads latest.json", reviewerCode.includes("latest.json")));
  checks.push(check("reviewer reads promote gate", reviewerCode.includes("daily-digest-promote-gate.json")));
  checks.push(check("reviewer reads shadow copy", reviewerCode.includes("promote-shadow")));
  checks.push(check("reviewer reads rollback manifest", reviewerCode.includes("rollback-manifest.json")));
  checks.push(check("reviewer reads design config", reviewerCode.includes("daily-digest-promote-execution-design.json")));
  checks.push(check("reviewer checks all evidence keys", reviewerCode.includes("promote_gate_pass") && reviewerCode.includes("shadow_copy_pass") && reviewerCode.includes("rollback_manifest_exists") && reviewerCode.includes("protected_paths_snapshot_exists") && reviewerCode.includes("sandbox_output_validation_pass") && reviewerCode.includes("diff_summary_reviewed")));

  // 6. package.json has new scripts
  const pkg = loadJson(path.join(HARVESTER_DIR, "package.json"));
  checks.push(check("package.json has validate:daily-digest-promote-execution-review", pkg?.scripts?.["validate:daily-digest-promote-execution-review"] !== undefined));
  checks.push(check("package.json has check:daily-digest-promote-execution-review", pkg?.scripts?.["check:daily-digest-promote-execution-review"] !== undefined));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Promote Execution Review Validation (Phase 5C-2C-C5K) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);
  for (const c of checks) console.log(c.msg);
  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
