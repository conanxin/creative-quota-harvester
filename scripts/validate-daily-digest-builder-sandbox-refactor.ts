#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-builder-sandbox-refactor.ts
 * Phase 5C-2C-C5D: Validate sandbox builder refactor
 *
 * Checks:
 * - sandbox runtime helper exists
 * - pilot builder imports sandbox guards/runtime
 * - required flags recognized
 * - sandbox output-dir restricted to reports/sandbox/daily-digest/
 * - production paths rejected in sandbox mode
 * - collect/send/timer disabled in sandbox mode
 * - no exec / spawn / child_process
 * - no .env / .control.local reads
 * - no network calls
 * - no builder execution
 * - no token leaks
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

  // 1. Sandbox runtime helper exists
  const runtimePath = path.join(HARVESTER_DIR, "scripts/daily-digest-sandbox-runtime.ts");
  const runtimeCode = loadText(runtimePath);
  checks.push(check("sandbox runtime helper exists", fs.existsSync(runtimePath)));

  // 2. Reuses sandbox-guards
  checks.push(check("runtime imports from daily-digest-sandbox-guards", runtimeCode.includes("from \"./daily-digest-sandbox-guards\"")));
  checks.push(check("runtime imports parseSandboxArgs", runtimeCode.includes("parseSandboxArgs")));
  checks.push(check("runtime imports buildSandboxRuntimeConfig", runtimeCode.includes("buildSandboxRuntimeConfig")));
  checks.push(check("runtime imports validateSandboxFlags", runtimeCode.includes("validateSandboxFlags")));
  checks.push(check("runtime imports assertSandboxOutputPath", runtimeCode.includes("assertSandboxOutputPath")));
  checks.push(check("runtime imports assertNotProductionPath", runtimeCode.includes("assertNotProductionPath")));
  checks.push(check("runtime imports PRODUCTION_PATHS", runtimeCode.includes("PRODUCTION_PATHS")));

  // 3. Exports key functions
  checks.push(check("runtime exports resolveSandboxPaths", runtimeCode.includes("export function resolveSandboxPaths")));
  checks.push(check("runtime exports buildSandboxRuntime", runtimeCode.includes("export function buildSandboxRuntime")));
  checks.push(check("runtime exports getProductionPaths", runtimeCode.includes("export function getProductionPaths")));
  checks.push(check("runtime exports resolveBuilderPaths", runtimeCode.includes("export function resolveBuilderPaths")));

  // 4. Safety: no child_process, no exec, no spawn, no network, no env
  checks.push(check("runtime does not import child_process", !runtimeCode.includes('import * as child_process') && !runtimeCode.includes('require("child_process")')));
  checks.push(check("runtime does not use exec", !runtimeCode.includes("exec(")));
  checks.push(check("runtime does not use spawn", !runtimeCode.includes("spawn")));
  checks.push(check("runtime does not use execSync", !runtimeCode.includes("execSync")));
  checks.push(check("runtime does not import http", !runtimeCode.includes("import * as http")));
  checks.push(check("runtime does not use fetch", !runtimeCode.includes("fetch")));
  checks.push(check("runtime does not use axios", !runtimeCode.includes("axios")));
  checks.push(check("runtime does not read .env", !runtimeCode.includes(".env")));
  checks.push(check("runtime does not read .control.local", !runtimeCode.includes(".control.local")));

  // 5. Sandbox path restriction
  checks.push(check("runtime enforces sandbox output dir", runtimeCode.includes("assertSandboxOutputPath")));
  checks.push(check("runtime restricts outputDir to sandbox area", runtimeCode.includes("reports/sandbox/daily-digest/")));

  // 6. Production path protection in resolveBuilderPaths
  checks.push(check("runtime rejects production paths in sandbox mode", runtimeCode.includes("assertNotProductionPath")));
  checks.push(check("runtime references reports/daily-digest.md", runtimeCode.includes("reports/daily-digest.md")));
  checks.push(check("runtime references reports/telegram-digest.txt", runtimeCode.includes("reports/telegram-digest.txt")));
  checks.push(check("runtime references dashboard/status.json", runtimeCode.includes("dashboard/status.json")));
  checks.push(check("runtime references reports/daily/", runtimeCode.includes("reports/daily/")));

  // 7. Sandbox mode side effects disabled
  checks.push(check("runtime sets collectAllowed=false in sandbox", runtimeCode.includes("collectAllowed: false")));
  checks.push(check("runtime sets sendAllowed=false in sandbox", runtimeCode.includes("sendAllowed: false")));
  checks.push(check("runtime sets timerAllowed=false in sandbox", runtimeCode.includes("timerAllowed: false")));
  checks.push(check("runtime sets productionWriteAllowed=false in sandbox", runtimeCode.includes("productionWriteAllowed: false")));

  // 8. No token leaks
  checks.push(check("runtime has no token leaks", !hasTokenLeak(runtimeCode)));

  // 9. Pilot builder refactored
  const pilotPath = path.join(HARVESTER_DIR, "src/reports/telegram-daily-digest.ts");
  const pilotCode = loadText(pilotPath);
  checks.push(check("pilot builder exists", fs.existsSync(pilotPath)));
  checks.push(check("pilot builder imports sandbox guards", pilotCode.includes("daily-digest-sandbox-guards")));
  checks.push(check("pilot builder imports sandbox runtime", pilotCode.includes("daily-digest-sandbox-runtime")));
  checks.push(check("pilot builder uses buildSandboxRuntime", pilotCode.includes("buildSandboxRuntime")));
  checks.push(check("pilot builder uses resolveBuilderPaths", pilotCode.includes("resolveBuilderPaths")));
  checks.push(check("pilot builder checks sandboxMode before production writes", pilotCode.includes("sandboxMode")));
  checks.push(check("pilot builder skips writeFileSync in sandbox mode", pilotCode.includes("if (!paths.sandboxMode)") || pilotCode.includes("paths.sandboxMode === false") || pilotCode.includes("sandboxMode: false")));

  // 10. Pilot builder still has production defaults
  checks.push(check("pilot builder still has production default paths", pilotCode.includes("reports/daily-digest.md") || pilotCode.includes("getProductionPaths")));

  // 11. package.json has new validate script
  const packageJson = loadJson(path.join(HARVESTER_DIR, "package.json"));
  checks.push(check("package.json has validate:daily-digest-builder-sandbox-refactor", packageJson && packageJson.scripts && packageJson.scripts["validate:daily-digest-builder-sandbox-refactor"]));

  // 12. No builder execution in validation script itself
  const thisCode = loadText(__filename);
  checks.push(check("validator does not import child_process", !/(^|\n)\s*import\s+.*child_process/.test(thisCode) && !/(^|\n)\s*require\s*\(\s*["']child_process["']/.test(thisCode)));
  checks.push(check("validator does not use execSync", !/(^|\n)\s*execSync\s*\(/.test(thisCode)));
  checks.push(check("validator does not use spawn", !/(^|\n)\s*spawn\s*\(/.test(thisCode)));
  checks.push(check("validator does not use fetch", !/(^|\n)\s*fetch\s*\(/.test(thisCode)));
  checks.push(check("validator does not use axios", !/(^|\n)\s*axios/.test(thisCode)));
  checks.push(check("validator does not read .env", !/(^|\n)\s*readFileSync\s*\(.*["']\.env/.test(thisCode)));
  checks.push(check("validator does not read .control.local", !/(^|\n)\s*readFileSync\s*\(.*["']\.control\.local/.test(thisCode)));
  checks.push(check("validator has no token leaks", !hasTokenLeak(thisCode)));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Builder Sandbox Refactor Validation (Phase 5C-2C-C5D) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);
  for (const c of checks) console.log(c.msg);
  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
