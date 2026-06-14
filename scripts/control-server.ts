import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import { executeLowRiskAction } from "./control-action-runner";

/**
 * scripts/control-server.ts — Phase 5C-1 + 5C-2A + 5C-2B + 5C-2C-A
 *
 * localhost-only private control server.
 * Phase 5C-2C-A: Confirmed low-risk execution canary for 5 safe validation commands.
 *
 * Safety rules:
 *   - Only binds to 127.0.0.1 (any other host → exit)
 *   - Only accepts GET (405 for everything else except POST /api/action/*)
 *   - No shell, no arbitrary command execution
 *   - Only npm run <script> via control-action-runner
 *   - Only scripts in control-execution-allowlist.json
 *   - No .env reading, no token reading
 *   - Path traversal blocked (.. forbidden)
 *   - Report whitelist enforced
 */

const HOST = "127.0.0.1";
const PORT = parseInt(process.env.CQA_CONTROL_PORT || "8788", 10);
const HARVESTER_DIR = path.resolve(__dirname, "..");

// --- Phase 5C-5A: Rate limit state (in-memory, per-process) ---
interface RateLimitBucket {
  count: number;
  windowStart: number;
}
const rateLimitWindows = new Map<string, RateLimitBucket>();
const RATE_LIMITS = {
  execute_low_risk_per_minute: 5,
  dry_run_per_minute: 20,
  read_only_per_minute: 60,
};

function isRateLimited(category: string): boolean {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const key = `${category}:${Math.floor(now / windowMs)}`;
  const bucket = rateLimitWindows.get(key) || { count: 0, windowStart: now };
  bucket.count++;
  rateLimitWindows.set(key, bucket);
  // Cleanup old windows
  for (const [k, b] of rateLimitWindows) {
    if (now - b.windowStart > windowMs * 2) {
      rateLimitWindows.delete(k);
    }
  }
  const limit = (RATE_LIMITS as any)[category] || 10;
  return bucket.count > limit;
}

function rateLimitResponse(res: http.ServerResponse, category: string, limit: number) {
  res.writeHead(429, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    error: "Rate limit exceeded",
    category,
    limit_per_minute: limit,
    retry_after_seconds: 60,
  }) + "\n");
}

// --- Phase 5C-5A: Execution lock ---
let executionLock = false;
function acquireExecutionLock(): boolean {
  if (executionLock) return false;
  executionLock = true;
  return true;
}
function releaseExecutionLock() {
  executionLock = false;
}

// --- Phase 5C-5A: Audit log redaction helper ---
function redactAuditLine(line: string): string {
  let result = line;
  // Telegram tokens
  result = result.replace(/[0-9]{8,12}:[A-Za-z0-9_-]{25,}/g, "<REDACTED_TELEGRAM_TOKEN>");
  // API keys
  result = result.replace(/sk-[A-Za-z0-9_-]{20,}/g, "<REDACTED_API_KEY>");
  // Bearer tokens
  result = result.replace(/(authorization:\s*bearer\s+)[A-Za-z0-9._-]+/gi, "$1<REDACTED>");
  // Generic token values
  result = result.replace(/(token["']?\s*[:=]\s*["']?)[^"',\s]+/gi, "$1<REDACTED>");
  return result;
}

// --- Phase 5C-2A: Auth config ---
function loadControlConfig(): { token: string; actionsEnabled: boolean } {
  const configPath = path.join(HARVESTER_DIR, ".control.local");
  let token = "";
  let actionsEnabled = false;
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed === "") continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (key === "CQA_CONTROL_TOKEN") token = val;
      if (key === "CQA_CONTROL_ENABLE_ACTIONS") actionsEnabled = val === "1" || val.toLowerCase() === "true";
    }
  } catch {
    // .control.local not present — default to read-only mode
  }
  return { token, actionsEnabled };
}

const CONTROL_CONFIG = loadControlConfig();
const AUDIT_LOG_PATH = path.join(HARVESTER_DIR, "reports", "control-action-audit.jsonl");

const REPORTS_WHITELIST = [
  "telegram-digest.txt",
  "daily-digest.md",
  "source-health.md",
  "source-health.json",
  "collect-fresh-report.md",
  "collect-timeout-diagnosis.md",
  "image-quality-review.md",
  "harvester-dashboard.md",
  "project-report-send-result.json",
  "telegram-phase-4c5-adapter-parallelization.txt",
  "telegram-phase-4h-video-prompts.txt",
  "telegram-phase-4i-music-prompts.txt",
  "telegram-phase-5c0-control-catalog.txt",
  "digest-sanitization-freshness.md",
  "first-scheduled-run-validation.md",
  "latest-briefs.md",
  "latest-content-packs.md",
  "latest-signals.json",
  "latest-signals.md",
  "manual-daily-run.md",
  "minimax-image-canary.md",
  "minimax-token-plan-setup.md",
  "open-source-safety-check.md",
  "phase-4f-facts-enrichment.md",
  "public-gallery-chinese-ui.md",
  "scheduler-dry-run.md",
  "source-aware-image-prompts.md",
];

function safeReadJson<T>(filepath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function safeReadText(filepath: string, fallback = ""): string {
  try {
    return fs.readFileSync(filepath, "utf-8");
  } catch {
    return fallback;
  }
}

function forbidden(res: http.ServerResponse, reason: string) {
  res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Forbidden: " + reason);
}

function notFound(res: http.ServerResponse, reason: string) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found: " + reason);
}

function badRequest(res: http.ServerResponse, reason: string) {
  res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Bad Request: " + reason);
}

function methodNotAllowed(res: http.ServerResponse, allowedMethod?: string) {
  res.writeHead(405, {
    "Content-Type": "text/plain; charset=utf-8",
    Allow: allowedMethod || "GET",
  });
  res.end("Method Not Allowed: only " + (allowedMethod || "GET") + " is supported");
}

function tooManyRequests(res: http.ServerResponse, reason: string) {
  res.writeHead(429, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Too Many Requests: " + reason);
}

function conflict(res: http.ServerResponse, reason: string) {
  res.writeHead(409, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Conflict: " + reason);
}

function jsonResponse(res: http.ServerResponse, data: unknown) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2) + "\n");
}

function textResponse(res: http.ServerResponse, text: string) {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function htmlResponse(res: http.ServerResponse, html: string) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function buildReportIndex(): Array<{
  name: string;
  exists: boolean;
  size: number;
}> {
  const results = [];
  for (const name of REPORTS_WHITELIST) {
    const p = path.join(HARVESTER_DIR, "reports", name);
    try {
      const stat = fs.statSync(p);
      results.push({ name, exists: true, size: stat.size });
    } catch {
      results.push({ name, exists: false, size: 0 });
    }
  }
  return results;
}

function buildHomePage(): string {
  const status = safeReadJson(
    path.join(HARVESTER_DIR, "dashboard", "status.json"),
    {}
  ) as Record<string, unknown>;

  const catalog = safeReadJson(
    path.join(HARVESTER_DIR, "dashboard", "control-catalog.json"),
    {}
  ) as any;

  const buildTime = (status.build_time as string) || "N/A";
  const signalCount = (status.signals as number) || 0;
  const packCount = (status.content_packs as number) || 0;
  const topicCount = (status.topics as number) || 0;
  const imgCount = (status.generated_images as number) || 0;
  const timerActive = (status.timer_active as boolean) || false;
  const nextRun = (status.next_run as string) || "N/A";
  const lastRun = (status.last_run as string) || "N/A";
  const guardMax = (status.generation_guard as Record<string, unknown>)?.max_images_per_run || "N/A";
  const guardMusic = (status.generation_guard as Record<string, unknown>)?.music_disabled || "N/A";
  const guardVideo = (status.generation_guard as Record<string, unknown>)?.video_disabled || "N/A";

  const groups = catalog.command_groups || [];

  let policyReviewHtml = "";
  const review = safeReadJson(
    path.join(HARVESTER_DIR, "dashboard", "policy-review.json"),
    {}
  ) as any;
  if (review && review.total_commands) {
    const rc = review.risk_counts || {};
    const safeReadonlyCount = review.execution_mode_counts?.safe_readonly || 0;
    const dryRunCount = review.execution_mode_counts?.dry_run_only || 0;
    const disabledCount = review.execution_mode_counts?.disabled || 0;
    const allReviewed = review.all_commands_reviewed ? '<div style="background:#d1fae5;color:#065f46;padding:6px 12px;border-radius:6px;font-size:0.8rem;font-weight:600;margin-top:8px;">✅ All commands reviewed</div>' : '';
    const futureCount = (review.future_execution_candidates || []).length;
    const neverCount = (review.never_execute || []).length;
    policyReviewHtml = `
    <div class="section" style="background:#f0f9ff;border:1px solid #bae6fd;">
      <h2>📋 Policy Review / 策略审查</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:12px;">
        <div style="background:#fff;border-radius:8px;padding:10px;text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:#1e3a5f;">${review.total_commands}</div><div style="font-size:0.75rem;color:#7f8c8d;">Total Commands</div></div>
        <div style="background:#fff;border-radius:8px;padding:10px;text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:#22c55e;">${review.classified}</div><div style="font-size:0.75rem;color:#7f8c8d;">Classified</div></div>
        <div style="background:#fff;border-radius:8px;padding:10px;text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:${review.needs_policy_review > 0 ? '#ef4444' : '#22c55e'};">${review.needs_policy_review}</div><div style="font-size:0.75rem;color:#7f8c8d;">Needs Review</div></div>
      </div>
      <div style="font-size:0.85rem;color:#555;margin-bottom:8px;">
        ⚡ Risk: Safe=${rc.safe || 0} · Medium=${rc.medium || 0} · High=${rc.high || 0} · Danger=${rc.danger || 0}
      </div>
      <div style="font-size:0.85rem;color:#555;margin-bottom:8px;">
        🔧 Execution: Safe-readonly=${safeReadonlyCount} · Dry-run=${dryRunCount} · Disabled=${disabledCount}
      </div>
      ${allReviewed}
      <div style="margin-top:10px;font-size:0.8rem;color:#555;">
        🚀 Future candidates: ${futureCount} · 🚫 Never execute: ${neverCount}
      </div>
    </div>`;
  }

  let groupsHtml = "";
  for (const g of groups) {
    const cmds = g.commands || [];
    let cmdsHtml = "";
    for (const cmd of cmds) {
      const riskClass = cmd.risk_level === "danger" ? "danger" : cmd.risk_level === "high" ? "high" : cmd.risk_level === "medium" ? "medium" : "safe";
      const chips = [];
      if (cmd.calls_model) chips.push("⚡ calls_model");
      if (cmd.generates_media) chips.push("🎨 generates_media");
      if (cmd.modifies_timer) chips.push("⏰ modifies_timer");
      if (cmd.requires_confirm) chips.push("✅ requires_confirm");
      if (!cmd.public_safe) chips.push("🔒 not_public");
      if (cmd.execution_mode === "safe_readonly") {
        chips.push("🔍 safe_readonly");
      } else if (cmd.execution_mode === "dry_run_only") {
        chips.push("🧪 dry_run_only");
      } else {
        chips.push("❌ disabled");
      }
      chips.push(cmd.real_execution_supported ? "❌ real_exec=true" : "✅ real_exec=false");
      const chipHtml = chips.length > 0 ? `<div class="meta-chips">${chips.map((c: string) => `<span class="chip">${c}</span>`).join(" ")}</div>` : "";

      const sourceTag = cmd.source ? `<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:0.68rem;font-family:monospace;margin-right:6px;">${cmd.source}</span>` : "";
      const reviewTag = cmd.needs_policy_review ? `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;font-size:0.68rem;font-weight:600;margin-right:4px;">needs_policy_review</span>` : "";

      const cmdHtml = `<div class="command-card risk-${riskClass}">
        <div class="cmd-header">
          <div class="cmd-name">${sourceTag}${reviewTag}${cmd.label_zh || cmd.id}</div>
          <div class="risk-pill ${riskClass}">Risk: ${cmd.risk_level || "safe"}</div>
        </div>
        <div class="cmd-desc">${cmd.description_zh || ""}</div>
        ${chipHtml}
        <div class="cmd-code">${cmd.command || ""}</div>
        <div class="cmd-note">${cmd.notes || ""}</div>
      </div>`;
      cmdsHtml += cmdHtml;
    }

    groupsHtml += `<div class="group">
      <h3>${g.label_zh || g.id}</h3>
      <p class="group-desc">${g.description_zh || ""}</p>
      ${cmdsHtml}
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Creative Quota 私有控制台</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f5f5f0; color: #333; line-height: 1.6; padding: 0; }
  .container { max-width: 1100px; margin: 0 auto; padding: 20px; }
  header { text-align: center; padding: 30px 0; border-bottom: 2px solid #e0e0e0; margin-bottom: 30px; background: #fff; border-radius: 12px; }
  h1 { font-size: 1.8rem; color: #2c3e50; }
  .subtitle { color: #7f8c8d; font-size: 0.9rem; margin-top: 8px; }
  .mode-badge { display: inline-block; background: #1e3a5f; color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; margin-top: 12px; font-weight: 600; }
  .warning-box { background: #fff3cd; border: 2px solid #ffc107; color: #856404; padding: 16px 20px; border-radius: 12px; margin-bottom: 24px; font-size: 0.95rem; }
  .warning-box strong { display: block; margin-bottom: 6px; }
  .section { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #e0e0e0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .section h2 { color: #2c3e50; margin-bottom: 16px; font-size: 1.3rem; }
  .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 16px; }
  .status-card { background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center; }
  .status-card .number { font-size: 2rem; font-weight: 700; color: #1e3a5f; }
  .status-card .label { font-size: 0.85rem; color: #7f8c8d; margin-top: 4px; }
  .timer-line { font-size: 0.9rem; color: #555; margin: 6px 0; }
  .guard-line { font-size: 0.85rem; color: #555; margin: 4px 0; padding: 4px 8px; background: #f0f9ff; border-radius: 4px; }
  .group h3 { color: #2c3e50; margin-bottom: 8px; font-size: 1.15rem; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; }
  .group-desc { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 16px; }
  .command-card { background: #fafafa; border: 1px solid #e8e8e8; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
  .command-card.risk-high { border-left: 5px solid #ef4444; background: #fff5f5; }
  .command-card.risk-danger { border-left: 5px solid #991b1b; background: #fef2f2; }
  .command-card.risk-medium { border-left: 5px solid #f59e0b; background: #fffbf0; }
  .command-card.risk-safe { border-left: 5px solid #22c55e; }
  .cmd-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
  .cmd-name { font-weight: 600; color: #2c3e50; }
  .risk-pill { padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
  .risk-pill.safe { background: #d1fae5; color: #065f46; }
  .risk-pill.medium { background: #fef3c7; color: #92400e; }
  .risk-pill.high { background: #fee2e2; color: #991b1b; }
  .risk-pill.danger { background: #991b1b; color: #fff; }
  .cmd-desc { font-size: 0.85rem; color: #555; margin-bottom: 8px; }
  .meta-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .chip { font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: #f0f0f0; color: #666; font-family: monospace; }
  .cmd-code { background: #1e293b; color: #e2e8f0; padding: 10px 14px; border-radius: 6px; font-family: 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', monospace; font-size: 0.82rem; overflow-x: auto; user-select: all; margin-top: 8px; }
  .cmd-note { font-size: 0.78rem; color: #1e40af; margin-top: 8px; background: #f0f9ff; padding: 6px 10px; border-radius: 4px; }
  .links { display: flex; flex-wrap: wrap; gap: 10px; }
  .links a { display: inline-block; padding: 8px 16px; background: #1e3a5f; color: #fff; border-radius: 8px; text-decoration: none; font-size: 0.85rem; }
  .links a:hover { background: #2c3e50; }
  footer { text-align: center; padding: 24px 0; color: #95a5a6; font-size: 0.8rem; border-top: 1px solid #e0e0e0; margin-top: 20px; }
  @media (max-width: 600px) { .container { padding: 12px; } .section { padding: 16px; } }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>🔒 Creative Quota 私有控制台</h1>
    <div class="subtitle">Phase 5C-2C-A · localhost-only private control server · dry-run + safe-readonly + confirmed-low-risk-canary</div>
    <div class="mode-badge">localhost-only · dry-run · safe-readonly · confirmed-low-risk-canary (5 scripts) · 不执行模型/媒体/发送</div>
  </header>
  <div class="warning-box">
    <strong>⚠️ 安全说明</strong>
    <p>本服务器仅监听 127.0.0.1，不提供公网访问。Phase 5C-2C-A 支持 confirmed low-risk 真实执行（仅限 5 个安全验证脚本），dry-run 模拟和 safe-readonly 只读查询。高风险命令（high / danger）未启用真实执行。请勿公开暴露此服务。</p>
  </div>
  <div class="warning-box" style="background:#f0f9ff;border-color:#3b82f6;color:#1e40af;">
    <strong>🧪 Phase 5C-2C-A 功能说明</strong>
    <p><b>Confirmed Low-risk:</b> POST /api/action/execute-low-risk — 真实执行 5 个安全验证脚本（npm run），通过 control-action-runner 调用，shell=false，超时 60 秒，输出截断 12000 字符。<br><b>Dry-run:</b> POST /api/action/dry-run — 模拟将要执行什么命令，不执行。<br><b>Safe-readonly:</b> POST /api/action/read-only — 读取现有系统状态，不执行命令、不调用模型、不修改文件。</p>
  </div>
  <div class="warning-box" style="background:#d1fae5;border-color:#22c55e;color:#065f46;">
    <strong>✅ Canary 5 个允许脚本</strong>
    <p>validate:control-server · validate:control-readonly-actions · validate:control-actions-dry-run · dashboard:control:drift-check · dashboard:policy:validate</p>
    <p style="font-size:0.8rem;margin-top:4px;">所有脚本 risk_level=safe, calls_model=false, generates_media=false, modifies_timer=false, requires_confirm=true, confirmation_phrase="EXECUTE LOW RISK"</p>
  </div>
  <div class="section">
    <h2>📊 系统状态</h2>
    <div class="status-grid">
      <div class="status-card"><div class="number">${signalCount}</div><div class="label">Signals</div></div>
      <div class="status-card"><div class="number">${packCount}</div><div class="label">Content Packs</div></div>
      <div class="status-card"><div class="number">${topicCount}</div><div class="label">Unique Topics</div></div>
      <div class="status-card"><div class="number">${imgCount}</div><div class="label">Generated Images</div></div>
    </div>
    <div class="timer-line">⏰ Timer: ${timerActive ? "active" : "unknown"} · Next: ${nextRun} · Last: ${lastRun}</div>
    <div class="timer-line">🕒 Build: ${buildTime}</div>
  </div>
  <div class="section">
    <h2>🛡️ Generation Guard</h2>
    <div class="guard-line">Max images per run: ${guardMax}</div>
    <div class="guard-line">Music generation: ${guardMusic}</div>
    <div class="guard-line">Video generation: ${guardVideo}</div>
    <div class="guard-line">Ambiguous commands: blocked</div>
  </div>
  ${policyReviewHtml}
  <div class="section">
    <h2>📋 Command Catalog</h2>
    ${groupsHtml}
  </div>
  <div class="section">
    <h2>🔗 链接</h2>
    <div class="links">
      <a href="/api/control-catalog">Control Catalog JSON</a>
      <a href="/api/policy-review">Policy Review JSON</a>
      <a href="https://conanxin.github.io/creative-quota-harvester/dashboard/" target="_blank">Public Dashboard</a>
      <a href="https://conanxin.github.io/creative-quota-assets/gallery/" target="_blank">Assets Gallery</a>
      <a href="https://conanxin.github.io/creative-quota-assets/daily/" target="_blank">Daily Archive</a>
      <a href="https://github.com/conanxin/creative-quota-harvester" target="_blank">GitHub</a>
      <a href="https://github.com/conanxin/creative-quota-harvester/blob/main/docs/SCHEDULED_DAILY_DIGEST_RUNBOOK.md" target="_blank">Runbook</a>
    </div>
  </div>
  <footer>
    <p>Creative Quota Harvester · Phase 5C-2C-B · localhost-only · dry-run + safe-readonly + confirmed-low-risk-expanded</p>
  </footer>
</div>
</body>
</html>`;
}

// --- Phase 5C-2C-C5: Read body JSON helper ---
function readBodyJson(req: http.IncomingMessage, callback: (body: any) => void) {
  let body = "";
  req.on("data", (chunk: string) => { body += chunk; });
  req.on("end", () => {
    let payload: any = {};
    try {
      payload = JSON.parse(body);
    } catch {
      // ignore parse error, callback gets empty object
    }
    callback(payload);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url || "/", true);
  const pathname = parsedUrl.pathname || "/";
  const query = parsedUrl.query;

  // Path traversal check (applies to ALL methods)
  if (pathname.includes("..") || pathname.includes("\0")) {
    badRequest(res, "Path traversal not allowed");
    return;
  }

  // --- Phase 5C-2A: dry-run POST handler ---
  if (pathname === "/api/action/dry-run" && req.method === "POST") {
    handleDryRun(req, res);
    return;
  }

  // --- Phase 5C-2B: safe read-only POST handler ---
  if (pathname === "/api/action/read-only" && req.method === "POST") {
    handleReadOnly(req, res);
    return;
  }

  // --- Phase 5C-2C-A: confirmed low-risk execution handler ---
  if (pathname === "/api/action/execute-low-risk" && req.method === "POST") {
    handleExecuteLowRisk(req, res);
    return;
  }

  // --- Phase 5C-2C-C0: workflow dry-run POST handler ---
  if (pathname === "/api/workflow/dry-run" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      let payload: any = {};
      try {
        payload = JSON.parse(body);
      } catch {
        badRequest(res, "Invalid JSON body");
        return;
      }

      const workflowId = String(payload.workflow_id || "").trim();
      const token = String(payload.token || "").trim();

      if (!workflowId) {
        badRequest(res, "Missing 'workflow_id' field");
        return;
      }

      if (CONTROL_CONFIG.token && token !== CONTROL_CONFIG.token) {
        forbidden(res, "Invalid or missing control token");
        writeAuditLog({
          action_id: "workflow_dry_run",
          risk_level: "safe",
          confirm_ok: false,
          real_execution: false,
          result: "blocked",
          reason: "invalid_token",
        });
        return;
      }

      const { planWorkflow } = require("./control-workflow-planner");
      const plan = planWorkflow(workflowId);

      if (!plan) {
        notFound(res, `Workflow "${workflowId}" not found`);
        writeAuditLog({
          action_id: "workflow_dry_run",
          risk_level: "safe",
          confirm_ok: false,
          real_execution: false,
          result: "blocked",
          reason: "workflow_not_found",
        });
        return;
      }

      writeAuditLog({
        action_id: "workflow_dry_run",
        risk_level: "safe",
        confirm_ok: true,
        real_execution: false,
        result: "success",
        reason: "dry_run_plan_generated",
        workflow_id: workflowId,
        blocked_steps: plan.summary.blocked_steps,
        allowed_low_risk_steps: plan.summary.allowed_low_risk_steps,
      });

      writeAuditLog({
        action_id: "workflow_dry_run",
        risk_level: "safe",
        confirm_ok: true,
        real_execution: false,
        result: "success",
        reason: "dry_run_plan_generated",
        workflow_id: workflowId,
        blocked_steps: plan.summary.blocked_steps,
        allowed_low_risk_steps: plan.summary.allowed_low_risk_steps,
      });

      jsonResponse(res, plan);
    });
    return;
  }

  // --- Phase 5C-2C-C1: Workflow execute low-risk handler ---
  if (pathname === "/api/workflow/execute-low-risk" && req.method === "POST") {
    // Phase 5C-5A: Rate limit (uses execute-low-risk category)
    if (isRateLimited("execute_low_risk_per_minute")) {
      rateLimitResponse(res, "execute_low_risk_per_minute", RATE_LIMITS.execute_low_risk_per_minute);
      return;
    }
    // Phase 5C-5A: Execution lock (shared with execute-low-risk action)
    if (!acquireExecutionLock()) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "Execution lock busy",
        message: "Another execute-low-risk or workflow is already in progress. Try again later.",
        max_concurrent: 1,
      }) + "\n");
      return;
    }

    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      let workflowId = "";
      let confirmPhrase = "";
      let token = "";
      try {
        let payload: any = {};
        try {
          payload = JSON.parse(body);
        } catch {
          badRequest(res, "Invalid JSON body");
          return;
        }

        workflowId = String(payload.workflow_id || "").trim();
        confirmPhrase = String(payload.confirm_phrase || "").trim();
        token = String(payload.token || "").trim();

        if (!workflowId) {
          badRequest(res, "Missing 'workflow_id' field");
          return;
        }

        if (CONTROL_CONFIG.token && token !== CONTROL_CONFIG.token) {
          forbidden(res, "Invalid or missing control token");
          writeAuditLog({
            action_id: "workflow_execute_low_risk",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "invalid_token",
            workflow_id: workflowId,
          });
          return;
        }

        // Load workflow definition
        const workflowsData = safeReadJson(path.join(HARVESTER_DIR, "dashboard", "control-workflows.json"), null) as any;
        if (!workflowsData || !workflowsData.workflows) {
          notFound(res, "Workflow definitions not found");
          writeAuditLog({
            action_id: "workflow_execute_low_risk",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "workflows_not_found",
            workflow_id: workflowId,
          });
          return;
        }

        const workflow = workflowsData.workflows.find((w: any) => w.workflow_id === workflowId);
        if (!workflow) {
          notFound(res, `Workflow "${workflowId}" not found`);
          writeAuditLog({
            action_id: "workflow_execute_low_risk",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "workflow_not_found",
            workflow_id: workflowId,
          });
          return;
        }

        // Explicit allowlist: only asset_validation_sweep and control_health_sweep
        if (workflowId !== "asset_validation_sweep" && workflowId !== "control_health_sweep") {
          forbidden(res, `Workflow "${workflowId}" is not in the low-risk execution allowlist. Only asset_validation_sweep and control_health_sweep are allowed.`);
          writeAuditLog({
            action_id: "workflow_execute_low_risk",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "workflow_not_in_allowlist",
            workflow_id: workflowId,
          });
          return;
        }

        // Must be confirmed_low_risk_workflow mode
        if (workflow.mode !== "confirmed_low_risk_workflow") {
          forbidden(res, `Workflow "${workflowId}" is not confirmed_low_risk_workflow. Mode: ${workflow.mode}`);
          writeAuditLog({
            action_id: "workflow_execute_low_risk",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "not_confirmed_low_risk_workflow",
            workflow_id: workflowId,
          });
          return;
        }

        // Must have real_execution_supported=true
        if (!workflow.real_execution_supported) {
          forbidden(res, `Workflow "${workflowId}" does not support real execution.`);
          writeAuditLog({
            action_id: "workflow_execute_low_risk",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "real_execution_not_supported",
            workflow_id: workflowId,
          });
          return;
        }

        // Must be allowed for execution
        if (workflow.allowed_for_execution === false) {
          forbidden(res, `Workflow "${workflowId}" is not allowed for execution: ${workflow.blocked_reason || "blocked"}`);
          writeAuditLog({
            action_id: "workflow_execute_low_risk",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "workflow_not_allowed_for_execution",
            workflow_id: workflowId,
          });
          return;
        }

        // Check confirmation phrase
        const expectedPhrase = workflow.confirmation_phrase || "EXECUTE LOW RISK WORKFLOW";
        if (confirmPhrase !== expectedPhrase) {
          jsonResponse(res, {
            workflow_id: workflowId,
            confirmation_phrase_expected: expectedPhrase,
            confirmation_status: "mismatch",
            real_execution: false,
            message: `Execution blocked: confirmation phrase mismatch. Expected: "${expectedPhrase}"`,
          });
          writeAuditLog({
            action_id: "workflow_execute_low_risk",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "confirm_phrase_mismatch",
            workflow_id: workflowId,
          });
          return;
        }

        // Execute workflow via executor
        const { executeWorkflow } = require("./control-workflow-executor");
        const result = await executeWorkflow(workflowId);

        if (!result) {
          notFound(res, `Workflow "${workflowId}" executor returned null`);
          writeAuditLog({
            action_id: "workflow_execute_low_risk",
            risk_level: "safe",
            confirm_ok: true,
            real_execution: true,
            result: "failed",
            reason: "executor_null",
            workflow_id: workflowId,
          });
          return;
        }

        jsonResponse(res, {
          workflow_id: result.workflow_id,
          real_execution: result.real_execution,
          mode: result.mode,
          steps_total: result.steps_total,
          steps_completed: result.steps_completed,
          steps_failed: result.steps_failed,
          timed_out: result.timed_out,
          results: result.results,
          message: result.steps_failed === 0 ? "Workflow executed successfully." : `Workflow completed with ${result.steps_failed} failed steps.`,
        });

        writeAuditLog({
          action_id: "workflow_execute_low_risk",
          risk_level: "safe",
          confirm_ok: true,
          real_execution: true,
          result: result.steps_failed === 0 ? "success" : "failed",
          reason: "workflow_executed",
          workflow_id: workflowId,
          steps_total: result.steps_total,
          steps_completed: result.steps_completed,
          steps_failed: result.steps_failed,
          timed_out: result.timed_out,
        });
      } catch (err: any) {
        jsonResponse(res, {
          workflow_id: workflowId,
          real_execution: true,
          error: err.message || "unknown",
          message: "Workflow execution failed with an unexpected error.",
        });
        writeAuditLog({
          action_id: "workflow_execute_low_risk",
          risk_level: "safe",
          confirm_ok: true,
          real_execution: true,
          result: "failed",
          reason: err.message || "unknown",
          workflow_id: workflowId,
        });
      } finally {
        // Always release execution lock
        releaseExecutionLock();
      }
    });
    return;
  }

  // --- Phase 5C-2C-C3: Daily digest validation stage execution handler ---
  if (pathname === "/api/daily-digest/execute-validation-stage" && req.method === "POST") {
    // Phase 5C-5A: Rate limit (uses execute-low-risk category)
    if (isRateLimited("execute_low_risk_per_minute")) {
      rateLimitResponse(res, "execute_low_risk_per_minute", RATE_LIMITS.execute_low_risk_per_minute);
      return;
    }
    // Phase 5C-5A: Execution lock (shared with execute-low-risk)
    if (!acquireExecutionLock()) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "Execution lock busy",
        message: "Another execute-low-risk or workflow is already in progress. Try again later.",
        max_concurrent: 1,
      }) + "\n");
      return;
    }

    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      let stage_id = "";
      let confirm_phrase = "";
      let token = "";
      try {
        let payload: any = {};
        try {
          payload = JSON.parse(body);
        } catch {
          badRequest(res, "Invalid JSON body");
          return;
        }

        stage_id = String(payload.stage_id || "").trim();
        confirm_phrase = String(payload.confirm_phrase || "").trim();
        token = String(payload.token || "").trim();

        if (!stage_id) {
          badRequest(res, "Missing 'stage_id' field");
          return;
        }

        if (CONTROL_CONFIG.token && token !== CONTROL_CONFIG.token) {
          forbidden(res, "Invalid or missing control token");
          writeAuditLog({
            action_id: "daily_digest_execute_validation_stage",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "invalid_token",
            stage_id,
          });
          return;
        }

        // Load staged plan definition
        const stagedPlan = safeReadJson(path.join(HARVESTER_DIR, "dashboard", "daily-digest-staged-plan.json"), null) as any;
        if (!stagedPlan || !stagedPlan.workflows) {
          notFound(res, "Staged plan definitions not found");
          writeAuditLog({
            action_id: "daily_digest_execute_validation_stage",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "staged_plan_not_found",
            stage_id,
          });
          return;
        }

        const workflow = stagedPlan.workflows[0];
        const stage = workflow.stages.find((s: any) => s.stage_id === stage_id);
        if (!stage) {
          notFound(res, `Stage "${stage_id}" not found in staged plan`);
          writeAuditLog({
            action_id: "daily_digest_execute_validation_stage",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "stage_not_found",
            stage_id,
          });
          return;
        }

        // Only stage_3_validate_outputs is allowed
        if (stage_id !== "stage_3_validate_outputs") {
          forbidden(res, `Stage "${stage_id}" is not allowed for execution. Only "stage_3_validate_outputs" can be executed.`);
          writeAuditLog({
            action_id: "daily_digest_execute_validation_stage",
            risk_level: stage.risk_level || "unknown",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "stage_not_allowed",
            stage_id,
          });
          return;
        }

        // Must be confirmed_low_risk_stage mode
        if (stage.mode !== "confirmed_low_risk_stage") {
          forbidden(res, `Stage "${stage_id}" is not confirmed_low_risk_stage. Mode: ${stage.mode}`);
          writeAuditLog({
            action_id: "daily_digest_execute_validation_stage",
            risk_level: stage.risk_level,
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "not_confirmed_low_risk_stage",
            stage_id,
          });
          return;
        }

        // Must have real_execution_supported=true
        if (!stage.real_execution_supported) {
          forbidden(res, `Stage "${stage_id}" does not support real execution.`);
          writeAuditLog({
            action_id: "daily_digest_execute_validation_stage",
            risk_level: stage.risk_level,
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "real_execution_not_supported",
            stage_id,
          });
          return;
        }

        // Must be allowed for execution
        if (stage.allowed_for_execution === false) {
          forbidden(res, `Stage "${stage_id}" is not allowed for execution: ${stage.blocked_reason || "blocked"}`);
          writeAuditLog({
            action_id: "daily_digest_execute_validation_stage",
            risk_level: stage.risk_level,
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "stage_not_allowed_for_execution",
            stage_id,
          });
          return;
        }

        // Check confirmation phrase
        const expectedPhrase = stage.confirmation_phrase || "EXECUTE DAILY VALIDATION";
        if (confirm_phrase !== expectedPhrase) {
          jsonResponse(res, {
            stage_id,
            confirmation_phrase_expected: expectedPhrase,
            confirmation_status: "mismatch",
            real_execution: false,
            message: `Execution blocked: confirmation phrase mismatch. Expected: "${expectedPhrase}"`,
          });
          writeAuditLog({
            action_id: "daily_digest_execute_validation_stage",
            risk_level: stage.risk_level,
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "confirm_phrase_mismatch",
            stage_id,
          });
          return;
        }

        // Execute stage via executor
        const { executeStage } = require("./daily-digest-stage-executor");
        const result = await executeStage(stage_id, confirm_phrase);

        if (result.error) {
          jsonResponse(res, {
            stage_id: result.stage_id,
            real_execution: result.real_execution,
            steps_total: result.steps_total,
            steps_completed: result.steps_completed,
            steps_failed: result.steps_failed,
            results: result.results,
            error: result.error,
            message: result.message,
          });
          writeAuditLog({
            action_id: "daily_digest_execute_validation_stage",
            risk_level: stage.risk_level,
            confirm_ok: true,
            real_execution: result.real_execution,
            result: result.steps_failed === 0 ? "success" : "failed",
            reason: result.error || "stage_executed",
            stage_id,
            steps_total: result.steps_total,
            steps_completed: result.steps_completed,
            steps_failed: result.steps_failed,
          });
          return;
        }

        jsonResponse(res, {
          stage_id: result.stage_id,
          real_execution: result.real_execution,
          steps_total: result.steps_total,
          steps_completed: result.steps_completed,
          steps_failed: result.steps_failed,
          results: result.results,
          message: result.message,
        });

        writeAuditLog({
          action_id: "daily_digest_execute_validation_stage",
          risk_level: stage.risk_level,
          confirm_ok: true,
          real_execution: result.real_execution,
          result: result.steps_failed === 0 ? "success" : "failed",
          reason: "stage_executed",
          stage_id,
          steps_total: result.steps_total,
          steps_completed: result.steps_completed,
          steps_failed: result.steps_failed,
        });
      } catch (err: any) {
        jsonResponse(res, {
          stage_id,
          real_execution: true,
          error: err.message || "unknown",
          message: "Stage execution failed with an unexpected error.",
        });
        writeAuditLog({
          action_id: "daily_digest_execute_validation_stage",
          risk_level: "safe",
          confirm_ok: true,
          real_execution: true,
          result: "failed",
          reason: err.message || "unknown",
          stage_id,
        });
      } finally {
        releaseExecutionLock();
      }
    });
    return;
  }

  // --- Phase 5C-2C-C5: Daily digest sandbox creation handler ---
  if (pathname === "/api/daily-digest/sandbox/create" && req.method === "POST") {
    // Phase 5C-2C-C5: Create sandbox directory (real execution, but only writes to sandbox)
    if (!CONTROL_CONFIG.actionsEnabled) {
      forbidden(res, "Actions are disabled via CQA_CONTROL_ENABLE_ACTIONS");
      return;
    }
    if (isRateLimited("execute_low_risk_per_minute")) {
      tooManyRequests(res, "Rate limit exceeded for sandbox creation.");
      return;
    }
    if (!acquireExecutionLock()) {
      conflict(res, "Another execution is in progress. Please wait.");
      return;
    }
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const confirmPhrase = String(payload?.confirm_phrase || "").trim();
        const token = String(payload?.token || "").trim();

        if (CONTROL_CONFIG.token && token !== CONTROL_CONFIG.token) {
          forbidden(res, "Invalid or missing control token");
          writeAuditLogLowRisk({
            action_id: "daily_digest_sandbox_create",
            risk_level: "low",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "invalid_token",
          });
          releaseExecutionLock();
          return;
        }

        const expectedPhrase = "CREATE DAILY SANDBOX";
        if (confirmPhrase !== expectedPhrase) {
          jsonResponse(res, {
            action_id: "daily_digest_sandbox_create",
            confirmation_status: "mismatch",
            real_execution: false,
            message: `Sandbox creation blocked: confirmation phrase mismatch. Expected: "${expectedPhrase}"`,
          });
          writeAuditLogLowRisk({
            action_id: "daily_digest_sandbox_create",
            risk_level: "low",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "confirm_phrase_mismatch",
          });
          releaseExecutionLock();
          return;
        }

        const { createSandboxRun } = require("./daily-digest-sandbox-manager");
        const result = createSandboxRun();

        if (result.success) {
          jsonResponse(res, {
            action_id: "daily_digest_sandbox_create",
            confirmation_status: "matched",
            real_execution: true,
            production_write_allowed: false,
            result: "success",
            run_id: result.run_id,
            sandbox_path: result.sandbox_path,
            created_dirs: result.created_dirs,
            manifest_written: result.manifest_written,
            latest_json_updated: result.latest_json_updated,
            message: `Sandbox directory created: ${result.run_id}`,
          });
          writeAuditLogLowRisk({
            action_id: "daily_digest_sandbox_create",
            risk_level: "low",
            confirm_ok: true,
            real_execution: true,
            result: "success",
            reason: "sandbox_created",
            run_id: result.run_id,
          });
        } else {
          jsonResponse(res, {
            action_id: "daily_digest_sandbox_create",
            confirmation_status: "matched",
            real_execution: true,
            result: "failed",
            error: result.error,
            message: `Sandbox creation failed: ${result.error}`,
          });
          writeAuditLogLowRisk({
            action_id: "daily_digest_sandbox_create",
            risk_level: "low",
            confirm_ok: true,
            real_execution: true,
            result: "failed",
            reason: result.error,
          });
        }
      } catch (err: any) {
        jsonResponse(res, {
          action_id: "daily_digest_sandbox_create",
          confirmation_status: "matched",
          real_execution: true,
          result: "failed",
          error: err.message || "unknown",
          message: "Sandbox creation failed with an unexpected error.",
        });
        writeAuditLogLowRisk({
          action_id: "daily_digest_sandbox_create",
          risk_level: "low",
          confirm_ok: true,
          real_execution: true,
          result: "failed",
          reason: err.message || "unknown",
        });
      } finally {
        releaseExecutionLock();
      }
    });
    return;
  }

  // --- Phase 5C-2C-C5E: Pilot sandbox build execution ---
  if (pathname === "/api/daily-digest/sandbox/build-pilot" && req.method === "POST") {
    if (!CONTROL_CONFIG.actionsEnabled) {
      forbidden(res, "Actions are disabled via CQA_CONTROL_ENABLE_ACTIONS");
      return;
    }
    if (isRateLimited("execute_low_risk_per_minute")) {
      tooManyRequests(res, "Rate limit exceeded for sandbox build.");
      return;
    }
    if (!acquireExecutionLock()) {
      conflict(res, "Another execution is in progress. Please wait.");
      return;
    }
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const confirmPhrase = String(payload?.confirm_phrase || "").trim();
        const token = String(payload?.token || "").trim();

        if (CONTROL_CONFIG.token && token !== CONTROL_CONFIG.token) {
          forbidden(res, "Invalid or missing control token");
          writeAuditLogLowRisk({
            action_id: "daily_digest_sandbox_build_pilot",
            risk_level: "low",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "invalid_token",
          });
          releaseExecutionLock();
          return;
        }

        const expectedPhrase = "BUILD DAILY SANDBOX PILOT";
        if (confirmPhrase !== expectedPhrase) {
          jsonResponse(res, {
            action_id: "daily_digest_sandbox_build_pilot",
            confirmation_status: "mismatch",
            real_execution: false,
            message: `Sandbox build blocked: confirmation phrase mismatch. Expected: "${expectedPhrase}"`,
          });
          writeAuditLogLowRisk({
            action_id: "daily_digest_sandbox_build_pilot",
            risk_level: "low",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "confirm_phrase_mismatch",
          });
          releaseExecutionLock();
          return;
        }

        const { runSandboxBuildPilot } = require("./daily-digest-sandbox-build-pilot");
        const result = await runSandboxBuildPilot();

        if (result.success) {
          jsonResponse(res, {
            action_id: "daily_digest_sandbox_build_pilot",
            confirmation_status: "matched",
            real_execution: true,
            production_write_allowed: false,
            production_write_detected: result.protected_paths_changed,
            result: "success",
            run_id: result.run_id,
            sandbox_path: result.sandbox_path,
            output_files: result.output_files,
            exit_code: result.exit_code,
            duration_ms: result.duration_ms,
            message: `Pilot sandbox build succeeded: ${result.run_id}`,
          });
          writeAuditLogLowRisk({
            action_id: "daily_digest_sandbox_build_pilot",
            risk_level: "low",
            confirm_ok: true,
            real_execution: true,
            result: "success",
            reason: "sandbox_build_pilot_success",
            run_id: result.run_id,
          });
        } else {
          jsonResponse(res, {
            action_id: "daily_digest_sandbox_build_pilot",
            confirmation_status: "matched",
            real_execution: true,
            production_write_allowed: false,
            production_write_detected: result.protected_paths_changed,
            result: "failed",
            error: result.error,
            run_id: result.run_id,
            changed_files: result.changed_files,
            message: `Pilot sandbox build failed: ${result.error || "unknown"}`,
          });
          writeAuditLogLowRisk({
            action_id: "daily_digest_sandbox_build_pilot",
            risk_level: "low",
            confirm_ok: true,
            real_execution: true,
            result: "failed",
            reason: result.error || "unknown",
            run_id: result.run_id,
          });
        }
      } catch (err: any) {
        jsonResponse(res, {
          action_id: "daily_digest_sandbox_build_pilot",
          confirmation_status: "matched",
          real_execution: true,
          result: "failed",
          error: err.message || "unknown",
          message: "Sandbox build failed with an unexpected error.",
        });
        writeAuditLogLowRisk({
          action_id: "daily_digest_sandbox_build_pilot",
          risk_level: "low",
          confirm_ok: true,
          real_execution: true,
          result: "failed",
          reason: err.message || "unknown",
        });
      } finally {
        releaseExecutionLock();
      }
    });
    return;
  }

  // Block anything that's not GET (for all other routes)
  if (req.method !== "GET") {
    methodNotAllowed(res);
    return;
  }

  switch (pathname) {
    case "/": {
      htmlResponse(res, buildHomePage());
      return;
    }

    case "/health": {
      const allowlist = safeReadJson(path.join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json"), null) as any;
      jsonResponse(res, {
        status: "ok",
        mode: "localhost-only-dry-run-safe-readonly-confirmed-low-risk-hardened",
        phase: "5C-5A",
        host: HOST,
        port: PORT,
        actions_enabled: CONTROL_CONFIG.actionsEnabled,
        token_configured: !!CONTROL_CONFIG.token,
        confirmed_low_risk_canary: {
          enabled: true,
          allowed_scripts_count: allowlist?.allowed_scripts?.length || 0,
          allowed_scripts: allowlist?.allowed_scripts || [],
          max_runtime_ms: allowlist?.max_runtime_ms || 60000,
          max_output_chars: allowlist?.max_output_chars || 12000,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    case "/api/status": {
      const status = safeReadJson(
        path.join(HARVESTER_DIR, "dashboard", "status.json"),
        null
      );
      if (!status) {
        notFound(res, "status.json not found — run 'npm run dashboard:build' first");
        return;
      }
      jsonResponse(res, status);
      return;
    }

    case "/api/control-catalog": {
      const catalog = safeReadJson(
        path.join(HARVESTER_DIR, "dashboard", "control-catalog.json"),
        null
      );
      if (!catalog) {
        notFound(res, "control-catalog.json not found");
        return;
      }
      jsonResponse(res, catalog);
      return;
    }

    case "/api/policy-review": {
      const review = safeReadJson(
        path.join(HARVESTER_DIR, "dashboard", "policy-review.json"),
        null
      );
      if (!review) {
        notFound(res, "policy-review.json not found — run 'npm run dashboard:policy:build' first");
        return;
      }
      jsonResponse(res, review);
      return;
    }

    case "/api/audit-log": {
      // Phase 5C-5A: Audit log viewer (read-only, redacted, no path parameters)
      let lines: string[] = [];
      try {
        if (fs.existsSync(AUDIT_LOG_PATH)) {
          const content = fs.readFileSync(AUDIT_LOG_PATH, "utf-8");
          lines = content.trim().split("\n").filter((l) => l.trim() !== "");
        }
      } catch {
        lines = [];
      }
      // Return only last 100 lines, redacted
      const recentLines = lines.slice(-100);
      const redactedLines = recentLines.map((line) => redactAuditLine(line));
      jsonResponse(res, {
        enabled: true,
        total_lines: lines.length,
        returned_lines: redactedLines.length,
        redacted: true,
        entries: redactedLines.map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return { raw: line };
          }
        }),
      });
      return;
    }

    case "/api/control-security-status": {
      // Phase 5C-5A: Security status endpoint (no secrets, no token leakage)
      const securityPolicy = safeReadJson(path.join(HARVESTER_DIR, "dashboard", "control-security-policy.json"), null) as any;
      const allowlist = safeReadJson(path.join(HARVESTER_DIR, "dashboard", "control-execution-allowlist.json"), null) as any;
      let auditLogExists = false;
      let auditLogSize = 0;
      try {
        const stat = fs.statSync(AUDIT_LOG_PATH);
        auditLogExists = true;
        auditLogSize = stat.size;
      } catch {
        // audit log not present
      }
      jsonResponse(res, {
        mode: "localhost-only",
        host: HOST,
        real_execution_scope: "confirmed_low_risk_validation_only",
        allowed_scripts_count: allowlist?.allowed_scripts?.length || 0,
        rate_limits: securityPolicy?.rate_limits || RATE_LIMITS,
        execution_lock: {
          enabled: true,
          max_concurrent_execute_low_risk: 1,
          currently_locked: executionLock,
        },
        audit_log: {
          enabled: true,
          exists: auditLogExists,
          size_bytes: auditLogSize,
        },
        output: {
          max_output_chars: securityPolicy?.output?.max_output_chars || 12000,
          redact_before_return: true,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    case "/api/reports": {
      jsonResponse(res, {
        whitelist: REPORTS_WHITELIST,
        available: buildReportIndex(),
      });
      return;
    }

    case "/api/report": {
      const rawName = String(query.name || "").trim();
      if (!rawName) {
        badRequest(res, "Missing 'name' query parameter");
        return;
      }
      // Allow both "telegram-digest" and "telegram-digest.txt"
      const name = rawName.endsWith(".txt") || rawName.endsWith(".md") || rawName.endsWith(".json")
        ? rawName
        : rawName + ".txt";
      if (!REPORTS_WHITELIST.includes(name)) {
        forbidden(res, "Report not in whitelist");
        return;
      }
      const reportPath = path.join(HARVESTER_DIR, "reports", name);
      // Double-check it's not trying to escape reports dir
      const resolved = path.resolve(reportPath);
      const reportsDir = path.resolve(path.join(HARVESTER_DIR, "reports"));
      if (!resolved.startsWith(reportsDir + path.sep) && resolved !== reportsDir) {
        forbidden(res, "Report must be inside reports directory");
        return;
      }
      const text = safeReadText(reportPath, "");
      if (!text) {
        notFound(res, `Report "${name}" not found`);
        return;
      }
      textResponse(res, text);
      return;
    }

    case "/static/dashboard": {
      const dashboardPath = path.join(HARVESTER_DIR, "dashboard", "index.html");
      const html = safeReadText(dashboardPath, "");
      if (!html) {
        notFound(res, "dashboard/index.html not found");
        return;
      }
      htmlResponse(res, html);
      return;
    }

    case "/api/workflows": {
      // Phase 5C-2C-C0: List all workflows
      const { listWorkflows } = require("./control-workflow-planner");
      const workflows = listWorkflows();
      jsonResponse(res, {
        workflows,
        count: workflows.length,
        mode: "dry_run_only",
        real_execution_supported: false,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    case "/api/workflow/dry-run": {
      // Phase 5C-2C-C0: Workflow dry-run planner
      if (req.method !== "POST") {
        methodNotAllowed(res, "POST");
        return;
      }
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        let payload: any = {};
        try {
          payload = JSON.parse(body);
        } catch {
          badRequest(res, "Invalid JSON body");
          return;
        }

        const workflowId = String(payload.workflow_id || "").trim();
        const token = String(payload.token || "").trim();

        if (!workflowId) {
          badRequest(res, "Missing 'workflow_id' field");
          return;
        }

        // Check token if configured
        if (CONTROL_CONFIG.token && token !== CONTROL_CONFIG.token) {
          forbidden(res, "Invalid or missing control token");
          writeAuditLog({
            action_id: "workflow_dry_run",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "invalid_token",
          });
          return;
        }

        const { planWorkflow } = require("./control-workflow-planner");
        const plan = planWorkflow(workflowId);

        if (!plan) {
          notFound(res, `Workflow "${workflowId}" not found`);
          writeAuditLog({
            action_id: "workflow_dry_run",
            risk_level: "safe",
            confirm_ok: false,
            real_execution: false,
            result: "blocked",
            reason: "workflow_not_found",
          });
          return;
        }

        // Write audit log
        writeAuditLog({
          action_id: "workflow_dry_run",
          risk_level: "safe",
          confirm_ok: true,
          real_execution: false,
          result: "success",
          reason: "dry_run_plan_generated",
          workflow_id: workflowId,
          blocked_steps: plan.summary.blocked_steps,
          allowed_low_risk_steps: plan.summary.allowed_low_risk_steps,
        });

        jsonResponse(res, plan);
      });
      return;
    }

    case "/api/daily-digest/staged-plan": {
      // Phase 5C-2C-C2: Daily digest staged plan (read-only, no execution)
      if (req.method !== "GET") {
        methodNotAllowed(res, "GET");
        return;
      }
      const { buildStagedPlan } = require("./daily-digest-staged-planner");
      const stagedPlan = buildStagedPlan();
      if (!stagedPlan) {
        notFound(res, "Staged plan not found");
        return;
      }
      jsonResponse(res, stagedPlan);
      return;
    }

    case "/api/daily-digest/build-sandbox-plan": {
      // Phase 5C-2C-C4: Daily digest build sandbox plan (read-only, no execution)
      if (req.method !== "GET") {
        methodNotAllowed(res, "GET");
        return;
      }
      const { buildSandboxPlan } = require("./daily-digest-build-sandbox-planner");
      const sandboxPlan = buildSandboxPlan();
      if (!sandboxPlan) {
        notFound(res, "Sandbox plan not found");
        return;
      }
      jsonResponse(res, sandboxPlan);
      return;
    }

    case "/api/daily-digest/sandbox-interface": {
      // Phase 5C-2C-C5C: Read-only sandbox interface contract (no execution, no builder call)
      if (req.method !== "GET") {
        methodNotAllowed(res, "GET");
        return;
      }
      const interfacePath = path.join(HARVESTER_DIR, "dashboard", "daily-digest-sandbox-interface.json");
      const interfaceData = safeReadJson(interfacePath, null);
      if (!interfaceData) {
        notFound(res, "Sandbox interface contract not found. Run: npm run validate:daily-digest-sandbox-interface");
        return;
      }
      jsonResponse(res, interfaceData);
      return;
    }

    case "/api/daily-digest/build-readiness": {
      // Phase 5C-2C-C5B: Read-only readiness audit (no execution, no builder call)
      if (req.method !== "GET") {
        methodNotAllowed(res, "GET");
        return;
      }
      const readinessPath = path.join(HARVESTER_DIR, "dashboard", "daily-digest-build-readiness.json");
      const readiness = safeReadJson(readinessPath, null);
      if (!readiness) {
        notFound(res, "Readiness audit not found. Run: npm run audit:daily-digest-build-readiness");
        return;
      }
      jsonResponse(res, readiness);
      return;
    }

    case "/api/daily-digest/sandbox-status": {
      // Phase 5C-2C-C5: Read sandbox status (read-only, no execution)
      if (req.method !== "GET") {
        methodNotAllowed(res, "GET");
        return;
      }
      const { readSandboxStatus } = require("./daily-digest-sandbox-manager");
      const status = readSandboxStatus();
      jsonResponse(res, status);
      return;
    }

    case "/api/daily-digest/sandbox/latest-build": {
      // Phase 5C-2C-C5E: Read latest sandbox build summary (read-only, no execution)
      if (req.method !== "GET") {
        methodNotAllowed(res, "GET");
        return;
      }
      const { readSandboxStatus } = require("./daily-digest-sandbox-manager");
      const status = readSandboxStatus();
      let latestBuild = null;
      if (status.latest && status.latest.latest_run_path) {
        const summaryPath = path.join(status.latest.latest_run_path, "reports", "build-summary.json");
        if (fs.existsSync(summaryPath)) {
          try {
            latestBuild = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
          } catch {
            latestBuild = null;
          }
        }
      }
      jsonResponse(res, {
        latest_run: status.latest || null,
        latest_build: latestBuild,
        sandbox_root: status.sandbox_root,
        total_runs: status.total_runs,
      });
      return;
    }

    case "/api/daily-digest/sandbox/latest-output-validation": {
      // Phase 5C-2C-C5F: Read latest sandbox output validation + diff (read-only, no execution)
      if (req.method !== "GET") {
        methodNotAllowed(res, "GET");
        return;
      }
      const { validateLatestSandboxOutput } = require("./validate-daily-digest-sandbox-output");
      const { generateSandboxDiff } = require("./daily-digest-sandbox-diff");
      const validationResult = validateLatestSandboxOutput();
      const diffResult = generateSandboxDiff();
      jsonResponse(res, {
        phase: "5C-2C-C5F",
        mode: "sandbox_output_validation_readonly",
        real_execution: false,
        production_write_allowed: false,
        run_id: validationResult.run_id,
        validation: validationResult,
        diff: {
          run_id: diffResult.run_id,
          files: diffResult.files.map(f => ({
            file_name: f.file_name,
            sandbox_lines: f.sandbox_lines,
            production_lines: f.production_lines,
            sandbox_chars: f.sandbox_chars,
            production_chars: f.production_chars,
            lines_added: f.lines_added,
            lines_removed: f.lines_removed,
            chars_added: f.chars_added,
            chars_removed: f.chars_removed,
            summary: f.summary,
          })),
          summary: diffResult.summary,
          output_files: diffResult.output_files,
        },
      });
      return;
    }

    case "/api/daily-digest/promote-readiness": {
      // Phase 5C-2C-C5G: Read promote readiness (read-only, no execution)
      if (req.method !== "GET") {
        methodNotAllowed(res, "GET");
        return;
      }
      const { checkPromoteReadiness } = require("./daily-digest-promote-readiness");
      const readiness = checkPromoteReadiness();
      jsonResponse(res, readiness);
      return;
    }

    case "/api/daily-digest/promote-dry-run-plan": {
      // Phase 5C-2C-C5H: Read promote dry-run plan (read-only, no execution)
      if (req.method !== "GET") {
        methodNotAllowed(res, "GET");
        return;
      }
      const { generatePromoteDryRunPlan } = require("./daily-digest-promote-dry-run");
      const plan = generatePromoteDryRunPlan();
      jsonResponse(res, {
        phase: "5C-2C-C5H",
        mode: "promote_dry_run_only",
        real_execution: false,
        production_write_allowed: false,
        run_id: plan.run_id,
        preconditions: plan.preconditions,
        copy_map: plan.copy_map,
        backup_plan: plan.backup_plan,
        human_approval_required: plan.human_approval_required,
        future_confirm_phrase: plan.future_confirm_phrase,
        future_confirm_phrase_enabled: plan.future_confirm_phrase_enabled,
        blocked_actions: plan.blocked_actions,
        safe_next_step: plan.safe_next_step,
        output_files: plan.output_files,
      });
      return;
    }

    case "/api/daily-digest/promote-shadow-status": {
      // Phase 5C-2C-C5I: Read promote shadow copy status (read-only, no execution)
      if (req.method !== "GET") {
        methodNotAllowed(res, "GET");
        return;
      }
      const { createPromoteShadowCopy } = require("./daily-digest-promote-shadow-copy");
      const result = createPromoteShadowCopy();
      jsonResponse(res, {
        phase: "5C-2C-C5I",
        mode: "shadow_copy_only",
        real_execution: false,
        production_write_allowed: false,
        run_id: result.run_id,
        shadow_dir: result.shadow_dir,
        production_backups: result.production_backups,
        candidate_previews: result.candidate_previews,
        rollback_manifest: result.rollback_manifest,
        promote_checklist: result.promote_checklist,
        output_files: result.output_files,
        safe_next_step: result.safe_next_step,
      });
      return;
    }

    default: {
      notFound(res, "Unknown route");
      return;
    }
  }
});

// Safety check: refuse to bind if host is not 127.0.0.1
if (HOST !== "127.0.0.1") {
  console.error("[control-server] FATAL: host must be 127.0.0.1, got " + HOST);
  process.exit(1);
}

server.on("error", (err) => {
  console.error("[control-server] Server error:", err.message);
});

server.listen(PORT, HOST, () => {
  console.log(`[control-server] Listening on http://${HOST}:${PORT} (localhost-only, dry-run + safe-readonly + confirmed-low-risk + hardened)`);
  console.log(`[control-server] PID: ${process.pid}`);
  console.log(`[control-server] Routes: GET /, /health, /api/status, /api/control-catalog, /api/reports, /api/report, /api/audit-log, /api/control-security-status, /api/workflows, /api/workflow/dry-run, /api/daily-digest/staged-plan, /api/daily-digest/build-sandbox-plan, /api/daily-digest/sandbox-interface, /api/daily-digest/build-readiness, /api/daily-digest/sandbox-status, /api/daily-digest/sandbox/latest-build, /api/daily-digest/sandbox/latest-output-validation, /static/dashboard`);
  console.log(`[control-server] POST /api/action/dry-run (dry-run only, no real execution)`);
  console.log(`[control-server] POST /api/action/read-only (safe readonly queries, no side effects)`);
  console.log(`[control-server] POST /api/action/execute-low-risk (confirmed low-risk execution, expanded validation allowlist, rate limited, execution locked)`);
  console.log(`[control-server] POST /api/daily-digest/execute-validation-stage (confirmed low-risk stage execution, rate limited, execution locked)`);
  console.log(`[control-server] POST /api/daily-digest/sandbox/create (confirmed sandbox directory creation, rate limited, execution locked)`);
console.log(`[control-server] POST /api/daily-digest/sandbox/build-pilot (confirmed pilot sandbox build execution, rate limited, execution locked)`);
  console.log(`[control-server] Actions enabled: ${CONTROL_CONFIG.actionsEnabled}, Token configured: ${!!CONTROL_CONFIG.token}`);
});

process.on("SIGTERM", () => {
  console.log("[control-server] SIGTERM received, shutting down...");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("[control-server] SIGINT received, shutting down...");
  server.close(() => process.exit(0));
});

// --- Phase 5C-2A: Dry-run handler (no command execution, no child_process, no exec/spawn) ---
function handleDryRun(req: http.IncomingMessage, res: http.ServerResponse) {
  // Phase 5C-5A: Rate limit
  if (isRateLimited("dry_run_per_minute")) {
    rateLimitResponse(res, "dry_run_per_minute", RATE_LIMITS.dry_run_per_minute);
    return;
  }
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    let payload: any = {};
    try {
      payload = JSON.parse(body);
    } catch {
      badRequest(res, "Invalid JSON body");
      return;
    }

    const actionId = String(payload.action_id || "").trim();
    const confirmPhrase = String(payload.confirm_phrase || "").trim();
    const token = String(payload.token || "").trim();

    if (!actionId) {
      badRequest(res, "Missing 'action_id' field");
      return;
    }

    // Load catalog to find action metadata
    const catalog = safeReadJson(path.join(HARVESTER_DIR, "dashboard", "control-catalog.json"), null) as any;
    if (!catalog) {
      notFound(res, "control-catalog.json not found");
      return;
    }

    let foundCommand: any = null;
    for (const g of catalog.command_groups || []) {
      for (const cmd of g.commands || []) {
        if (cmd.id === actionId || cmd.action_id === actionId) {
          foundCommand = cmd;
          break;
        }
      }
      if (foundCommand) break;
    }

    if (!foundCommand) {
      notFound(res, `Action "${actionId}" not found in catalog`);
      writeAuditLog({
        action_id: actionId,
        risk_level: "unknown",
        confirm_ok: false,
        real_execution: false,
        result: "blocked",
        reason: "action_id_not_found",
      });
      return;
    }

    const riskLevel = (foundCommand.risk_level || "safe").toLowerCase();

    // Check token if actions are enabled and token is configured
    if (CONTROL_CONFIG.actionsEnabled && CONTROL_CONFIG.token) {
      if (token !== CONTROL_CONFIG.token) {
        forbidden(res, "Invalid or missing control token");
        writeAuditLog({
          action_id: actionId,
          risk_level: riskLevel,
          confirm_ok: false,
          real_execution: false,
          result: "blocked",
          reason: "invalid_token",
        });
        return;
      }
    }

    if (!CONTROL_CONFIG.actionsEnabled && !CONTROL_CONFIG.token) {
      // No auth configured — read-only mode, block all dry-run attempts
      jsonResponse(res, {
        action_id: actionId,
        label_zh: foundCommand.label_zh || actionId,
        risk_level: riskLevel,
        would_run_command: foundCommand.command || null,
        requires_confirm: !!foundCommand.requires_confirm,
        confirmation_phrase_expected: foundCommand.confirmation_phrase || "",
        confirmation_status: "blocked_needs_control_config",
        real_execution: false,
        message: "Blocked: .control.local not configured. Add CQA_CONTROL_TOKEN to .control.local to enable dry-run mode.",
      });
      writeAuditLog({
        action_id: actionId,
        risk_level: riskLevel,
        confirm_ok: false,
        real_execution: false,
        result: "blocked",
        reason: "control_config_missing",
      });
      return;
    }

    // Check confirmation phrase (all commands require it in dry-run)
    const expectedPhrase = foundCommand.confirmation_phrase || "dry-run";
    const confirmOk = confirmPhrase === expectedPhrase;

    if (!confirmOk) {
      jsonResponse(res, {
        action_id: actionId,
        label_zh: foundCommand.label_zh || actionId,
        risk_level: riskLevel,
        would_run_command: foundCommand.command || null,
        requires_confirm: !!foundCommand.requires_confirm,
        confirmation_phrase_expected: expectedPhrase,
        confirmation_status: "mismatch",
        real_execution: false,
        message: `Dry-run failed: confirmation phrase mismatch. Expected: "${expectedPhrase}"`,
      });
      writeAuditLog({
        action_id: actionId,
        risk_level: riskLevel,
        confirm_ok: false,
        real_execution: false,
        result: "blocked",
        reason: "confirm_phrase_mismatch",
      });
      return;
    }

    // All checks passed — dry-run success (still no real execution)
    jsonResponse(res, {
      action_id: actionId,
      label_zh: foundCommand.label_zh || actionId,
      risk_level: riskLevel,
      would_run_command: foundCommand.command || null,
      requires_confirm: !!foundCommand.requires_confirm,
      confirmation_phrase_expected: expectedPhrase,
      confirmation_status: "matched",
      real_execution: false,
      dry_run_only: true,
      message: "Dry-run passed. No command executed. This is a simulation only.",
      audit_required: !!foundCommand.audit_required,
    });
    writeAuditLog({
      action_id: actionId,
      risk_level: riskLevel,
      confirm_ok: true,
      real_execution: false,
      result: "allowed_dry_run",
      reason: "confirm_phrase_matched",
    });
  });
}

// --- Phase 5C-2B: Safe read-only handler (no command execution, no child_process, no exec/spawn) ---
function handleReadOnly(req: http.IncomingMessage, res: http.ServerResponse) {
  // Phase 5C-5A: Rate limit
  if (isRateLimited("read_only_per_minute")) {
    rateLimitResponse(res, "read_only_per_minute", RATE_LIMITS.read_only_per_minute);
    return;
  }
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    let payload: any = {};
    try {
      payload = JSON.parse(body);
    } catch {
      badRequest(res, "Invalid JSON body");
      return;
    }

    const actionId = String(payload.action_id || "").trim();
    const token = String(payload.token || "").trim();

    if (!actionId) {
      badRequest(res, "Missing 'action_id' field");
      return;
    }

    // Load catalog to find action metadata
    const catalog = safeReadJson(path.join(HARVESTER_DIR, "dashboard", "control-catalog.json"), null) as any;
    if (!catalog) {
      notFound(res, "control-catalog.json not found");
      return;
    }

    let foundCommand: any = null;
    for (const g of catalog.command_groups || []) {
      for (const cmd of g.commands || []) {
        if (cmd.id === actionId || cmd.action_id === actionId) {
          foundCommand = cmd;
          break;
        }
      }
      if (foundCommand) break;
    }

    if (!foundCommand) {
      notFound(res, `Action "${actionId}" not found in catalog`);
      writeAuditLogReadOnly({
        action_id: actionId,
        result: "blocked",
        reason: "action_id_not_found",
      });
      return;
    }

    // Must be execution_mode === "safe_readonly"
    if (foundCommand.execution_mode !== "safe_readonly") {
      forbidden(res, `Action "${actionId}" is not safe_readonly. Execution mode: ${foundCommand.execution_mode || "disabled"}`);
      writeAuditLogReadOnly({
        action_id: actionId,
        result: "blocked",
        reason: "not_safe_readonly",
      });
      return;
    }

    // Check token if configured
    if (CONTROL_CONFIG.token && token !== CONTROL_CONFIG.token) {
      forbidden(res, "Invalid or missing control token");
      writeAuditLogReadOnly({
        action_id: actionId,
        result: "blocked",
        reason: "invalid_token",
      });
      return;
    }

    // Execute the read-only query (pure data read, no shell, no child_process, no exec, no spawn)
    let resultData: any = null;
    let sourceFiles: string[] = [];
    let statusText = "";

    try {
      switch (actionId) {
        case "get_status": {
          const statusPath = path.join(HARVESTER_DIR, "dashboard", "status.json");
          sourceFiles = [statusPath];
          resultData = safeReadJson(statusPath, null);
          statusText = resultData ? "status_loaded" : "status_not_found";
          break;
        }
        case "get_source_health": {
          const jsonPath = path.join(HARVESTER_DIR, "reports", "source-health.json");
          const mdPath = path.join(HARVESTER_DIR, "reports", "source-health.md");
          sourceFiles = [jsonPath, mdPath];
          resultData = {
            json: safeReadJson(jsonPath, null),
            md_available: !!safeReadText(mdPath, ""),
          };
          statusText = "source_health_loaded";
          break;
        }
        case "get_latest_digest": {
          const txtPath = path.join(HARVESTER_DIR, "reports", "telegram-digest.txt");
          const mdPath = path.join(HARVESTER_DIR, "reports", "daily-digest.md");
          sourceFiles = [txtPath, mdPath];
          resultData = {
            telegram_digest_available: !!safeReadText(txtPath, ""),
            daily_digest_available: !!safeReadText(mdPath, ""),
          };
          statusText = "digest_loaded";
          break;
        }
        case "get_generation_queue": {
          const statusPath = path.join(HARVESTER_DIR, "dashboard", "status.json");
          sourceFiles = [statusPath];
          const status = safeReadJson(statusPath, null) as any;
          resultData = status?.recommended_generation_queue || null;
          statusText = resultData ? "queue_loaded" : "queue_not_found";
          break;
        }
        case "get_asset_summary": {
          const assetsDir = path.join(HARVESTER_DIR, "..", "creative-quota-assets", "metadata");
          const cpPath = path.join(assetsDir, "content-pack-index.json");
          const gaPath = path.join(assetsDir, "generated-assets.json");
          const gdPath = path.join(assetsDir, "gallery-dedup-index.json");
          sourceFiles = [cpPath, gaPath, gdPath];
          resultData = {
            content_pack_index: safeReadJson(cpPath, null),
            generated_assets: safeReadJson(gaPath, null),
            gallery_dedup_index: safeReadJson(gdPath, null),
          };
          statusText = "assets_loaded";
          break;
        }
        case "get_timer_snapshot": {
          const statusPath = path.join(HARVESTER_DIR, "dashboard", "status.json");
          sourceFiles = [statusPath];
          const status = safeReadJson(statusPath, null) as any;
          resultData = {
            timer_active: status?.timer_active || false,
            next_run: status?.next_run || "N/A",
            last_run: status?.last_run || "N/A",
          };
          statusText = "timer_loaded";
          break;
        }
        case "get_dashboard_links": {
          sourceFiles = [];
          resultData = {
            public_dashboard: "https://conanxin.github.io/creative-quota-harvester/dashboard/",
            assets_gallery: "https://conanxin.github.io/creative-quota-assets/gallery/",
            daily_archive: "https://conanxin.github.io/creative-quota-assets/daily/",
            github_repo: "https://github.com/conanxin/creative-quota-harvester",
            runbook: "https://github.com/conanxin/creative-quota-harvester/blob/main/docs/SCHEDULED_DAILY_DIGEST_RUNBOOK.md",
          };
          statusText = "links_returned";
          break;
        }
        default: {
          notFound(res, `Read-only handler for "${actionId}" not implemented`);
          writeAuditLogReadOnly({
            action_id: actionId,
            result: "blocked",
            reason: "handler_not_implemented",
          });
          return;
        }
      }

      jsonResponse(res, {
        action_id: actionId,
        label_zh: foundCommand.label_zh || actionId,
        mode: "safe_readonly",
        real_execution: false,
        side_effects: false,
        result: resultData,
        source_files: sourceFiles.map((f) => path.relative(HARVESTER_DIR, f)),
        status: statusText,
        timestamp: new Date().toISOString(),
      });
      writeAuditLogReadOnly({
        action_id: actionId,
        result: "success",
        reason: statusText,
      });
    } catch (err: any) {
      jsonResponse(res, {
        action_id: actionId,
        label_zh: foundCommand.label_zh || actionId,
        mode: "safe_readonly",
        real_execution: false,
        side_effects: false,
        result: null,
        error: err.message || "unknown",
        status: "failed",
        timestamp: new Date().toISOString(),
      });
      writeAuditLogReadOnly({
        action_id: actionId,
        result: "failed",
        reason: err.message || "unknown",
      });
    }
  });
}

interface AuditEntry {
  action_id: string;
  risk_level: string;
  confirm_ok: boolean;
  real_execution: boolean;
  result: string;
  reason: string;
}

interface AuditEntryReadOnly {
  action_id: string;
  result: string;
  reason: string;
}

function writeAuditLog(entry: AuditEntry) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    mode: "dry-run",
    action_id: entry.action_id,
    risk_level: entry.risk_level,
    confirm_ok: entry.confirm_ok,
    real_execution: entry.real_execution,
    result: entry.result,
    reason: entry.reason,
  }) + "\n";
  try {
    fs.appendFileSync(AUDIT_LOG_PATH, line);
  } catch (err: any) {
    console.error("[control-server] Audit log write failed:", err.message);
  }
}

function writeAuditLogReadOnly(entry: AuditEntryReadOnly) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    mode: "safe_readonly",
    action_id: entry.action_id,
    real_execution: false,
    side_effects: false,
    result: entry.result,
    reason: entry.reason,
  }) + "\n";
  try {
    fs.appendFileSync(AUDIT_LOG_PATH, line);
  } catch (err: any) {
    console.error("[control-server] Audit log write failed:", err.message);
  }
}

interface AuditEntryLowRisk {
  action_id: string;
  script_name: string;
  risk_level: string;
  confirm_ok: boolean;
  real_execution: boolean;
  result: string;
  reason: string;
  exit_code?: number;
  timed_out?: boolean;
  duration_ms?: number;
}

function writeAuditLogLowRisk(entry: AuditEntryLowRisk) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    mode: "confirmed_low_risk",
    phase: "5C-2C-A",
    action_id: entry.action_id,
    script_name: entry.script_name,
    risk_level: entry.risk_level,
    confirm_ok: entry.confirm_ok,
    real_execution: entry.real_execution,
    result: entry.result,
    reason: entry.reason,
    exit_code: entry.exit_code,
    timed_out: entry.timed_out,
    duration_ms: entry.duration_ms,
  }) + "\n";
  try {
    fs.appendFileSync(AUDIT_LOG_PATH, line);
  } catch (err: any) {
    console.error("[control-server] Audit log write failed:", err.message);
  }
}

// --- Phase 5C-2C-A: Confirmed low-risk execution handler ---
function handleExecuteLowRisk(req: http.IncomingMessage, res: http.ServerResponse) {
  // Phase 5C-5A: Rate limit
  if (isRateLimited("execute_low_risk_per_minute")) {
    rateLimitResponse(res, "execute_low_risk_per_minute", RATE_LIMITS.execute_low_risk_per_minute);
    return;
  }
  // Phase 5C-5A: Execution lock
  if (!acquireExecutionLock()) {
    res.writeHead(409, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Execution lock busy",
      message: "Another execute-low-risk is already in progress. Try again later.",
      max_concurrent: 1,
    }) + "\n");
    return;
  }
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", async () => {
    let actionId = "";
    let confirmPhrase = "";
    let token = "";
    let payload: any = {};
    try {
      payload = JSON.parse(body);
    } catch {
      badRequest(res, "Invalid JSON body");
      return;
    }

    actionId = String(payload.action_id || "").trim();
    confirmPhrase = String(payload.confirm_phrase || "").trim();
    token = String(payload.token || "").trim();

    if (!actionId) {
      badRequest(res, "Missing 'action_id' field");
      return;
    }

    // Load catalog to find action metadata
    const catalog = safeReadJson(path.join(HARVESTER_DIR, "dashboard", "control-catalog.json"), null) as any;
    if (!catalog) {
      notFound(res, "control-catalog.json not found");
      return;
    }

    let foundCommand: any = null;
    for (const g of catalog.command_groups || []) {
      for (const cmd of g.commands || []) {
        if (cmd.id === actionId || cmd.action_id === actionId) {
          foundCommand = cmd;
          break;
        }
      }
      if (foundCommand) break;
    }

    if (!foundCommand) {
      notFound(res, `Action "${actionId}" not found in catalog`);
      writeAuditLogLowRisk({
        action_id: actionId,
        script_name: "",
        risk_level: "unknown",
        confirm_ok: false,
        real_execution: false,
        result: "blocked",
        reason: "action_id_not_found",
      });
      return;
    }

    const riskLevel = (foundCommand.risk_level || "safe").toLowerCase();
    const scriptName = foundCommand.script_name || foundCommand.id?.replace(/_/g, ":") || actionId;

    // Must be confirmed_low_risk execution mode
    if (foundCommand.execution_mode !== "confirmed_low_risk") {
      forbidden(res, `Action "${actionId}" is not confirmed_low_risk. Execution mode: ${foundCommand.execution_mode || "disabled"}`);
      writeAuditLogLowRisk({
        action_id: actionId,
        script_name: scriptName,
        risk_level: riskLevel,
        confirm_ok: false,
        real_execution: false,
        result: "blocked",
        reason: "not_confirmed_low_risk",
      });
      return;
    }

    // Must have real_execution_supported=true
    if (!foundCommand.real_execution_supported) {
      forbidden(res, `Action "${actionId}" does not support real execution.`);
      writeAuditLogLowRisk({
        action_id: actionId,
        script_name: scriptName,
        risk_level: riskLevel,
        confirm_ok: false,
        real_execution: false,
        result: "blocked",
        reason: "real_execution_not_supported",
      });
      return;
    }

    // Must be safe risk level
    if (riskLevel !== "safe") {
      forbidden(res, `Action "${actionId}" risk level is not safe: ${riskLevel}`);
      writeAuditLogLowRisk({
        action_id: actionId,
        script_name: scriptName,
        risk_level: riskLevel,
        confirm_ok: false,
        real_execution: false,
        result: "blocked",
        reason: "risk_level_not_safe",
      });
      return;
    }

    // Must not call model
    if (foundCommand.calls_model) {
      forbidden(res, `Action "${actionId}" calls_model=true, blocked for low-risk execution.`);
      writeAuditLogLowRisk({
        action_id: actionId,
        script_name: scriptName,
        risk_level: riskLevel,
        confirm_ok: false,
        real_execution: false,
        result: "blocked",
        reason: "calls_model_blocked",
      });
      return;
    }

    // Must not generate media
    if (foundCommand.generates_media) {
      forbidden(res, `Action "${actionId}" generates_media=true, blocked for low-risk execution.`);
      writeAuditLogLowRisk({
        action_id: actionId,
        script_name: scriptName,
        risk_level: riskLevel,
        confirm_ok: false,
        real_execution: false,
        result: "blocked",
        reason: "generates_media_blocked",
      });
      return;
    }

    // Must not modify timer
    if (foundCommand.modifies_timer) {
      forbidden(res, `Action "${actionId}" modifies_timer=true, blocked for low-risk execution.`);
      writeAuditLogLowRisk({
        action_id: actionId,
        script_name: scriptName,
        risk_level: riskLevel,
        confirm_ok: false,
        real_execution: false,
        result: "blocked",
        reason: "modifies_timer_blocked",
      });
      return;
    }

    // Check token if configured
    if (CONTROL_CONFIG.token && token !== CONTROL_CONFIG.token) {
      forbidden(res, "Invalid or missing control token");
      writeAuditLogLowRisk({
        action_id: actionId,
        script_name: scriptName,
        risk_level: riskLevel,
        confirm_ok: false,
        real_execution: false,
        result: "blocked",
        reason: "invalid_token",
      });
      return;
    }

    // Check confirmation phrase
    const expectedPhrase = foundCommand.confirmation_phrase || "EXECUTE LOW RISK";
    const confirmOk = confirmPhrase === expectedPhrase;

    if (!confirmOk) {
      jsonResponse(res, {
        action_id: actionId,
        label_zh: foundCommand.label_zh || actionId,
        risk_level: riskLevel,
        script_name: scriptName,
        would_run_command: foundCommand.command || null,
        requires_confirm: !!foundCommand.requires_confirm,
        confirmation_phrase_expected: expectedPhrase,
        confirmation_status: "mismatch",
        real_execution: false,
        message: `Execution blocked: confirmation phrase mismatch. Expected: "${expectedPhrase}"`,
      });
      writeAuditLogLowRisk({
        action_id: actionId,
        script_name: scriptName,
        risk_level: riskLevel,
        confirm_ok: false,
        real_execution: false,
        result: "blocked",
        reason: "confirm_phrase_mismatch",
      });
      return;
    }

    // All safety checks passed — execute via runner
    try {
      const result = await executeLowRiskAction(scriptName, actionId);

      jsonResponse(res, {
        action_id: actionId,
        label_zh: foundCommand.label_zh || actionId,
        risk_level: riskLevel,
        script_name: scriptName,
        command: foundCommand.command || null,
        confirmation_phrase_expected: expectedPhrase,
        confirmation_status: "matched",
        real_execution: true,
        execution_result: {
          exit_code: result.exitCode,
          timed_out: result.timedOut,
          duration_ms: result.duration_ms,
          stdout_tail: result.stdout_tail,
          stderr_tail: result.stderr_tail,
        },
        message: result.exitCode === 0 ? "Execution completed successfully." : `Execution failed with exit code ${result.exitCode}.`,
      });

      writeAuditLogLowRisk({
        action_id: actionId,
        script_name: scriptName,
        risk_level: riskLevel,
        confirm_ok: true,
        real_execution: true,
        result: result.exitCode === 0 ? "success" : "failed",
        reason: result.timedOut ? "timed_out" : "executed",
        exit_code: result.exitCode,
        timed_out: result.timedOut,
        duration_ms: result.duration_ms,
      });
    } catch (err: any) {
      jsonResponse(res, {
        action_id: actionId,
        label_zh: foundCommand.label_zh || actionId,
        risk_level: riskLevel,
        script_name: scriptName,
        confirmation_status: "matched",
        real_execution: true,
        execution_result: null,
        error: err.message || "unknown",
        message: "Execution failed with an unexpected error.",
      });
      writeAuditLogLowRisk({
        action_id: actionId,
        script_name: scriptName,
        risk_level: riskLevel,
        confirm_ok: true,
        real_execution: true,
        result: "failed",
        reason: err.message || "unknown",
      });
    } finally {
      // Phase 5C-5A: Always release execution lock
      releaseExecutionLock();
    }
  });
}
