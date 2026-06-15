#!/usr/bin/env tsx
/**
 * scripts/validate-x-human-review-decision-sheet.ts
 * Phase 6D-2: Validator for X Human Review Decision Sheet.
 *
 * Checks (all must PASS):
 *   - dashboard/x-human-review-decision-sheet.json valid
 *   - assets decision-sheet.json valid
 *   - assets decision-sheet.md exists
 *   - assets decision-cards/ has 5 markdown files
 *   - total_items=5
 *   - all current_decision=pending
 *   - no_platform_publish=true
 *   - platform_publish_enabled=false
 *   - no published_externally=true
 *   - no X API call patterns
 *   - no baoyu-post-to-x call patterns
 *   - post_text matches Phase 6D-1 source
 *   - no token / sk-cp / TELEGRAM_BOT_TOKEN / MINIMAX_API_KEY
 *   - no media generation patterns
 *   - no model call patterns
 *   - mainline-publishing-status.json preserves 6B/6C/6D/6D-1 + adds 6D-2
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER = path.resolve(__dirname, "..");
const ASSETS = path.join(process.env.HOME || "/home/ubuntu", ".openclaw/workspace/projects/creative-quota-assets");

interface Check {
  id: string;
  met: boolean;
  message: string;
}

const checks: Check[] = [];
function addCheck(id: string, met: boolean, message: string) {
  checks.push({ id, met, message });
}

function readText(rel: string, base: string = HARVESTER): string {
  return fs.readFileSync(path.join(base, rel), "utf-8");
}
function readJson(rel: string, base: string = HARVESTER): any {
  return JSON.parse(readText(rel, base));
}
function exists(rel: string, base: string = HARVESTER): boolean {
  return fs.existsSync(path.join(base, rel));
}

const TOKEN_PATTERNS = [
  /sk-cp-[A-Za-z0-9_-]{10,}/,
  /TELEGRAM_BOT_TOKEN\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /MINIMAX_API_KEY\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /CQA_CONTROL_TOKEN\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /OPENAI_API_KEY\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /X_BEARER_TOKEN\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /AIza[A-Za-z0-9_-]{20,}/,
];
const X_API_PATTERNS = [
  /https?:\/\/(api\.twitter\.com|api\.x\.com)/i,
  /bearer\s+[A-Za-z0-9_-]{20,}/,
];
const BAOYU_POST_PATTERNS = [
  /\bbaoyu[-_]post[-_]to[-_]x\s*\(/i,
  /\bspawn\s+.*baoyu[-_]post[-_]to[-_]x/i,
  /exec\s*\(\s*['"`].*baoyu[-_]post[-_]to[-_]x/i,
];
const MODEL_CALL_PATTERNS = [
  /\bcompletion\s*\(\s*{/,
  /\blitellm\.(completion|transcription|image_generation|video_generation|music_generation)\s*\(/i,
  /\bopenai\.ChatCompletion\.(create|with\w+)\s*\(/i,
  /\bminimax\.(text|image|video|music)\s*\([^{]/i,
];
const MEDIA_GEN_PATTERNS = [
  /\bimage_generate\s*\(\s*{/,
  /\bvideo_generate\s*\(\s*{/,
  /\bmusic_generate\s*\(\s*{/,
  /exec\s*\(\s*['"].*generate:image/i,
];
const AUTO_PUBLISH_PATTERNS = [
  /\bpublished\s*[:=]\s*true\b/i,
  /\bpublished_externally\s*[:=]\s*true\b/i,
];

// Load Phase 6D-1 review board for cross-check
let phase61Board: any = null;
try {
  phase61Board = readJson("publishing/review/x/phase-6d/review-board.json", ASSETS);
} catch (e) {
  // ignore, will fail later
}

// 1. harvester dashboard/x-human-review-decision-sheet.json
if (!exists("dashboard/x-human-review-decision-sheet.json")) {
  addCheck("harvester_decision_sheet_exists", false, "missing");
} else {
  try {
    const d = readJson("dashboard/x-human-review-decision-sheet.json");
    addCheck("harvester_decision_sheet_exists", true, "valid JSON");
    addCheck("harvester_decision_sheet_phase_6D-2", d.phase === "6D-2", "phase=6D-2");
    addCheck("harvester_decision_sheet_no_platform_publish", d.no_platform_publish === true, "no_platform_publish=true");
    addCheck("harvester_decision_sheet_platform_publish_disabled", d.platform_publish_enabled === false, "platform_publish_enabled=false");
    addCheck("harvester_decision_sheet_awaiting_human", d.decision_status === "awaiting_human_input", "decision_status=awaiting_human_input");
    addCheck("harvester_decision_sheet_total_5", d.total_items === 5, "total_items=5");
    addCheck("harvester_decision_sheet_approved_0", d.approved === 0, "approved=0");
    addCheck("harvester_decision_sheet_needs_edit_0", d.needs_edit === 0, "needs_edit=0");
    addCheck("harvester_decision_sheet_rejected_0", d.rejected === 0, "rejected=0");
    addCheck("harvester_decision_sheet_hold_0", d.hold === 0, "hold=0");
    addCheck("harvester_decision_sheet_5_items", Array.isArray(d.items) && d.items.length === 5, "items=5");

    const items = d.items || [];
    const itemsAllPending = items.every((i: any) => i.current_decision === "pending");
    const itemsNotPublished = items.every((i: any) => i.current_publish_status === "not_published");
    const itemsHaveAvailableDecisions = items.every((i: any) =>
      Array.isArray(i.available_decisions) &&
      i.available_decisions.includes("approved") &&
      i.available_decisions.includes("needs_edit") &&
      i.available_decisions.includes("rejected") &&
      i.available_decisions.includes("hold")
    );
    const itemsHaveFields = items.every((i: any) =>
      i.id && i.title && i.source_type && i.risk_level &&
      i.post_text && i.image_url && i.gallery_url && i.review_file
    );
    addCheck("harvester_decision_sheet_all_pending", itemsAllPending, "all current_decision=pending");
    addCheck("harvester_decision_sheet_all_not_published", itemsNotPublished, "all current_publish_status=not_published");
    addCheck("harvester_decision_sheet_all_have_options", itemsHaveAvailableDecisions, "all items have 4 available_decisions");
    addCheck("harvester_decision_sheet_all_have_fields", itemsHaveFields, "all items have required fields");

    // post_text cross-check with Phase 6D-1
    if (phase61Board && phase61Board.items) {
      let allMatch = true;
      for (let idx = 0; idx < items.length; idx++) {
        const d6d2 = items[idx];
        const d6d1 = phase61Board.items[idx];
        if (d6d2.id !== d6d1.id) { allMatch = false; break; }
        if (d6d2.post_text !== d6d1.post_text) { allMatch = false; break; }
        if (d6d2.image_url !== d6d1.image_url) { allMatch = false; break; }
      }
      addCheck("post_text_passthrough_from_6D-1", allMatch, "post_text/image_url match Phase 6D-1 review-board.json");
    } else {
      addCheck("post_text_passthrough_from_6D-1", false, "Phase 6D-1 review-board.json missing for cross-check");
    }
  } catch (e: any) {
    addCheck("harvester_decision_sheet_valid", false, "parse error: " + e.message);
  }
}

// 2. assets decision-sheet.json
const assetsSheetPath = "publishing/review/x/phase-6d/decision-sheet.json";
if (!exists(assetsSheetPath, ASSETS)) {
  addCheck("assets_decision_sheet_json_exists", false, "missing");
} else {
  try {
    const d = readJson(assetsSheetPath, ASSETS);
    addCheck("assets_decision_sheet_json_exists", true, "valid JSON");
    addCheck("assets_decision_sheet_phase_6D-2", d.phase === "6D-2", "phase=6D-2");
    addCheck("assets_decision_sheet_no_platform_publish", d.no_platform_publish === true, "no_platform_publish=true");
    addCheck("assets_decision_sheet_total_5", d.total_items === 5, "total_items=5");
    addCheck("assets_decision_sheet_5_items", Array.isArray(d.items) && d.items.length === 5, "items=5");
    const items = d.items || [];
    const itemsAllPending = items.every((i: any) => i.current_decision === "pending");
    addCheck("assets_decision_sheet_all_pending", itemsAllPending, "all current_decision=pending");
  } catch (e: any) {
    addCheck("assets_decision_sheet_json_valid", false, "parse error: " + e.message);
  }
}

// 3. assets decision-sheet.md
addCheck("assets_decision_sheet_md_exists", exists("publishing/review/x/phase-6d/decision-sheet.md", ASSETS), "decision-sheet.md exists");

// 4. assets decision-cards/ has 5 markdown files
const cardsDir = "publishing/review/x/phase-6d/decision-cards";
const cardsFullDir = path.join(ASSETS, cardsDir);
if (!fs.existsSync(cardsFullDir)) {
  addCheck("decision_cards_dir_exists", false, "missing");
} else {
  const cardFiles = fs.readdirSync(cardsFullDir).filter(f => f.endsWith(".md"));
  addCheck("decision_cards_dir_exists", true, "directory exists");
  addCheck("decision_cards_5_files", cardFiles.length === 5, `5 markdown files (got ${cardFiles.length}: ${cardFiles.join(", ")})`);
}

// 5. mainline-publishing-status.json preserves 6B/6C/6D/6D-1 + adds 6D-2
if (!exists("dashboard/mainline-publishing-status.json")) {
  addCheck("mainline_status_exists", false, "missing");
} else {
  try {
    const m = readJson("dashboard/mainline-publishing-status.json");
    addCheck("mainline_status_phase_6B_preserved", m.phase === "6B", "phase=6B (preserved)");
    addCheck("mainline_status_stats_preserved", m.stats && m.stats.total_packs === 25, "stats.total_packs=25 (preserved)");
    addCheck("mainline_status_has_6c_section", m.publishing_readiness_review && m.publishing_readiness_review.phase === "6C", "publishing_readiness_review.phase=6C");
    addCheck("mainline_status_has_6d_section", m.x_human_review_pack && m.x_human_review_pack.phase === "6D", "x_human_review_pack.phase=6D");
    addCheck("mainline_status_has_6d1_section", m.x_manual_review_board && m.x_manual_review_board.phase === "6D-1", "x_manual_review_board.phase=6D-1");
    addCheck("mainline_status_has_6d2_section", m.x_human_review_decision_sheet && m.x_human_review_decision_sheet.phase === "6D-2", "x_human_review_decision_sheet.phase=6D-2");
    addCheck("mainline_status_6d2_total_5", m.x_human_review_decision_sheet && m.x_human_review_decision_sheet.total_items === 5, "6D-2 total_items=5");
  } catch (e: any) {
    addCheck("mainline_status_valid", false, "parse error: " + e.message);
  }
}

// 6. Pattern scan on all new files
const allNewFiles = [
  "dashboard/x-human-review-decision-sheet.json",
  "scripts/validate-x-human-review-decision-sheet.ts",
];
for (const f of allNewFiles) {
  if (!exists(f)) continue;
  const content = readText(f);
  for (const p of TOKEN_PATTERNS) {
    addCheck(`no_token_${path.basename(f)}`, !p.test(content), `no token pattern ${p}`);
  }
  for (const p of X_API_PATTERNS) {
    addCheck(`no_x_api_${path.basename(f)}`, !p.test(content), `no X API pattern ${p}`);
  }
  for (const p of BAOYU_POST_PATTERNS) {
    addCheck(`no_baoyu_${path.basename(f)}`, !p.test(content), `no baoyu-post-to-x pattern ${p}`);
  }
  for (const p of MODEL_CALL_PATTERNS) {
    addCheck(`no_model_call_${path.basename(f)}`, !p.test(content), `no model call pattern ${p}`);
  }
  for (const p of MEDIA_GEN_PATTERNS) {
    addCheck(`no_media_gen_${path.basename(f)}`, !p.test(content), `no media gen pattern ${p}`);
  }
  if (f !== "scripts/validate-x-human-review-decision-sheet.ts") {
    for (const p of AUTO_PUBLISH_PATTERNS) {
      addCheck(`no_auto_publish_${path.basename(f)}`, !p.test(content), `no auto-publish pattern ${p}`);
    }
  }
}

const assetsNewFiles = [
  "publishing/review/x/phase-6d/decision-sheet.json",
  "publishing/review/x/phase-6d/decision-sheet.md",
];
for (const f of assetsNewFiles) {
  if (!exists(f, ASSETS)) continue;
  const content = readText(f, ASSETS);
  for (const p of TOKEN_PATTERNS) {
    addCheck(`assets_no_token_${path.basename(f)}`, !p.test(content), `no token pattern ${p}`);
  }
  for (const p of X_API_PATTERNS) {
    addCheck(`assets_no_x_api_${path.basename(f)}`, !p.test(content), `no X API pattern ${p}`);
  }
  for (const p of BAOYU_POST_PATTERNS) {
    addCheck(`assets_no_baoyu_${path.basename(f)}`, !p.test(content), `no baoyu-post-to-x pattern ${p}`);
  }
  for (const p of AUTO_PUBLISH_PATTERNS) {
    addCheck(`assets_no_auto_publish_${path.basename(f)}`, !p.test(content), `no auto-publish pattern ${p}`);
  }
}

// scan decision cards
const cardsDir2 = path.join(ASSETS, "publishing/review/x/phase-6d/decision-cards");
if (fs.existsSync(cardsDir2)) {
  for (const card of fs.readdirSync(cardsDir2).filter(f => f.endsWith(".md"))) {
    const content = fs.readFileSync(path.join(cardsDir2, card), "utf-8");
    for (const p of TOKEN_PATTERNS) {
      addCheck(`card_no_token_${card}`, !p.test(content), `no token in ${card}`);
    }
    for (const p of X_API_PATTERNS) {
      addCheck(`card_no_x_api_${card}`, !p.test(content), `no X API in ${card}`);
    }
    for (const p of BAOYU_POST_PATTERNS) {
      addCheck(`card_no_baoyu_${card}`, !p.test(content), `no baoyu-post-to-x in ${card}`);
    }
  }
}

const passed = checks.filter(c => c.met).length;
const failed = checks.filter(c => !c.met);
const total = checks.length;

console.log("=== Phase 6D-2 X Human Review Decision Sheet Validation ===");
console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed.length}`);
console.log("");
if (failed.length > 0) {
  console.log("FAILED CHECKS:");
  for (const c of failed) {
    console.log(`  ❌ ${c.id}: ${c.message}`);
  }
  console.log("");
  console.log("STATUS: FAIL");
  process.exit(1);
} else {
  console.log("All checks passed.");
  console.log("");
  console.log("STATUS: PASS");
  process.exit(0);
}
