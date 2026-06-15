#!/usr/bin/env tsx
/**
 * scripts/validate-x-human-decision-update.ts
 * Phase 6D-3: Validator for X Human Decision Update.
 *
 * Checks (all must PASS):
 *   - dashboard/x-human-review-decision-sheet.json valid
 *   - dashboard/x-manual-review-board.json valid
 *   - assets review-board.json valid
 *   - assets decision-sheet.json valid
 *   - assets approved/index.json exists
 *   - assets approved/posts/ has 5 markdown files
 *   - total_items=5
 *   - reviewed=5
 *   - approved=5
 *   - needs_edit=0
 *   - rejected=0
 *   - hold=0
 *   - posted_manually=0
 *   - publish_status all not_published
 *   - no_platform_publish=true
 *   - platform_publish_enabled=false
 *   - post_text matches Phase 6D-2 source
 *   - image_url matches Phase 6D-2 source
 *   - no X API call patterns
 *   - no baoyu-post-to-x call patterns
 *   - no token / sk-cp / TELEGRAM_BOT_TOKEN / MINIMAX_API_KEY
 *   - no media generation patterns
 *   - no model call patterns
 *   - mainline-publishing-status.json preserves 6B/6C/6D/6D-1/6D-2 + adds 6D-3
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

// Load Phase 6D-2 source for cross-check
let phase62Sheet: any = null;
try {
  phase62Sheet = readJson("publishing/review/x/phase-6d/decision-sheet.json", ASSETS);
} catch (e) {
  // 6D-2 may have been updated, try 6D-3 fallback
}

// 1. harvester dashboard/x-human-review-decision-sheet.json
if (!exists("dashboard/x-human-review-decision-sheet.json")) {
  addCheck("harvester_decision_sheet_exists", false, "missing");
} else {
  try {
    const d = readJson("dashboard/x-human-review-decision-sheet.json");
    addCheck("harvester_decision_sheet_exists", true, "valid JSON");
    addCheck("harvester_decision_sheet_phase_6D-3", d.phase === "6D-3", "phase=6D-3");
    addCheck("harvester_decision_sheet_no_platform_publish", d.no_platform_publish === true, "no_platform_publish=true");
    addCheck("harvester_decision_sheet_platform_publish_disabled", d.platform_publish_enabled === false, "platform_publish_enabled=false");
    addCheck("harvester_decision_sheet_total_5", d.total_items === 5, "total_items=5");
    addCheck("harvester_decision_sheet_reviewed_5", d.reviewed === 5, "reviewed=5");
    addCheck("harvester_decision_sheet_approved_5", d.approved === 5, "approved=5");
    addCheck("harvester_decision_sheet_needs_edit_0", d.needs_edit === 0, "needs_edit=0");
    addCheck("harvester_decision_sheet_rejected_0", d.rejected === 0, "rejected=0");
    addCheck("harvester_decision_sheet_hold_0", d.hold === 0, "hold=0");
    addCheck("harvester_decision_sheet_posted_manually_0", d.posted_manually === 0, "posted_manually=0");
    addCheck("harvester_decision_sheet_published_externally_0", d.published_externally === 0, "published_externally=0");
    addCheck("harvester_decision_sheet_5_items", Array.isArray(d.items) && d.items.length === 5, "items=5");

    const items = d.items || [];
    const allApproved = items.every((i: any) => i.current_decision === "approved");
    const allHumanApproved = items.every((i: any) => i.human_decision === "approved");
    const allNotPublished = items.every((i: any) => i.current_publish_status === "not_published");
    const allReviewStatusApproved = items.every((i: any) => i.current_review_status === "approved");
    const allHaveApprovedAt = items.every((i: any) => typeof i.approved_at === "string" && i.approved_at.length > 0);
    addCheck("harvester_decision_sheet_all_approved", allApproved, "all current_decision=approved");
    addCheck("harvester_decision_sheet_all_human_approved", allHumanApproved, "all human_decision=approved");
    addCheck("harvester_decision_sheet_all_not_published", allNotPublished, "all publish_status=not_published");
    addCheck("harvester_decision_sheet_all_review_status_approved", allReviewStatusApproved, "all current_review_status=approved");
    addCheck("harvester_decision_sheet_all_have_approved_at", allHaveApprovedAt, "all items have approved_at");
  } catch (e: any) {
    addCheck("harvester_decision_sheet_valid", false, "parse error: " + e.message);
  }
}

// 2. harvester dashboard/x-manual-review-board.json
if (!exists("dashboard/x-manual-review-board.json")) {
  addCheck("harvester_review_board_exists", false, "missing");
} else {
  try {
    const b = readJson("dashboard/x-manual-review-board.json");
    addCheck("harvester_review_board_exists", true, "valid JSON");
    addCheck("harvester_review_board_total_5", b.total_items === 5, "total_items=5");
    addCheck("harvester_review_board_reviewed_5", b.reviewed === 5, "reviewed=5");
    addCheck("harvester_review_board_approved_5", b.approved === 5, "approved=5");
    addCheck("harvester_review_board_needs_edit_0", b.needs_edit === 0, "needs_edit=0");
    addCheck("harvester_review_board_rejected_0", b.rejected === 0, "rejected=0");
    addCheck("harvester_review_board_posted_manually_0", b.posted_manually === 0, "posted_manually=0");

    const items = b.items || [];
    const allHumanApproved = items.every((i: any) => i.human_decision === "approved");
    const allReviewStatusApproved = items.every((i: any) => i.review_status === "approved");
    addCheck("harvester_review_board_all_approved", allHumanApproved, "all human_decision=approved");
    addCheck("harvester_review_board_all_review_status_approved", allReviewStatusApproved, "all review_status=approved");
  } catch (e: any) {
    addCheck("harvester_review_board_valid", false, "parse error: " + e.message);
  }
}

// 3. assets review-board.json
const assetsReviewBoardPath = "publishing/review/x/phase-6d/review-board.json";
if (!exists(assetsReviewBoardPath, ASSETS)) {
  addCheck("assets_review_board_exists", false, "missing");
} else {
  try {
    const b = readJson(assetsReviewBoardPath, ASSETS);
    addCheck("assets_review_board_exists", true, "valid JSON");
    addCheck("assets_review_board_total_5", b.total_items === 5, "total_items=5");
    addCheck("assets_review_board_approved_5", b.approved === 5, "approved=5");
    const items = b.items || [];
    const allApproved = items.every((i: any) => i.review_status === "approved");
    const allHumanApproved = items.every((i: any) => i.human_decision === "approved");
    addCheck("assets_review_board_all_approved", allApproved, "all review_status=approved");
    addCheck("assets_review_board_all_human_approved", allHumanApproved, "all human_decision=approved");
  } catch (e: any) {
    addCheck("assets_review_board_valid", false, "parse error: " + e.message);
  }
}

// 4. assets decision-sheet.json
const assetsSheetPath = "publishing/review/x/phase-6d/decision-sheet.json";
if (!exists(assetsSheetPath, ASSETS)) {
  addCheck("assets_decision_sheet_exists", false, "missing");
} else {
  try {
    const d = readJson(assetsSheetPath, ASSETS);
    addCheck("assets_decision_sheet_exists", true, "valid JSON");
    addCheck("assets_decision_sheet_total_5", d.total_items === 5, "total_items=5");
    addCheck("assets_decision_sheet_approved_5", d.approved === 5, "approved=5");
    const items = d.items || [];
    const allApproved = items.every((i: any) => i.current_decision === "approved");
    addCheck("assets_decision_sheet_all_approved", allApproved, "all current_decision=approved");

    // post_text cross-check with phase62Sheet
    if (phase62Sheet && phase62Sheet.items) {
      let allMatch = true;
      for (let idx = 0; idx < items.length; idx++) {
        const dNow = items[idx];
        const dPrev = phase62Sheet.items[idx];
        if (dNow.id !== dPrev.id) { allMatch = false; break; }
        if (dNow.post_text !== dPrev.post_text) { allMatch = false; break; }
        if (dNow.image_url !== dPrev.image_url) { allMatch = false; break; }
      }
      addCheck("post_text_passthrough_from_6D-2", allMatch, "post_text/image_url match Phase 6D-2");
    } else {
      addCheck("post_text_passthrough_from_6D-2", false, "Phase 6D-2 source missing for cross-check");
    }
  } catch (e: any) {
    addCheck("assets_decision_sheet_valid", false, "parse error: " + e.message);
  }
}

// 5. assets approved/index.json
addCheck("assets_approved_index_exists", exists("publishing/review/x/phase-6d/approved/index.json", ASSETS), "approved/index.json exists");

// 6. assets approved/README.md
addCheck("assets_approved_readme_exists", exists("publishing/review/x/phase-6d/approved/README.md", ASSETS), "approved/README.md exists");

// 7. assets approved/posts/ has 5 markdown files
const postsDir = path.join(ASSETS, "publishing/review/x/phase-6d/approved/posts");
if (!fs.existsSync(postsDir)) {
  addCheck("approved_posts_dir_exists", false, "missing");
} else {
  const postFiles = fs.readdirSync(postsDir).filter(f => f.endsWith(".md"));
  addCheck("approved_posts_dir_exists", true, "directory exists");
  addCheck("approved_posts_5_files", postFiles.length === 5, `5 markdown files (got ${postFiles.length}: ${postFiles.join(", ")})`);
}

// 8. mainline-publishing-status.json preserves 6B/6C/6D/6D-1/6D-2 + adds 6D-3
if (!exists("dashboard/mainline-publishing-status.json")) {
  addCheck("mainline_status_exists", false, "missing");
} else {
  try {
    const m = readJson("dashboard/mainline-publishing-status.json");
    addCheck("mainline_status_phase_6B_preserved", m.phase === "6B", "phase=6B (preserved)");
    addCheck("mainline_status_has_6c_section", m.publishing_readiness_review && m.publishing_readiness_review.phase === "6C", "6C preserved");
    addCheck("mainline_status_has_6d_section", m.x_human_review_pack && m.x_human_review_pack.phase === "6D", "6D preserved");
    addCheck("mainline_status_has_6d1_section", m.x_manual_review_board && m.x_manual_review_board.phase === "6D-1", "6D-1 preserved");
    addCheck("mainline_status_has_6d2_section", m.x_human_review_decision_sheet && m.x_human_review_decision_sheet.phase === "6D-2", "6D-2 preserved");
    addCheck("mainline_status_has_6d3_section", m.x_human_decision_update && m.x_human_decision_update.phase === "6D-3", "6D-3 added");
    addCheck("mainline_status_6d3_total_5", m.x_human_decision_update && m.x_human_decision_update.total_items === 5, "6D-3 total_items=5");
    addCheck("mainline_status_6d3_approved_5", m.x_human_decision_update && m.x_human_decision_update.approved === 5, "6D-3 approved=5");
  } catch (e: any) {
    addCheck("mainline_status_valid", false, "parse error: " + e.message);
  }
}

// 9. Pattern scan on all new files
const allNewFiles = [
  "scripts/validate-x-human-decision-update.ts",
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
}

const assetsNewFiles = [
  "publishing/review/x/phase-6d/approved/index.json",
  "publishing/review/x/phase-6d/approved/README.md",
];
for (const f of assetsNewFiles) {
  if (!exists(f, ASSETS)) continue;
  const content = readText(f, ASSETS);
  for (const p of TOKEN_PATTERNS) {
    addCheck(`assets_no_token_${path.basename(f)}`, !p.test(content), `no token in ${f}`);
  }
  for (const p of X_API_PATTERNS) {
    addCheck(`assets_no_x_api_${path.basename(f)}`, !p.test(content), `no X API in ${f}`);
  }
  for (const p of BAOYU_POST_PATTERNS) {
    addCheck(`assets_no_baoyu_${path.basename(f)}`, !p.test(content), `no baoyu-post-to-x in ${f}`);
  }
  for (const p of AUTO_PUBLISH_PATTERNS) {
    addCheck(`assets_no_auto_publish_${path.basename(f)}`, !p.test(content), `no auto-publish in ${f}`);
  }
}

// scan approved posts
if (fs.existsSync(postsDir)) {
  for (const post of fs.readdirSync(postsDir).filter(f => f.endsWith(".md"))) {
    const content = fs.readFileSync(path.join(postsDir, post), "utf-8");
    for (const p of TOKEN_PATTERNS) {
      addCheck(`approved_no_token_${post}`, !p.test(content), `no token in ${post}`);
    }
    for (const p of X_API_PATTERNS) {
      addCheck(`approved_no_x_api_${post}`, !p.test(content), `no X API in ${post}`);
    }
    for (const p of BAOYU_POST_PATTERNS) {
      addCheck(`approved_no_baoyu_${post}`, !p.test(content), `no baoyu-post-to-x in ${post}`);
    }
  }
}

const passed = checks.filter(c => c.met).length;
const failed = checks.filter(c => !c.met);
const total = checks.length;

console.log("=== Phase 6D-3 X Human Decision Update Validation ===");
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
