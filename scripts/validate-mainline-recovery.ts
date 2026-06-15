#!/usr/bin/env tsx
/**
 * scripts/validate-mainline-recovery.ts
 * Phase 6A: Validator for mainline recovery artifacts.
 *
 * Checks (all must PASS):
 *   - docs/MAINLINE_GOAL.md exists with required sections
 *   - dashboard/mainline-status.json is valid JSON + has required fields
 *   - dashboard/mainline-asset-inventory.json is valid JSON + has required fields
 *   - dashboard/mainline-production-queue.json is valid JSON + has required fields
 *   - queue items have required fields
 *   - control_plane_status = stable_frozen
 *   - no generate/send/timer/promote enabled in boundaries_enforced
 *   - no secrets / tokens / sk-cp / TELEGRAM_BOT_TOKEN / MINIMAX_API_KEY
 *   - dashboard/index.html has Mainline Recovery section
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

interface Check {
  id: string;
  met: boolean;
  message: string;
}

const checks: Check[] = [];
function addCheck(id: string, met: boolean, message: string) {
  checks.push({ id, met, message });
}

function readText(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}
function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}
function readJson(rel: string): any {
  return JSON.parse(readText(rel));
}

const REQUIRED_MAINLINE_GOAL_SECTIONS = [
  "Project North Star",
  "Original Goal",
  "What the system is for",
  "What the system is NOT for",
  "Current stable control-plane baseline",
  "Mainline production loop",
  "Success metrics",
  "Stop-doing list",
];

const REQUIRED_STATUS_FIELDS = [
  "phase", "mode", "north_star", "control_plane_status",
  "current_assets", "boundaries_enforced",
];

const REQUIRED_INVENTORY_FIELDS = [
  "phase", "inventory", "gaps", "ready_for_next",
];

const REQUIRED_QUEUE_FIELDS = [
  "phase", "items", "categories",
];

const REQUIRED_QUEUE_ITEM_FIELDS = [
  "id", "title", "source_type", "current_asset_state",
  "recommended_next_action", "risk_level", "requires_model_call",
];

const REQUIRED_BOUNDARY_FIELDS = [
  "model_call_allowed", "media_generation_allowed",
  "collect_allowed", "digest_send_allowed",
  "timer_allowed", "generate_allowed",
  "c5n_promote_allowed", "production_digest_overwrite",
  "systemd_change", "token_commit",
];

// 1. MAINLINE_GOAL.md
if (!exists("docs/MAINLINE_GOAL.md")) {
  addCheck("mainline_goal_exists", false, "docs/MAINLINE_GOAL.md missing");
} else {
  const content = readText("docs/MAINLINE_GOAL.md");
  addCheck("mainline_goal_exists", true, "docs/MAINLINE_GOAL.md present");
  let foundSections = 0;
  for (const s of REQUIRED_MAINLINE_GOAL_SECTIONS) {
    if (content.toLowerCase().includes(s.toLowerCase())) foundSections++;
  }
  addCheck("mainline_goal_sections", foundSections === REQUIRED_MAINLINE_GOAL_SECTIONS.length,
    `sections: ${foundSections}/${REQUIRED_MAINLINE_GOAL_SECTIONS.length}`);
  addCheck("mainline_goal_control_plane_frozen", content.toLowerCase().includes("控制台") && content.toLowerCase().includes("冻结"),
    "mentions control plane freeze");
  addCheck("mainline_goal_stop_doing", content.toLowerCase().includes("stop-doing") || content.toLowerCase().includes("stop doing"),
    "has Stop-Doing list");
}

// 2. mainline-status.json
if (!exists("dashboard/mainline-status.json")) {
  addCheck("status_json_exists", false, "dashboard/mainline-status.json missing");
} else {
  try {
    const s = readJson("dashboard/mainline-status.json");
    addCheck("status_json_exists", true, "valid JSON");
    for (const f of REQUIRED_STATUS_FIELDS) {
      addCheck("status_field_" + f, f in s, `field: ${f}`);
    }
    addCheck("status_phase_6A", s.phase === "6A", "phase=6A");
    addCheck("status_mode_mainline_recovery", s.mode === "mainline_recovery", "mode=mainline_recovery");
    addCheck("status_control_plane_frozen", s.control_plane_status === "stable_frozen", "control_plane_status=stable_frozen");

    // Check boundaries
    const b = s.boundaries_enforced || {};
    for (const f of REQUIRED_BOUNDARY_FIELDS) {
      const val = b[f];
      const shouldBeFalse = ["model_call_allowed", "media_generation_allowed", "collect_allowed",
        "digest_send_allowed", "timer_allowed", "generate_allowed",
        "c5n_promote_allowed", "production_digest_overwrite", "systemd_change", "token_commit"].includes(f);
      addCheck("boundary_" + f, shouldBeFalse ? val === false : true,
        `boundary.${f}=${val} (should be false)`);
    }

    // Check current_assets
    const ca = s.current_assets || {};
    addCheck("status_has_content_packs", "content_packs" in ca, "has content_packs");
    addCheck("status_has_generated_images", "generated_images" in ca, "has generated_images");
    addCheck("status_has_image_prompts", "image_prompts" in ca, "has image_prompts");
    addCheck("status_content_packs_total", ca.content_packs && ca.content_packs.total === 25,
      "content_packs.total=25");
    addCheck("status_images_total", ca.generated_images && ca.generated_images.total === 5,
      "generated_images.total=5");

  } catch (e: any) {
    addCheck("status_json_valid", false, "parse error: " + e.message);
  }
}

// 3. mainline-asset-inventory.json
if (!exists("dashboard/mainline-asset-inventory.json")) {
  addCheck("inventory_json_exists", false, "dashboard/mainline-asset-inventory.json missing");
} else {
  try {
    const inv = readJson("dashboard/mainline-asset-inventory.json");
    addCheck("inventory_json_exists", true, "valid JSON");
    for (const f of REQUIRED_INVENTORY_FIELDS) {
      addCheck("inventory_field_" + f, f in inv, `field: ${f}`);
    }
    const i = inv.inventory || {};
    addCheck("inventory_has_content_packs", "content_packs" in i, "has content_packs");
    addCheck("inventory_has_generated_images", "generated_images" in i, "has generated_images");
    addCheck("inventory_content_packs_total", i.content_packs && i.content_packs.total === 25,
      "content_packs.total=25");
    addCheck("inventory_images_total", i.generated_images && i.generated_images.total === 5,
      "generated_images.total=5");
    addCheck("inventory_images_all_reviewed",
      i.generated_images && i.generated_images.all_reviewed === true,
      "all images reviewed");
    addCheck("inventory_gaps_present", Array.isArray(inv.gaps) && inv.gaps.length > 0,
      `gaps: ${inv.gaps ? inv.gaps.length : 0}`);
  } catch (e: any) {
    addCheck("inventory_json_valid", false, "parse error: " + e.message);
  }
}

// 4. mainline-production-queue.json
if (!exists("dashboard/mainline-production-queue.json")) {
  addCheck("queue_json_exists", false, "dashboard/mainline-production-queue.json missing");
} else {
  try {
    const q = readJson("dashboard/mainline-production-queue.json");
    addCheck("queue_json_exists", true, "valid JSON");
    for (const f of REQUIRED_QUEUE_FIELDS) {
      addCheck("queue_field_" + f, f in q, `field: ${f}`);
    }

    // Check categories (keys are like "A_ready_for_image_generation", "B_ready_for_video_prompt_publication", etc.)
    const cats = q.categories || {};
    const catKeys = Object.keys(cats);
    addCheck("queue_has_cat_A", catKeys.some(k => k.startsWith("A_")), "has category A: " + catKeys.filter(k=>k.startsWith("A_")));
    addCheck("queue_has_cat_B", catKeys.some(k => k.startsWith("B_")), "has category B: " + catKeys.filter(k=>k.startsWith("B_")));
    addCheck("queue_has_cat_C", catKeys.some(k => k.startsWith("C_")), "has category C: " + catKeys.filter(k=>k.startsWith("C_")));
    addCheck("queue_has_cat_D", catKeys.some(k => k.startsWith("D_")), "has category D: " + catKeys.filter(k=>k.startsWith("D_")));
    addCheck("queue_has_cat_E", catKeys.some(k => k.startsWith("E_")), "has category E: " + catKeys.filter(k=>k.startsWith("E_")));
    addCheck("queue_has_cat_F", catKeys.some(k => k.startsWith("F_")), "has category F: " + catKeys.filter(k=>k.startsWith("F_")));

    // Check items
    const items = q.items || [];
    addCheck("queue_items_count", items.length > 0, `items: ${items.length}`);
    let validItems = 0;
    let requiresModelCall = 0;
    for (const item of items) {
      let itemValid = true;
      for (const f of REQUIRED_QUEUE_ITEM_FIELDS) {
        if (!(f in item)) itemValid = false;
      }
      if (itemValid) validItems++;
      if (item.requires_model_call === true) requiresModelCall++;
    }
    addCheck("queue_items_all_valid", validItems === items.length,
      `valid items: ${validItems}/${items.length}`);
    addCheck("queue_items_model_call标记", requiresModelCall > 0,
      `items requiring model call: ${requiresModelCall}`);

    // Category A should have requires_model_call = true
    const catA = (items || []).filter((it: any) => it.category === "A");
    const catARequireModel = catA.filter((it: any) => it.requires_model_call === true);
    addCheck("queue_cat_A_requires_model", catARequireModel.length > 0,
      `cat A items requiring model: ${catARequireModel.length}/${catA.length}`);

    // Category E should NOT require model call
    const catE = (items || []).filter((it: any) => it.category === "E");
    const catENotModel = catE.filter((it: any) => it.requires_model_call !== true);
    addCheck("queue_cat_E_no_model", catENotModel.length === catE.length,
      `cat E without model call: ${catENotModel.length}/${catE.length}`);

  } catch (e: any) {
    addCheck("queue_json_valid", false, "parse error: " + e.message);
  }
}

// 5. No token/secrets in all new files
{
  const newFiles = [
    "docs/MAINLINE_GOAL.md",
    "dashboard/mainline-status.json",
    "dashboard/mainline-asset-inventory.json",
    "dashboard/mainline-production-queue.json",
    "dashboard/index.html",
  ];
  const tokenPatterns = [
    /sk-cp-[A-Za-z0-9_-]{10,}/,
    /TELEGRAM_BOT_TOKEN\s*=\s*['"][A-Za-z0-9_-]{10,}/,
    /MINIMAX_API_KEY\s*=\s*['"][A-Za-z0-9_-]{10,}/,
    /CQA_CONTROL_TOKEN\s*=\s*['"][A-Za-z0-9_-]{10,}/,
    /OPENAI_API_KEY\s*=\s*['"][A-Za-z0-9_-]{10,}/,
  ];
  let found = false;
  for (const f of newFiles) {
    if (!exists(f)) continue;
    const content = readText(f);
    for (const pat of tokenPatterns) {
      if (pat.test(content)) {
        found = true;
        addCheck("no_token:" + f, false, `token-like found in ${f}`);
      }
    }
  }
  if (!found) addCheck("no_tokens_in_new_files", true, "no token patterns in new files");
}

// 6. dashboard/index.html has Mainline Recovery section
if (exists("dashboard/index.html")) {
  const html = readText("dashboard/index.html");
  addCheck("index_html_has_mainline_section",
    html.includes("Mainline Recovery") && html.includes("Phase 6A"),
    "has Mainline Recovery section");
  addCheck("index_html_has_north_star",
    html.toLowerCase().includes("north star") || html.toLowerCase().includes("主线恢复"),
    "has North Star display");
  addCheck("index_html_no_danger_buttons",
    !/<button[^>]*>(?:promote|rollback|approve|generate|timer|send)/i.test(html.replace(/\n/g, " ")),
    "no danger buttons found");
} else {
  addCheck("index_html_exists", false, "dashboard/index.html missing");
}

const allMet = checks.every(c => c.met);
const summary = {
  validator: "validate-mainline-recovery",
  phase: "6A",
  generated_at: new Date().toISOString(),
  total_checks: checks.length,
  passed: checks.filter(c => c.met).length,
  failed: checks.filter(c => !c.met).length,
  all_pass: allMet,
  checks,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(allMet ? 0 : 1);