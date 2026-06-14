#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-promote-executor-disabled.ts
 * Phase 5C-2C-C5L: Validate disabled promote executor scaffold
 *
 * Checks:
 * - disabled config exists and valid
 * - executor exists and exports correct functions
 * - executor does not use child_process/exec/spawn
 * - executor does not read .env/.control.local
 * - executor does not call network
 * - executor does not copy to production
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

  // 1. Disabled config exists
  const configPath = path.join(HARVESTER_DIR, "dashboard/daily-digest-promote-execution-disabled.json");
  const config = loadJson(configPath);
  checks.push(check("disabled config exists", fs.existsSync(configPath)));
  checks.push(check("disabled config is valid", config !== null));
  checks.push(check("config has phase 5C-2C-C5L", config?.phase === "5C-2C-C5L"));
  checks.push(check("config has mode execution_scaffold_disabled", config?.mode === "execution_scaffold_disabled"));
  checks.push(check("config has real_promote_allowed=false", config?.real_promote_allowed === false));
  checks.push(check("config has production_write_allowed=false", config?.production_write_allowed === false));
  checks.push(check("config has telegram_send_allowed=false", config?.telegram_send_allowed === false));
  checks.push(check("config has required_confirm_phrase", typeof config?.required_confirm_phrase === "string" && config.required_confirm_phrase.length > 0));
  checks.push(check("config has disabled_reason", typeof config?.disabled_reason === "string" && config.disabled_reason.length > 0));
  checks.push(check("config has required_gates", config?.required_gates && Object.keys(config.required_gates).length > 0));
  checks.push(check("config has future_execution_steps", Array.isArray(config?.future_execution_steps) && config.future_execution_steps.length > 0));
  checks.push(check("config has blocked_actions", Array.isArray(config?.blocked_actions) && config.blocked_actions.length > 0));
  checks.push(check("config has no token leaks", !hasTokenLeak(loadText(configPath))));

  // 2. Executor exists
  const executorPath = path.join(HARVESTER_DIR, "scripts/daily-digest-promote-executor-disabled.ts");
  const executorCode = loadText(executorPath);
  checks.push(check("executor exists", fs.existsSync(executorPath)));
  checks.push(check("executor exports runDisabledExecutor", executorCode.includes("export function runDisabledExecutor")));

  // 3. Executor safety
  checks.push(check("executor does not import child_process", !/(^|\n)\s*import\s+.*child_process/.test(executorCode) && !/(^|\n)\s*require\s*\(\s*["']child_process["']/.test(executorCode)));
  checks.push(check("executor does not use exec", !/(^|\n)\s*exec\s*\(/.test(executorCode)));
  checks.push(check("executor does not use spawn", !/(^|\n)\s*spawn\s*\(/.test(executorCode)));
  checks.push(check("executor does not read .env", !/(^|\n)\s*readFileSync\s*\(.*["']\.env/.test(executorCode)));
  checks.push(check("executor does not read .control.local", !/(^|\n)\s*readFileSync\s*\(.*["']\.control\.local/.test(executorCode)));
  checks.push(check("executor does not use fetch", !/(^|\n)\s*fetch\s*\(/.test(executorCode)));
  checks.push(check("executor does not use axios", !/(^|\n)\s*axios/.test(executorCode)));
  checks.push(check("executor does not copy to production", !executorCode.includes("copyFileSync")));
  checks.push(check("executor has redact function", executorCode.includes("function redact")));
  checks.push(check("executor has no token leaks", !hasTokenLeak(executorCode)));

  // 4. Executor always returns disabled
  checks.push(check("executor always sets real_promote_allowed=false", executorCode.includes("real_promote_allowed: false")));
  checks.push(check("executor always sets production_write_allowed=false", executorCode.includes("production_write_allowed: false")));
  checks.push(check("executor always sets telegram_send_allowed=false", executorCode.includes("telegram_send_allowed: false")));
  checks.push(check("executor always sets would_promote=false", executorCode.includes("would_promote: false")));
  checks.push(check("executor has blocked_reason", executorCode.includes("blocked_reason")));

  // 5. Server has endpoint
  const serverPath = path.join(HARVESTER_DIR, "scripts/control-server.ts");
  const serverCode = loadText(serverPath);
  checks.push(check("server has /api/daily-digest/promote-execution-disabled", serverCode.includes("/api/daily-digest/promote-execution-disabled")));
  checks.push(check("server has no token leaks in disabled block", !hasTokenLeak(serverCode)));

  // 6. Executor reads correct inputs
  checks.push(check("executor reads latest.json", executorCode.includes("latest.json")));
  checks.push(check("executor reads promote gate", executorCode.includes("daily-digest-promote-gate.json")));
  checks.push(check("executor reads shadow copy", executorCode.includes("promote-shadow")));
  checks.push(check("executor reads rollback manifest", executorCode.includes("rollback-manifest.json")));
  checks.push(check("executor checks all gate keys", executorCode.includes("promote_gate_pass") && executorCode.includes("shadow_copy_pass") && executorCode.includes("rollback_manifest_exists") && executorCode.includes("protected_paths_snapshot_exists") && executorCode.includes("human_approval_required")));

  // 7. package.json has new scripts
  const pkg = loadJson(path.join(HARVESTER_DIR, "package.json"));
  checks.push(check("package.json has validate:daily-digest-promote-executor-disabled", pkg?.scripts?.["validate:daily-digest-promote-executor-disabled"] !== undefined));
  checks.push(check("package.json has check:daily-digest-promote-executor-disabled", pkg?.scripts?.["check:daily-digest-promote-executor-disabled"] !== undefined));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Promote Execution Disabled Validation (Phase 5C-2C-C5L) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);
  for (const c of checks) console.log(c.msg);
  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
