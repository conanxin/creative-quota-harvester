#!/usr/bin/env tsx
/**
 * scripts/validate-x-human-review-pack.ts
 * Phase 6D: Validator for X Human Review Pack.
 *
 * Checks (all must PASS):
 *   - assets publishing review index JSON valid
 *   - 5 review markdown files exist
 *   - each item has title/source_type/post_text/image_url/gallery_url
 *   - X post text matches Phase 6C shortlist verbatim
 *   - no_platform_publish=true
 *   - published_externally=false or 0
 *   - no X API call patterns
 *   - no baoyu-post-to-x call patterns
 *   - no token / sk-cp / TELEGRAM_BOT_TOKEN / MINIMAX_API_KEY
 *   - no media generation patterns
 *   - no model call patterns
 *   - dashboard/x-human-review-pack.json valid
 *   - dashboard/x-manual-publish-checklist.json valid
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
// BAOYU_POST_PATTERNS: flag actual function calls or shell invocations (not documentation mentions)
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
];

// 1. assets review index JSON
const reviewIndexPath = "publishing/review/x/phase-6d/index.json";
if (!exists(reviewIndexPath, ASSETS)) {
  addCheck("assets_review_index_exists", false, "missing");
} else {
  try {
    const idx = readJson(reviewIndexPath, ASSETS);
    addCheck("assets_review_index_exists", true, "valid JSON");
    addCheck("assets_review_index_phase_6D", idx.phase === "6D", "phase=6D");
    addCheck("assets_review_index_no_platform_publish", idx.no_platform_publish === true, "no_platform_publish=true");
    addCheck("assets_review_index_no_x_api", idx.no_x_api === true, "no_x_api=true");
    addCheck("assets_review_index_no_baoyu", idx.no_baoyu_post_to_x === true, "no_baoyu_post_to_x=true");
    addCheck("assets_review_index_no_auto_publish", idx.no_auto_publish === true, "no_auto_publish=true");
    addCheck("assets_review_index_total_5", idx.total_review_items === 5, "total_review_items=5");
    addCheck("assets_review_index_reviewed_0", idx.reviewed === 0, "reviewed=0");
    addCheck("assets_review_index_approved_0", idx.approved_for_manual_publish === 0, "approved_for_manual_publish=0");
    addCheck("assets_review_index_published_0", idx.published_externally === 0, "published_externally=0");
    addCheck("assets_review_index_5_items", Array.isArray(idx.items) && idx.items.length === 5, "items=5");
    addCheck("assets_review_index_5_unique_topics", new Set((idx.items || []).map((i: any) => i.title_slug)).size === 5, "5 unique topics");

    // Per-item checks
    const items = idx.items || [];
    const itemsNoPublish = items.every((i: any) => i.no_platform_publish === true);
    const itemsNotPublished = items.every((i: any) => i.publish_status === "not_published");
    const itemsReviewStatus = items.every((i: any) => i.review_status === "ready_for_human_review");
    const itemsHaveFields = items.every((i: any) =>
      i.id && i.title && i.source_type && i.post_text && i.image_url && i.gallery_url
    );
    addCheck("assets_review_index_all_no_publish", itemsNoPublish, "all no_platform_publish=true");
    addCheck("assets_review_index_all_not_published", itemsNotPublished, "all publish_status=not_published");
    addCheck("assets_review_index_all_review_status", itemsReviewStatus, "all review_status=ready_for_human_review");
    addCheck("assets_review_index_all_have_fields", itemsHaveFields, "all have id/title/source_type/post_text/image_url/gallery_url");
  } catch (e: any) {
    addCheck("assets_review_index_valid", false, "parse error: " + e.message);
  }
}

// 2. Per-post markdown files exist + post text matches Phase 6C verbatim
const phase6CShortlist = exists("publishing/shortlists/x-ready-shortlist.json", ASSETS)
  ? readJson("publishing/shortlists/x-ready-shortlist.json", ASSETS)
  : null;

const postFiles = [
  "publishing/review/x/phase-6d/posts/flaws-in-the-llm-automation-narrative.md",
  "publishing/review/x/phase-6d/posts/stabilityai-stable-video-diffusion-img2vid-xt.md",
  "publishing/review/x/phase-6d/posts/samuraigpt-generative-media-skills.md",
  "publishing/review/x/phase-6d/posts/river-ai.md",
  "publishing/review/x/phase-6d/posts/the-penitence-of-saint-jerome.md",
];
for (const f of postFiles) {
  addCheck(`post_md_exists_${path.basename(f)}`, exists(f, ASSETS), `${path.basename(f)} exists`);
  if (!exists(f, ASSETS)) continue;
  const content = readText(f, ASSETS);
  const slug = path.basename(f, ".md");

  // Post text verbatim check
  if (phase6CShortlist && phase6CShortlist.items) {
    const match = phase6CShortlist.items.find((i: any) => i.title_slug === slug);
    if (match) {
      addCheck(`post_text_verbatim_${slug}`, content.includes(match.post_text), `post_text matches Phase 6C`);
    }
  }

  // Per-markdown checks
  const hasId = /\*\*ID\*\*|`Q-6B-X-/.test(content);
  const hasTitle = /\*\*Title\*\*|## Metadata/.test(content);
  const hasSourceType = /Source type|academic|ai-ecosystem|code|dev-community|culture-art/.test(content);
  const hasPostText = /X Post Text/.test(content);
  const hasImageUrl = /image_url/.test(content);
  const hasGalleryUrl = /gallery_url/.test(content);
  const hasNoPlatformPublish = /no_platform_publish\*\*: true|no_platform_publish: true/.test(content);
  const hasPublishNotPublished = /publish_status:?\s*\*\*\s*not_published|publish_status\*\*:\s*not_published|publish_status:\s*not_published/.test(content);
  const hasCopyChecklist = /Copy Checklist/.test(content);
  const hasManualReviewChecklist = /Manual Review Checklist/.test(content);
  const hasManualPublishNote = /Copy manually to X UI/.test(content);
  const hasSafetyNote = /not_published/.test(content) && /no X API called/.test(content);

  addCheck(`post_md_has_id_${slug}`, hasId, "has ID");
  addCheck(`post_md_has_title_${slug}`, hasTitle, "has title");
  addCheck(`post_md_has_source_type_${slug}`, hasSourceType, "has source_type");
  addCheck(`post_md_has_post_text_${slug}`, hasPostText, "has X Post Text section");
  addCheck(`post_md_has_image_url_${slug}`, hasImageUrl, "has image_url");
  addCheck(`post_md_has_gallery_url_${slug}`, hasGalleryUrl, "has gallery_url");
  addCheck(`post_md_has_no_publish_${slug}`, hasNoPlatformPublish, "has no_platform_publish: true");
  addCheck(`post_md_has_not_published_${slug}`, hasPublishNotPublished, "has publish_status: not_published");
  addCheck(`post_md_has_copy_checklist_${slug}`, hasCopyChecklist, "has Copy Checklist");
  addCheck(`post_md_has_manual_review_checklist_${slug}`, hasManualReviewChecklist, "has Manual Review Checklist");
  addCheck(`post_md_has_manual_publish_note_${slug}`, hasManualPublishNote, "has manual publish note");
  addCheck(`post_md_has_safety_note_${slug}`, hasSafetyNote, "has safety note");
}

// 3. harvester dashboard files
if (!exists("dashboard/x-human-review-pack.json")) {
  addCheck("harvester_review_pack_exists", false, "missing");
} else {
  try {
    const r = readJson("dashboard/x-human-review-pack.json");
    addCheck("harvester_review_pack_exists", true, "valid JSON");
    addCheck("harvester_review_pack_phase_6D", r.phase === "6D", "phase=6D");
    addCheck("harvester_review_pack_no_platform_publish", r.no_platform_publish === true, "no_platform_publish=true");
    addCheck("harvester_review_pack_total_5", r.total_review_items === 5, "total_review_items=5");
    addCheck("harvester_review_pack_reviewed_0", r.reviewed === 0, "reviewed=0");
    addCheck("harvester_review_pack_approved_0", r.approved_for_manual_publish === 0, "approved_for_manual_publish=0");
    addCheck("harvester_review_pack_published_0", r.published_externally === 0, "published_externally=0");
    addCheck("harvester_review_pack_5_items", Array.isArray(r.items) && r.items.length === 5, "items=5");

    const items = r.items || [];
    const itemsNoPublish = items.every((i: any) => i.no_platform_publish === true);
    const itemsNotPublished = items.every((i: any) => i.publish_status === "not_published");
    const itemsHaveFields = items.every((i: any) =>
      i.id && i.title && i.source_type && i.post_text && i.image_url && i.gallery_url && i.checklist
    );
    addCheck("harvester_review_pack_all_no_publish", itemsNoPublish, "all no_platform_publish=true");
    addCheck("harvester_review_pack_all_not_published", itemsNotPublished, "all publish_status=not_published");
    addCheck("harvester_review_pack_all_have_fields", itemsHaveFields, "all have id/title/source_type/post_text/image_url/gallery_url/checklist");
  } catch (e: any) {
    addCheck("harvester_review_pack_valid", false, "parse error: " + e.message);
  }
}

if (!exists("dashboard/x-manual-publish-checklist.json")) {
  addCheck("harvester_publish_checklist_exists", false, "missing");
} else {
  try {
    const c = readJson("dashboard/x-manual-publish-checklist.json");
    addCheck("harvester_publish_checklist_exists", true, "valid JSON");
    addCheck("harvester_publish_checklist_phase_6D", c.phase === "6D", "phase=6D");
    addCheck("harvester_publish_checklist_no_platform_publish", c.no_platform_publish === true, "no_platform_publish=true");
    addCheck("harvester_publish_checklist_no_x_api", c.no_x_api === true, "no_x_api=true");
    addCheck("harvester_publish_checklist_no_baoyu", c.no_baoyu_post_to_x === true, "no_baoyu_post_to_x=true");
    addCheck("harvester_publish_checklist_global_10", Array.isArray(c.global_checklist) && c.global_checklist.length === 10, "10 global checklist items");
    const allGlobalMet = (c.global_checklist || []).every((g: any) => g.status === "met");
    addCheck("harvester_publish_checklist_all_global_met", allGlobalMet, "all global items met");
    addCheck("harvester_publish_checklist_per_item_6", Array.isArray(c.per_item_checklist_template) && c.per_item_checklist_template.length === 6, "6 per-item sections");
    addCheck("harvester_publish_checklist_steps_6", Array.isArray(c.manual_publish_steps) && c.manual_publish_steps.length === 6, "6 manual publish steps");
    addCheck("harvester_publish_checklist_donot_7", Array.isArray(c.do_not_do) && c.do_not_do.length === 7, "7 do-not-do items");
  } catch (e: any) {
    addCheck("harvester_publish_checklist_valid", false, "parse error: " + e.message);
  }
}

// 4. Pattern scan on all new files
const allNewFiles = [
  "dashboard/x-human-review-pack.json",
  "dashboard/x-manual-publish-checklist.json",
  "reports/x-human-review-pack.md",
  "reports/x-manual-publish-checklist.md",
  "scripts/validate-x-human-review-pack.ts",
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
  if (f !== "scripts/validate-x-human-review-pack.ts") {
    for (const p of AUTO_PUBLISH_PATTERNS) {
      addCheck(`no_auto_publish_${path.basename(f)}`, !p.test(content), `no auto-publish pattern ${p}`);
    }
  }
}

const assetsNewFiles = [
  "publishing/review/x/phase-6d/index.json",
  "publishing/review/x/phase-6d/README.md",
  ...postFiles,
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

console.log("=== Phase 6D X Human Review Pack Validation ===");
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
