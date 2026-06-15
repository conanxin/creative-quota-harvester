#!/usr/bin/env tsx
/**
 * scripts/validate-publishing-readiness.ts
 * Phase 6C: Validator for publishing readiness review & deduped shortlist.
 *
 * Checks (all must PASS):
 *   - dashboard/publishing-readiness-policy.json valid
 *   - dashboard/publishing-readiness-review.json valid
 *   - dashboard/deduped-publishing-shortlist.json valid
 *   - creative-quota-assets/publishing/shortlists/{x-ready,blog,image-generation-candidates}.json exist
 *   - creative-quota-assets/publishing/shortlists/README.md exists
 *   - ready_x_shortlist has exactly 5 items
 *   - blog_shortlist has exactly 5 items
 *   - image_generation_candidates has exactly 5 items
 *   - All 3 shortlists have 5 unique title_slug (no duplicates)
 *   - All 3 shortlists have 5 unique source_type (no duplicates)
 *   - ready_x_shortlist items all have: id, title, source_type, post_text, image_url, gallery_url, why_ready, suggested_manual_review_note, publish_status, no_platform_publish
 *   - All ready_x items: publish_status = "ready_for_human_review"
 *   - All ready_x items: no_platform_publish = true
 *   - All blog items: draft_status set
 *   - All image_generation items: requires_model_call = true, model_call_status = "not_called"
 *   - No token / sk-cp / TELEGRAM_BOT_TOKEN / MINIMAX_API_KEY in any new file
 *   - No X API call patterns in any new file
 *   - No model call patterns in any new file
 *   - No media generation patterns in any new file
 *   - No timer / cron patterns in any new file
 *   - No auto-publish / platform_publish = true
 *   - dashboard/mainline-publishing-status.json preserves 6B fields (phase, stats, etc.)
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

// Patterns we never want to see in Phase 6C files
// TOKEN_PATTERNS: flag actual secret=value assignments (not just pattern description strings)
const TOKEN_PATTERNS = [
  /sk-cp-[A-Za-z0-9_-]{10,}/,
  /TELEGRAM_BOT_TOKEN\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /MINIMAX_API_KEY\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /CQA_CONTROL_TOKEN\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /OPENAI_API_KEY\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /X_BEARER_TOKEN\s*[=:]\s*['"][A-Za-z0-9_-]{10,}/,
  /AIza[A-Za-z0-9_-]{20,}/,
];
// X_API_PATTERNS: flag actual HTTP API calls (not comment strings)
const X_API_PATTERNS = [
  /https?:\/\/(api\.twitter\.com|api\.x\.com)/i,
  /bearer\s+[A-Za-z0-9_-]{20,}/,
];
// MODEL_CALL_PATTERNS: flag actual function call invocations (not comment strings or field names)
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
// TIMER_PATTERNS: flag actual timer/scheduler setup (not file paths like .timer)
const TIMER_PATTERNS = [
  /systemctl\s+(start|enable|stop)\s+(twitter|telegram|openclaw|cqa)/i,
  /crontab\s+(-l|-r|-e)/i,
  /setTimeout\s*\(\s*['"`]/i,
];
// AUTO_PUBLISH_PATTERNS: flag published=true (reject any published flag set to true, not no_platform_publish field names)
const AUTO_PUBLISH_PATTERNS = [
  /\bpublished\s*[:=]\s*true\b/i,
];

// 1. Policy file
if (!exists("dashboard/publishing-readiness-policy.json")) {
  addCheck("policy_json_exists", false, "missing");
} else {
  try {
    const p = readJson("dashboard/publishing-readiness-policy.json");
    addCheck("policy_json_exists", true, "valid JSON");
    addCheck("policy_phase_6C", p.phase === "6C", "phase=6C");
    addCheck("policy_no_platform_publish", p.no_platform_publish === true, "no_platform_publish=true");
    addCheck("policy_no_model_call", p.no_model_call === true, "no_model_call=true");
    addCheck("policy_no_media_generation", p.no_media_generation === true, "no_media_generation=true");
    addCheck("policy_no_x_api", p.no_x_api === true, "no_x_api=true");
    addCheck("policy_no_auto_publish", p.no_auto_publish === true, "no_auto_publish=true");
    addCheck("policy_has_rules", Array.isArray(p.policy_rules) && p.policy_rules.length >= 7, "policy_rules >= 7");
    addCheck("policy_has_dedup_method", typeof p.dedup_method === "object", "has dedup_method");
  } catch (e: any) {
    addCheck("policy_json_valid", false, "parse error: " + e.message);
  }
}

// 2. Review file
if (!exists("dashboard/publishing-readiness-review.json")) {
  addCheck("review_json_exists", false, "missing");
} else {
  try {
    const r = readJson("dashboard/publishing-readiness-review.json");
    addCheck("review_json_exists", true, "valid JSON");
    addCheck("review_phase_6C", r.phase === "6C", "phase=6C");
    addCheck("review_no_platform_publish", r.no_platform_publish === true, "no_platform_publish=true");
    addCheck("review_no_model_call", r.no_model_call === true, "no_model_call=true");
    addCheck("review_no_media_generation", r.no_media_generation === true, "no_media_generation=true");
    addCheck("review_no_x_api", r.no_x_api === true, "no_x_api=true");

    // ready_x_shortlist
    addCheck("review_ready_x_count_5", Array.isArray(r.ready_x_shortlist) && r.ready_x_shortlist.length === 5, "ready_x_shortlist=5");

    const readyXIds = new Set<string>();
    const readyXSlugs = new Set<string>();
    const readyXSources = new Set<string>();
    const requiredReadyXFields = [
      "id", "title", "source_type", "post_text", "image_url", "gallery_url",
      "why_ready", "suggested_manual_review_note", "publish_status", "no_platform_publish",
    ];
    let allReadyXHaveFields = true;
    let allReadyXHaveStatus = true;
    let allReadyXHaveNoPlatform = true;
    for (const item of r.ready_x_shortlist || []) {
      readyXIds.add(item.id);
      readyXSlugs.add(item.title_slug);
      readyXSources.add(item.source_type);
      for (const f of requiredReadyXFields) {
        if (item[f] === undefined || item[f] === null || item[f] === "") {
          allReadyXHaveFields = false;
        }
      }
      if (item.publish_status !== "ready_for_human_review") allReadyXHaveStatus = false;
      if (item.no_platform_publish !== true) allReadyXHaveNoPlatform = false;
    }
    addCheck("review_ready_x_5_unique_topics", readyXSlugs.size === 5, `5 unique topics (${readyXSlugs.size})`);
    addCheck("review_ready_x_5_unique_sources", readyXSources.size === 5, `5 unique source_types (${readyXSources.size})`);
    addCheck("review_ready_x_no_duplicate_ids", readyXIds.size === 5, `5 unique ids (${readyXIds.size})`);
    addCheck("review_ready_x_all_have_fields", allReadyXHaveFields, "all have required fields");
    addCheck("review_ready_x_all_status", allReadyXHaveStatus, 'all publish_status=ready_for_human_review');
    addCheck("review_ready_x_all_no_platform", allReadyXHaveNoPlatform, "all no_platform_publish=true");

    // blog_shortlist
    addCheck("review_blog_count_5", Array.isArray(r.blog_shortlist) && r.blog_shortlist.length === 5, "blog_shortlist=5");
    const blogSlugs = new Set<string>();
    const blogSources = new Set<string>();
    let allBlogHaveFields = true;
    for (const item of r.blog_shortlist || []) {
      blogSlugs.add(item.title_slug);
      blogSources.add(item.source_type);
      for (const f of ["id", "title", "source_type", "draft_status", "needs_expansion", "related_gallery_url", "suggested_next_action"]) {
        if (item[f] === undefined) allBlogHaveFields = false;
      }
    }
    addCheck("review_blog_5_unique_topics", blogSlugs.size === 5, `5 unique topics (${blogSlugs.size})`);
    addCheck("review_blog_5_unique_sources", blogSources.size === 5, `5 unique source_types (${blogSources.size})`);
    addCheck("review_blog_all_have_fields", allBlogHaveFields, "all have required fields");

    // image_generation_candidates
    addCheck("review_img_count_5", Array.isArray(r.image_generation_candidates) && r.image_generation_candidates.length === 5, "image_generation_candidates=5");
    const imgSlugs = new Set<string>();
    const imgSources = new Set<string>();
    let allImgRequireModel = true;
    let allImgNotCalled = true;
    for (const item of r.image_generation_candidates || []) {
      imgSlugs.add(item.title_slug);
      imgSources.add(item.source_type);
      if (item.requires_model_call !== true) allImgRequireModel = false;
      if (item.model_call_status !== "not_called") allImgNotCalled = false;
    }
    addCheck("review_img_5_unique_topics", imgSlugs.size === 5, `5 unique topics (${imgSlugs.size})`);
    addCheck("review_img_5_unique_sources", imgSources.size === 5, `5 unique source_types (${imgSources.size})`);
    addCheck("review_img_all_require_model_call", allImgRequireModel, "all requires_model_call=true");
    addCheck("review_img_all_not_called", allImgNotCalled, 'all model_call_status=not_called');

    addCheck("review_dup_warning_resolved", r.summary_metrics && r.summary_metrics.duplicate_queue_warning_resolved === true, "duplicate_queue_warning_resolved=true");
  } catch (e: any) {
    addCheck("review_json_valid", false, "parse error: " + e.message);
  }
}

// 3. Deduped shortlist file
if (!exists("dashboard/deduped-publishing-shortlist.json")) {
  addCheck("shortlist_json_exists", false, "missing");
} else {
  try {
    const s = readJson("dashboard/deduped-publishing-shortlist.json");
    addCheck("shortlist_json_exists", true, "valid JSON");
    addCheck("shortlist_phase_6C", s.phase === "6C", "phase=6C");
    addCheck("shortlist_no_platform_publish", s.no_platform_publish === true, "no_platform_publish=true");
    addCheck("shortlist_has_ready_x", s.shortlists && s.shortlists.ready_x && s.shortlists.ready_x.actual_count === 5, "ready_x=5");
    addCheck("shortlist_has_blog", s.shortlists && s.shortlists.blog && s.shortlists.blog.actual_count === 5, "blog=5");
    addCheck("shortlist_has_img", s.shortlists && s.shortlists.image_generation_candidates && s.shortlists.image_generation_candidates.actual_count === 5, "image_gen=5");
    addCheck("shortlist_excluded_x_20", s.excluded_from_first_round && s.excluded_from_first_round.excluded_x_count === 20, "excluded_x=20");
    addCheck("shortlist_excluded_blog_20", s.excluded_from_first_round && s.excluded_from_first_round.excluded_blog_count === 20, "excluded_blog=20");
  } catch (e: any) {
    addCheck("shortlist_json_valid", false, "parse error: " + e.message);
  }
}

// 4. Assets shortlists
const assetsShortlistFiles = [
  "publishing/shortlists/x-ready-shortlist.json",
  "publishing/shortlists/blog-shortlist.json",
  "publishing/shortlists/image-generation-candidates.json",
  "publishing/shortlists/README.md",
];
for (const f of assetsShortlistFiles) {
  addCheck(`assets_shortlist_${path.basename(f)}_exists`, exists(f, ASSETS), `${f} exists`);
}

if (exists("publishing/shortlists/x-ready-shortlist.json", ASSETS)) {
  try {
    const x = readJson("publishing/shortlists/x-ready-shortlist.json", ASSETS);
    addCheck("assets_x_shortlist_count_5", Array.isArray(x.items) && x.items.length === 5, "5 items");
    addCheck("assets_x_shortlist_no_publish_flag", x.no_platform_publish === true, "no_platform_publish=true");
  } catch (e: any) {
    addCheck("assets_x_shortlist_valid", false, "parse error: " + e.message);
  }
}

if (exists("publishing/shortlists/blog-shortlist.json", ASSETS)) {
  try {
    const b = readJson("publishing/shortlists/blog-shortlist.json", ASSETS);
    addCheck("assets_blog_shortlist_count_5", Array.isArray(b.items) && b.items.length === 5, "5 items");
    addCheck("assets_blog_shortlist_no_publish_flag", b.no_platform_publish === true, "no_platform_publish=true");
  } catch (e: any) {
    addCheck("assets_blog_shortlist_valid", false, "parse error: " + e.message);
  }
}

if (exists("publishing/shortlists/image-generation-candidates.json", ASSETS)) {
  try {
    const g = readJson("publishing/shortlists/image-generation-candidates.json", ASSETS);
    addCheck("assets_img_shortlist_count_5", Array.isArray(g.items) && g.items.length === 5, "5 items");
    addCheck("assets_img_shortlist_model_not_called", g.model_call_status === "not_called", "model_call_status=not_called");
  } catch (e: any) {
    addCheck("assets_img_shortlist_valid", false, "parse error: " + e.message);
  }
}

// 5. mainline-publishing-status.json preserves 6B fields AND has 6C section
if (!exists("dashboard/mainline-publishing-status.json")) {
  addCheck("mainline_status_exists", false, "missing");
} else {
  try {
    const m = readJson("dashboard/mainline-publishing-status.json");
    addCheck("mainline_status_phase_6B_preserved", m.phase === "6B", "phase=6B (preserved)");
    addCheck("mainline_status_stats_preserved", m.stats && m.stats.total_packs === 25, "stats.total_packs=25 (preserved)");
    addCheck("mainline_status_ready_5_preserved", m.stats && m.stats.ready_to_publish === 5, "stats.ready_to_publish=5 (preserved)");
    addCheck("mainline_status_needs_asset_20_preserved", m.stats && m.stats.needs_asset === 20, "stats.needs_asset=20 (preserved)");
    addCheck("mainline_status_has_6c_section", m.publishing_readiness_review && m.publishing_readiness_review.phase === "6C", "publishing_readiness_review.phase=6C");
    addCheck("mainline_status_6c_count_5", m.publishing_readiness_review && m.publishing_readiness_review.ready_x_shortlist_count === 5, "6C ready_x_shortlist_count=5");
  } catch (e: any) {
    addCheck("mainline_status_valid", false, "parse error: " + e.message);
  }
}

// 6. Secret/X-API/model/media/timer/auto-publish pattern scan on all new files
const allNewFiles = [
  "dashboard/publishing-readiness-policy.json",
  "dashboard/publishing-readiness-review.json",
  "dashboard/deduped-publishing-shortlist.json",
  "reports/publishing-readiness-review.md",
  "reports/deduped-publishing-shortlist.md",
  "scripts/validate-publishing-readiness.ts",
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
  for (const p of MODEL_CALL_PATTERNS) {
    addCheck(`no_model_call_${path.basename(f)}`, !p.test(content), `no model call pattern ${p}`);
  }
  for (const p of MEDIA_GEN_PATTERNS) {
    addCheck(`no_media_gen_${path.basename(f)}`, !p.test(content), `no media gen pattern ${p}`);
  }
  for (const p of TIMER_PATTERNS) {
    addCheck(`no_timer_${path.basename(f)}`, !p.test(content), `no timer pattern ${p}`);
  }
  // Skip validator script itself for auto-publish check (contains pattern strings as test data, not actual violations)
  if (f !== "scripts/validate-publishing-readiness.ts") {
    for (const p of AUTO_PUBLISH_PATTERNS) {
      addCheck(`no_auto_publish_${path.basename(f)}`, !p.test(content), `no auto-publish pattern ${p}`);
    }
  }
}

const assetsNewFiles = [
  "publishing/shortlists/x-ready-shortlist.json",
  "publishing/shortlists/blog-shortlist.json",
  "publishing/shortlists/image-generation-candidates.json",
  "publishing/shortlists/README.md",
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
  for (const p of AUTO_PUBLISH_PATTERNS) {
    addCheck(`assets_no_auto_publish_${path.basename(f)}`, !p.test(content), `no auto-publish pattern ${p}`);
  }
}

// Summary
const passed = checks.filter(c => c.met).length;
const failed = checks.filter(c => !c.met);
const total = checks.length;

console.log("=== Phase 6C Publishing Readiness Validation ===");
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
