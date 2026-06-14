/**
 * scripts/validate-daily-digest-build-readiness.ts
 * Phase 5C-2C-C5B: Validate build readiness audit, endpoint, and safety invariants
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");

function check(desc: string, condition: boolean): { pass: boolean; msg: string } {
  return { pass: condition, msg: condition ? `✅ ${desc}` : `❌ ${desc}` };
}

function loadText(p: string): string {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

function loadJson(p: string): any {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function hasTokenLeak(text: string): boolean {
  const patterns = [
    /sk-[a-zA-Z0-9]{20,}/,
    /TELEGRAM_BOT_TOKEN\s*=\s*['"]\S+['"]/,
    /MINIMAX_API_KEY\s*=\s*['"]\S+['"]/,
    /CQA_CONTROL_TOKEN\s*=\s*['"]\S+['"]/,
    /ghp_[a-zA-Z0-9]{36,}/,
  ];
  return patterns.some((p) => p.test(text));
}

function main() {
  const checks: { pass: boolean; msg: string }[] = [];

  // 1. auditor script exists
  const auditorPath = path.join(HARVESTER_DIR, "scripts/audit-daily-digest-build-readiness.ts");
  checks.push(check("auditor script exists", fs.existsSync(auditorPath)));
  const auditorCode = loadText(auditorPath);

  // 2. Auditor does not use child_process
  checks.push(check("Auditor does not import child_process", !auditorCode.includes("import * as child_process") && !auditorCode.includes("require(\"child_process\")")));
  checks.push(check("Auditor does not use exec", !auditorCode.includes("child_process.exec") && !auditorCode.includes("exec(") && !auditorCode.includes("execFile") && !auditorCode.includes("execSync")));
  checks.push(check("Auditor does not use spawn", !auditorCode.includes("spawn(") && !auditorCode.includes("child_process.spawn")));
  checks.push(check("Auditor does not use execFile", !auditorCode.includes("execFile(")));
  checks.push(check("Auditor does not use execSync", !auditorCode.includes("execSync(")));

  // 3. Auditor does not call network
  checks.push(check("Auditor does not import http", !auditorCode.includes("import * as http")));
  checks.push(check("Auditor does not import https", !auditorCode.includes("import * as https")));
  checks.push(check("Auditor does not use fetch", !auditorCode.includes("fetch")));
  checks.push(check("Auditor does not use axios", !auditorCode.includes("axios")));
  checks.push(check("Auditor does not use http.request", !auditorCode.includes("http.request")));

  // 4. Auditor does not read .env or .control.local
  checks.push(check("Auditor does not read .env file", !auditorCode.includes(".env") || auditorCode.includes("without .env reading")));
  checks.push(check("Auditor does not read .control.local", !auditorCode.includes(".control.local")));

  // 5. Auditor does not execute builders
  checks.push(check("Auditor does not call tsx to run builders", !auditorCode.includes("tsx scripts/") && !auditorCode.includes("npx tsx")));
  checks.push(check("Auditor does not require builders", !auditorCode.includes("require(")));
  checks.push(check("Auditor is read-only", auditorCode.includes("read-only") || auditorCode.includes("readiness_check_only")));

  // 6. readiness JSON exists
  const readinessPath = path.join(HARVESTER_DIR, "dashboard/daily-digest-build-readiness.json");
  checks.push(check("readiness JSON exists", fs.existsSync(readinessPath)));
  const readiness = loadJson(readinessPath);
  checks.push(check("readiness JSON is valid", readiness !== null));
  checks.push(check("readiness JSON has phase", readiness && readiness.phase === "5C-2C-C5B"));
  checks.push(check("readiness JSON has mode", readiness && readiness.mode === "readiness_check_only"));
  checks.push(check("readiness JSON has ready_for_sandbox_build", readiness && readiness.ready_for_sandbox_build !== undefined));
  checks.push(check("readiness JSON has builders_detected", readiness && Array.isArray(readiness.builders_detected)));
  checks.push(check("readiness JSON has production_write_paths", readiness && Array.isArray(readiness.production_write_paths)));
  checks.push(check("readiness JSON has sandbox_support", readiness && readiness.sandbox_support !== undefined));
  checks.push(check("readiness JSON has blocked_risks", readiness && readiness.blocked_risks !== undefined));
  checks.push(check("readiness JSON has required_refactors", readiness && Array.isArray(readiness.required_refactors_before_sandbox_execution)));
  checks.push(check("readiness JSON has safe_next_step", readiness && typeof readiness.safe_next_step === "string"));

  // 7. Production protected paths are recognized
  if (readiness && readiness.production_write_paths) {
    checks.push(check("readiness includes reports/daily-digest.md", readiness.production_write_paths.includes("reports/daily-digest.md")));
    checks.push(check("readiness includes reports/telegram-digest.txt", readiness.production_write_paths.includes("reports/telegram-digest.txt")));
    checks.push(check("readiness includes dashboard/status.json", readiness.production_write_paths.includes("dashboard/status.json")));
  }

  // 8. Blocked risks are properly set
  if (readiness && readiness.blocked_risks) {
    checks.push(check("blocked_risks.collect is true", readiness.blocked_risks.collect === true));
    checks.push(check("blocked_risks.telegram_send is true", readiness.blocked_risks.telegram_send === true));
    checks.push(check("blocked_risks.timer is true", readiness.blocked_risks.timer === true));
    checks.push(check("blocked_risks.production_write is true", readiness.blocked_risks.production_write === true));
  }

  // 9. Server has build-readiness endpoint
  const serverPath = path.join(HARVESTER_DIR, "scripts/control-server.ts");
  const serverCode = loadText(serverPath);
  checks.push(check("Server has /api/daily-digest/build-readiness", serverCode.includes("/api/daily-digest/build-readiness")));
  checks.push(check("build-readiness endpoint is GET only", serverCode.includes('case "/api/daily-digest/build-readiness":') && serverCode.includes('if (req.method !== "GET")')));
  
  // Extract build-readiness block from server code
  const readinessStart = serverCode.indexOf('case "/api/daily-digest/build-readiness":');
  const readinessEnd = serverCode.indexOf('case "/api/daily-digest/sandbox-status":');
  const readinessBlock = readinessStart >= 0 && readinessEnd > readinessStart
    ? serverCode.substring(readinessStart, readinessEnd)
    : "";
  checks.push(check("build-readiness does not call runner", !readinessBlock.includes("executeLowRiskAction")));
  checks.push(check("build-readiness does not write production", !readinessBlock.includes("writeFile") && !readinessBlock.includes("mkdirSync")));

  // 10. control.html has build-readiness panel
  const controlHtmlPath = path.join(HARVESTER_DIR, "dashboard/control.html");
  const controlHtml = loadText(controlHtmlPath);
  checks.push(check("control.html has build-readiness-panel", controlHtml.includes("build-readiness-panel")));
  checks.push(check("control.html calls /api/daily-digest/build-readiness", controlHtml.includes("/api/daily-digest/build-readiness")));
  checks.push(check("control.html has readiness warning", controlHtml.includes("本阶段只做 readiness audit")));

  // 11. No token leaks
  const readinessText = loadText(readinessPath);
  checks.push(check("No token leaks in readiness JSON", !hasTokenLeak(readinessText)));
  checks.push(check("No token leaks in auditor", !hasTokenLeak(auditorCode)));
  checks.push(check("No token leaks in server", !hasTokenLeak(serverCode)));

  // 12. package.json has scripts
  const packageJson = loadJson(path.join(HARVESTER_DIR, "package.json"));
  checks.push(check("package.json has audit:daily-digest-build-readiness", packageJson && packageJson.scripts && packageJson.scripts["audit:daily-digest-build-readiness"]));
  checks.push(check("package.json has validate:daily-digest-build-readiness", packageJson && packageJson.scripts && packageJson.scripts["validate:daily-digest-build-readiness"]));

  // Summary
  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Daily Digest Build Readiness Validation (Phase 5C-2C-C5B) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);

  for (const c of checks) {
    console.log(c.msg);
  }

  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
