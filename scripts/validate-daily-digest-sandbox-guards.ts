#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-sandbox-guards.ts
 * Phase 5C-2C-C5C: Validate sandbox guard functions
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

function main() {
  const checks: { pass: boolean; msg: string }[] = [];

  const guardPath = path.join(HARVESTER_DIR, "scripts/daily-digest-sandbox-guards.ts");
  const guardCode = loadText(guardPath);

  // 1. Guard file exists
  checks.push(check("guard file exists", fs.existsSync(guardPath)));

  // 2. Guard safety: no child_process, no exec, no spawn, no network, no env
  checks.push(check("Guard does not import child_process", !guardCode.includes("child_process")));
  checks.push(check("Guard does not use exec", !guardCode.includes("exec(") && !guardCode.includes("child_process.exec")));
  checks.push(check("Guard does not use spawn", !guardCode.includes("spawn")));
  checks.push(check("Guard does not use execFile", !guardCode.includes("execFile")));
  checks.push(check("Guard does not use execSync", !guardCode.includes("execSync")));
  checks.push(check("Guard does not import http", !guardCode.includes("import * as http")));
  checks.push(check("Guard does not use fetch", !guardCode.includes("fetch")));
  checks.push(check("Guard does not use axios", !guardCode.includes("axios")));
  checks.push(check("Guard does not read .env", !guardCode.includes(".env")));
  checks.push(check("Guard does not read .control.local", !guardCode.includes(".control.local")));

  // 3. Guard functions
  checks.push(check("Guard exports isSandboxPath", guardCode.includes("export function isSandboxPath")));
  checks.push(check("Guard exports assertSandboxOutputPath", guardCode.includes("export function assertSandboxOutputPath")));
  checks.push(check("Guard exports assertNotProductionPath", guardCode.includes("export function assertNotProductionPath")));
  checks.push(check("Guard exports parseSandboxArgs", guardCode.includes("export function parseSandboxArgs")));
  checks.push(check("Guard exports buildSandboxRuntimeConfig", guardCode.includes("export function buildSandboxRuntimeConfig")));
  checks.push(check("Guard exports validateSandboxFlags", guardCode.includes("export function validateSandboxFlags")));

  // 4. Runtime tests
  // Dynamic import to test the functions
  const { isSandboxPath, assertSandboxOutputPath, assertNotProductionPath, parseSandboxArgs, buildSandboxRuntimeConfig, validateSandboxFlags } = require("./daily-digest-sandbox-guards");

  // isSandboxPath
  checks.push(check("isSandboxPath allows sandbox path", isSandboxPath("reports/sandbox/daily-digest/sandbox-20260614_134500/outputs/test.md")));
  checks.push(check("isSandboxPath rejects production path", !isSandboxPath("reports/daily-digest.md")));
  checks.push(check("isSandboxPath rejects random path", !isSandboxPath("tmp/random.txt")));

  // assertSandboxOutputPath
  let threw = false;
  try { assertSandboxOutputPath("reports/sandbox/daily-digest/sandbox-20260614_134500/outputs/test.md"); } catch { threw = true; }
  checks.push(check("assertSandboxOutputPath allows sandbox path", !threw));

  threw = false;
  try { assertSandboxOutputPath("reports/daily-digest.md"); } catch { threw = true; }
  checks.push(check("assertSandboxOutputPath throws on production path", threw));

  // assertNotProductionPath
  threw = false;
  try { assertNotProductionPath("tmp/random.txt"); } catch { threw = true; }
  checks.push(check("assertNotProductionPath allows non-production path", !threw));

  threw = false;
  try { assertNotProductionPath("reports/daily-digest.md"); } catch { threw = true; }
  checks.push(check("assertNotProductionPath throws on production path", threw));

  threw = false;
  try { assertNotProductionPath("dashboard/status.json"); } catch { threw = true; }
  checks.push(check("assertNotProductionPath throws on dashboard/status.json", threw));

  threw = false;
  try { assertNotProductionPath("reports/telegram-digest.txt"); } catch { threw = true; }
  checks.push(check("assertNotProductionPath throws on telegram-digest.txt", threw));

  // parseSandboxArgs
  const args = parseSandboxArgs(["--sandbox", "--output-dir", "reports/sandbox/daily-digest/sandbox-20260614_134500/outputs/", "--no-collect", "--no-send", "--no-timer", "--no-production-write"]);
  checks.push(check("parseSandboxArgs parses --sandbox", args.sandbox === true));
  checks.push(check("parseSandboxArgs parses --output-dir", args.outputDir === "reports/sandbox/daily-digest/sandbox-20260614_134500/outputs/"));
  checks.push(check("parseSandboxArgs parses --no-collect", args.noCollect === true));
  checks.push(check("parseSandboxArgs parses --no-send", args.noSend === true));
  checks.push(check("parseSandboxArgs parses --no-timer", args.noTimer === true));
  checks.push(check("parseSandboxArgs parses --no-production-write", args.noProductionWrite === true));

  // Missing flags
  const missingArgs = parseSandboxArgs(["--sandbox"]);
  checks.push(check("parseSandboxArgs missing --output-dir", missingArgs.outputDir === null));
  checks.push(check("parseSandboxArgs missing --no-collect", missingArgs.noCollect === false));

  // buildSandboxRuntimeConfig
  const config = buildSandboxRuntimeConfig(args);
  checks.push(check("buildSandboxRuntimeConfig allGuardsActive=true", config.allGuardsActive === true));
  checks.push(check("buildSandboxRuntimeConfig sandboxMode=true", config.sandboxMode === true));
  checks.push(check("buildSandboxRuntimeConfig collectAllowed=false", config.collectAllowed === false));
  checks.push(check("buildSandboxRuntimeConfig sendAllowed=false", config.sendAllowed === false));
  checks.push(check("buildSandboxRuntimeConfig timerAllowed=false", config.timerAllowed === false));
  checks.push(check("buildSandboxRuntimeConfig productionWriteAllowed=false", config.productionWriteAllowed === false));

  const partialConfig = buildSandboxRuntimeConfig(missingArgs);
  checks.push(check("buildSandboxRuntimeConfig allGuardsActive=false when missing flags", partialConfig.allGuardsActive === false));

  // validateSandboxFlags
  const validFlags = validateSandboxFlags(args);
  checks.push(check("validateSandboxFlags valid when all flags present", validFlags.valid === true));
  checks.push(check("validateSandboxFlags missing empty when valid", validFlags.missing.length === 0));

  const invalidFlags = validateSandboxFlags(missingArgs);
  checks.push(check("validateSandboxFlags invalid when missing flags", invalidFlags.valid === false));
  checks.push(check("validateSandboxFlags reports missing flags", invalidFlags.missing.length > 0));

  // 5. package.json
  const packageJson = JSON.parse(fs.readFileSync(path.join(HARVESTER_DIR, "package.json"), "utf-8"));
  checks.push(check("package.json has validate:daily-digest-sandbox-guards", packageJson.scripts && packageJson.scripts["validate:daily-digest-sandbox-guards"]));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Sandbox Guards Validation (Phase 5C-2C-C5C) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);
  for (const c of checks) console.log(c.msg);
  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
