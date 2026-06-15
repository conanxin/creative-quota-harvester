#!/usr/bin/env tsx
/**
 * scripts/validate-x-manual-review-board.ts
 * Phase 6D-1: Validator for X Manual Review Board.
 *
 * Checks (all must PASS):
 *   - dashboard/x-manual-review-board.json valid
 *   - assets review-board.json valid
 *   - assets review-board.md exists
 *   - total_items=5
 *   - all items review_status=needs_review
 *   - all items publish_status=not_published
 *   - all items no_platform_publish=true (or global no_platform_publish=true)
 *   - no published_externally=true
 *   - no X API call patterns
 *   - no baoyu-post-to-x call patterns
 *   - no token / sk-cp / TELEGRAM_BOT_TOKEN / MINIMAX_API_KEY
 *   - no media generation patterns
 *   - no model call patterns
 *   - mainline-publishing-status.json preserves 6B + 6C + adds 6D-1 section
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

// TOKEN_PATTERNS: flag actual secret=*** assignments
const TOKEN_PATTERNS = [
  /sk-cp-[A-Za-z0-9_-]{10,}/,
  /TELEGRAM_BOT_TOKEN\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /MINIMAX_API_KEY\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /CQA_CONTROL_TOKEN\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /OPENAI_API_KEY\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /X_BEARER_TOKEN\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /AIza[A-Za-z0-9_-]{20,}/,
];
// X_API_PATTERNS: flag actual HTTP API calls
const X_API_PATTERNS = [
  /https?:\/\/(api\.twitter\.com|api\.x\.com)/i,
  /bearer\s+[A-Za-z0-9_-]{20,}/,
];
// BAOYU_POST_PATTERNS: flag actual function calls or shell invocations
const BAOYU_POST_PATTERNS = [
  /\bbaoyu[-_]post[-_]to[-_]x\s*\(/i,
  /\bspawn\s+.*baoyu[-_]post[-_]to[-_]x/i,
  /exec\s*\(\s*['"`].*baoyu[-_]post[-_]to[-_]x/i,
];
// MODEL_CALL_PATTERNS: flag actual function call invocations
const MODEL_CALL_PATTERNS = [
  /\bcompletion\s*\(\s*{/,
  /\blitellm\.(completion|transcription|image_generation|video_generation|music_generation)\s*\(/i,
  /\bopenai\.ChatCompletion\.(create|with\w+)\s*\(/i,
  /\bminimax\.(text|image|video|music)\s*\([^{]/i,
];
// MEDIA_GEN_PATTERNS: flag actual function calls or exec invocations
const MEDIA_GEN_PATTERNS = [
  /\bimage_generate\s*\(\s*{/,
  /\bvideo_generate\s*\(\s*{/,
  /\bmusic_generate\s*\(\s*{/,
  /exec\s*\(\s*['"].*generate:image/i,
];
// AUTO_PUBLISH_PATTERNS: flag actual published=true (not no_platform_publish field names)
const AUTO_PUBLISH_PATTERNS = [
  /\bpublished\s*[:=]\s*true\b/i,
  /\bpublished_externally\s*[:=]\s*true\b/i,
];

// 1. harvester dashboard/x-manual-review-board.json
if (!exists("dashboard/x-manual-review-board.json")) {
  addCheck("harvester_board_exists", false, "missing");
} else {
  try {
    const b = readJson("dashboard/x-manual-review-board.json");
    addCheck("harvester_board_exists", true, "valid JSON");
    addCheck("harvester_board_phase_6D-1", b.phase === "6D-1", "phase=6D-1");
    addCheck("harvester_board_no_platform_publish", b.no_platform_publish === true, "no_platform_publish=true");
    addCheck("harvester_board_platform_publish_disabled", b.platform_publish_enabled === false, "platform_publish_enabled=false");
    addCheck("harvester_board_total_5", b.total_items === 5, "total_items=5");
    addCheck("harvester_board_reviewed_0", b.reviewed === 0, "reviewed=0");
    addCheck("harvester_board_approved_0", b.approved === 0, "approved=0");
    addCheck("harvester_board_needs_edit_0", b.needs_edit === 0, "needs_edit=0");
    addCheck("harvester_board_rejected_0", b.rejected === 0, "rejected=0");
    addCheck("harvester_board_posted_manually_0", b.posted_manually === 0, "posted_manually=0");
    addCheck("harvester_board_5_items", Array.isArray(b.items) && b.items.length === 5, "items=5");

    const items = b.items || [];
    const itemsNeedsReview = items.every((i: any) => i.review_status === "needs_review");
    const itemsNotPublished = items.every((i: any) => i.publish_status === "not_published");
    const itemsNoPlatformPublish = items.every((i: any) => i.no_platform_publish === true);
    const itemsHaveFields = items.every((i: any) =>
      i.id && i.title && i.source_type && i.topic_slug && i.post_text && i.image_url && i.gallery_url && i.review_file && i.checklist
    );
    const itemsHumanDecisionPending = items.every((i: any) => i.human_decision === "pending");
    addCheck("harvester_board_all_needs_review", itemsNeedsReview, "all review_status=needs_review");
    addCheck("harvester_board_all_not_published", itemsNotPublished, "all publish_status=not_published");
    addCheck("harvester_board_all_no_publish", itemsNoPlatformPublish, "all no_platform_publish=true");
    addCheck("harvester_board_all_have_fields", itemsHaveFields, "all have id/title/source_type/topic_slug/post_text/image_url/gallery_url/review_file/checklist");
    addCheck("harvester_board_all_decision_pending", itemsHumanDecisionPending, "all human_decision=pending");
  } catch (e: any) {
    addCheck("harvester_board_valid", false, "parse error: " + e.message);
  }
}

// 2. assets review-board.json
const assetsBoardPath = "publishing/review/x/phase-6d/review-board.json";
if (!exists(assetsBoardPath, ASSETS)) {
  addCheck("assets_board_json_exists", false, "missing");
} else {
  try {
    const b = readJson(assetsBoardPath, ASSETS);
    addCheck("assets_board_json_exists", true, "valid JSON");
    addCheck("assets_board_phase_6D-1", b.phase === "6D-1", "phase=6D-1");
    addCheck("assets_board_no_platform_publish", b.no_platform_publish === true, "no_platform_publish=true");
    addCheck("assets_board_total_5", b.total_items === 5, "total_items=5");
    addCheck("assets_board_5_items", Array.isArray(b.items) && b.items.length === 5, "items=5");
    const items = b.items || [];
    const itemsNeedsReview = items.every((i: any) => i.review_status === "needs_review");
    const itemsNotPublished = items.every((i: any) => i.publish_status === "not_published");
    addCheck("assets_board_all_needs_review", itemsNeedsReview, "all review_status=needs_review");
    addCheck("assets_board_all_not_published", itemsNotPublished, "all publish_status=not_published");
  } catch (e: any) {
    addCheck("assets_board_json_valid", false, "parse error: " + e.message);
  }
}

// 3. assets review-board.md
const assetsBoardMdPath = "publishing/review/x/phase-6d/review-board.md";
addCheck("assets_board_md_exists", exists(assetsBoardMdPath, ASSETS), "review-board.md exists");

// 4. mainline-publishing-status.json preserves 6B/6C fields and adds 6D-1 section
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
    addCheck("mainline_status_6d1_total_5", m.x_manual_review_board && m.x_manual_review_board.total_items === 5, "6D-1 total_items=5");
  } catch (e: any) {
    addCheck("mainline_status_valid", false, "parse error: " + e.message);
  }
}

// 5. Pattern scan on all new files
const allNewFiles = [
  "dashboard/x-manual-review-board.json",
  "scripts/validate-x-manual-review-board.ts",
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
  // Skip validator script itself for auto-publish check
  if (f !== "scripts/validate-x-manual-review-board.ts") {
    for (const p of AUTO_PUBLISH_PATTERNS) {
      addCheck(`no_auto_publish_${path.basename(f)}`, !p.test(content), `no auto-publish pattern ${p}`);
    }
  }
}

const assetsNewFiles = [
  "publishing/review/x/phase-6d/review-board.json",
  "publishing/review/x/phase-6d/review-board.md",
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

// Summary
const passed = checks.filter(c => c.met).length;
const failed = checks.filter(c => !c.met);
const total = checks.length;

console.log("=== Phase 6D-1 X Manual Review Board Validation ===");
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
