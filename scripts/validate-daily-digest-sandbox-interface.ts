#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-sandbox-interface.ts
 * Phase 5C-2C-C5C: Validate sandbox interface contract
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

  const interfacePath = path.join(HARVESTER_DIR, "dashboard/daily-digest-sandbox-interface.json");
  const interfaceJson = loadJson(interfacePath);
  const interfaceText = loadText(interfacePath);

  // 1. Interface JSON exists
  checks.push(check("interface JSON exists", fs.existsSync(interfacePath)));
  checks.push(check("interface JSON is valid", interfaceJson !== null));
  checks.push(check("interface JSON has phase", interfaceJson && interfaceJson.phase === "5C-2C-C5C"));
  checks.push(check("interface JSON has mode", interfaceJson && interfaceJson.mode === "interface_contract_only"));
  checks.push(check("interface JSON has real_digest_build_allowed=false", interfaceJson && interfaceJson.real_digest_build_allowed === false));
  checks.push(check("interface JSON has production_write_allowed=false", interfaceJson && interfaceJson.production_write_allowed === false));

  // 2. Required flags
  checks.push(check("interface has required_flags", interfaceJson && typeof interfaceJson.required_flags === "object"));
  checks.push(check("required_flags has --sandbox", interfaceJson && interfaceJson.required_flags && interfaceJson.required_flags["--sandbox"]));
  checks.push(check("required_flags has --output-dir", interfaceJson && interfaceJson.required_flags && interfaceJson.required_flags["--output-dir"]));
  checks.push(check("required_flags has --no-collect", interfaceJson && interfaceJson.required_flags && interfaceJson.required_flags["--no-collect"]));
  checks.push(check("required_flags has --no-send", interfaceJson && interfaceJson.required_flags && interfaceJson.required_flags["--no-send"]));
  checks.push(check("required_flags has --no-timer", interfaceJson && interfaceJson.required_flags && interfaceJson.required_flags["--no-timer"]));
  checks.push(check("required_flags has --no-production-write", interfaceJson && interfaceJson.required_flags && interfaceJson.required_flags["--no-production-write"]));

  // 3. Protected paths
  checks.push(check("interface has protected_paths", interfaceJson && Array.isArray(interfaceJson.protected_paths)));
  checks.push(check("protected_paths includes reports/daily-digest.md", interfaceJson && interfaceJson.protected_paths && interfaceJson.protected_paths.includes("reports/daily-digest.md")));
  checks.push(check("protected_paths includes reports/telegram-digest.txt", interfaceJson && interfaceJson.protected_paths && interfaceJson.protected_paths.includes("reports/telegram-digest.txt")));
  checks.push(check("protected_paths includes dashboard/status.json", interfaceJson && interfaceJson.protected_paths && interfaceJson.protected_paths.includes("dashboard/status.json")));
  checks.push(check("protected_paths includes reports/daily/", interfaceJson && interfaceJson.protected_paths && interfaceJson.protected_paths.includes("reports/daily/")));

  // 4. Allowed output root
  checks.push(check("interface has allowed_output_root", interfaceJson && typeof interfaceJson.allowed_output_root === "string"));
  checks.push(check("allowed_output_root is in sandbox", interfaceJson && interfaceJson.allowed_output_root && interfaceJson.allowed_output_root.includes("reports/sandbox/daily-digest/")));

  // 5. Blocked side effects
  checks.push(check("interface has blocked_side_effects", interfaceJson && typeof interfaceJson.blocked_side_effects === "object"));
  checks.push(check("blocked_side_effects.collect=true", interfaceJson && interfaceJson.blocked_side_effects && interfaceJson.blocked_side_effects.collect === true));
  checks.push(check("blocked_side_effects.telegram_send=true", interfaceJson && interfaceJson.blocked_side_effects && interfaceJson.blocked_side_effects.telegram_send === true));
  checks.push(check("blocked_side_effects.timer=true", interfaceJson && interfaceJson.blocked_side_effects && interfaceJson.blocked_side_effects.timer === true));
  checks.push(check("blocked_side_effects.model_call=true", interfaceJson && interfaceJson.blocked_side_effects && interfaceJson.blocked_side_effects.model_call === true));
  checks.push(check("blocked_side_effects.media_generation=true", interfaceJson && interfaceJson.blocked_side_effects && interfaceJson.blocked_side_effects.media_generation === true));
  checks.push(check("blocked_side_effects.production_write=true", interfaceJson && interfaceJson.blocked_side_effects && interfaceJson.blocked_side_effects.production_write === true));

  // 6. No token leaks
  checks.push(check("No token leaks in interface JSON", !hasTokenLeak(interfaceText)));

  // 7. Server endpoint
  const serverPath = path.join(HARVESTER_DIR, "scripts/control-server.ts");
  const serverCode = loadText(serverPath);
  checks.push(check("Server has /api/daily-digest/sandbox-interface", serverCode.includes("/api/daily-digest/sandbox-interface")));
  checks.push(check("sandbox-interface is GET only", serverCode.includes('case "/api/daily-digest/sandbox-interface":') && serverCode.includes('if (req.method !== "GET")')));
  const interfaceStart = serverCode.indexOf('case "/api/daily-digest/sandbox-interface":');
  const interfaceEnd = serverCode.indexOf('case "/api/daily-digest/build-readiness":');
  const interfaceBlock = interfaceStart >= 0 && interfaceEnd > interfaceStart ? serverCode.substring(interfaceStart, interfaceEnd) : "";
  checks.push(check("sandbox-interface does not call runner", !interfaceBlock.includes("executeLowRiskAction")));
  checks.push(check("sandbox-interface does not write file", !interfaceBlock.includes("writeFile") && !interfaceBlock.includes("mkdirSync")));

  // 8. control.html
  const controlHtml = loadText(path.join(HARVESTER_DIR, "dashboard/control.html"));
  checks.push(check("control.html has sandbox-interface-panel", controlHtml.includes("sandbox-interface-panel")));
  checks.push(check("control.html calls /api/daily-digest/sandbox-interface", controlHtml.includes("/api/daily-digest/sandbox-interface")));

  // 9. package.json
  const packageJson = loadJson(path.join(HARVESTER_DIR, "package.json"));
  checks.push(check("package.json has validate:daily-digest-sandbox-interface", packageJson && packageJson.scripts && packageJson.scripts["validate:daily-digest-sandbox-interface"]));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Sandbox Interface Validation (Phase 5C-2C-C5C) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);
  for (const c of checks) console.log(c.msg);
  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
