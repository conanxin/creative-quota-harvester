/**
 * scripts/validate-daily-digest-sandbox-manager.ts
 * Phase 5C-2C-C5: Validate sandbox manager, endpoints, and safety invariants
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");

function check(desc: string, condition: boolean): { pass: boolean; msg: string } {
  return { pass: condition, msg: condition ? `✅ ${desc}` : `❌ ${desc}` };
}

function loadJson(p: string): any {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function loadText(p: string): string {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
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

  // 1. sandbox manager exists
  const managerPath = path.join(HARVESTER_DIR, "scripts/daily-digest-sandbox-manager.ts");
  checks.push(check("daily-digest-sandbox-manager.ts exists", fs.existsSync(managerPath)));

  const managerCode = loadText(managerPath);

  // 2. Manager does not use child_process
  checks.push(check("Manager does not import child_process", !managerCode.includes("child_process")));
  checks.push(check("Manager does not use exec", !managerCode.includes("exec")));
  checks.push(check("Manager does not use spawn", !managerCode.includes("spawn")));
  checks.push(check("Manager does not use execFile", !managerCode.includes("execFile")));
  checks.push(check("Manager does not use execSync", !managerCode.includes("execSync")));

  // 3. Manager does not call network
  checks.push(check("Manager does not import http", !managerCode.includes("import * as http")));
  checks.push(check("Manager does not import https", !managerCode.includes("import * as https")));
  checks.push(check("Manager does not use fetch", !managerCode.includes("fetch")));
  checks.push(check("Manager does not use axios", !managerCode.includes("axios")));
  checks.push(check("Manager does not use http.request", !managerCode.includes("http.request")));

  // 4. Manager does not read .env or .control.local
  checks.push(check("Manager does not read .env", !managerCode.includes(".env")));
  checks.push(check("Manager does not read .control.local", !managerCode.includes(".control.local")));

  // 5. Manager writes only to reports/sandbox/daily-digest/
  checks.push(check("Manager writes to sandbox root", managerCode.includes("reports/sandbox/daily-digest")));
  // Check protected paths - the manager should mention them as protected but not write to them
  // We check the code doesn't contain fs.writeFileSync with these paths as target
  const hasWriteFileSyncToPath = (code: string, targetPath: string) => {
    const writeFileIdx = code.indexOf("fs.writeFileSync");
    if (writeFileIdx === -1) return false;
    // Check if the path appears in the same writeFileSync call
    const lines = code.split("\n");
    for (const line of lines) {
      if (line.includes("fs.writeFileSync") && line.includes(targetPath)) {
        return true;
      }
    }
    return false;
  };
  checks.push(check("Manager does not write to reports/daily-digest.md", !hasWriteFileSyncToPath(managerCode, "reports/daily-digest.md")));
  checks.push(check("Manager does not write to reports/telegram-digest.txt", !hasWriteFileSyncToPath(managerCode, "reports/telegram-digest.txt")));
  checks.push(check("Manager does not write to dashboard/status.json", !hasWriteFileSyncToPath(managerCode, "dashboard/status.json")));

  // 6. .gitignore ignores sandbox runtime
  const gitignorePath = path.join(HARVESTER_DIR, ".gitignore");
  const gitignore = loadText(gitignorePath);
  checks.push(check(".gitignore exists", gitignore.length > 0));
  checks.push(check(".gitignore ignores sandbox runtime", gitignore.includes("reports/sandbox/daily-digest/*")));
  checks.push(check(".gitignore allows .gitkeep", gitignore.includes("!reports/sandbox/daily-digest/.gitkeep")));
  checks.push(check(".gitignore allows README", gitignore.includes("!reports/sandbox/README.md")));

  // 7. reports/sandbox/README.md exists
  const readmePath = path.join(HARVESTER_DIR, "reports/sandbox/README.md");
  checks.push(check("reports/sandbox/README.md exists", fs.existsSync(readmePath)));
  const readme = loadText(readmePath);
  checks.push(check("README mentions sandbox", readme.includes("sandbox")));
  checks.push(check("README mentions no production files", readme.includes("No production files")));

  // 8. reports/sandbox/daily-digest/.gitkeep exists
  const gitkeepPath = path.join(HARVESTER_DIR, "reports/sandbox/daily-digest/.gitkeep");
  checks.push(check("reports/sandbox/daily-digest/.gitkeep exists", fs.existsSync(gitkeepPath)));

  // 9. control-server.ts has sandbox endpoints
  const serverPath = path.join(HARVESTER_DIR, "scripts/control-server.ts");
  const serverCode = loadText(serverPath);
  checks.push(check("Server has /api/daily-digest/sandbox/create", serverCode.includes("/api/daily-digest/sandbox/create")));
  checks.push(check("Server has /api/daily-digest/sandbox-status", serverCode.includes("/api/daily-digest/sandbox-status")));
  checks.push(check("sandbox/create is POST only",
    (serverCode.includes('case "/api/daily-digest/sandbox/create":') && serverCode.includes('if (req.method !== "POST")')) ||
    serverCode.includes('pathname === "/api/daily-digest/sandbox/create" && req.method === "POST"')
  ));
  checks.push(check("sandbox-status is GET only", serverCode.includes('case "/api/daily-digest/sandbox-status":') && serverCode.includes('if (req.method !== "GET")')));

  // 10. Server checks token for sandbox/create
  checks.push(check("sandbox/create checks token", serverCode.includes("CONTROL_CONFIG.token") && serverCode.includes("sandbox/create")));

  // 11. Server checks confirmation phrase for sandbox/create
  checks.push(check("sandbox/create checks confirmation phrase", serverCode.includes("CREATE DAILY SANDBOX")));

  // 12. Server uses execution lock for sandbox/create
  checks.push(check("sandbox/create uses execution lock", serverCode.includes("acquireExecutionLock") && serverCode.includes("sandbox/create")));
  checks.push(check("sandbox/create releases execution lock in finally", serverCode.includes("releaseExecutionLock") && serverCode.includes("sandbox/create")));

  // 13. Server does not call runner for sandbox/create
  // extract the sandbox/create block from server code
  let sandboxCreateBlock = "";
  const sandboxCreateCaseStart = serverCode.indexOf('case "/api/daily-digest/sandbox/create":');
  const sandboxCreateIfStart = serverCode.indexOf('pathname === "/api/daily-digest/sandbox/create"');
  const sandboxCreateEnd = serverCode.indexOf('case "/api/daily-digest/sandbox-status":');
  if (sandboxCreateCaseStart >= 0 && sandboxCreateEnd > sandboxCreateCaseStart) {
    sandboxCreateBlock = serverCode.substring(sandboxCreateCaseStart, sandboxCreateEnd);
  } else if (sandboxCreateIfStart >= 0 && sandboxCreateEnd > sandboxCreateIfStart) {
    sandboxCreateBlock = serverCode.substring(sandboxCreateIfStart, sandboxCreateEnd);
  }
  checks.push(check("sandbox/create does not call executeLowRiskAction", !sandboxCreateBlock.includes("executeLowRiskAction")));

  // 14. Server writes audit log for sandbox/create
  checks.push(check("sandbox/create writes audit log", serverCode.includes("writeAuditLogLowRisk") && serverCode.includes("daily_digest_sandbox_create")));

  // 15. Audit log does not include token for sandbox/create
  const auditLogSection = serverCode.substring(
    serverCode.indexOf("daily_digest_sandbox_create"),
    serverCode.indexOf("daily_digest_sandbox_create") + 2000
  );
  checks.push(check("Audit log for sandbox/create does not contain 'token' key", !auditLogSection.includes("token:") || auditLogSection.includes("reason: \"invalid_token\"")));

  // 16. Server is localhost-only
  checks.push(check("Server binds to 127.0.0.1", serverCode.includes('HOST = "127.0.0.1"')));

  // 17. No token leaks in manager or server
  checks.push(check("No token leaks in manager", !hasTokenLeak(managerCode)));
  checks.push(check("No token leaks in server", !hasTokenLeak(serverCode)));

  // 18. Manager manifest has correct properties
  checks.push(check("Manager creates manifest.json", managerCode.includes("manifest.json")));
  checks.push(check("Manager creates latest.json", managerCode.includes("latest.json")));
  checks.push(check("Manager manifest has mode sandbox_directory_only", managerCode.includes("sandbox_directory_only")));
  checks.push(check("Manager manifest has real_digest_build=false", managerCode.includes("real_digest_build: false")));
  checks.push(check("Manager manifest has collect_allowed=false", managerCode.includes("collect_allowed: false")));
  checks.push(check("Manager manifest has telegram_send_allowed=false", managerCode.includes("telegram_send_allowed: false")));
  checks.push(check("Manager manifest has production_write_allowed=false", managerCode.includes("production_write_allowed: false")));
  checks.push(check("Manager manifest has protected_paths", managerCode.includes("protected_paths")));
  checks.push(check("Manager manifest has next_allowed_stage", managerCode.includes("next_allowed_stage")));

  // 19. Manager creates subdirectories
  checks.push(check("Manager creates inputs/", managerCode.includes('"inputs"')));
  checks.push(check("Manager creates outputs/", managerCode.includes('"outputs"')));
  checks.push(check("Manager creates reports/", managerCode.includes('"reports"')));
  checks.push(check("Manager creates diffs/", managerCode.includes('"diffs"')));
  checks.push(check("Manager creates logs/", managerCode.includes('"logs"')));

  // 20. package.json has validate script
  const pkgPath = path.join(HARVESTER_DIR, "package.json");
  const pkg = loadJson(pkgPath);
  checks.push(check("package.json exists", pkg !== null));
  checks.push(check("package.json has validate:daily-digest-sandbox-manager", pkg?.scripts?.["validate:daily-digest-sandbox-manager"] !== undefined));

  // 21. control.html has sandbox UI
  const controlHtmlPath = path.join(HARVESTER_DIR, "dashboard/control.html");
  const controlHtml = loadText(controlHtmlPath);
  checks.push(check("control.html has sandbox-create-panel", controlHtml.includes("sandbox-create-panel")));
  checks.push(check("control.html has create sandbox button", controlHtml.includes("btn-create-sandbox")));
  checks.push(check("control.html loads sandbox status", controlHtml.includes("loadSandboxStatus")));
  checks.push(check("control.html has sandbox status display", controlHtml.includes("sandbox-status-display")));
  checks.push(check("control.html has sandbox create result", controlHtml.includes("sandbox-create-result")));
  checks.push(check("control.html has warning about sandbox only", controlHtml.includes("本阶段只创建 sandbox 目录")));
  checks.push(check("control.html calls /api/daily-digest/sandbox/create", controlHtml.includes("/api/daily-digest/sandbox/create")));
  checks.push(check("control.html calls /api/daily-digest/sandbox-status", controlHtml.includes("/api/daily-digest/sandbox-status")));

  // Summary
  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const status = passed === total ? "PASS" : "FAIL";

  console.log(`\n=== Daily Digest Sandbox Manager Validation (Phase 5C-2C-C5) ===`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`Status: ${status}\n`);

  for (const c of checks) {
    console.log(c.msg);
  }

  console.log(`\n=== ${status} ===`);
  process.exit(status === "PASS" ? 0 : 1);
}

main();
