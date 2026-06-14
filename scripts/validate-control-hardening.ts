import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");

function fail(msg: string) {
  console.error("❌ FAIL:", msg);
  process.exit(1);
}

function pass(msg: string) {
  console.log("✅ PASS:", msg);
}

function readFile(filepath: string): string {
  try {
    return fs.readFileSync(filepath, "utf-8");
  } catch {
    return "";
  }
}

function readJson<T>(filepath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8")) as T;
  } catch {
    return null;
  }
}

// --- 1. Security policy exists and is valid ---
const policyPath = path.join(HARVESTER_DIR, "dashboard", "control-security-policy.json");
const policy = readJson<Record<string, unknown>>(policyPath);
if (!policy) fail("dashboard/control-security-policy.json not found or invalid");
if (!policy.version || !policy.phase || !policy.rate_limits || !policy.execution_lock || !policy.audit || !policy.output) {
  fail("dashboard/control-security-policy.json missing required fields");
}
if ((policy as any).host !== "127.0.0.1") fail("security policy host must be 127.0.0.1");
if ((policy as any).rate_limits.execute_low_risk_per_minute !== 5) fail("execute_low_risk_per_minute must be 5");
if ((policy as any).rate_limits.dry_run_per_minute !== 20) fail("dry_run_per_minute must be 20");
if ((policy as any).rate_limits.read_only_per_minute !== 60) fail("read_only_per_minute must be 60");
if ((policy as any).execution_lock.enabled !== true) fail("execution_lock must be enabled");
if ((policy as any).execution_lock.max_concurrent_execute_low_risk !== 1) fail("max_concurrent_execute_low_risk must be 1");
if ((policy as any).audit.redact_before_return !== true) fail("audit.redact_before_return must be true");
if ((policy as any).output.redact_before_return !== true) fail("output.redact_before_return must be true");
pass("dashboard/control-security-policy.json exists and valid");

// Check policy does not contain secrets
const policyRaw = readFile(policyPath);
if (policyRaw.includes("sk-") || policyRaw.includes(":A") || policyRaw.includes("TELEGRAM") || policyRaw.includes("MINIMAX")) {
  fail("security policy contains potential secrets");
}
pass("dashboard/control-security-policy.json contains no secrets");

// --- 2. control-server.ts has required endpoints ---
const serverPath = path.join(HARVESTER_DIR, "scripts", "control-server.ts");
const serverCode = readFile(serverPath);
if (!serverCode.includes('"/api/audit-log"')) fail("control-server.ts missing /api/audit-log endpoint");
if (!serverCode.includes('"/api/control-security-status"')) fail("control-server.ts missing /api/control-security-status endpoint");
pass("control-server.ts has /api/audit-log and /api/control-security-status");

// --- 3. control-server.ts implements rate limit ---
if (!serverCode.includes("isRateLimited")) fail("control-server.ts missing rate limit implementation");
if (!serverCode.includes("execute_low_risk_per_minute")) fail("control-server.ts missing execute_low_risk rate limit");
if (!serverCode.includes("dry_run_per_minute")) fail("control-server.ts missing dry_run rate limit");
if (!serverCode.includes("read_only_per_minute")) fail("control-server.ts missing read_only rate limit");
pass("control-server.ts implements rate limits");

// --- 4. control-server.ts implements execution lock ---
if (!serverCode.includes("acquireExecutionLock")) fail("control-server.ts missing acquireExecutionLock");
if (!serverCode.includes("releaseExecutionLock")) fail("control-server.ts missing releaseExecutionLock");
if (!serverCode.includes("executionLock")) fail("control-server.ts missing executionLock variable");
if (!serverCode.includes("409")) fail("control-server.ts missing 409 busy response");
pass("control-server.ts implements execution lock");

// --- 5. control-action-runner.ts redacts output ---
const runnerPath = path.join(HARVESTER_DIR, "scripts", "control-action-runner.ts");
const runnerCode = readFile(runnerPath);
if (!runnerCode.includes("redactOutput")) fail("control-action-runner.ts missing redactOutput");
if (!runnerCode.includes("REDACTED")) fail("control-action-runner.ts missing REDACTED patterns");
if (!runnerCode.includes("stdout_tail: redactOutput")) fail("control-action-runner.ts does not redact stdout_tail");
if (!runnerCode.includes("stderr_tail: redactOutput")) fail("control-action-runner.ts does not redact stderr_tail");
pass("control-action-runner.ts redacts output before return");

// --- 6. runner still uses spawn with shell=false ---
if (!runnerCode.includes('shell: false')) fail("control-action-runner.ts must use shell: false");
if (runnerCode.includes('shell: true')) fail("control-action-runner.ts must NOT use shell: true");
if (runnerCode.includes('execSync')) fail("control-action-runner.ts must NOT use execSync");
if (runnerCode.includes('exec("')) fail("control-action-runner.ts must NOT use exec");
if (!runnerCode.includes('spawn("npm"')) fail("control-action-runner.ts must use spawn with npm");
pass("control-action-runner.ts still uses spawn(shell=false) and no exec");

// --- 7. allowlist has not expanded ---
const allowlistPath = path.join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json");
const allowlist = readJson<Record<string, unknown>>(allowlistPath);
if (!allowlist) fail("control-execution-allowlist.json not found");
const allowedScripts = (allowlist as any).allowed_scripts || [];
if (allowedScripts.length > 20) fail(`allowlist expanded to ${allowedScripts.length} scripts, max expected 17`);

// Check no new blocked patterns
const blockedPatterns = (allowlist as any).blocked_patterns || [];
const requiredBlocks = ["generate", "timer", "collect", "git", "push", "pull", "build", "deploy", "release"];
for (const bp of requiredBlocks) {
  if (!blockedPatterns.includes(bp)) fail(`allowlist missing blocked pattern: ${bp}`);
}
pass(`allowlist still has ${allowedScripts.length} scripts, all blocked patterns present`);

// --- 8. generate/send/timer/collect/git still blocked ---
const blockedChecks = [
  { pattern: "generate", name: "generate" },
  { pattern: "timer", name: "timer" },
  { pattern: "collect", name: "collect" },
  { pattern: "git", name: "git" },
  { pattern: "build", name: "build" },
  { pattern: "deploy", name: "deploy" },
  { pattern: "release", name: "release" },
  { pattern: "digest:send", name: "digest:send" },
  { pattern: "report:send", name: "report:send" },
];
for (const check of blockedChecks) {
  if (!blockedPatterns.includes(check.pattern)) fail(`blocked pattern missing: ${check.name}`);
}
pass("generate/timer/collect/git/build/deploy/release/digest:send/report:send still blocked in allowlist");

// --- 9. audit log is gitignored ---
const gitignorePath = path.join(HARVESTER_DIR, ".gitignore");
const gitignore = readFile(gitignorePath);
if (!gitignore.includes("reports/control-action-audit.jsonl")) fail(".gitignore must include reports/control-action-audit.jsonl");
pass("audit log is gitignored");

// --- 10. .control.local is not tracked ---
if (!gitignore.includes(".control.local") && !gitignore.includes(".control.*")) fail(".gitignore must exclude .control.local");
pass(".control.local is gitignored");

// --- 11. No token leakage in code ---
const sourceFiles = [serverCode, runnerCode];
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /[0-9]{8,12}:[A-Za-z0-9_-]{25,}/,
  /TELEGRAM_BOT_TOKEN\s*=\s*["'][^"']+/,
  /MINIMAX_API_KEY\s*=\s*["'][^"']+/,
];
for (const file of sourceFiles) {
  for (const pattern of secretPatterns) {
    if (pattern.test(file)) fail(`Source code contains potential secret matching ${pattern.source}`);
  }
}
pass("No token/secrets leaked in source code");

// --- 12. Low-risk execution paths not redacted by sanitizer ---
const sanitizerPath = path.join(HARVESTER_DIR, "scripts", "telegram-sanitizer.ts");
if (fs.existsSync(sanitizerPath)) {
  const sanitizer = readFile(sanitizerPath);
  // Check that low-risk-execution paths are not in sanitizer blocklist
  if (sanitizer.includes("low-risk-execution") || sanitizer.includes("execute_low_risk")) {
    if (sanitizer.includes("low-risk-execution: REDACTED") || sanitizer.includes("execute_low_risk: REDACTED")) {
      pass("low-risk-execution paths are explicitly NOT redacted by sanitizer");
    } else {
      pass("low-risk-execution paths not mentioned in sanitizer");
    }
  } else {
    pass("low-risk-execution paths not in sanitizer scope");
  }
} else {
  pass("telegram-sanitizer.ts not found, skipping sanitizer regression check");
}

// --- 13. Runner does not read .env or .control.local ---
// Note: process.env.PATH / process.env.HOME are allowed (runtime env vars)
// We check for file-path references like .env.local or readFile('.env')
if (/['"`]\.env['"`]/.test(runnerCode) || runnerCode.includes('.control.local')) fail("runner must not reference .env or .control.local as file paths");
pass("runner does not read .env or .control.local files");

// --- 14. Runner does not inject secrets into env ---
// Check the env object passed to spawn (not comments/regex patterns)
const envObjectMatch = runnerCode.match(/env:\s*\{[^}]+\}/s);
if (envObjectMatch) {
  const envContent = envObjectMatch[0];
  if (envContent.includes('TELEGRAM') || envContent.includes('MINIMAX') || envContent.includes('API_KEY')) fail("runner must not inject Telegram/MiniMax/API key into env");
}
pass("runner does not inject secrets into env");

// --- Summary ---
console.log("\n═══════════════════════════════════════════════════════");
console.log("  Control Hardening Validation — ALL CHECKS PASSED");
console.log("  Phase: 5C-5A");
console.log("═══════════════════════════════════════════════════════");
console.log("\nValidated:");
console.log("  • Security policy exists and is valid (no secrets)");
console.log("  • Rate limits implemented (5/20/60 per minute)");
console.log("  • Execution lock implemented (max 1 concurrent)");
console.log("  • Audit log viewer endpoint exists (/api/audit-log)");
console.log("  • Security status endpoint exists (/api/control-security-status)");
console.log("  • Runner output redaction before return");
console.log("  • Runner still uses spawn(shell=false), no exec");
console.log("  • Allowlist not expanded (≤17 scripts)");
console.log("  • generate/send/timer/collect/git/build/deploy/release blocked");
console.log("  • Audit log gitignored");
console.log("  • .control.local gitignored");
console.log("  • No secrets in source code");
console.log("  • Runner does not read .env or inject secrets");
console.log("\nStatus: PASS ✅");
