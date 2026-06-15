#!/usr/bin/env tsx
/**
 * scripts/validate-publishing-pack.ts
 * Phase 6B: Validator for X / Blog publishing pack.
 *
 * Checks (all must PASS):
 *   - dashboard/mainline-publishing-status.json valid
 *   - dashboard/x-blog-publishing-queue.json valid
 *   - publishing/x/index.json exists in assets repo
 *   - publishing/blog/index.json exists in assets repo
 *   - X posts markdown files exist
 *   - Blog drafts markdown files exist
 *   - All items have id/title/status/source_type
 *   - no_platform_publish=true everywhere
 *   - No token / sk-cp / TELEGRAM_BOT_TOKEN / MINIMAX_API_KEY in any new file
 *   - No X API call patterns
 *   - No published=true assertions
 *   - No model call patterns
 *   - No media generation patterns
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
function exists(rel: string, base: string = HARVESTER): boolean {
  return fs.existsSync(path.join(base, rel));
}
function readJson(rel: string, base: string = HARVESTER): any {
  return JSON.parse(readText(rel, base));
}

const TOKEN_PATTERNS = [
  /sk-cp-[A-Za-z0-9_-]{10,}/,
  /TELEGRAM_BOT_TOKEN\s*=\s*['"][A-Za-z0-9_-]{10,}/,
  /MINIMAX_API_KEY\s*=\s*['"][A-Za-z0-9_-]{10,}/,
  /CQA_CONTROL_TOKEN\s*=\s*['"][A-Za-z0-9_-]{10,}/,
  /OPENAI_API_KEY\s*=\s*['"][A-Za-z0-9_-]{10,}/,
  /X_BEARER_TOKEN\s*=\s*['"][A-Za-z0-9_-]{10,}/,
];

const X_API_PATTERNS = [
  /api\.twitter\.com/i,
  /api\.x\.com/i,
  /oauth.*twitter/i,
  /bearer\s+token/i,
];

// 1. mainline-publishing-status.json
if (!exists("dashboard/mainline-publishing-status.json")) {
  addCheck("status_json_exists", false, "missing");
} else {
  try {
    const s = readJson("dashboard/mainline-publishing-status.json");
    addCheck("status_json_exists", true, "valid JSON");
    addCheck("status_phase_6B", s.phase === "6B", "phase=6B");
    addCheck("status_no_platform_publish", s.no_platform_publish === true, "no_platform_publish=true");
    addCheck("status_no_model_call", s.no_model_call === true, "no_model_call=true");
    addCheck("status_no_media_generation", s.no_media_generation === true, "no_media_generation=true");
    addCheck("status_no_x_api", s.no_x_api === true, "no_x_api=true");
    addCheck("status_has_stats", typeof s.stats === "object", "has stats");
    addCheck("status_total_packs_25", s.stats && s.stats.total_packs === 25, "total_packs=25");
    addCheck("status_has_x_post_25", s.stats && s.stats.has_x_post === 25, "has_x_post=25");
    addCheck("status_has_generated_image_5", s.stats && s.stats.has_generated_image === 5, "has_generated_image=5");
    addCheck("status_ready_5", s.stats && s.stats.ready_to_publish === 5, "ready_to_publish=5");
    addCheck("status_needs_asset_20", s.stats && s.stats.needs_asset === 20, "needs_asset=20");
    addCheck("status_has_source_types", s.source_type_counts && Object.keys(s.source_type_counts).length === 5, "5 source types");
  } catch (e: any) {
    addCheck("status_json_valid", false, "parse error: " + e.message);
  }
}

// 2. x-blog-publishing-queue.json
if (!exists("dashboard/x-blog-publishing-queue.json")) {
  addCheck("queue_json_exists", false, "missing");
} else {
  try {
    const q = readJson("dashboard/x-blog-publishing-queue.json");
    addCheck("queue_json_exists", true, "valid JSON");
    addCheck("queue_no_platform_publish", q.no_platform_publish === true, "no_platform_publish=true");
    addCheck("queue_has_x_queue", Array.isArray(q.x_queue) && q.x_queue.length === 25, "x_queue length=25");
    addCheck("queue_has_blog_queue", Array.isArray(q.blog_queue) && q.blog_queue.length === 25, "blog_queue length=25");

    // Validate x_queue items
    let allXValid = true;
    let allXNoPublish = true;
    for (const item of q.x_queue) {
      if (!item.id || !item.title || !item.source_type || !item.publish_status) allXValid = false;
      if (item.no_platform_publish !== true) allXNoPublish = false;
    }
    addCheck("queue_x_items_have_required", allXValid, "all x items have id/title/source_type/publish_status");
    addCheck("queue_x_items_no_publish", allXNoPublish, "all x items have no_platform_publish=true");

    // Validate blog_queue items
    let allBlogValid = true;
    let allBlogNoPublish = true;
    for (const item of q.blog_queue) {
      if (!item.id || !item.title || !item.source_type || !item.publish_status) allBlogValid = false;
      if (item.no_platform_publish !== true) allBlogNoPublish = false;
    }
    addCheck("queue_blog_items_have_required", allBlogValid, "all blog items have id/title/source_type/publish_status");
    addCheck("queue_blog_items_no_publish", allBlogNoPublish, "all blog items have no_platform_publish=true");
  } catch (e: any) {
    addCheck("queue_json_valid", false, "parse error: " + e.message);
  }
}

// 3. Assets publishing files
if (!exists("publishing/x/index.json", ASSETS)) {
  addCheck("assets_x_index_exists", false, "missing publishing/x/index.json in assets");
} else {
  try {
    const xi = readJson("publishing/x/index.json", ASSETS);
    addCheck("assets_x_index_exists", true, "valid JSON");
    addCheck("assets_x_index_no_publish", xi.no_platform_publish === true, "no_platform_publish=true");
    addCheck("assets_x_index_has_posts", Array.isArray(xi.posts) && xi.posts.length >= 5, `posts: ${xi.posts ? xi.posts.length : 0}`);
  } catch (e: any) {
    addCheck("assets_x_index_valid", false, "parse error");
  }
}

if (!exists("publishing/blog/index.json", ASSETS)) {
  addCheck("assets_blog_index_exists", false, "missing publishing/blog/index.json in assets");
} else {
  try {
    const bi = readJson("publishing/blog/index.json", ASSETS);
    addCheck("assets_blog_index_exists", true, "valid JSON");
    addCheck("assets_blog_index_no_publish", bi.no_platform_publish === true, "no_platform_publish=true");
    addCheck("assets_blog_index_has_drafts", Array.isArray(bi.drafts) && bi.drafts.length >= 5, `drafts: ${bi.drafts ? bi.drafts.length : 0}`);
  } catch (e: any) {
    addCheck("assets_blog_index_valid", false, "parse error");
  }
}

// 4. X post files exist
if (exists("publishing/x/index.json", ASSETS)) {
  const xi = readJson("publishing/x/index.json", ASSETS);
  let allExist = true;
  for (const p of xi.posts) {
    if (!exists(p.file, ASSETS)) allExist = false;
  }
  addCheck("assets_x_post_files_exist", allExist, "all x post files exist");
}

// 5. Blog draft files exist
if (exists("publishing/blog/index.json", ASSETS)) {
  const bi = readJson("publishing/blog/index.json", ASSETS);
  let allExist = true;
  for (const d of bi.drafts) {
    if (!exists(d.file, ASSETS)) allExist = false;
  }
  addCheck("assets_blog_draft_files_exist", allExist, "all blog draft files exist");
}

// 6. publishing/README.md exists
addCheck("assets_publishing_readme_exists", exists("publishing/README.md", ASSETS), "publishing/README.md exists");
addCheck("assets_x_readme_exists", exists("publishing/x/README.md", ASSETS), "publishing/x/README.md exists");
addCheck("assets_blog_readme_exists", exists("publishing/blog/README.md", ASSETS), "publishing/blog/README.md exists");

// 7. Token leak check in all new files
{
  const newFiles = [
    "dashboard/mainline-publishing-status.json",
    "dashboard/x-blog-publishing-queue.json",
    "scripts/mainline-publishing-pack.ts",
    "scripts/build-assets-publishing-pack.ts",
    "scripts/validate-publishing-pack.ts",
    "reports/x-blog-publishing-inventory.md",
    "reports/x-blog-publishing-queue.md",
    "reports/phase-6b-x-blog-publishing-pack.md",
    "reports/telegram-phase-6b-x-blog-publishing-pack.txt",
  ];
  const assetsFiles = [
    "publishing/README.md",
    "publishing/x/README.md",
    "publishing/x/index.json",
    "publishing/blog/README.md",
    "publishing/blog/index.json",
  ];
  let found = false;
  for (const f of [...newFiles, ...assetsFiles]) {
    const base = assetsFiles.includes(f) ? ASSETS : HARVESTER;
    if (!exists(f, base)) continue;
    const content = readText(f, base);
    for (const pat of TOKEN_PATTERNS) {
      if (pat.test(content)) {
        found = true;
        addCheck("no_token:" + f, false, `token-like in ${f}`);
      }
    }
  }
  if (!found) addCheck("no_tokens_in_new_files", true, "no token patterns in new files");
}

// 8. No X API call patterns
{
  const scripts = [
    "scripts/mainline-publishing-pack.ts",
    "scripts/build-assets-publishing-pack.ts",
    // Note: validate-publishing-pack.ts intentionally contains X API patterns as part of the check
  ];
  let found = false;
  for (const f of scripts) {
    if (!exists(f)) continue;
    const content = readText(f);
    for (const pat of X_API_PATTERNS) {
      if (pat.test(content)) {
        found = true;
        addCheck("no_x_api:" + f, false, `X API pattern in ${f}`);
      }
    }
  }
  if (!found) addCheck("no_x_api_in_scripts", true, "no X API patterns in scripts");
}

// 9. No "published: true" assertions
{
  const newFiles = [
    "dashboard/mainline-publishing-status.json",
    "dashboard/x-blog-publishing-queue.json",
    "publishing/x/index.json",
    "publishing/blog/index.json",
  ];
  let found = false;
  for (const f of newFiles) {
    const base = f.includes("publishing") ? ASSETS : HARVESTER;
    if (!exists(f, base)) continue;
    const content = readText(f, base);
    if (/["']published["']\s*:\s*true/.test(content) || /["']is_published["']\s*:\s*true/.test(content)) {
      found = true;
      addCheck("no_published_true:" + f, false, `"published":true found in ${f}`);
    }
  }
  if (!found) addCheck("no_published_true", true, "no \"published\":true assertions");
}

// 10. No model call patterns in scripts
{
  const scripts = [
    "scripts/mainline-publishing-pack.ts",
    "scripts/build-assets-publishing-pack.ts",
  ];
  let found = false;
  for (const f of scripts) {
    if (!exists(f)) continue;
    const content = readText(f);
    const stripped = content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/.*$/gm, "");
    if (/\b(exec|spawn|fork)\s*\(/.test(stripped) || /child_process/.test(stripped) || /https?:\/\/api/.test(stripped)) {
      found = true;
      addCheck("no_model_call:" + f, false, `model call pattern in ${f}`);
    }
  }
  if (!found) addCheck("no_model_call_in_scripts", true, "no model call patterns in scripts");
}

// 11. boundary compliance
if (exists("dashboard/mainline-publishing-status.json")) {
  const s = readJson("dashboard/mainline-publishing-status.json");
  const b = s.boundaries_enforced || {};
  addCheck("boundary_model_call_disabled", b.model_call_allowed === false, "model_call_allowed=false");
  addCheck("boundary_media_generation_disabled", b.media_generation_allowed === false, "media_generation_allowed=false");
  addCheck("boundary_x_api_disabled", b.x_api_called === false, "x_api_called=false");
  addCheck("boundary_platform_publish_disabled", b.platform_publish_executed === false, "platform_publish_executed=false");
  addCheck("boundary_collect_disabled", b.collect_allowed === false, "collect_allowed=false");
  addCheck("boundary_digest_send_disabled", b.digest_send_allowed === false, "digest_send_allowed=false");
  addCheck("boundary_timer_disabled", b.timer_allowed === false, "timer_allowed=false");
  addCheck("boundary_generate_disabled", b.generate_allowed === false, "generate_allowed=false");
}

const allMet = checks.every(c => c.met);
const summary = {
  validator: "validate-publishing-pack",
  phase: "6B",
  generated_at: new Date().toISOString(),
  total_checks: checks.length,
  passed: checks.filter(c => c.met).length,
  failed: checks.filter(c => !c.met).length,
  all_pass: allMet,
  checks,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(allMet ? 0 : 1);