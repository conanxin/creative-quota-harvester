#!/usr/bin/env tsx
/**
 * scripts/generate-control-catalog.ts — Phase 5C-3
 *
 * Auto-generates control catalog from package.json scripts + control-policy.json.
 * Merges with existing manual commands (safe_readonly queries) to produce final
 * dashboard/control-catalog.json.
 *
 * Usage: npm run dashboard:control:generate
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const HARVESTER_DIR = "/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester";
const PKG_PATH = join(HARVESTER_DIR, "package.json");
const POLICY_PATH = join(HARVESTER_DIR, "dashboard", "control-policy.json");
const MANUAL_CATALOG_PATH = join(HARVESTER_DIR, "dashboard", "control-catalog.json");
const GENERATED_PATH = join(HARVESTER_DIR, "dashboard", "control-catalog.generated.json");

interface PolicyRule {
  match: string;
  risk_level?: string;
  requires_confirm?: boolean;
  requires_env?: string[];
  calls_model?: boolean;
  generates_media?: boolean;
  modifies_timer?: boolean;
  modifies_files?: boolean;
  public_safe?: boolean;
  dry_run_supported?: boolean;
  real_execution_supported?: boolean;
  execution_mode?: string;
  audit_required?: boolean;
  notes?: string;
}

interface Policy {
  version: string;
  phase: string;
  generated_at: string;
  purpose: string;
  default_policy: {
    risk_level: string;
    requires_confirm: boolean;
    requires_env: string[];
    calls_model: boolean;
    generates_media: boolean;
    modifies_timer: boolean;
    modifies_files: boolean;
    public_safe: boolean;
    dry_run_supported: boolean;
    real_execution_supported: boolean;
    execution_mode: string;
    audit_required: boolean;
    notes: string;
  };
  rules: PolicyRule[];
  ignored_scripts: string[];
}

interface Command {
  id: string;
  label_zh: string;
  description_zh: string;
  command: string;
  risk_level: string;
  requires_confirm: boolean;
  requires_env: string[];
  calls_model: boolean;
  generates_media: boolean;
  modifies_timer: boolean;
  public_safe: boolean;
  notes: string;
  action_id: string;
  dry_run_supported: boolean;
  real_execution_supported: boolean;
  allowed_in_phase: string;
  confirmation_phrase: string;
  audit_required: boolean;
  execution_mode: string;
}

interface CommandGroup {
  id: string;
  label_zh: string;
  description_zh: string;
  commands: Command[];
}

interface Catalog {
  version: string;
  phase: string;
  generated_at: string;
  purpose: string;
  public_safety_model: string;
  risk_levels: Record<string, string>;
  command_groups: CommandGroup[];
  boundaries: Record<string, unknown>;
}

function matchRule(scriptName: string, rule: PolicyRule): boolean {
  const pattern = rule.match;
  if (pattern.includes("*")) {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return regex.test(scriptName);
  }
  return pattern === scriptName;
}

function findPolicy(scriptName: string, policy: Policy): Partial<PolicyRule> | null {
  for (const rule of policy.rules) {
    if (matchRule(scriptName, rule)) {
      return rule;
    }
  }
  return null;
}

function generateCommand(scriptName: string, scriptCmd: string, policy: Policy): Command | null {
  if (policy.ignored_scripts.includes(scriptName)) {
    return null;
  }

  const matched = findPolicy(scriptName, policy);
  const dp = policy.default_policy;

  const risk = matched?.risk_level || dp.risk_level;
  const requiresConfirm = matched?.requires_confirm ?? dp.requires_confirm;
  const requiresEnv = matched?.requires_env || dp.requires_env || [];
  const callsModel = matched?.calls_model ?? dp.calls_model;
  const generatesMedia = matched?.generates_media ?? dp.generates_media;
  const modifiesTimer = matched?.modifies_timer ?? dp.modifies_timer;
  const publicSafe = matched?.public_safe ?? dp.public_safe;
  const dryRunSupported = matched?.dry_run_supported ?? dp.dry_run_supported;
  const realExecutionSupported = matched?.real_execution_supported ?? dp.real_execution_supported;
  const executionMode = matched?.execution_mode || dp.execution_mode;
  const auditRequired = matched?.audit_required ?? dp.audit_required;
  const notes = matched?.notes || dp.notes;

  // Generate label_zh from script name
  const labelZh = scriptName
    .split(":")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(": ");

  // Generate description_zh
  const descriptionZh = notes.includes(".") || notes.includes("，") || notes.includes("；")
    ? notes
    : `${labelZh} — ${notes}`;

  // Confirmation phrase based on risk and execution mode
  const riskLower = risk.toLowerCase();
  const confirmationPhrase = executionMode === "confirmed_low_risk" ? "EXECUTE LOW RISK" :
    riskLower === "safe" ? "dry-run-safe" :
    riskLower === "medium" ? "dry-run-medium" :
    riskLower === "high" ? "dry-run-high" :
    riskLower === "danger" ? "dry-run-danger" : "dry-run";

  return {
    id: scriptName.replace(/:/g, "_"),
    label_zh: labelZh,
    description_zh: descriptionZh,
    command: scriptCmd,
    risk_level: risk,
    requires_confirm: requiresConfirm,
    requires_env: requiresEnv,
    calls_model: callsModel,
    generates_media: generatesMedia,
    modifies_timer: modifiesTimer,
    public_safe: publicSafe,
    notes: notes,
    action_id: scriptName.replace(/:/g, "_"),
    dry_run_supported: dryRunSupported,
    real_execution_supported: realExecutionSupported,
    allowed_in_phase: "5C-3-auto-generated",
    confirmation_phrase: confirmationPhrase,
    audit_required: auditRequired,
    execution_mode: executionMode,
    source: "package-script",
    needs_policy_review: !matched,
  };
}

function groupCommands(commands: Command[]): CommandGroup[] {
  const groups: Record<string, Command[]> = {
    daily_digest: [],
    source_collection: [],
    asset_generation: [],
    validation: [],
    timer: [],
    reports: [],
    development: [],
    dashboard_control: [],
    prompt_enhancement: [],
    other: [],
  };

  for (const cmd of commands) {
    const name = cmd.id;
    if (name.includes("digest") || name.includes("daily")) {
      groups.daily_digest.push(cmd);
    } else if (name.includes("collect") || name.includes("source") || name.includes("diagnose")) {
      groups.source_collection.push(cmd);
    } else if (name.includes("generate") || name.includes("image") || name.includes("video") || name.includes("music")) {
      groups.asset_generation.push(cmd);
    } else if (name.includes("validate") || name.includes("check") || name.includes("guard") || name.includes("review")) {
      groups.validation.push(cmd);
    } else if (name.includes("timer") || name.includes("systemctl") || name.includes("enable") || name.includes("disable")) {
      groups.timer.push(cmd);
    } else if (name.includes("send") || name.includes("report") || name.includes("telegram")) {
      groups.reports.push(cmd);
    } else if (name.includes("build") || name.includes("dashboard") || name.includes("control") || name.includes("gallery") || name.includes("archive") || name.includes("enrich") || name.includes("brief")) {
      groups.dashboard_control.push(cmd);
    } else if (name.includes("prompt") || name.includes("enhance")) {
      groups.prompt_enhancement.push(cmd);
    } else if (name.includes("test") || name.includes("type") || name.includes("run") || name.includes("build")) {
      groups.development.push(cmd);
    } else {
      groups.other.push(cmd);
    }
  }

  const groupDefs: Record<string, { label: string; desc: string }> = {
    daily_digest: { label: "📅 Daily Digest", desc: "生成、刷新、发送和验证每日内容 Digest 的命令" },
    source_collection: { label: "🌐 Source Collection", desc: "采集外部 source 的命令（collect / diagnose）" },
    asset_generation: { label: "🎨 Asset Generation", desc: "生成图片 / 视频 Prompt / 音乐 Prompt 的命令" },
    validation: { label: "✅ Validation", desc: "静态 / 数据校验脚本（safe，pure check）" },
    timer: { label: "⏰ Timer", desc: "systemd timer 状态 / 日志 / 启停命令" },
    reports: { label: "📨 Reports", desc: "项目报告发送相关命令（project sender）" },
    development: { label: "🔧 Development", desc: "开发、测试和构建命令" },
    dashboard_control: { label: "🎛️ Dashboard & Control", desc: "Dashboard 构建、控制、归档和增强命令" },
    prompt_enhancement: { label: "✨ Prompt Enhancement", desc: "Prompt 增强和事实补充命令" },
    other: { label: "📦 Other", desc: "其他命令" },
  };

  const result: CommandGroup[] = [];
  for (const [id, cmds] of Object.entries(groups)) {
    if (cmds.length > 0) {
      result.push({
        id,
        label_zh: groupDefs[id]?.label || id,
        description_zh: groupDefs[id]?.desc || "",
        commands: cmds,
      });
    }
  }
  return result;
}

// Main
function main() {
  if (!existsSync(PKG_PATH)) {
    console.error("package.json not found:", PKG_PATH);
    process.exit(1);
  }
  if (!existsSync(POLICY_PATH)) {
    console.error("control-policy.json not found:", POLICY_PATH);
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf-8"));
  const policy: Policy = JSON.parse(readFileSync(POLICY_PATH, "utf-8"));
  const scripts = pkg.scripts || {};

  const commands: Command[] = [];
  const unmapped: string[] = [];

  for (const [name, cmd] of Object.entries(scripts)) {
    const command = generateCommand(name, cmd as string, policy);
    if (command) {
      commands.push(command);
    } else if (!policy.ignored_scripts.includes(name)) {
      unmapped.push(name);
    }
  }

  // Load manual catalog for safe_readonly commands
  let manualGroups: CommandGroup[] = [];
  if (existsSync(MANUAL_CATALOG_PATH)) {
    const manual = JSON.parse(readFileSync(MANUAL_CATALOG_PATH, "utf-8")) as Catalog;
    manualGroups = manual.command_groups || [];
  }

  // Filter out safe_readonly group from manual (we keep it)
  const safeReadonlyGroup = manualGroups.find((g) => g.id === "safe_readonly_queries");
  const manualNonReadonly = manualGroups.filter((g) => g.id !== "safe_readonly_queries");

  // Auto-group generated commands
  const autoGroups = groupCommands(commands);

  // Merge: auto-generated groups + manual safe_readonly group only
  const mergedGroups = [...autoGroups];
  if (safeReadonlyGroup) {
    // Tag manual safe_readonly commands with source
    for (const cmd of safeReadonlyGroup.commands || []) {
      (cmd as any).source = (cmd as any).source || "manual";
    }
    mergedGroups.push(safeReadonlyGroup);
  }

  // Note: manual non-readonly commands are replaced by auto-generated ones
  // to avoid drift. If manual metadata was better, future phases could add
  // override merging (manual label_zh / notes / description_zh take precedence).

  const generatedCatalog: Catalog = {
    version: "0.4.0",
    phase: "5C-3",
    generated_at: new Date().toISOString().slice(0, 19) + "Z",
    purpose: "Auto-generated command catalog from package.json scripts + control-policy.json. Merged with manual safe_readonly queries from Phase 5C-2B. All commands have real_execution_supported=false.",
    public_safety_model: "All commands are listed for reference only. The public catalog cannot execute any of them. Real control actions require either a localhost-only control server (Phase 5C-1) or an authenticated dashboard (Phase 5C-2).",
    risk_levels: {
      safe: "Read-only / dry-run / validation. No side effects. Safe to run repeatedly.",
      medium: "Has observable side effects (file writes, network calls, message sends). Requires confirmation.",
      high: "Triggers model calls (image generation) or other expensive operations. Requires CQA_ALLOW_* env flag and explicit confirmation.",
      danger: "Modifies system-level state (timer, service). Requires manual intervention and double confirmation.",
    },
    command_groups: mergedGroups,
    boundaries: {
      no_real_execution: true,
      no_button_to_run: true,
      no_fetch_post: true,
      no_websocket: true,
      no_child_process: true,
      no_secret_in_file: true,
      gitignore_targets: [".env", ".env.local", ".env.telegram.local", "data/*.db", "logs/", "*.log"],
      public_deploy_target: "GitHub Pages (conanxin.github.io/creative-quota-harvester/dashboard/)",
      real_execution_coming_in: "Phase 5C-2C (authenticated execution)",
    },
  };

  writeFileSync(GENERATED_PATH, JSON.stringify(generatedCatalog, null, 2) + "\n");

  // Also write the merged catalog as the final control-catalog.json
  writeFileSync(MANUAL_CATALOG_PATH, JSON.stringify(generatedCatalog, null, 2) + "\n");

  console.log(`Generated ${commands.length} commands from package.json scripts`);
  console.log(`Unmapped scripts: ${unmapped.length > 0 ? unmapped.join(", ") : "none"}`);
  console.log(`Total groups: ${mergedGroups.length}`);
  console.log(`Total commands: ${mergedGroups.reduce((a, g) => a + g.commands.length, 0)}`);
  console.log(`Safe readonly commands: ${safeReadonlyGroup ? safeReadonlyGroup.commands.length : 0}`);
  console.log(`Written to: ${GENERATED_PATH}`);
  console.log(`Final catalog: ${MANUAL_CATALOG_PATH}`);

  if (unmapped.length > 0) {
    console.warn("\nWarning: Unmapped scripts need policy rules:");
    for (const name of unmapped) {
      console.warn(`  - ${name}`);
    }
  }
}

main();
