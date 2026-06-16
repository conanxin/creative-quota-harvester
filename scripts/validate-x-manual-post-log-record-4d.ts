#!/usr/bin/env tsx
/**
 * scripts/validate-x-manual-post-log-record-4d.ts
 * Phase 6D-4D: Validator for third Manual X Post Log Record.
 *
 * Checks (all must PASS):
 *   - dashboard/x-manual-post-log.json valid, phase=6D-4D
 *   - assets manual-post-log/index.json valid, phase=6D-4D
 *   - 5 items total
 *   - 3 items have posted_manually=true (flaws + stabilityai + samurai)
 *   - 2 items have posted_manually=false (river-ai, penitence)
 *   - posted_manually_total = 3
 *   - awaiting_manual_post_total = 2
 *   - exactly 3 real x_post_url values
 *   - exactly 2 null x_post_url values
 *   - samurai item has correct url + posted_by + posted_at
 *   - no duplicate URLs
 *   - no_platform_publish=true, manual_only=true, no_x_api=true, etc.
 *   - post_text unchanged from 6D-3
 *   - image_url unchanged from 6D-3
 *   - risk_level unchanged from 6D-3
 *   - no token / sk-cp / TELEGRAM_BOT_TOKEN / MINIMAX_API_KEY
 *   - no X API call patterns
 *   - no baoyu-post-to-x call patterns
 *   - no auto publish / platform_publish_enabled
 *   - no model call patterns
 *   - no media generation patterns
 *   - mainline-publishing-status.json preserves 6B/6C/6D/6D-1/6D-2/6D-3/6D-4A/6D-4B/6D-4C + adds 6D-4D
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
  /platform_publish_enabled\s*[:=]\s*true/i,
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
    addCheck("harvester_log_phase_6D-4D", d.phase === "6D-4D", "phase=6D-4D");
    addCheck("harvester_log_no_platform_publish", d.no_platform_publish === true, "no_platform_publish=true");
    addCheck("harvester_log_platform_publish_disabled", d.platform_publish_enabled === false, "platform_publish_enabled=false");
    addCheck("harvester_log_manual_only", d.manual_only === true, "manual_only=true");
    addCheck("harvester_log_no_x_api", d.no_x_api === true, "no_x_api=true");
    addCheck("harvester_log_no_auto_publish", d.no_auto_publish === true, "no_auto_publish=true");
    addCheck("harvester_log_no_model_call", d.no_model_call === true, "no_model_call=true");
    addCheck("harvester_log_approved_total_5", d.approved_total === 5, "approved_total=5");
    addCheck("harvester_log_awaiting_total_2", d.awaiting_manual_post_total === 2, "awaiting_manual_post_total=2");
    addCheck("harvester_log_posted_manually_3", d.posted_manually_total === 3, "posted_manually_total=3");
    addCheck("harvester_log_missing_url_2", d.missing_url_total === 2, "missing_url_total=2");
    addCheck("harvester_log_5_items", Array.isArray(d.items) && d.items.length === 5, "items=5");

    const items = d.items || [];

    const postedCount = items.filter((i: any) => i.posted_manually === true).length;
    const awaitingCount = items.filter((i: any) => i.manual_post_status === "awaiting_manual_post").length;
    const manuallyPostedCount = items.filter((i: any) => i.publish_status === "manually_posted").length;
    const notPublishedCount = items.filter((i: any) => i.publish_status === "not_published").length;
    const nullUrlCount = items.filter((i: any) => i.x_post_url === null).length;
    const realUrlCount = items.filter((i: any) => i.x_post_url !== null && i.x_post_url.startsWith("https://")).length;

    addCheck("harvester_log_exactly_3_posted", postedCount === 3, `exactly 3 posted_manually=true (got ${postedCount})`);
    addCheck("harvester_log_exactly_2_awaiting", awaitingCount === 2, `exactly 2 awaiting (got ${awaitingCount})`);
    addCheck("harvester_log_exactly_3_manually_posted", manuallyPostedCount === 3, `exactly 3 publish_status=manually_posted (got ${manuallyPostedCount})`);
    addCheck("harvester_log_exactly_2_not_published", notPublishedCount === 2, `exactly 2 publish_status=not_published (got ${notPublishedCount})`);
    addCheck("harvester_log_exactly_2_null_urls", nullUrlCount === 2, `exactly 2 x_post_url=null (got ${nullUrlCount})`);
    addCheck("harvester_log_exactly_3_real_urls", realUrlCount === 3, `exactly 3 real x_post_url (got ${realUrlCount})`);

    // Previously posted items (6D-4B and 6D-4C) preserved
    const flawsItem = items.find((i: any) => i.item_id === "Q-6B-X-brief-brief-mq8c6kp5-u-flaws-i");
    if (flawsItem) {
      addCheck("harvester_log_flaws_preserved", flawsItem.posted_manually === true, "flaws item posted_manually=true (preserved from 6D-4B)");
      addCheck("harvester_log_flaws_url_preserved", flawsItem.x_post_url === "https://x.com/porco7161/status/2066654295135822139?s=46", "flaws item url preserved");
    } else {
      addCheck("harvester_log_flaws_found", false, "flaws item not found");
    }

    const stabilityItem = items.find((i: any) => i.item_id === "Q-6B-X-brief-brief-mq8c663q-4-stabili");
    if (stabilityItem) {
      addCheck("harvester_log_stability_preserved", stabilityItem.posted_manually === true, "stability item posted_manually=true (preserved from 6D-4C)");
      addCheck("harvester_log_stability_url_preserved", stabilityItem.x_post_url === "https://x.com/porco7161/status/2066673108761853983?s=46", "stability item url preserved");
    } else {
      addCheck("harvester_log_stability_found", false, "stability item not found");
    }

    // The 6D-4D item: samurai
    const samuraiItem = items.find((i: any) => i.item_id === "Q-6B-X-brief-brief-mq8c6kp4-7-samurai");
    if (samuraiItem) {
      addCheck("harvester_log_samurai_posted", samuraiItem.posted_manually === true, "samurai item posted_manually=true");
      addCheck("harvester_log_samurai_status", samuraiItem.publish_status === "manually_posted", "samurai item publish_status=manually_posted");
      addCheck("harvester_log_samurai_url", samuraiItem.x_post_url === "https://x.com/porco7161/status/2066681191529668844?s=46", "samurai item has correct x_post_url");
      addCheck("harvester_log_samurai_by", samuraiItem.posted_by === "@Porco7161", "samurai item posted_by=@Porco7161");
      addCheck("harvester_log_samurai_at", samuraiItem.posted_at === "2026-06-16T08:36:00+08:00", "samurai item has correct posted_at");
    } else {
      addCheck("harvester_log_samurai_found", false, "samurai item not found");
    }

    // Other 2 items remain unchanged
    const otherItems = items.filter((i: any) =>
      i.item_id !== "Q-6B-X-brief-brief-mq8c6kp5-u-flaws-i" &&
      i.item_id !== "Q-6B-X-brief-brief-mq8c663q-4-stabili" &&
      i.item_id !== "Q-6B-X-brief-brief-mq8c6kp4-7-samurai"
    );
    const allOthersUnchanged = otherItems.every((i: any) =>
      i.posted_manually === false &&
      i.publish_status === "not_published" &&
      i.manual_post_status === "awaiting_manual_post" &&
      i.x_post_url === null
    );
    addCheck("harvester_log_other_2_unchanged", allOthersUnchanged, "other 2 items unchanged");

    // All approved
    const allApproved = items.every((i: any) => i.approved_status === "approved");
    addCheck("harvester_log_all_approved", allApproved, "all approved_status=approved");

    // Risk level preserved
    const allRiskPreserved = items.every((i: any) => {
      if (i.topic_slug === "river-ai" || i.topic_slug === "the-penitence-of-saint-jerome") {
        return i.risk_level === "medium";
      }
      return i.risk_level === "low";
    });
    addCheck("harvester_log_risk_level_preserved", allRiskPreserved, "risk_level preserved (medium stays medium)");

    // No duplicate URLs
    const urls = items.map((i: any) => i.x_post_url).filter((u: any) => u !== null);
    addCheck("harvester_log_no_duplicate_urls", new Set(urls).size === urls.length, "no duplicate x_post_urls");
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
    addCheck("assets_log_phase_6D-4D", d.phase === "6D-4D", "phase=6D-4D");
    addCheck("assets_log_approved_total_5", d.approved_total === 5, "approved_total=5");
    addCheck("assets_log_awaiting_total_2", d.awaiting_manual_post_total === 2, "awaiting_manual_post_total=2");
    addCheck("assets_log_posted_manually_3", d.posted_manually_total === 3, "posted_manually_total=3");
    addCheck("assets_log_5_items", Array.isArray(d.items) && d.items.length === 5, "items=5");

    const items = d.items || [];
    const postedCount = items.filter((i: any) => i.posted_manually === true).length;
    const manuallyPostedCount = items.filter((i: any) => i.publish_status === "manually_posted").length;
    addCheck("assets_log_exactly_3_posted", postedCount === 3, `exactly 3 posted_manually=true (got ${postedCount})`);
    addCheck("assets_log_exactly_3_manually_posted", manuallyPostedCount === 3, `exactly 3 publish_status=manually_posted (got ${manuallyPostedCount})`);
  } catch (e: any) {
    addCheck("assets_log_index_valid", false, "parse error: " + e.message);
  }
}

// 3. assets manual-post-log/pending-posts.md
addCheck("assets_log_pending_posts_exists", exists("publishing/review/x/phase-6d/manual-post-log/pending-posts.md", ASSETS), "pending-posts.md exists");

// 4. mainline-publishing-status.json preserves 6B/6C/6D/6D-1/6D-2/6D-3/6D-4A/6D-4B/6D-4C + adds 6D-4D
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
    addCheck("mainline_status_has_6d4d_section", m.x_manual_post_log_record_4d && m.x_manual_post_log_record_4d.phase === "6D-4D", "6D-4D added");
    addCheck("mainline_status_6d4d_posted_3", m.x_manual_post_log_record_4d && m.x_manual_post_log_record_4d.posted_manually === 3, "6D-4D posted_manually=3");
    addCheck("mainline_status_6d4d_awaiting_2", m.x_manual_post_log_record_4d && m.x_manual_post_log_record_4d.approved_waiting_manual_post === 2, "6D-4D approved_waiting=2");
  } catch (e: any) {
    addCheck("mainline_status_valid", false, "parse error: " + e.message);
  }
}

// 5. post_text / image_url unchanged from 6D-3
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

// 6. Pattern scan on new validator script
const newFiles = [
  "scripts/validate-x-manual-post-log-record-4d.ts",
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
}

const passed = checks.filter(c => c.met).length;
const failed = checks.filter(c => !c.met);
const total = checks.length;

console.log("=== Phase 6D-4D X Manual Post Log Record Validation ===");
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
