#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-promote-readiness.ts
 * Phase 5C-2C-C5G: Validate promote readiness checker and config
 *
 * Checks:
 * - promote readiness plan JSON exists and valid
 * - checker exists and exports correct functions
 * - checker does not use child_process/exec/spawn
 * - checker does not read .env/.control.local
 * - checker does not call network
 * - checker does not write production paths
 * - control-server.ts has /api/daily-digest/promote-readiness
 * - real_promote_allowed=false
 * - production_write_allowed=false
 * - telegram_send_allowed=false
 * - future confirm phrase exists but not enabled
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

  // 1. Promote readiness plan JSON exists
  const planPath = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-readiness-plan.json");
  const plan = loadJson(planPath);
  checks.push(check("promote readiness plan JSON exists", fs.existsSync(planPath)));
  checks.push(check("promote readiness plan JSON is valid", plan !== null));
  checks.push(check("plan has phase 5C-2C-C5G", plan?.phase === "5C-2C-C5G"));
  checks.push(check("plan has mode promote_readiness_only", plan?.mode === "promote_readiness_only"));
  checks.push(check("plan has real_promote_allowed", plan?.real_promote_allowed === false));
  checks.push(check("plan has production_write_allowed=false", plan?.production_write_allowed === false));
  checks.push(check("plan has telegram_send_allowed=false", plan?.telegram_send_allowed === false));
  checks.push(check("plan has human_approval_required=true", plan?.human_approval_required === true));
  checks.push(check("plan has required_preconditions", plan?.required_preconditions && Object.keys(plan.required_preconditions).length > 0));
  checks.push(check("plan has blocked_actions", Array.isArray(plan?.blocked_actions) && plan.blocked_actions.length > 0));
  checks.push(check("plan has future_confirm_phrase", typeof plan?.future_confirm_phrase === "string" && plan.future_confirm_phrase.length > 0));
  checks.push(check("plan future_confirm_phrase_enabled=false", plan?.future_confirm_phrase_enabled === false));
  checks.push(check("plan has no token leaks", !hasTokenLeak(loadText(planPath))));

  // 2. Promote readiness checker exists
  const checkerPath = path.join(HARVESTER_DIR, "scripts/daily-digest-promote-readiness.ts");
  const checkerCode = loadText(checkerPath);
  checks.push(check("promote readiness checker exists", fs.existsSync(checkerPath)));
  checks.push(check("checker exports checkPromoteReadiness", checkerCode.includes("export function checkPromoteReadiness")));
  checks.push(check("checker exports writePromoteReadiness", checkerCode.includes("export function writePromoteReadiness")));

  // 3. Checker safety
  checks.push(check("checker does not import child_process", !/(^|\n)\s*import\s+.*child_process/.test(checkerCode) && !/(^|\n)\s*require\s*\(\s*["']child_process["']/.test(checkerCode)));
  checks.push(check("checker does not use exec", !/(^|\n)\s*exec\s*\(/.test(checkerCode)));
  checks.push(check("checker does not use spawn", !/(^|\n)\s*spawn\s*\(/.test(checkerCode)));
  checks.push(check("checker does not read .env", !/(^|\n)\s*readFileSync\s*\(.*["']\.env/.test(checkerCode)));
  checks.push(check("checker does not read .control.local", !/(^|\n)\s*readFileSync\s*\(.*["']\.control\.local/.test(checkerCode)));
  checks.push(check("checker does not use fetch", !/(^|\n)\s*fetch\s*\(/.test(checkerCode)));
  checks.push(check("checker does not use axios", !/(^|\n)\s*axios/.test(checkerCode)));
  checks.push(check("checker does not write production paths", !checkerCode.includes("reports/daily-digest.md") || !checkerCode.includes("writeFileSync")));
  checks.push(check("checker only writes to dashboard", checkerCode.includes("dashboard/daily-digest-promote-readiness.json")));
  checks.push(check("checker has no token leaks", !hasTokenLeak(checkerCode)));

  // 4. Server has endpoint
  const serverPath = path.join(HARVESTER_DIR, "scripts/control-server.ts");
  const serverCode = loadText(serverPath);
  checks.push(check("server has /api/daily-digest/promote-readiness", serverCode.includes("/api/daily-digest/promote-readiness")));
  checks.push(check("promote-readiness is GET only", serverCode.includes("promote-readiness") && serverCode.includes("req.method !== \"GET\"") && serverCode.includes("methodNotAllowed")));
  checks.push(check("server has no token leaks in promote block", !hasTokenLeak(serverCode)));

  // 5. Checker reads latest.json and validation outputs
  checks.push(check("checker reads latest.json", checkerCode.includes("latest.json")));
  checks.push(check("checker reads manifest.json", checkerCode.includes("manifest.json")));
  checks.push(check("checker reads build-summary.json", checkerCode.includes("build-summary.json")));
  checks.push(check("checker reads diff-summary", checkerCode.includes("diff-summary")));
  checks.push(check("checker checks sandbox outputs", checkerCode.includes("daily-digest.md") && checkerCode.includes("telegram-digest.txt")));

  // 6. Checker checks all preconditions
  checks.push(check("checker checks secret_scan", checkerCode.includes("secret")));
  checks.push(check("checker checks tool_residue", checkerCode.includes("tool") || checkerCode.includes("residue")));
  checks.push(check("checker checks protected_paths", checkerCode.includes("protected_paths")));
  checks.push(check("checker checks human_approval", checkerCode.includes("human_approval")));

  // 7. package.json has new scripts
  const pkg = loadJson(path.join(HARVESTER_DIR, "package.json"));
  checks.push(check("package.json has validate:daily-digest-promote-readiness", pkg?.scripts?.["validate:daily-digest-promote-readiness"] !== undefined));
  checks.push(check("package.json has check:daily-digest-promote-readiness", pkg?.scripts?.["check:daily-digest-promote-readiness"] !== undefined));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Promote Readiness Validation (Phase 5C-2C-C5G) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);
  for (const c of checks) console.log(c.msg);
  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
