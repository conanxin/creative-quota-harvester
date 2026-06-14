/**
 * control-action-runner.ts
 * Phase 5C-5A: Hardened Low-risk Execution Runner with Output Redaction
 *
 * Safety-first execution runner for the localhost-only control server.
 * Only executes scripts listed in control-execution-allowlist.json.
 * Output is redacted before return to prevent secret leakage.
 */
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// --- Phase 5C-5A: Redaction patterns ---
const REDACTION_PATTERNS = [
  // Telegram tokens
  { pattern: /[0-9]{8,12}:[A-Za-z0-9_-]{25,}/g, replacement: "<REDACTED_TELEGRAM_TOKEN>" },
  // API keys (sk- prefix)
  { pattern: /sk-[A-Za-z0-9_-]{20,}/g, replacement: "<REDACTED_API_KEY>" },
  // Bearer tokens in Authorization header
  { pattern: /(authorization:\s*bearer\s+)[A-Za-z0-9._-]+/gi, replacement: "$1<REDACTED>" },
  // Generic token values after = or :
  { pattern: /(token["']?\s*[:=]\s*["']?)[^"',\s]+/gi, replacement: "$1<REDACTED>" },
];

function redactOutput(output: string): string {
  let result = output;
  for (const r of REDACTION_PATTERNS) {
    result = result.replace(r.pattern, r.replacement);
  }
  return result;
}

interface ExecutionResult {
  exitCode: number;
  timedOut: boolean;
  stdout_tail: string;
  stderr_tail: string;
  duration_ms: number;
  action_id: string;
  executed_at: string;
}

interface AllowlistConfig {
  version: string;
  phase: string;
  mode: string;
  allowed_scripts: string[];
  blocked_patterns: string[];
  max_runtime_ms: number;
  max_output_chars: number;
  safety_rules: {
    shell: boolean;
    command_only: string;
    args_only: string[];
    cwd_only: string;
    no_secrets_in_env: boolean;
    timeout_enforced: boolean;
    output_truncated: boolean;
    audit_required: boolean;
  };
}

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ALLOWLIST_PATH = path.join(
  PROJECT_ROOT,
  "dashboard",
  "control-execution-allowlist.json"
);

function loadAllowlist(): AllowlistConfig {
  const raw = fs.readFileSync(ALLOWLIST_PATH, "utf8");
  return JSON.parse(raw) as AllowlistConfig;
}

function isAllowed(scriptName: string, allowlist: AllowlistConfig): boolean {
  // Phase 5C-5A: Allowed_scripts has highest priority (explicit whitelist)
  if (allowlist.allowed_scripts.includes(scriptName)) {
    return true;
  }
  // Must not match any blocked pattern (for non-allowed scripts)
  for (const pattern of allowlist.blocked_patterns) {
    if (scriptName.toLowerCase().includes(pattern.toLowerCase())) {
      return false;
    }
  }
  return false;
}

function truncateOutput(output: string, maxChars: number): string {
  if (output.length <= maxChars) return output;
  const half = Math.floor(maxChars / 2);
  return (
    output.slice(0, half) +
    "\n... [truncated: " +
    (output.length - maxChars) +
    " chars omitted] ...\n" +
    output.slice(-half)
  );
}

export async function executeLowRiskAction(
  scriptName: string,
  action_id: string
): Promise<ExecutionResult> {
  const allowlist = loadAllowlist();
  const startTime = Date.now();
  const executed_at = new Date().toISOString();

  // Safety checks
  if (!isAllowed(scriptName, allowlist)) {
    return {
      exitCode: -1,
      timedOut: false,
      stdout_tail: "",
      stderr_tail: `BLOCKED: "${scriptName}" not in execution allowlist or matches blocked pattern.`,
      duration_ms: Date.now() - startTime,
      action_id,
      executed_at,
    };
  }

  // Fixed command: npm
  if (allowlist.safety_rules.command_only !== "npm") {
    return {
      exitCode: -1,
      timedOut: false,
      stdout_tail: "",
      stderr_tail: "ERROR: allowlist.command_only must be 'npm'.",
      duration_ms: Date.now() - startTime,
      action_id,
      executed_at,
    };
  }

  const args = ["run", scriptName];

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    const child = spawn("npm", args, {
      cwd: PROJECT_ROOT,
      shell: false, // CRITICAL: no shell
      env: {
        PATH: process.env.PATH || "/usr/bin:/bin",
        HOME: process.env.HOME || "",
        NODE_ENV: "production",
      }, // Minimal env, no secrets
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000);
    }, allowlist.max_runtime_ms);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
      if (stdout.length > allowlist.max_output_chars * 2) {
        stdout = stdout.slice(-allowlist.max_output_chars * 2);
      }
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
      if (stderr.length > allowlist.max_output_chars * 2) {
        stderr = stderr.slice(-allowlist.max_output_chars * 2);
      }
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      const duration_ms = Date.now() - startTime;
      const timedOut = code === null && duration_ms >= allowlist.max_runtime_ms;
      resolve({
        exitCode: code ?? -1,
        timedOut,
        stdout_tail: redactOutput(truncateOutput(stdout, allowlist.max_output_chars)),
        stderr_tail: redactOutput(truncateOutput(stderr, allowlist.max_output_chars)),
        duration_ms,
        action_id,
        executed_at,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      resolve({
        exitCode: -1,
        timedOut: false,
        stdout_tail: "",
        stderr_tail: `SPAWN ERROR: ${err.message}`,
        duration_ms: Date.now() - startTime,
        action_id,
        executed_at,
      });
    });
  });
}

// CLI usage for testing
if (require.main === module) {
  const scriptName = process.argv[2];
  const actionId = process.argv[3] || scriptName;
  if (!scriptName) {
    console.error("Usage: tsx scripts/control-action-runner.ts <script-name> [action-id]");
    process.exit(1);
  }
  executeLowRiskAction(scriptName, actionId).then((result) => {
    console.log(JSON.stringify(result, null, 2));
  });
}
