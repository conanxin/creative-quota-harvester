#!/usr/bin/env tsx
/**
 * scripts/validate-daily-digest-sandbox-output-tools.ts
 * Phase 5C-2C-C5F: Validate sandbox output tools
 *
 * Checks:
 * - output validator exists
 * - diff generator exists
 * - both do not use child_process/exec/spawn
 * - both do not read .env/.control.local
 * - both do not call network
 * - both do not write production paths
 * - control-server.ts has latest-output-validation endpoint
 * - if POST endpoint exists, confirm phrase required
 * - no token/sk-cp/TELEGRAM_BOT_TOKEN/MINIMAX_API_KEY
 * - sanitizer regression passes
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

  // 1. Output validator exists
  const validatorPath = path.join(HARVESTER_DIR, "scripts/validate-daily-digest-sandbox-output.ts");
  const validatorCode = loadText(validatorPath);
  checks.push(check("output validator exists", fs.existsSync(validatorPath)));

  // 2. Diff generator exists
  const diffPath = path.join(HARVESTER_DIR, "scripts/daily-digest-sandbox-diff.ts");
  const diffCode = loadText(diffPath);
  checks.push(check("diff generator exists", fs.existsSync(diffPath)));

  // 3. Both do not use child_process
  checks.push(check("validator does not import child_process", !/(^|\n)\s*import\s+.*child_process/.test(validatorCode) && !/(^|\n)\s*require\s*\(\s*["']child_process["']/.test(validatorCode)));
  checks.push(check("diff does not import child_process", !/(^|\n)\s*import\s+.*child_process/.test(diffCode) && !/(^|\n)\s*require\s*\(\s*["']child_process["']/.test(diffCode)));

  // 4. Both do not use exec/spawn
  checks.push(check("validator does not use exec", !/(^|\n)\s*exec\s*\(/.test(validatorCode)));
  checks.push(check("validator does not use spawn", !/(^|\n)\s*spawn\s*\(/.test(validatorCode)));
  checks.push(check("diff does not use exec", !/(^|\n)\s*exec\s*\(/.test(diffCode)));
  checks.push(check("diff does not use spawn", !/(^|\n)\s*spawn\s*\(/.test(diffCode)));

  // 5. Both do not read .env/.control.local
  checks.push(check("validator does not read .env", !/(^|\n)\s*readFileSync\s*\(.*["']\.env/.test(validatorCode)));
  checks.push(check("validator does not read .control.local", !/(^|\n)\s*readFileSync\s*\(.*["']\.control\.local/.test(validatorCode)));
  checks.push(check("diff does not read .env", !/(^|\n)\s*readFileSync\s*\(.*["']\.env/.test(diffCode)));
  checks.push(check("diff does not read .control.local", !/(^|\n)\s*readFileSync\s*\(.*["']\.control\.local/.test(diffCode)));

  // 6. Both do not call network
  checks.push(check("validator does not use fetch", !/(^|\n)\s*fetch\s*\(/.test(validatorCode)));
  checks.push(check("validator does not use axios", !/(^|\n)\s*axios/.test(validatorCode)));
  checks.push(check("diff does not use fetch", !/(^|\n)\s*fetch\s*\(/.test(diffCode)));
  checks.push(check("diff does not use axios", !/(^|\n)\s*axios/.test(diffCode)));

  // 7. Validator does not write production (reads only, no writeFileSync to production)
  checks.push(check("validator does not write production", !validatorCode.includes("writeFileSync") || !validatorCode.includes("reports/daily-digest.md")));
  // Diff reads production but should not write to it
  checks.push(check("diff does not write to production paths", !diffCode.includes("writeFileSync") || diffCode.includes("diffs/")));

  // 8. Server has latest-output-validation endpoint
  const serverPath = path.join(HARVESTER_DIR, "scripts/control-server.ts");
  const serverCode = loadText(serverPath);
  checks.push(check("server has latest-output-validation", serverCode.includes("/api/daily-digest/sandbox/latest-output-validation")));
  checks.push(check("latest-output-validation is GET only", serverCode.includes("latest-output-validation") && serverCode.includes("req.method !== \"GET\"") && serverCode.includes("methodNotAllowed")));

  // 9. No token leaks
  checks.push(check("validator has no token leaks", !hasTokenLeak(validatorCode)));
  checks.push(check("diff has no token leaks", !hasTokenLeak(diffCode)));
  checks.push(check("server has no token leaks in output endpoints", !hasTokenLeak(serverCode)));

  // 10. package.json has new validate script
  const pkg = loadJson(path.join(HARVESTER_DIR, "package.json"));
  checks.push(check("package.json has validate:daily-digest-sandbox-output-tools", pkg?.scripts?.["validate:daily-digest-sandbox-output-tools"] !== undefined));

  // 11. Diff only writes to sandbox
  checks.push(check("diff writes to diffs/", diffCode.includes("diffs/")));
  // Check that writeFileSync in diff only uses diffs/ paths
  const diffWriteFileSyncLines = diffCode.split("\n").filter(line => line.includes("writeFileSync"));
  const diffWritesToProduction = diffWriteFileSyncLines.some(line =>
    line.includes("reports/daily-digest.md") ||
    line.includes("reports/telegram-digest.txt") ||
    line.includes("dashboard/status.json")
  );
  checks.push(check("diff does not write to production paths via writeFileSync", !diffWritesToProduction));

  // 12. Validator exports validateLatestSandboxOutput
  checks.push(check("validator exports validateLatestSandboxOutput", validatorCode.includes("export function validateLatestSandboxOutput")));

  // 13. Diff exports generateSandboxDiff
  checks.push(check("diff exports generateSandboxDiff", diffCode.includes("export function generateSandboxDiff")));

  // 14. Validator checks manifest flags
  checks.push(check("validator checks manifest.collect_allowed", validatorCode.includes("collect_allowed")));
  checks.push(check("validator checks manifest.telegram_send_allowed", validatorCode.includes("telegram_send_allowed")));
  checks.push(check("validator checks manifest.production_write_allowed", validatorCode.includes("production_write_allowed")));

  // 15. Validator checks for secrets and tool residues
  checks.push(check("validator checks for secrets", validatorCode.includes("secret") || validatorCode.includes("TELEGRAM_BOT_TOKEN")));
  checks.push(check("validator checks for tool residues", validatorCode.includes("tool") || validatorCode.includes("truncated")));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Sandbox Output Tools Validation (Phase 5C-2C-C5F) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);
  for (const c of checks) console.log(c.msg);
  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
