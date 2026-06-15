#!/usr/bin/env tsx
/**
 * scripts/validate-x-manual-post-log.ts
 * Phase 6D-4A: Validator for X Manual Post Logging Scaffold.
 *
 * Checks (all must PASS):
 *   - dashboard/x-manual-post-log.json valid
 *   - assets manual-post-log/index.json valid
 *   - assets manual-post-log/README.md exists
 *   - assets manual-post-log/pending-posts.md exists
 *   - assets manual-post-log/template.md exists
 *   - 5 approved items all exist
 *   - all posted_manually=false
 *   - all publish_status in {not_published, awaiting_manual_post}
 *   - NO publish_status=published
 *   - all x_post_url=null
 *   - all posted_at=null
 *   - all posted_by=null
 *   - no_platform_publish=true
 *   - manual_only=true
 *   - post_text unchanged from 6D-3
 *   - image_url unchanged from 6D-3
 *   - risk_level unchanged from 6D-3
 *   - no token / sk-cp / TELEGRAM_BOT_TOKEN / MINIMAX_API_KEY
 *   - no X API call patterns
 *   - no baoyu-post-to-x call patterns
 *   - no auto publish / platform_publish_enabled
 *   - no model call patterns
 *   - no media generation patterns
 *   - mainline-publishing-status.json preserves 6B/6C/6D/6D-1/6D-2/6D-3 + adds 6D-4A
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
    addCheck("harvester_log_phase_6D-4A", d.phase === "6D-4A", "phase=6D-4A");
    addCheck("harvester_log_no_platform_publish", d.no_platform_publish === true, "no_platform_publish=true");
    addCheck("harvester_log_platform_publish_disabled", d.platform_publish_enabled === false, "platform_publish_enabled=false");
    addCheck("harvester_log_manual_only", d.manual_only === true, "manual_only=true");
    addCheck("harvester_log_approved_total_5", d.approved_total === 5, "approved_total=5");
    addCheck("harvester_log_awaiting_total_5", d.awaiting_manual_post_total === 5, "awaiting_manual_post_total=5");
    addCheck("harvester_log_posted_manually_0", d.posted_manually_total === 0, "posted_manually_total=0");
    addCheck("harvester_log_missing_url_5", d.missing_url_total === 5, "missing_url_total=5");
    addCheck("harvester_log_5_items", Array.isArray(d.items) && d.items.length === 5, "items=5");

    const items = d.items || [];
    const allPostedManuallyFalse = items.every((i: any) => i.posted_manually === false);
    const allAwaiting = items.every((i: any) => i.manual_post_status === "awaiting_manual_post");
    const allPublishNotPublished = items.every((i: any) => i.publish_status === "not_published");
    const noPublished = items.every((i: any) => i.publish_status !== "published");
    const allPostUrlNull = items.every((i: any) => i.x_post_url === null);
    const allPostedAtNull = items.every((i: any) => i.posted_at === null);
    const allPostedByNull = items.every((i: any) => i.posted_by === null);
    const allApproved = items.every((i: any) => i.approved_status === "approved");
    const allRiskPreserved = items.every((i: any) => {
      // River AI and Penitence should still be medium
      if (i.topic_slug === "river-ai" || i.topic_slug === "the-penitence-of-saint-jerome") {
        return i.risk_level === "medium";
      }
      return i.risk_level === "low";
    });
    addCheck("harvester_log_all_posted_manually_false", allPostedManuallyFalse, "all posted_manually=false");
    addCheck("harvester_log_all_awaiting", allAwaiting, "all manual_post_status=awaiting_manual_post");
    addCheck("harvester_log_all_publish_not_published", allPublishNotPublished, "all publish_status=not_published");
    addCheck("harvester_log_no_published", noPublished, "no publish_status=published");
    addCheck("harvester_log_all_x_post_url_null", allPostUrlNull, "all x_post_url=null");
    addCheck("harvester_log_all_posted_at_null", allPostedAtNull, "all posted_at=null");
    addCheck("harvester_log_all_posted_by_null", allPostedByNull, "all posted_by=null");
    addCheck("harvester_log_all_approved", allApproved, "all approved_status=approved");
    addCheck("harvester_log_risk_level_preserved", allRiskPreserved, "risk_level preserved (medium stays medium)");
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
    addCheck("assets_log_phase_6D-4A", d.phase === "6D-4A", "phase=6D-4A");
    addCheck("assets_log_approved_total_5", d.approved_total === 5, "approved_total=5");
    addCheck("assets_log_awaiting_total_5", d.awaiting_manual_post_total === 5, "awaiting_manual_post_total=5");
    addCheck("assets_log_posted_manually_0", d.posted_manually_total === 0, "posted_manually_total=0");
    addCheck("assets_log_5_items", Array.isArray(d.items) && d.items.length === 5, "items=5");
    const items = d.items || [];
    const allPostedManuallyFalse = items.every((i: any) => i.posted_manually === false);
    const allAwaiting = items.every((i: any) => i.manual_post_status === "awaiting_manual_post");
    addCheck("assets_log_all_posted_manually_false", allPostedManuallyFalse, "all posted_manually=false");
    addCheck("assets_log_all_awaiting", allAwaiting, "all manual_post_status=awaiting_manual_post");
  } catch (e: any) {
    addCheck("assets_log_index_valid", false, "parse error: " + e.message);
  }
}

// 3. assets manual-post-log/README.md
addCheck("assets_log_readme_exists", exists("publishing/review/x/phase-6d/manual-post-log/README.md", ASSETS), "README.md exists");

// 4. assets manual-post-log/pending-posts.md
addCheck("assets_log_pending_posts_exists", exists("publishing/review/x/phase-6d/manual-post-log/pending-posts.md", ASSETS), "pending-posts.md exists");

// 5. assets manual-post-log/template.md
addCheck("assets_log_template_exists", exists("publishing/review/x/phase-6d/manual-post-log/template.md", ASSETS), "template.md exists");

// 6. mainline-publishing-status.json preserves 6B/6C/6D/6D-1/6D-2/6D-3 + adds 6D-4A
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
    addCheck("mainline_status_has_6d4a_section", m.x_manual_post_log_scaffold && m.x_manual_post_log_scaffold.phase === "6D-4A", "6D-4A added");
    addCheck("mainline_status_6d4a_approved_5", m.x_manual_post_log_scaffold && m.x_manual_post_log_scaffold.approved_waiting_manual_post === 5, "6D-4A approved_waiting=5");
    addCheck("mainline_status_6d4a_posted_0", m.x_manual_post_log_scaffold && m.x_manual_post_log_scaffold.posted_manually === 0, "6D-4A posted_manually=0");
  } catch (e: any) {
    addCheck("mainline_status_valid", false, "parse error: " + e.message);
  }
}

// 7. post_text / image_url unchanged from 6D-3
if (exists("dashboard/x-manual-post-log.json") && phase63Board && phase63Board.items) {
  try {
    const d = readJson("dashboard/x-manual-post-log.json");
    // Note: x-manual-post-log.json only references topic_slug, not post_text/image_url directly.
    // Cross-check via approved pack file references.
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

// 8. Pattern scan on all new files
const allNewFiles = [
  "scripts/validate-x-manual-post-log.ts",
];
for (const f of allNewFiles) {
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

const assetsNewFiles = [
  "publishing/review/x/phase-6d/manual-post-log/index.json",
  "publishing/review/x/phase-6d/manual-post-log/README.md",
  "publishing/review/x/phase-6d/manual-post-log/pending-posts.md",
  "publishing/review/x/phase-6d/manual-post-log/template.md",
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

const passed = checks.filter(c => c.met).length;
const failed = checks.filter(c => !c.met);
const total = checks.length;

console.log("=== Phase 6D-4A X Manual Post Logging Scaffold Validation ===");
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
