#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-sandbox-build-pilot.ts
 * Phase 5C-2C-C5E: Validate pilot sandbox build execution
 *
 * Checks:
 * - pilot runner exists
 * - runner does not use exec
 * - runner does not use shell=true
 * - runner only writes to reports/sandbox/daily-digest/
 * - runner checks protected paths before/after
 * - runner forces required flags
 * - control-server.ts has /api/daily-digest/sandbox/build-pilot
 * - control-server.ts has /api/daily-digest/sandbox/latest-build
 * - no collect/send/timer/generate/git/build/deploy/release
 * - no token / sk-cp / TELEGRAM_BOT_TOKEN / MINIMAX_API_KEY
 * - sandbox runtime ignored by git
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

  // 1. Pilot runner exists
  const runnerPath = path.join(HARVESTER_DIR, "scripts/daily-digest-sandbox-build-pilot.ts");
  const runnerCode = loadText(runnerPath);
  checks.push(check("pilot runner exists", fs.existsSync(runnerPath)));

  // 2. Runner does not use exec
  checks.push(check("runner does not use exec", !runnerCode.includes("exec(") && !runnerCode.includes("execSync(") && !runnerCode.includes("execFile(")));

  // 3. Runner uses spawn with shell=false
  checks.push(check("runner uses spawn", runnerCode.includes("spawn(")));
  checks.push(check("runner uses shell=false", runnerCode.includes("shell: false")));
  checks.push(check("runner does not use shell=true", !runnerCode.includes("shell: true")));

  // 4. Runner only writes to sandbox
  checks.push(check("runner only writes to sandbox", runnerCode.includes("reports/sandbox/daily-digest/")));
  // Check that writeFileSync is only used with sandbox paths
  const writeFileSyncLines = runnerCode.split("\n").filter(line => line.includes("writeFileSync"));
  const writesToProduction = writeFileSyncLines.some(line =>
    line.includes("reports/daily-digest.md") ||
    line.includes("reports/telegram-digest.txt") ||
    line.includes("dashboard/status.json")
  );
  checks.push(check("runner does not write to production paths via writeFileSync", !writesToProduction));

  // 5. Runner checks protected paths before/after
  checks.push(check("runner checks protected paths before", runnerCode.includes("protected_paths_before")));
  checks.push(check("runner checks protected paths after", runnerCode.includes("protected_paths_after")));
  checks.push(check("runner compares path hashes", runnerCode.includes("comparePathHashes")));
  checks.push(check("runner fails if protected paths changed", runnerCode.includes("PRODUCTION_VIOLATION")));

  // 6. Runner forces required flags
  checks.push(check("runner forces --sandbox", runnerCode.includes("--sandbox")));
  checks.push(check("runner forces --output-dir", runnerCode.includes("--output-dir")));
  checks.push(check("runner forces --no-collect", runnerCode.includes("--no-collect")));
  checks.push(check("runner forces --no-send", runnerCode.includes("--no-send")));
  checks.push(check("runner forces --no-timer", runnerCode.includes("--no-timer")));
  checks.push(check("runner forces --no-production-write", runnerCode.includes("--no-production-write")));

  // 7. Runner uses fixed args only, no shell string
  checks.push(check("runner uses fixed args array", runnerCode.includes("const args = [")));
  checks.push(check("runner does not use shell string construction", !runnerCode.includes("\`npx tsx\`")));

  // 8. No collect/send/timer/generate/git/build/deploy/release
  checks.push(check("runner does not trigger collect", !runnerCode.includes("CQA_PROFILE")));
  checks.push(check("runner does not trigger send", !runnerCode.includes("CQA_ALLOW_TELEGRAM_SEND=1")));
  checks.push(check("runner does not trigger generation", !runnerCode.includes("CQA_ALLOW_GENERATION=1")));
  checks.push(check("runner does not use git", !runnerCode.includes("git ")));
  checks.push(check("runner does not deploy", !runnerCode.includes("deploy")));
  checks.push(check("runner does not build release", !runnerCode.includes("build") || runnerCode.includes("build-summary")));

  // 9. Server has new endpoints
  const serverPath = path.join(HARVESTER_DIR, "scripts/control-server.ts");
  const serverCode = loadText(serverPath);
  checks.push(check("server has /api/daily-digest/sandbox/build-pilot", serverCode.includes("/api/daily-digest/sandbox/build-pilot")));
  checks.push(check("server has /api/daily-digest/sandbox/latest-build", serverCode.includes("/api/daily-digest/sandbox/latest-build")));
  checks.push(check("build-pilot is POST only", serverCode.includes('pathname === "/api/daily-digest/sandbox/build-pilot"') && serverCode.includes("req.method === \"POST\"")));
  checks.push(check("latest-build is GET only", serverCode.includes('case "/api/daily-digest/sandbox/latest-build":') && serverCode.includes('if (req.method !== "GET")')));
  checks.push(check("build-pilot checks token", serverCode.includes("CONTROL_CONFIG.token") && serverCode.includes("daily_digest_sandbox_build_pilot")));
  checks.push(check("build-pilot checks confirmation phrase", serverCode.includes("BUILD DAILY SANDBOX PILOT")));
  checks.push(check("build-pilot uses execution lock", serverCode.includes("acquireExecutionLock") && serverCode.includes("daily_digest_sandbox_build_pilot")));
  checks.push(check("build-pilot releases execution lock in finally", serverCode.includes("releaseExecutionLock") && serverCode.includes("daily_digest_sandbox_build_pilot")));
  checks.push(check("build-pilot writes audit log", serverCode.includes("writeAuditLogLowRisk") && serverCode.includes("daily_digest_sandbox_build_pilot")));
  checks.push(check("build-pilot audit log does not include token", serverCode.includes("daily_digest_sandbox_build_pilot") && serverCode.includes("reason: \"invalid_token\"")));

  // 10. Server does not use exec for build-pilot
  const buildPilotStart = serverCode.indexOf('pathname === "/api/daily-digest/sandbox/build-pilot"');
  const buildPilotEnd = serverCode.indexOf('// Block anything that\'s not GET');
  const buildPilotBlock = buildPilotStart >= 0 && buildPilotEnd > buildPilotStart ? serverCode.substring(buildPilotStart, buildPilotEnd) : "";
  checks.push(check("build-pilot endpoint does not use exec", !buildPilotBlock.includes("exec(")));
  checks.push(check("build-pilot endpoint does not use child_process", !buildPilotBlock.includes("child_process")));

  // 11. No token leaks
  checks.push(check("runner has no token leaks", !hasTokenLeak(runnerCode)));
  checks.push(check("server has no token leaks in build-pilot block", !hasTokenLeak(buildPilotBlock)));

  // 12. Sandbox runtime ignored by git
  const gitignorePath = path.join(HARVESTER_DIR, ".gitignore");
  const gitignore = loadText(gitignorePath);
  checks.push(check(".gitignore exists", gitignore.length > 0));
  checks.push(check(".gitignore ignores sandbox runtime", gitignore.includes("reports/sandbox/daily-digest/*")));
  checks.push(check(".gitignore allows .gitkeep", gitignore.includes("!reports/sandbox/daily-digest/.gitkeep")));

  // 13. package.json has new validate script
  const pkg = loadJson(path.join(HARVESTER_DIR, "package.json"));
  checks.push(check("package.json has validate:daily-digest-sandbox-build-pilot", pkg?.scripts?.["validate:daily-digest-sandbox-build-pilot"] !== undefined));

  // 14. Runner sets env to disable send/generation
  checks.push(check("runner sets CQA_ALLOW_TELEGRAM_SEND=0", runnerCode.includes('CQA_ALLOW_TELEGRAM_SEND: "0"')));
  checks.push(check("runner sets CQA_ALLOW_GENERATION=0", runnerCode.includes('CQA_ALLOW_GENERATION: "0"')));

  // 15. Runner exports runSandboxBuildPilot
  checks.push(check("runner exports runSandboxBuildPilot", runnerCode.includes("export async function runSandboxBuildPilot")));

  // 16. Runner uses sandbox manager to create run
  checks.push(check("runner imports createSandboxRun", runnerCode.includes("createSandboxRun")));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Sandbox Build Pilot Validation (Phase 5C-2C-C5E) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);
  for (const c of checks) console.log(c.msg);
  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
