#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-promote-approval-pack.ts
 * Phase 5C-2C-C5M-0: Validate promote approval pack generator
 *
 * Checks:
 * - approval pack config exists and valid
 * - generator exists and exports correct functions
 * - generator does not use child_process/exec/spawn
 * - generator does not read .env/.control.local
 * - generator does not call network
 * - generator does not copy to production
 * - real_promote_allowed=false
 * - production_write_allowed=false
 * - telegram_send_allowed=false
 * - required confirm phrase exists
 * - approval checklist exists
 * - rollback manifest referenced
 * - control-server.ts has endpoint
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

  // 1. Approval pack config exists
  const configPath = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-approval-pack.json");
  const config = loadJson(configPath);
  checks.push(check("approval pack config exists", fs.existsSync(configPath)));
  checks.push(check("approval pack config is valid", config !== null));
  checks.push(check("config has phase 5C-2C-C5M-0", config?.phase === "5C-2C-C5M-0"));
  checks.push(check("config has mode human_approval_pack_only", config?.mode === "human_approval_pack_only"));
  checks.push(check("config has real_promote_allowed=false", config?.real_promote_allowed === false));
  checks.push(check("config has production_write_allowed=false", config?.production_write_allowed === false));
  checks.push(check("config has telegram_send_allowed=false", config?.telegram_send_allowed === false));
  checks.push(check("config has required_human_approval=true", config?.required_human_approval === true));
  checks.push(check("config has required_confirm_phrase", typeof config?.required_confirm_phrase === "string" && config.required_confirm_phrase.length > 0));
  checks.push(check("config has approval_decision", typeof config?.approval_decision === "string"));
  checks.push(check("config has future_allowed_operation", typeof config?.future_allowed_operation === "string"));
  checks.push(check("config has blocked_actions", Array.isArray(config?.blocked_actions) && config.blocked_actions.length > 0));
  checks.push(check("config has human_checklist", Array.isArray(config?.human_checklist) && config.human_checklist.length > 0));
  checks.push(check("config has no token leaks", !hasTokenLeak(loadText(configPath))));

  // 2. Generator exists
  const genPath = path.join(HARVESTER_DIR, "scripts/daily-digest-promote-approval-pack.ts");
  const genCode = loadText(genPath);
  checks.push(check("approval pack generator exists", fs.existsSync(genPath)));
  checks.push(check("generator exports generateApprovalPack", genCode.includes("export function generateApprovalPack")));

  // 3. Generator safety
  checks.push(check("generator does not import child_process", !/(^|\n)\s*import\s+.*child_process/.test(genCode) && !/(^|\n)\s*require\s*\(\s*["']child_process["']/.test(genCode)));
  checks.push(check("generator does not use exec", !/(^|\n)\s*exec\s*\(/.test(genCode)));
  checks.push(check("generator does not use spawn", !/(^|\n)\s*spawn\s*\(/.test(genCode)));
  checks.push(check("generator does not read .env", !/(^|\n)\s*readFileSync\s*\(.*["']\.env/.test(genCode)));
  checks.push(check("generator does not read .control.local", !/(^|\n)\s*readFileSync\s*\(.*["']\.control\.local/.test(genCode)));
  checks.push(check("generator does not use fetch", !/(^|\n)\s*fetch\s*\(/.test(genCode)));
  checks.push(check("generator does not use axios", !/(^|\n)\s*axios/.test(genCode)));
  checks.push(check("generator does not copy to production", !genCode.includes("copyFileSync")));
  checks.push(check("generator has redact function", genCode.includes("function redact")));
  checks.push(check("generator has no token leaks", !hasTokenLeak(genCode)));

  // 4. Generator always returns disabled
  checks.push(check("generator always sets real_promote_allowed=false", genCode.includes("real_promote_allowed: false")));
  checks.push(check("generator always sets production_write_allowed=false", genCode.includes("production_write_allowed: false")));
  checks.push(check("generator always sets telegram_send_allowed=false", genCode.includes("telegram_send_allowed: false")));
  checks.push(check("generator has explicit no production write statement", genCode.includes("NO PRODUCTION WRITE WAS PERFORMED")));

  // 5. Server has endpoint
  const serverPath = path.join(HARVESTER_DIR, "scripts/control-server.ts");
  const serverCode = loadText(serverPath);
  checks.push(check("server has /api/daily-digest/promote-approval-pack", serverCode.includes("/api/daily-digest/promote-approval-pack")));
  checks.push(check("server has no token leaks in approval pack block", !hasTokenLeak(serverCode)));

  // 6. Generator reads correct inputs
  checks.push(check("generator reads latest.json", genCode.includes("latest.json")));
  checks.push(check("generator reads promote gate", genCode.includes("daily-digest-promote-gate.json")));
  checks.push(check("generator reads shadow copy", genCode.includes("promote-shadow")));
  checks.push(check("generator reads rollback manifest", genCode.includes("rollback-manifest.json")));
  checks.push(check("generator reads diff summary", genCode.includes("diff-summary.json")));
  checks.push(check("generator reads sandbox outputs", genCode.includes("daily-digest.md") && genCode.includes("telegram-digest.txt")));
  checks.push(check("generator reads production paths", genCode.includes("reports/daily-digest.md") && genCode.includes("reports/telegram-digest.txt")));
  checks.push(check("generator has human checklist", genCode.includes("human_checklist")));
  checks.push(check("generator has approval pack JSON output", genCode.includes("APPROVAL_PACK_JSON")));
  checks.push(check("generator has approval pack MD output", genCode.includes("APPROVAL_PACK_MD")));

  // 7. package.json has new scripts
  const pkg = loadJson(path.join(HARVESTER_DIR, "package.json"));
  checks.push(check("package.json has validate:daily-digest-promote-approval-pack", pkg?.scripts?.["validate:daily-digest-promote-approval-pack"] !== undefined));
  checks.push(check("package.json has check:daily-digest-promote-approval-pack", pkg?.scripts?.["check:daily-digest-promote-approval-pack"] !== undefined));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Promote Approval Pack Validation (Phase 5C-2C-C5M-0) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);
  for (const c of checks) console.log(c.msg);
  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
