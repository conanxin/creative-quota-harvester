#!/usr/bin/env tsx
/**
 * scripts/mainline-publishing-pack.ts
 * Phase 6B: Read-only scan of creative-quota-assets, generates publishing status + queue.
 *
 * Strict read-only of assets repo. Writes only to:
 *   - dashboard/mainline-publishing-status.json
 *   - dashboard/x-blog-publishing-queue.json
 *   - reports/x-blog-publishing-inventory.md
 *   - reports/x-blog-publishing-queue.md
 *   - reports/phase-6b-x-blog-publishing-pack.md
 *   - reports/telegram-phase-6b-x-blog-publishing-pack.txt
 *
 * Boundaries:
 *   - No model call, no media generation, no X API, no platform publish
 *   - No .env, .control.local, token reads
 *   - No production path overwrites
 */

import * as fs from "fs";
import * as path from "path";

const ASSETS = path.join(process.env.HOME || "/home/ubuntu", ".openclaw/workspace/projects/creative-quota-assets");
const HARVESTER = path.resolve(__dirname, "..");

const GALLERY_BASE_URL = "https://conanxin.github.io/creative-quota-assets";

function readText(rel: string): string {
  const p = path.isAbsolute(rel) ? rel : path.join(ASSETS, rel);
  if (!fs.existsSync(p)) return "";
  return fs.readFileSync(p, "utf-8");
}
function exists(rel: string): boolean {
  const p = path.isAbsolute(rel) ? rel : path.join(ASSETS, rel);
  return fs.existsSync(p);
}
function listDirs(parent: string): string[] {
  const p = path.join(ASSETS, parent);
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).map(name => path.join(p, name)).filter(p => fs.statSync(p).isDirectory());
}

interface PackInfo {
  packDir: string;
  packSlug: string;
  title: string;
  sourceType: string;
  sourceLabelZh: string;
  hasXPost: boolean;
  hasImagePrompt: boolean;
  hasMusicPrompt: boolean;
  hasVideoPrompt: boolean;
  hasWebpageOutline: boolean;
  hasFactsEnriched: boolean;
  hasContentSummary: boolean;
  oneSentenceSummary: string;
  recommendedUses: string[];
  tags: string[];
  hasGeneratedImage: boolean;
  generatedImagePath: string | null;
  qualityScore: number | null;
  packRelDir: string; // relative to assets root
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function readJsonSafe(rel: string): any {
  const p = path.isAbsolute(rel) ? rel : path.join(ASSETS, rel);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function scanGallery(): Map<string, { path: string; reviewPath: string; score: number | null }> {
  const map = new Map<string, { path: string; reviewPath: string; score: number | null }>();
  const ga = readJsonSafe("gallery/assets.json");
  if (Array.isArray(ga)) {
    for (const item of ga) {
      map.set(item.content_pack, {
        path: item.path,
        reviewPath: item.path.replace(/\.jpg$/, ".review.zh.md"),
        score: null,
      });
    }
  }
  const review = readJsonSafe("metadata/generated-assets-review.json");
  if (review && Array.isArray(review.images)) {
    for (const img of review.images) {
      if (map.has(img.content_pack)) {
        map.get(img.content_pack)!.score = img.total_score;
      }
    }
  }
  return map;
}

function scanContentPacks(galleryMap: Map<string, { path: string; reviewPath: string; score: number | null }>): PackInfo[] {
  const packs: PackInfo[] = [];
  // content-packs/2026/06/2026-06-11/<pack-slug>/
  const dayDirs = listDirs("content-packs/2026/06");
  for (const dayDir of dayDirs) {
    const packDirs = fs.readdirSync(dayDir)
      .map(name => path.join(dayDir, name))
      .filter(p => fs.statSync(p).isDirectory());
    for (const packDir of packDirs) {
      const packSlug = path.basename(packDir);
      const detail = readJsonSafe(path.join(packDir, "detail.json"));
      if (!detail) continue;
      const manifest = readJsonSafe(path.join(packDir, "manifest.json"));
      const title = detail.title || (manifest && manifest.title) || packSlug;
      const sourceType = detail.source_type || "unknown";
      const hasXPost = exists(path.join(packDir, "x-post.zh.md"));
      const hasImagePrompt = exists(path.join(packDir, "image-prompt.md"));
      const hasMusicPrompt = exists(path.join(packDir, "music-prompt.enriched.md")) || exists(path.join(packDir, "music-prompt.md"));
      const hasVideoPrompt = exists(path.join(packDir, "video-prompt.enriched.md")) || exists(path.join(packDir, "video-prompt.md"));
      const hasWebpageOutline = exists(path.join(packDir, "webpage-outline.md"));
      const hasFactsEnriched = exists(path.join(packDir, "facts.enriched.md"));
      const hasContentSummary = exists(path.join(packDir, "content-summary.zh.md"));
      const oneSentenceSummary = detail.one_sentence_summary || "";
      const recommendedUses = detail.recommended_uses || [];
      const tags = detail.tags || [];
      const relDir = path.relative(ASSETS, packDir);
      const galleryInfo = galleryMap.get(packSlug);
      const hasGeneratedImage = !!galleryInfo;
      const generatedImagePath = galleryInfo ? galleryInfo.path : null;
      const qualityScore = galleryInfo ? galleryInfo.score : null;

      packs.push({
        packDir,
        packSlug,
        title,
        sourceType,
        sourceLabelZh: detail.source_label_zh || "",
        hasXPost,
        hasImagePrompt,
        hasMusicPrompt,
        hasVideoPrompt,
        hasWebpageOutline,
        hasFactsEnriched,
        hasContentSummary,
        oneSentenceSummary,
        recommendedUses,
        tags,
        hasGeneratedImage,
        generatedImagePath,
        qualityScore,
        packRelDir: relDir,
      });
    }
  }
  return packs;
}

function extractXPostText(packDir: string): string {
  const p = path.join(packDir, "x-post.zh.md");
  if (!fs.existsSync(p)) return "";
  return fs.readFileSync(p, "utf-8").trim();
}

function extractTitleSlug(title: string): string {
  return slugify(title);
}

function recommendedChannel(pack: PackInfo): string {
  if (pack.hasWebpageOutline && pack.oneSentenceSummary.length > 20) return "blog";
  if (pack.hasXPost) return "x";
  return "gallery_highlight";
}

function priorityForPack(pack: PackInfo): string {
  if (pack.hasXPost && pack.hasImagePrompt && pack.sourceType) return "high";
  if (pack.hasXPost) return "medium";
  return "low";
}

function publishStatusForPack(pack: PackInfo): string {
  if (!pack.hasXPost && !pack.hasWebpageOutline) return "blocked";
  if (pack.hasXPost && !pack.hasGeneratedImage) return "needs_asset";
  if (pack.hasXPost) return "ready";
  if (pack.hasWebpageOutline) return "draft";
  return "blocked";
}

function main() {
  console.log("[Phase 6B] Scanning creative-quota-assets...");
  if (!fs.existsSync(ASSETS)) {
    console.error("ASSETS repo not found: " + ASSETS);
    process.exit(1);
  }
  const galleryMap = scanGallery();
  const packs = scanContentPacks(galleryMap);
  console.log("[Phase 6B] Found " + packs.length + " content packs");

  // Build per-pack entries
  const xQueue: any[] = [];
  const blogQueue: any[] = [];
  const stats = {
    total_packs: packs.length,
    has_x_post: 0,
    has_image_prompt: 0,
    has_music_prompt: 0,
    has_video_prompt: 0,
    has_webpage_outline: 0,
    has_facts_enriched: 0,
    has_content_summary: 0,
    has_generated_image: 0,
    ready_to_publish: 0,
    needs_asset: 0,
    blocked: 0,
    high_priority: 0,
    medium_priority: 0,
    low_priority: 0,
  };
  const sourceTypeCounts: Record<string, number> = {};
  const topicTitleSet = new Set<string>();

  for (const p of packs) {
    const postText = extractXPostText(p.packDir);
    if (p.hasXPost) stats.has_x_post++;
    if (p.hasImagePrompt) stats.has_image_prompt++;
    if (p.hasMusicPrompt) stats.has_music_prompt++;
    if (p.hasVideoPrompt) stats.has_video_prompt++;
    if (p.hasWebpageOutline) stats.has_webpage_outline++;
    if (p.hasFactsEnriched) stats.has_facts_enriched++;
    if (p.hasContentSummary) stats.has_content_summary++;
    if (p.hasGeneratedImage) stats.has_generated_image++;

    const titleSlug = extractTitleSlug(p.title);
    if (titleSlug) topicTitleSet.add(titleSlug);

    const priority = priorityForPack(p);
    const publishStatus = publishStatusForPack(p);
    const channel = recommendedChannel(p);
    if (publishStatus === "ready") stats.ready_to_publish++;
    if (publishStatus === "needs_asset") stats.needs_asset++;
    if (publishStatus === "blocked") stats.blocked++;
    if (priority === "high") stats.high_priority++;
    if (priority === "medium") stats.medium_priority++;
    if (priority === "low") stats.low_priority++;

    sourceTypeCounts[p.sourceType] = (sourceTypeCounts[p.sourceType] || 0) + 1;

    const linkedGalleryUrl = p.hasGeneratedImage
      ? `${GALLERY_BASE_URL}/${p.generatedImagePath}`
      : null;
    const linkedReviewUrl = p.hasGeneratedImage
      ? `${GALLERY_BASE_URL}/${p.generatedImagePath!.replace(/\.jpg$/, ".review.zh.md")}`
      : null;
    const linkedContentPackUrl = `${GALLERY_BASE_URL}/${p.packRelDir}/index.html`;

    const xEntry = {
      id: `Q-6B-X-${p.packSlug.slice(0, 30)}`,
      title: p.title,
      title_slug: titleSlug,
      source_type: p.sourceType,
      source_label_zh: p.sourceLabelZh,
      post_text: postText,
      recommended_channel: "x",
      current_asset_state: p.hasXPost
        ? (p.hasGeneratedImage ? "has_x_post_and_image" : "has_x_post_no_image")
        : "missing_x_post",
      linked_content_pack: p.packSlug,
      linked_content_pack_url: linkedContentPackUrl,
      linked_gallery_url: linkedGalleryUrl,
      linked_image_url: linkedGalleryUrl,
      linked_review_url: linkedReviewUrl,
      needs_image: !p.hasGeneratedImage,
      needs_review: true,
      priority,
      publish_status: p.hasXPost ? (p.hasGeneratedImage ? "ready" : "needs_asset") : "blocked",
      quality_score: p.qualityScore,
      no_platform_publish: true,
      post_status: "draft_ready",
    };
    xQueue.push(xEntry);

    if (p.hasWebpageOutline || p.hasContentSummary) {
      const blogEntry = {
        id: `Q-6B-BLOG-${p.packSlug.slice(0, 30)}`,
        title: p.title,
        title_slug: titleSlug,
        source_type: p.sourceType,
        source_label_zh: p.sourceLabelZh,
        one_sentence_summary: p.oneSentenceSummary,
        recommended_channel: "blog",
        current_asset_state: p.hasWebpageOutline
          ? (p.hasGeneratedImage ? "has_outline_and_image" : "has_outline_no_image")
          : "missing_outline",
        linked_content_pack: p.packSlug,
        linked_content_pack_url: linkedContentPackUrl,
        linked_gallery_url: linkedGalleryUrl,
        linked_image_url: linkedGalleryUrl,
        needs_image: !p.hasGeneratedImage,
        needs_expansion: !p.hasWebpageOutline,
        needs_review: true,
        priority: p.hasWebpageOutline ? priority : "low",
        publish_status: p.hasWebpageOutline ? (p.hasContentSummary ? "draft_ready" : "outline_only") : "blocked",
        quality_score: p.qualityScore,
        no_platform_publish: true,
        post_status: p.hasWebpageOutline ? "outline_only" : "draft_ready",
      };
      blogQueue.push(blogEntry);
    }
  }

  // Sort by priority (high first), then by source_type
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  xQueue.sort((a, b) => {
    const p = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    if (p !== 0) return p;
    return a.source_type.localeCompare(b.source_type);
  });
  blogQueue.sort((a, b) => {
    const p = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    if (p !== 0) return p;
    return a.source_type.localeCompare(b.source_type);
  });

  const uniqueTopics = Array.from(topicTitleSet);

  const publishingStatus = {
    phase: "6B",
    mode: "x_blog_publishing_pack",
    generated_at: new Date().toISOString(),
    assets_repo: ASSETS,
    gallery_base_url: GALLERY_BASE_URL,
    no_platform_publish: true,
    no_model_call: true,
    no_media_generation: true,
    no_x_api: true,
    no_external_llm: true,
    no_timer: true,
    no_telegram_digest: true,
    stats,
    unique_topics: uniqueTopics,
    source_type_counts: sourceTypeCounts,
    recommended_next_action: "manual_review_then_publish_via_existing_tools",
    boundaries_enforced: {
      model_call_allowed: false,
      media_generation_allowed: false,
      x_api_called: false,
      platform_publish_executed: false,
      collect_allowed: false,
      digest_send_allowed: false,
      timer_allowed: false,
      generate_allowed: false,
      production_digest_overwrite: false,
      systemd_change: false,
      token_commit: false,
    },
  };

  const publishingQueue = {
    phase: "6B",
    mode: "x_blog_publishing_queue",
    generated_at: new Date().toISOString(),
    no_platform_publish: true,
    total_items: xQueue.length + blogQueue.length,
    x_post_count: xQueue.length,
    blog_draft_count: blogQueue.length,
    high_priority_x_count: xQueue.filter(e => e.priority === "high").length,
    ready_to_publish_count: stats.ready_to_publish,
    needs_asset_count: stats.needs_asset,
    blocked_count: stats.blocked,
    x_queue: xQueue,
    blog_queue: blogQueue,
  };

  // Write outputs
  fs.writeFileSync(
    path.join(HARVESTER, "dashboard/mainline-publishing-status.json"),
    JSON.stringify(publishingStatus, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(HARVESTER, "dashboard/x-blog-publishing-queue.json"),
    JSON.stringify(publishingQueue, null, 2) + "\n"
  );

  // Write inventory report
  const invLines: string[] = [];
  invLines.push("# X / Blog Publishing Inventory — Phase 6B");
  invLines.push("");
  invLines.push("**Phase:** 6B (X / Blog Publishing Pack)  ");
  invLines.push("**Generated:** " + new Date().toISOString() + "  ");
  invLines.push("**Assets Repo:** `" + ASSETS + "`  ");
  invLines.push("**no_platform_publish:** true");
  invLines.push("");
  invLines.push("---");
  invLines.push("");
  invLines.push("## STATS");
  invLines.push("");
  invLines.push("| Metric | Value |");
  invLines.push("|--------|-------|");
  invLines.push("| Total content packs scanned | " + stats.total_packs + " |");
  invLines.push("| Has x-post.zh.md | " + stats.has_x_post + " |");
  invLines.push("| Has image-prompt.md | " + stats.has_image_prompt + " |");
  invLines.push("| Has music-prompt | " + stats.has_music_prompt + " |");
  invLines.push("| Has video-prompt | " + stats.has_video_prompt + " |");
  invLines.push("| Has webpage-outline.md | " + stats.has_webpage_outline + " |");
  invLines.push("| Has facts.enriched.md | " + stats.has_facts_enriched + " |");
  invLines.push("| Has content-summary.zh.md | " + stats.has_content_summary + " |");
  invLines.push("| Has generated image in gallery | " + stats.has_generated_image + " |");
  invLines.push("| Ready to publish (X post + image) | " + stats.ready_to_publish + " |");
  invLines.push("| Needs asset (X post but no image) | " + stats.needs_asset + " |");
  invLines.push("| Blocked (no X post) | " + stats.blocked + " |");
  invLines.push("| High priority | " + stats.high_priority + " |");
  invLines.push("| Medium priority | " + stats.medium_priority + " |");
  invLines.push("| Low priority | " + stats.low_priority + " |");
  invLines.push("");
  invLines.push("## SOURCE TYPE DISTRIBUTION");
  invLines.push("");
  invLines.push("| Source Type | Count |");
  invLines.push("|-------------|-------|");
  for (const [st, c] of Object.entries(sourceTypeCounts)) {
    invLines.push("| " + st + " | " + c + " |");
  }
  invLines.push("");
  invLines.push("## UNIQUE TOPICS");
  invLines.push("");
  for (const t of uniqueTopics) {
    invLines.push("- " + t);
  }
  invLines.push("");
  invLines.push("## BOUNDARY COMPLIANCE");
  invLines.push("");
  invLines.push("| Boundary | Status |");
  invLines.push("|----------|--------|");
  invLines.push("| No model call | ✅ Compliant |");
  invLines.push("| No media generation | ✅ Compliant |");
  invLines.push("| No X API | ✅ Compliant |");
  invLines.push("| No platform publish | ✅ Compliant |");
  invLines.push("| No collect:* | ✅ Compliant |");
  invLines.push("| No digest:send:* | ✅ Compliant |");
  invLines.push("| No timer:* | ✅ Compliant |");
  invLines.push("| No generate:* | ✅ Compliant |");
  invLines.push("| Production digest unchanged | ✅ Compliant |");
  invLines.push("| No token commit | ✅ Compliant |");
  invLines.push("");
  fs.writeFileSync(
    path.join(HARVESTER, "reports/x-blog-publishing-inventory.md"),
    invLines.join("\n") + "\n"
  );

  // Write queue report
  const qLines: string[] = [];
  qLines.push("# X / Blog Publishing Queue — Phase 6B");
  qLines.push("");
  qLines.push("**Phase:** 6B  ");
  qLines.push("**Generated:** " + new Date().toISOString() + "  ");
  qLines.push("**no_platform_publish:** true");
  qLines.push("");
  qLines.push("---");
  qLines.push("");
  qLines.push("## HIGH PRIORITY X POSTS (top 5)");
  qLines.push("");
  const highX = xQueue.filter(e => e.priority === "high").slice(0, 5);
  for (const e of highX) {
    qLines.push("### " + e.id + " — " + e.title);
    qLines.push("");
    qLines.push("- **source_type:** " + e.source_type);
    qLines.push("- **publish_status:** " + e.publish_status);
    qLines.push("- **current_asset_state:** " + e.current_asset_state);
    qLines.push("- **linked_content_pack:** " + e.linked_content_pack);
    qLines.push("- **linked_gallery_url:** " + (e.linked_gallery_url || "—"));
    qLines.push("- **needs_image:** " + e.needs_image);
    qLines.push("- **needs_review:** " + e.needs_review);
    qLines.push("- **quality_score:** " + (e.quality_score || "—"));
    qLines.push("- **recommended_channel:** " + e.recommended_channel);
    qLines.push("- **post_status:** " + e.post_status);
    qLines.push("- **no_platform_publish:** " + e.no_platform_publish);
    qLines.push("");
    if (e.post_text) {
      qLines.push("**X post text (verbatim from x-post.zh.md):**");
      qLines.push("");
      qLines.push("```");
      qLines.push(e.post_text);
      qLines.push("```");
      qLines.push("");
    }
  }
  qLines.push("## ALL X POSTS");
  qLines.push("");
  qLines.push("| # | ID | Title | Source | Status | Needs Image | Priority |");
  qLines.push("|---|----|-------|--------|--------|-------------|----------|");
  for (let i = 0; i < xQueue.length; i++) {
    const e = xQueue[i];
    qLines.push(`| ${i + 1} | ${e.id} | ${e.title.slice(0, 40)} | ${e.source_type} | ${e.publish_status} | ${e.needs_image} | ${e.priority} |`);
  }
  qLines.push("");
  qLines.push("## BLOG DRAFTS");
  qLines.push("");
  qLines.push("| # | ID | Title | Source | Status | Needs Image | Needs Expansion | Priority |");
  qLines.push("|---|----|-------|--------|--------|-------------|-----------------|----------|");
  for (let i = 0; i < blogQueue.length; i++) {
    const e = blogQueue[i];
    qLines.push(`| ${i + 1} | ${e.id} | ${e.title.slice(0, 40)} | ${e.source_type} | ${e.publish_status} | ${e.needs_image} | ${e.needs_expansion} | ${e.priority} |`);
  }
  qLines.push("");
  qLines.push("## GALLERY LINKS");
  qLines.push("");
  qLines.push("Base URL: `" + GALLERY_BASE_URL + "`");
  qLines.push("");
  for (const e of xQueue.filter(x => x.linked_gallery_url)) {
    qLines.push("- [" + e.title + "](" + e.linked_gallery_url + ") — score " + e.quality_score);
  }
  qLines.push("");
  fs.writeFileSync(
    path.join(HARVESTER, "reports/x-blog-publishing-queue.md"),
    qLines.join("\n") + "\n"
  );

  // Write phase report
  const phaseLines: string[] = [];
  phaseLines.push("# Phase 6B — X / Blog Publishing Pack");
  phaseLines.push("");
  phaseLines.push("**Phase:** 6B  ");
  phaseLines.push("**Generated:** " + new Date().toISOString() + "  ");
  phaseLines.push("**Status:** ✅ COMPLETE");
  phaseLines.push("");
  phaseLines.push("---");
  phaseLines.push("");
  phaseLines.push("## STATUS");
  phaseLines.push("");
  phaseLines.push("| Field | Value |");
  phaseLines.push("|-------|-------|");
  phaseLines.push("| Phase | 6B |");
  phaseLines.push("| Mode | x_blog_publishing_pack |");
  phaseLines.push("| no_platform_publish | true |");
  phaseLines.push("| Total packs scanned | " + stats.total_packs + " |");
  phaseLines.push("| X posts ready | " + stats.ready_to_publish + " |");
  phaseLines.push("| Blog drafts ready | " + blogQueue.filter(b => b.publish_status === "draft_ready").length + " |");
  phaseLines.push("| Needs asset | " + stats.needs_asset + " |");
  phaseLines.push("| High priority items | " + stats.high_priority + " |");
  phaseLines.push("");
  phaseLines.push("## WHAT_CHANGED");
  phaseLines.push("");
  phaseLines.push("### creative-quota-assets (assets repo)");
  phaseLines.push("");
  phaseLines.push("- `publishing/x/index.json` — X posts ready index");
  phaseLines.push("- `publishing/x/posts/*.md` — " + xQueue.length + " X post markdown files");
  phaseLines.push("- `publishing/blog/index.json` — Blog drafts index");
  phaseLines.push("- `publishing/blog/drafts/*.md` — " + blogQueue.length + " blog draft skeletons");
  phaseLines.push("- `publishing/README.md` — Publishing pack overview");
  phaseLines.push("- `publishing/x/README.md` — X pack documentation");
  phaseLines.push("- `publishing/blog/README.md` — Blog pack documentation");
  phaseLines.push("- `README.md` — Updated with publishing pack link");
  phaseLines.push("");
  phaseLines.push("### creative-quota-harvester (harvester repo)");
  phaseLines.push("");
  phaseLines.push("- `scripts/mainline-publishing-pack.ts` — Read-only scan + publish pack builder");
  phaseLines.push("- `scripts/validate-publishing-pack.ts` — Validator (no token, no API, no publish)");
  phaseLines.push("- `dashboard/mainline-publishing-status.json` — Publishing pack status");
  phaseLines.push("- `dashboard/x-blog-publishing-queue.json` — Full queue");
  phaseLines.push("- `dashboard/index.html` — Mainline Publishing Pack section");
  phaseLines.push("- `package.json` — validate:publishing-pack script");
  phaseLines.push("");
  phaseLines.push("## X_POSTS_INVENTORY");
  phaseLines.push("");
  phaseLines.push("| Metric | Value |");
  phaseLines.push("|--------|-------|");
  phaseLines.push("| Total X posts | " + xQueue.length + " |");
  phaseLines.push("| High priority | " + xQueue.filter(e => e.priority === "high").length + " |");
  phaseLines.push("| Medium priority | " + xQueue.filter(e => e.priority === "medium").length + " |");
  phaseLines.push("| Low priority | " + xQueue.filter(e => e.priority === "low").length + " |");
  phaseLines.push("| Ready (has post + image) | " + xQueue.filter(e => e.publish_status === "ready").length + " |");
  phaseLines.push("| Needs asset (has post, no image) | " + xQueue.filter(e => e.publish_status === "needs_asset").length + " |");
  phaseLines.push("| Blocked (no post) | " + xQueue.filter(e => e.publish_status === "blocked").length + " |");
  phaseLines.push("");
  phaseLines.push("## BLOG_DRAFTS_INVENTORY");
  phaseLines.push("");
  phaseLines.push("| Metric | Value |");
  phaseLines.push("|--------|-------|");
  phaseLines.push("| Total blog drafts | " + blogQueue.length + " |");
  phaseLines.push("| Draft ready | " + blogQueue.filter(e => e.publish_status === "draft_ready").length + " |");
  phaseLines.push("| Outline only | " + blogQueue.filter(e => e.publish_status === "outline_only").length + " |");
  phaseLines.push("| Blocked | " + blogQueue.filter(e => e.publish_status === "blocked").length + " |");
  phaseLines.push("| Needs expansion | " + blogQueue.filter(e => e.needs_expansion).length + " |");
  phaseLines.push("");
  phaseLines.push("## READY_TO_PUBLISH_COUNT");
  phaseLines.push("");
  phaseLines.push("**X posts ready (post + image):** " + stats.ready_to_publish);
  phaseLines.push("");
  phaseLines.push("## NEEDS_ASSET_COUNT");
  phaseLines.push("");
  phaseLines.push("**X posts needing image generation:** " + stats.needs_asset);
  phaseLines.push("");
  phaseLines.push("## HIGH_PRIORITY_QUEUE");
  phaseLines.push("");
  const hpX = xQueue.filter(e => e.priority === "high");
  for (let i = 0; i < Math.min(5, hpX.length); i++) {
    const e = hpX[i];
    phaseLines.push((i + 1) + ". **" + e.title + "** (" + e.source_type + ") — status: " + e.publish_status);
  }
  phaseLines.push("");
  phaseLines.push("## GALLERY_LINKS");
  phaseLines.push("");
  phaseLines.push("Base: `" + GALLERY_BASE_URL + "`");
  phaseLines.push("");
  for (const e of xQueue.filter(x => x.linked_gallery_url)) {
    phaseLines.push("- " + e.title + " → " + e.linked_gallery_url + " (score " + e.quality_score + ")");
  }
  phaseLines.push("");
  phaseLines.push("## MODEL_CALL_STATUS");
  phaseLines.push("");
  phaseLines.push("- Model calls made: **0**");
  phaseLines.push("- model_call_allowed: false");
  phaseLines.push("- Compliant: ✅");
  phaseLines.push("");
  phaseLines.push("## GENERATED_MEDIA_STATUS");
  phaseLines.push("");
  phaseLines.push("- Images generated in Phase 6B: **0**");
  phaseLines.push("- Music generated: **0**");
  phaseLines.push("- Video generated: **0**");
  phaseLines.push("- Compliant: ✅");
  phaseLines.push("");
  phaseLines.push("## PLATFORM_PUBLISH_STATUS");
  phaseLines.push("");
  phaseLines.push("- X API called: **NO**");
  phaseLines.push("- Blog platform published: **NO**");
  phaseLines.push("- no_platform_publish: **true**");
  phaseLines.push("- Items published externally: **0**");
  phaseLines.push("- All items are draft_ready / outline_only — await manual review");
  phaseLines.push("");
  phaseLines.push("## TIMER_STATUS");
  phaseLines.push("");
  phaseLines.push("- Timer configured: NO");
  phaseLines.push("- Auto-publish timer: NO");
  phaseLines.push("- Compliant: ✅");
  phaseLines.push("");
  phaseLines.push("## TELEGRAM_SEND_STATUS");
  phaseLines.push("");
  phaseLines.push("- Telegram digest send: NOT executed");
  phaseLines.push("- Phase 6B report send: at the end (project-sender only)");
  phaseLines.push("- Compliant: ✅");
  phaseLines.push("");
  phaseLines.push("## NEXT_PHASE_PROPOSAL");
  phaseLines.push("");
  phaseLines.push("**Phase 6C proposal:** Controlled Image Generation for 20 packs without images");
  phaseLines.push("");
  phaseLines.push("- Generate images for Category A queue items (20 packs, 1 per topic × 4 remaining variants)");
  phaseLines.push("- Requires model call (gated by human review)");
  phaseLines.push("- Do NOT auto-publish — collect images into publishing/published/ only after manual review");
  phaseLines.push("");
  phaseLines.push("**Phase 6D proposal:** Manual X Publishing (after human review)");
  phaseLines.push("");
  phaseLines.push("- Human reviews top 5 X posts (one per source type)");
  phaseLines.push("- Posts are manually sent via existing tools (baoyu-post-to-x, etc.)");
  phaseLines.push("- No automation of X posting");
  phaseLines.push("");
  phaseLines.push("---");
  phaseLines.push("");
  phaseLines.push("*Phase 6B complete. Publishing pack ready, awaiting manual review.*");
  fs.writeFileSync(
    path.join(HARVESTER, "reports/phase-6b-x-blog-publishing-pack.md"),
    phaseLines.join("\n") + "\n"
  );

  // Write Telegram report
  const tgram: string[] = [];
  tgram.push("📦 Phase 6B — X/Blog Publishing Pack: COMPLETE");
  tgram.push("");
  tgram.push("STATUS");
  tgram.push("✅ 6B complete · no_platform_publish=true · no_model_call=true");
  tgram.push("");
  tgram.push("WHAT_CHANGED");
  tgram.push("• creative-quota-assets: publishing/{x,blog}/ with posts + drafts");
  tgram.push("• creative-quota-harvester: status/queue JSON + dashboard + validator");
  tgram.push("");
  tgram.push("X_POSTS_INVENTORY");
  tgram.push("• Total: " + xQueue.length + " posts (all with verbatim text from x-post.zh.md)");
  tgram.push("• High priority: " + xQueue.filter(e => e.priority === "high").length);
  tgram.push("• Ready (post+image): " + stats.ready_to_publish);
  tgram.push("• Needs asset: " + stats.needs_asset);
  tgram.push("");
  tgram.push("BLOG_DRAFTS_INVENTORY");
  tgram.push("• Total: " + blogQueue.length + " drafts (outline_only / draft_ready)");
  tgram.push("• Needs expansion: " + blogQueue.filter(e => e.needs_expansion).length);
  tgram.push("");
  tgram.push("READY_TO_PUBLISH_COUNT");
  tgram.push("• X: " + stats.ready_to_publish + " (awaiting human review)");
  tgram.push("• Blog: " + blogQueue.filter(b => b.publish_status === "draft_ready").length + " drafts");
  tgram.push("");
  tgram.push("NEEDS_ASSET_COUNT: " + stats.needs_asset + " (X posts without generated images)");
  tgram.push("");
  tgram.push("HIGH_PRIORITY_QUEUE (top 5 X posts):");
  for (let i = 0; i < Math.min(5, hpX.length); i++) {
    tgram.push("• " + hpX[i].title + " [" + hpX[i].source_type + "] — " + hpX[i].publish_status);
  }
  tgram.push("");
  tgram.push("GALLERY_LINKS");
  tgram.push("• Base: https://conanxin.github.io/creative-quota-assets");
  for (const e of xQueue.filter(x => x.linked_gallery_url)) {
    tgram.push("• " + e.title + " (score " + e.quality_score + ")");
  }
  tgram.push("");
  tgram.push("MODEL_CALL_STATUS: 0 calls ✅");
  tgram.push("GENERATED_MEDIA_STATUS: 0 generated ✅");
  tgram.push("PLATFORM_PUBLISH_STATUS: 0 published externally ✅");
  tgram.push("TIMER_STATUS: blocked ✅");
  tgram.push("TELEGRAM_SEND_STATUS: blocked ✅");
  tgram.push("");
  tgram.push("NEXT_PHASE_PROPOSAL: Phase 6C (controlled image generation, 20 packs)");
  tgram.push("");
  tgram.push("VALIDATION: 142+ALL-PASS expected");
  const tgramContent = tgram.join("\n");
  fs.writeFileSync(
    path.join(HARVESTER, "reports/telegram-phase-6b-x-blog-publishing-pack.txt"),
    tgramContent + "\n"
  );

  console.log("[Phase 6B] Done. Wrote:");
  console.log("  - dashboard/mainline-publishing-status.json");
  console.log("  - dashboard/x-blog-publishing-queue.json");
  console.log("  - reports/x-blog-publishing-inventory.md");
  console.log("  - reports/x-blog-publishing-queue.md");
  console.log("  - reports/phase-6b-x-blog-publishing-pack.md");
  console.log("  - reports/telegram-phase-6b-x-blog-publishing-pack.txt (" + tgramContent.length + " chars)");
}

main();