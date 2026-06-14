#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-promote-gate.ts
 * Phase 5C-2C-C5J: Validate promote gate checker
 *
 * Checks:
 * - gate config exists and valid
 * - gate checker exists and exports correct functions
 * - checker does not use child_process/exec/spawn
 * - checker does not read .env/.control.local
 * - checker does not call network
 * - checker does not copy to production
 * - control-server.ts has /api/daily-digest/promote-gate
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

  // 1. Gate config exists
  const configPath = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-gate.json");
  const config = loadJson(configPath);
  checks.push(check("gate config exists", fs.existsSync(configPath)));
  checks.push(check("gate config is valid", config !== null));
  checks.push(check("config has phase 5C-2C-C5J", config?.phase === "5C-2C-C5J"));
  checks.push(check("config has mode promote_gate_only", config?.mode === "promote_gate_only"));
  checks.push(check("config has gate_status", typeof config?.gate_status === "string"));
  checks.push(check("config has real_promote_allowed=false", config?.real_promote_allowed === false));
  checks.push(check("config has production_write_allowed=false", config?.production_write_allowed === false));
  checks.push(check("config has telegram_send_allowed=false", config?.telegram_send_allowed === false));
  checks.push(check("config has required_evidence", config?.required_evidence && Object.keys(config.required_evidence).length > 0));
  checks.push(check("config has future_confirm_phrase", typeof config?.future_confirm_phrase === "string" && config.future_confirm_phrase.length > 0));
  checks.push(check("config future_confirm_phrase_enabled=false", config?.future_confirm_phrase_enabled === false));
  checks.push(check("config has blocked_actions", Array.isArray(config?.blocked_actions) && config.blocked_actions.length > 0));
  checks.push(check("config has human_approval_required=true", config?.human_approval_required === true));
  checks.push(check("config has no token leaks", !hasTokenLeak(loadText(configPath))));

  // 2. Gate checker exists
  const checkerPath = path.join(HARVESTER_DIR, "scripts/daily-digest-promote-gate.ts");
  const checkerCode = loadText(checkerPath);
  checks.push(check("gate checker exists", fs.existsSync(checkerPath)));
  checks.push(check("checker exports checkPromoteGate", checkerCode.includes("export function checkPromoteGate")));

  // 3. Checker safety
  checks.push(check("checker does not import child_process", !/(^|\n)\s*import\s+.*child_process/.test(checkerCode) && !/(^|\n)\s*require\s*\(\s*["']child_process["']/.test(checkerCode)));
  checks.push(check("checker does not use exec", !/(^|\n)\s*exec\s*\(/.test(checkerCode)));
  checks.push(check("checker does not use spawn", !/(^|\n)\s*spawn\s*\(/.test(checkerCode)));
  checks.push(check("checker does not read .env", !/(^|\n)\s*readFileSync\s*\(.*["']\.env/.test(checkerCode)));
  checks.push(check("checker does not read .control.local", !/(^|\n)\s*readFileSync\s*\(.*["']\.control\.local/.test(checkerCode)));
  checks.push(check("checker does not use fetch", !/(^|\n)\s*fetch\s*\(/.test(checkerCode)));
  checks.push(check("checker does not use axios", !/(^|\n)\s*axios/.test(checkerCode)));
  checks.push(check("checker does not copy to production", !checkerCode.includes("copyFileSync") || !checkerCode.includes("reports/daily-digest.md")));
  checks.push(check("checker has redact function", checkerCode.includes("function redact")));
  checks.push(check("checker has no token leaks", !hasTokenLeak(checkerCode)));

  // 4. Server has endpoint
  const serverPath = path.join(HARVESTER_DIR, "scripts/control-server.ts");
  const serverCode = loadText(serverPath);
  checks.push(check("server has /api/daily-digest/promote-gate", serverCode.includes("/api/daily-digest/promote-gate")));
  checks.push(check("promote-gate is GET only", serverCode.includes("promote-gate") && serverCode.includes("req.method !== \"GET\"") && serverCode.includes("methodNotAllowed")));
  checks.push(check("server has no token leaks in gate block", !hasTokenLeak(serverCode)));

  // 5. Checker reads correct inputs
  checks.push(check("checker reads latest.json", checkerCode.includes("latest.json")));
  checks.push(check("checker reads readiness", checkerCode.includes("promote-readiness.json")));
  checks.push(check("checker reads dry-run plan", checkerCode.includes("promote-dry-run-plan.json")));
  checks.push(check("checker reads shadow copy", checkerCode.includes("promote-shadow")));
  checks.push(check("checker reads build summary", checkerCode.includes("build-summary.json")));
  checks.push(check("checker checks production paths", checkerCode.includes("reports/daily-digest.md") && checkerCode.includes("reports/telegram-digest.txt")));
  checks.push(check("checker checks all evidence keys", checkerCode.includes("sandbox_output_validation_pass") && checkerCode.includes("promote_readiness_ready") && checkerCode.includes("shadow_copy_pass")));

  // 6. package.json has new scripts
  const pkg = loadJson(path.join(HARVESTER_DIR, "package.json"));
  checks.push(check("package.json has validate:daily-digest-promote-gate", pkg?.scripts?.["validate:daily-digest-promote-gate"] !== undefined));
  checks.push(check("package.json has check:daily-digest-promote-gate", pkg?.scripts?.["check:daily-digest-promote-gate"] !== undefined));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Promote Gate Validation (Phase 5C-2C-C5J) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);
  for (const c of checks) console.log(c.msg);
  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
