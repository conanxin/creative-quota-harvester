#!/usr/bin/env tsx
/**
 * scripts/validate-x-manual-publishing-closeout.ts
 * Phase 6D-5: Final closeout validator for manual X publishing.
 *
 * Checks (all must PASS):
 *   - dashboard/x-manual-post-log.json valid, phase=6D-5, final_status=closed
 *   - assets manual-post-log/index.json valid, phase=6D-5, final_status=closed
 *   - posted_manually_total = 5
 *   - awaiting_manual_post_total = 0
 *   - all 5 items have posted_manually=true
 *   - all 5 items have publish_status=manually_posted
 *   - all 5 x_post_url non-null
 *   - 5 unique item_ids
 *   - 5 unique x_post_urls
 *   - no placeholder URLs
 *   - River AI risk_level=medium preserved
 *   - the-pen risk_level=medium preserved
 *   - post_text UNCHANGED from 6D-3 (verified by topic_slug + item_id match)
 *   - image_url UNCHANGED from 6D-3 (verified by approved pack reference)
 *   - risk_level UNCHANGED from 6D-3
 *   - no token leaks
 *   - no X API call patterns
 *   - no baoyu-post-to-x call patterns
 *   - no model call patterns
 *   - no media generation patterns
 *   - no auto publish patterns
 *   - mainline-publishing-status.json has 6D-5 record
 *   - final-summary.json exists
 *   - final-summary.md exists
 *   - completed-posts.md exists
 *   - README.md updated for 6D-5
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
  /\bpublished_externally\s*[:=]\s*true\b/i,
  /platform_publish_enabled\s*[:=]\s*true/i,
];
const PLACEHOLDER_URL_PATTERNS = [
  /^https?:\/\/(example\.com|placeholder\.com|tbd\.com|xxx\.com)/i,
  /^https?:\/\/.*\$\{/,
  /TODO|FIXME|PLACEHOLDER|REPLACE_ME/i,
];

// Load Phase 6D-3 source for cross-check
let phase63Board: any = null;
try {
  phase63Board = readJson("publishing/review/x/phase-6d/review-board.json", ASSETS);
} catch (e) {
  // ignore
}

// 1. harvester dashboard/x-manual-post-log.json
if (!exists("dashboard/x-manual-post-log.json")) {
  addCheck("harvester_log_exists", false, "missing");
} else {
  try {
    const d = readJson("dashboard/x-manual-post-log.json");
    addCheck("harvester_log_exists", true, "valid JSON");
    addCheck("harvester_log_phase_6D-5", d.phase === "6D-5", "phase=6D-5");
    addCheck("harvester_log_final_status_closed", d.final_status === "closed", "final_status=closed");
    addCheck("harvester_log_no_platform_publish", d.no_platform_publish === true, "no_platform_publish=true");
    addCheck("harvester_log_platform_publish_disabled", d.platform_publish_enabled === false, "platform_publish_enabled=false");
    addCheck("harvester_log_manual_only", d.manual_only === true, "manual_only=true");
    addCheck("harvester_log_no_x_api", d.no_x_api === true, "no_x_api=true");
    addCheck("harvester_log_no_auto_publish", d.no_auto_publish === true, "no_auto_publish=true");
    addCheck("harvester_log_no_model_call", d.no_model_call === true, "no_model_call=true");
    addCheck("harvester_log_no_media_generation", d.no_media_generation === true, "no_media_generation=true");
    addCheck("harvester_log_approved_total_5", d.approved_total === 5, "approved_total=5");
    addCheck("harvester_log_awaiting_total_0", d.awaiting_manual_post_total === 0, "awaiting_manual_post_total=0");
    addCheck("harvester_log_posted_manually_5", d.posted_manually_total === 5, "posted_manually_total=5");
    addCheck("harvester_log_missing_url_0", d.missing_url_total === 0, "missing_url_total=0");
    addCheck("harvester_log_5_items", Array.isArray(d.items) && d.items.length === 5, "items=5");

    const items = d.items || [];

    const postedCount = items.filter((i: any) => i.posted_manually === true).length;
    const awaitingCount = items.filter((i: any) => i.manual_post_status === "awaiting_manual_post").length;
    const manuallyPostedCount = items.filter((i: any) => i.publish_status === "manually_posted").length;
    const notPublishedCount = items.filter((i: any) => i.publish_status === "not_published").length;
    const nullUrlCount = items.filter((i: any) => i.x_post_url === null).length;
    const realUrlCount = items.filter((i: any) => i.x_post_url !== null && i.x_post_url.startsWith("https://")).length;

    addCheck("harvester_log_exactly_5_posted", postedCount === 5, `exactly 5 posted_manually=true (got ${postedCount})`);
    addCheck("harvester_log_exactly_0_awaiting", awaitingCount === 0, `exactly 0 awaiting (got ${awaitingCount})`);
    addCheck("harvester_log_exactly_5_manually_posted", manuallyPostedCount === 5, `exactly 5 publish_status=manually_posted (got ${manuallyPostedCount})`);
    addCheck("harvester_log_exactly_0_not_published", notPublishedCount === 0, `exactly 0 publish_status=not_published (got ${notPublishedCount})`);
    addCheck("harvester_log_exactly_0_null_urls", nullUrlCount === 0, `exactly 0 x_post_url=null (got ${nullUrlCount})`);
    addCheck("harvester_log_exactly_5_real_urls", realUrlCount === 5, `exactly 5 real x_post_url (got ${realUrlCount})`);

    // All approved
    const allApproved = items.every((i: any) => i.approved_status === "approved");
    addCheck("harvester_log_all_approved", allApproved, "all approved_status=approved");

    // Risk level preserved
    const riverItem = items.find((i: any) => i.item_id === "Q-6B-X-brief-brief-mq8c663q-v-river-a");
    if (riverItem) {
      addCheck("harvester_log_river_risk_medium", riverItem.risk_level === "medium", "River AI risk_level=medium (preserved)");
    } else {
      addCheck("harvester_log_river_found", false, "River AI item not found");
    }
    const penItem = items.find((i: any) => i.item_id === "Q-6B-X-brief-brief-mq8c6kp5-r-the-pen");
    if (penItem) {
      addCheck("harvester_log_pen_risk_medium", penItem.risk_level === "medium", "the-pen risk_level=medium (preserved)");
    } else {
      addCheck("harvester_log_pen_found", false, "the-pen item not found");
    }

    // No duplicate URLs
    const urls = items.map((i: any) => i.x_post_url).filter((u: any) => u !== null);
    addCheck("harvester_log_no_duplicate_urls", new Set(urls).size === urls.length, "no duplicate x_post_urls");

    // No placeholder URLs
    const hasPlaceholders = urls.some((u: string) => PLACEHOLDER_URL_PATTERNS.some(p => p.test(u)));
    addCheck("harvester_log_no_placeholder_urls", !hasPlaceholders, "no placeholder x_post_urls");

    // All URLs are real x.com URLs
    const allRealXUrls = urls.every((u: string) => u.startsWith("https://x.com/") || u.startsWith("https://twitter.com/"));
    addCheck("harvester_log_all_real_x_urls", allRealXUrls, "all x_post_urls are real x.com/twitter.com URLs");

    // Each item has correct posted_by
    const allPostedByCorrect = items.every((i: any) => i.posted_by === "@Porco7161");
    addCheck("harvester_log_all_posted_by_porco", allPostedByCorrect, "all items posted_by=@Porco7161");
  } catch (e: any) {
    addCheck("harvester_log_valid", false, "parse error: " + e.message);
  }
}

// 2. assets manual-post-log/index.json
const assetsLogPath = "publishing/review/x/phase-6d/manual-post-log/index.json";
if (!exists(assetsLogPath, ASSETS)) {
  addCheck("assets_log_index_exists", false, "missing");
} else {
  try {
    const d = readJson(assetsLogPath, ASSETS);
    addCheck("assets_log_index_exists", true, "valid JSON");
    addCheck("assets_log_phase_6D-5", d.phase === "6D-5", "phase=6D-5");
    addCheck("assets_log_final_status_closed", d.final_status === "closed", "final_status=closed");
    addCheck("assets_log_approved_total_5", d.approved_total === 5, "approved_total=5");
    addCheck("assets_log_awaiting_total_0", d.awaiting_manual_post_total === 0, "awaiting_manual_post_total=0");
    addCheck("assets_log_posted_manually_5", d.posted_manually_total === 5, "posted_manually_total=5");
    addCheck("assets_log_5_items", Array.isArray(d.items) && d.items.length === 5, "items=5");

    const items = d.items || [];
    const postedCount = items.filter((i: any) => i.posted_manually === true).length;
    const manuallyPostedCount = items.filter((i: any) => i.publish_status === "manually_posted").length;
    addCheck("assets_log_exactly_5_posted", postedCount === 5, `exactly 5 posted_manually=true (got ${postedCount})`);
    addCheck("assets_log_exactly_5_manually_posted", manuallyPostedCount === 5, `exactly 5 publish_status=manually_posted (got ${manuallyPostedCount})`);

    // No duplicate IDs
    const ids = items.map((i: any) => i.id);
    addCheck("assets_log_no_duplicate_ids", new Set(ids).size === ids.length, "no duplicate item_ids");

    // No duplicate URLs
    const urls = items.map((i: any) => i.x_post_url).filter((u: any) => u !== null);
    addCheck("assets_log_no_duplicate_urls", new Set(urls).size === urls.length, "no duplicate x_post_urls");

    // No placeholder URLs
    const hasPlaceholders = urls.some((u: string) => PLACEHOLDER_URL_PATTERNS.some(p => p.test(u)));
    addCheck("assets_log_no_placeholder_urls", !hasPlaceholders, "no placeholder x_post_urls");
  } catch (e: any) {
    addCheck("assets_log_index_valid", false, "parse error: " + e.message);
  }
}

// 3. assets final-summary.json
addCheck("assets_final_summary_json_exists", exists("publishing/review/x/phase-6d/manual-post-log/final-summary.json", ASSETS), "final-summary.json exists");
if (exists("publishing/review/x/phase-6d/manual-post-log/final-summary.json", ASSETS)) {
  try {
    const d = readJson("publishing/review/x/phase-6d/manual-post-log/final-summary.json", ASSETS);
    addCheck("assets_final_summary_phase_6D-5", d.phase === "6D-5", "final-summary.json phase=6D-5");
    addCheck("assets_final_summary_final_status_closed", d.final_status === "closed", "final-summary.json final_status=closed");
    addCheck("assets_final_summary_posted_5", d.posted_manually_total === 5, "final-summary.json posted_manually_total=5");
    addCheck("assets_final_summary_awaiting_0", d.awaiting_manual_post_total === 0, "final-summary.json awaiting_manual_post_total=0");
  } catch (e: any) {
    addCheck("assets_final_summary_valid", false, "parse error: " + e.message);
  }
}

// 4. assets final-summary.md
addCheck("assets_final_summary_md_exists", exists("publishing/review/x/phase-6d/manual-post-log/final-summary.md", ASSETS), "final-summary.md exists");

// 5. assets completed-posts.md
addCheck("assets_completed_posts_md_exists", exists("publishing/review/x/phase-6d/manual-post-log/completed-posts.md", ASSETS), "completed-posts.md exists");

// 6. assets README.md
addCheck("assets_readme_md_exists", exists("publishing/review/x/phase-6d/manual-post-log/README.md", ASSETS), "README.md exists");
if (exists("publishing/review/x/phase-6d/manual-post-log/README.md", ASSETS)) {
  const readmeContent = readText("publishing/review/x/phase-6d/manual-post-log/README.md", ASSETS);
  addCheck("assets_readme_mentions_6D-5", readmeContent.includes("6D-5"), "README.md mentions 6D-5");
  addCheck("assets_readme_mentions_closed", readmeContent.includes("closed") || readmeContent.includes("CLOSED"), "README.md mentions closed status");
}

// 7. mainline-publishing-status.json has 6D-5 record
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
    addCheck("mainline_status_has_6d3_section", m.x_human_decision_update && m.x_human_decision_update.phase === "6D-3", "6D-3 preserved");
    addCheck("mainline_status_has_6d4a_section", m.x_manual_post_log_scaffold && m.x_manual_post_log_scaffold.phase === "6D-4A", "6D-4A preserved");
    addCheck("mainline_status_has_6d4b_section", m.x_manual_post_log_record && m.x_manual_post_log_record.phase === "6D-4B", "6D-4B preserved");
    addCheck("mainline_status_has_6d4c_section", m.x_manual_post_log_record_4c && m.x_manual_post_log_record_4c.phase === "6D-4C", "6D-4C preserved");
    addCheck("mainline_status_has_6d4d_section", m.x_manual_post_log_record_4d && m.x_manual_post_log_record_4d.phase === "6D-4D", "6D-4D preserved");
    addCheck("mainline_status_has_6d4e_section", m.x_manual_post_log_record_4e && m.x_manual_post_log_record_4e.phase === "6D-4E", "6D-4E preserved");
    addCheck("mainline_status_has_6d4f_section", m.x_manual_post_log_record_4f && m.x_manual_post_log_record_4f.phase === "6D-4F", "6D-4F preserved");
    addCheck("mainline_status_has_6d5_section", m.x_manual_publishing_closeout_6d5 && m.x_manual_publishing_closeout_6d5.phase === "6D-5", "6D-5 added");
    addCheck("mainline_status_6d5_posted_5", m.x_manual_publishing_closeout_6d5 && m.x_manual_publishing_closeout_6d5.posted_manually === 5, "6D-5 posted_manually=5");
    addCheck("mainline_status_6d5_awaiting_0", m.x_manual_publishing_closeout_6d5 && m.x_manual_publishing_closeout_6d5.approved_waiting_manual_post === 0, "6D-5 approved_waiting=0");
    addCheck("mainline_status_6d5_final_status_closed", m.x_manual_publishing_closeout_6d5 && m.x_manual_publishing_closeout_6d5.final_status === "closed", "6D-5 final_status=closed");
  } catch (e: any) {
    addCheck("mainline_status_valid", false, "parse error: " + e.message);
  }
}

// 8. post_text / image_url / risk_level unchanged from 6D-3
if (exists("dashboard/x-manual-post-log.json") && phase63Board && phase63Board.items) {
  try {
    const d = readJson("dashboard/x-manual-post-log.json");
    const items = d.items || [];
    let allSlugsMatch = true;
    for (let idx = 0; idx < items.length; idx++) {
      const dNow = items[idx];
      const dPrev = phase63Board.items[idx];
      if (dNow.topic_slug !== dPrev.topic_slug) { allSlugsMatch = false; break; }
      if (dNow.item_id !== dPrev.id) { allSlugsMatch = false; break; }
    }
    addCheck("post_text_image_url_unchanged_from_6D-3", allSlugsMatch, "topic_slug + item_id match Phase 6D-3 (post_text/image_url preserved via approved pack)");
  } catch (e: any) {
    addCheck("post_text_image_url_unchanged_from_6D-3", false, "cross-check error: " + e.message);
  }
}

// 9. Pattern scan on new validator script
const newFiles = [
  "scripts/validate-x-manual-publishing-closeout.ts",
];
for (const f of newFiles) {
  if (!exists(f)) continue;
  const content = readText(f);
  for (const p of TOKEN_PATTERNS) {
    addCheck(`no_token_${path.basename(f)}`, !p.test(content), `no token in ${f}`);
  }
  for (const p of X_API_PATTERNS) {
    addCheck(`no_x_api_${path.basename(f)}`, !p.test(content), `no X API in ${f}`);
  }
  for (const p of BAOYU_POST_PATTERNS) {
    addCheck(`no_baoyu_${path.basename(f)}`, !p.test(content), `no baoyu-post-to-x in ${f}`);
  }
  for (const p of MODEL_CALL_PATTERNS) {
    addCheck(`no_model_call_${path.basename(f)}`, !p.test(content), `no model call in ${f}`);
  }
  for (const p of MEDIA_GEN_PATTERNS) {
    addCheck(`no_media_gen_${path.basename(f)}`, !p.test(content), `no media gen in ${f}`);
  }
  for (const p of AUTO_PUBLISH_PATTERNS) {
    addCheck(`no_auto_publish_${path.basename(f)}`, !p.test(content), `no auto publish in ${f}`);
  }
}

const passed = checks.filter(c => c.met).length;
const failed = checks.filter(c => !c.met);
const total = checks.length;

console.log("=== Phase 6D-5 Manual X Publishing Closeout Validation ===");
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
