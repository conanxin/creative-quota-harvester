#!/usr/bin/env tsx
/**
 * scripts/build-assets-publishing-pack.ts
 * Phase 6B: Read from creative-quota-harvester's publishing queue JSON,
 * write publishing/ files in creative-quota-assets.
 *
 * Strictly read from harvester repo, write to assets repo.
 * No model call, no media generation, no X API, no platform publish.
 */

import * as fs from "fs";
import * as path from "path";

const HOME = process.env.HOME || "/home/ubuntu";
const HARVESTER = path.join(HOME, ".openclaw/workspace/projects/creative-quota-harvester");
const ASSETS = path.join(HOME, ".openclaw/workspace/projects/creative-quota-assets");

function readText(rel: string): string {
  return fs.readFileSync(rel, "utf-8");
}
function readJson(rel: string): any {
  return JSON.parse(fs.readFileSync(rel, "utf-8"));
}
function exists(p: string): boolean { return fs.existsSync(p); }
function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function writeFile(p: string, content: string) { fs.writeFileSync(p, content); }

const queuePath = path.join(HARVESTER, "dashboard/x-blog-publishing-queue.json");
const statusPath = path.join(HARVESTER, "dashboard/mainline-publishing-status.json");

if (!exists(queuePath) || !exists(statusPath)) {
  console.error("Queue/status JSON not found. Run mainline-publishing-pack.ts first.");
  process.exit(1);
}

const queue = readJson(queuePath);
const status = readJson(statusPath);

const xItems = queue.x_queue || [];
const blogItems = queue.blog_queue || [];

ensureDir(path.join(ASSETS, "publishing/x/posts"));
ensureDir(path.join(ASSETS, "publishing/blog/drafts"));

// === publishing/README.md ===
writeFile(path.join(ASSETS, "publishing/README.md"), [
  "# Publishing Pack — Creative Quota Assets",
  "",
  "**Phase:** 6B (X / Blog Publishing Pack)  ",
  "**Generated:** " + new Date().toISOString() + "  ",
  "**no_platform_publish:** true",
  "",
  "---",
  "",
  "## Overview",
  "",
  "This directory contains **ready-to-publish drafts** for X and blog platforms.",
  "All items are `draft_ready` and require **human review** before any external posting.",
  "",
  "**Important:**",
  "- No items have been auto-published.",
  "- No X API has been called.",
  "- All X post text is **verbatim** from the content pack's `x-post.zh.md`.",
  "- All blog drafts are skeletons built from existing `webpage-outline.md` and `content-summary.zh.md`.",
  "",
  "## Directory Structure",
  "",
  "```",
  "publishing/",
  "├── README.md           (this file)",
  "├── x/",
  "│   ├── README.md       (X pack documentation)",
  "│   ├── index.json      (X post index)",
  "│   └── posts/          (" + xItems.length + " X post markdown files)",
  "└── blog/",
  "    ├── README.md       (Blog pack documentation)",
  "    ├── index.json      (Blog draft index)",
  "    └── drafts/         (" + blogItems.length + " blog draft skeletons)",
  "```",
  "",
  "## Status",
  "",
  "| Metric | Value |",
  "|--------|-------|",
  "| Total X posts | " + xItems.length + " |",
  "| X posts ready (post + image) | " + xItems.filter((e: any) => e.publish_status === "ready").length + " |",
  "| X posts needs asset | " + xItems.filter((e: any) => e.publish_status === "needs_asset").length + " |",
  "| Total blog drafts | " + blogItems.length + " |",
  "| Blog drafts draft_ready | " + blogItems.filter((e: any) => e.publish_status === "draft_ready").length + " |",
  "| Blog drafts outline_only | " + blogItems.filter((e: any) => e.publish_status === "outline_only").length + " |",
  "",
  "## How to Use",
  "",
  "1. **Human review** — Read through `x/posts/*.md` and `blog/drafts/*.md`.",
  "2. **Manual posting** — Use existing tools (baoyu-post-to-x, etc.) to post manually.",
  "3. **No automation** — Do not set up timers or cron jobs for posting.",
  "4. **Track outcomes** — When manually posted, update `no_platform_publish` in any validator JSON if needed.",
  "",
  "## Boundaries",
  "",
  "- ❌ No X API calls",
  "- ❌ No platform auto-publish",
  "- ❌ No model calls (drafts built from existing text only)",
  "- ❌ No media generation",
  "- ✅ Human review required before any post",
  "- ✅ All text is verbatim from existing content packs",
  "",
].join("\n") + "\n");

// === publishing/x/README.md ===
writeFile(path.join(ASSETS, "publishing/x/README.md"), [
  "# X Publishing Pack",
  "",
  "**Phase:** 6B  ",
  "**Generated:** " + new Date().toISOString() + "  ",
  "**no_platform_publish:** true",
  "",
  "---",
  "",
  "## Overview",
  "",
  "**" + xItems.length + " X post drafts** ready for human review and manual posting.",
  "All text is **verbatim** from each content pack's `x-post.zh.md` file.",
  "No X API has been called. No posts have been sent to X.",
  "",
  "## Files",
  "",
  "- `index.json` — machine-readable index of all X posts",
  "- `posts/<slug>.md` — " + xItems.length + " post markdown files",
  "",
  "## Status Summary",
  "",
  "| Status | Count |",
  "|--------|-------|",
  "| ready (has post + image) | " + xItems.filter((e: any) => e.publish_status === "ready").length + " |",
  "| needs_asset (has post, no image) | " + xItems.filter((e: any) => e.publish_status === "needs_asset").length + " |",
  "| blocked (no post) | " + xItems.filter((e: any) => e.publish_status === "blocked").length + " |",
  "",
  "## Source Type Distribution",
  "",
  "| Source Type | Count |",
  "|-------------|-------|",
].concat(
  Object.entries(
    xItems.reduce((acc: Record<string, number>, e: any) => {
      acc[e.source_type] = (acc[e.source_type] || 0) + 1;
      return acc;
    }, {})
  ).map(([k, v]) => `| ${k} | ${v} |`)
).join("\n") + "\n\n## Manual Posting Workflow\n\n1. Open `index.json` to see all post IDs and statuses.\n2. Read each `posts/<slug>.md` file.\n3. For `ready` posts, optionally use the linked gallery image as the X post image.\n4. For `needs_asset` posts, the text is ready but the image needs to be generated first (Phase 6C).\n5. Post manually using existing tools (baoyu-post-to-x, etc.).\n6. Do not automate.\n");

// === publishing/x/index.json ===
const xIndex = {
  phase: "6B",
  mode: "x_publishing_index",
  generated_at: new Date().toISOString(),
  no_platform_publish: true,
  no_x_api: true,
  total_posts: xItems.length,
  source: "creative-quota-assets/content-packs/**/x-post.zh.md (verbatim)",
  posts: xItems.map((e: any) => ({
    id: e.id,
    title: e.title,
    title_slug: e.title_slug,
    source_type: e.source_type,
    source_label_zh: e.source_label_zh,
    linked_content_pack: e.linked_content_pack,
    linked_content_pack_url: e.linked_content_pack_url,
    linked_gallery_url: e.linked_gallery_url,
    linked_image_url: e.linked_image_url,
    linked_review_url: e.linked_review_url,
    needs_image: e.needs_image,
    priority: e.priority,
    publish_status: e.publish_status,
    quality_score: e.quality_score,
    post_status: e.post_status,
    no_platform_publish: true,
    file: "publishing/x/posts/" + e.title_slug + ".md",
  })),
};
writeFile(path.join(ASSETS, "publishing/x/index.json"), JSON.stringify(xIndex, null, 2) + "\n");

// === publishing/x/posts/*.md ===
for (const e of xItems) {
  const slug = e.title_slug;
  const lines: string[] = [];
  lines.push("# " + e.title);
  lines.push("");
  lines.push("**Phase:** 6B (X Publishing Pack)  ");
  lines.push("**Generated:** " + new Date().toISOString() + "  ");
  lines.push("**post_status:** draft_ready  ");
  lines.push("**no_platform_publish:** true");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Metadata");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|-------|-------|");
  lines.push("| ID | " + e.id + " |");
  lines.push("| Title | " + e.title + " |");
  lines.push("| Source type | " + e.source_type + " |");
  lines.push("| Source label (zh) | " + e.source_label_zh + " |");
  lines.push("| Linked content pack | " + e.linked_content_pack + " |");
  lines.push("| Content pack URL | " + e.linked_content_pack_url + " |");
  lines.push("| Gallery URL | " + (e.linked_gallery_url || "—") + " |");
  lines.push("| Image URL | " + (e.linked_image_url || "—") + " |");
  lines.push("| Review URL | " + (e.linked_review_url || "—") + " |");
  lines.push("| Needs image | " + e.needs_image + " |");
  lines.push("| Quality score | " + (e.quality_score || "—") + " |");
  lines.push("| Priority | " + e.priority + " |");
  lines.push("| Publish status | " + e.publish_status + " |");
  lines.push("");
  lines.push("## X Post Text (verbatim from x-post.zh.md)");
  lines.push("");
  if (e.post_text && e.post_text.trim().length > 0) {
    lines.push("```");
    lines.push(e.post_text);
    lines.push("```");
  } else {
    lines.push("_(missing — flagged in publish_status)_");
  }
  lines.push("");
  lines.push("## Suggested Posting Note");
  lines.push("");
  lines.push("- This post is **draft_ready** and requires human review before posting.");
  lines.push("- Posting is **manual only** — no automation, no X API.");
  if (e.linked_image_url) {
    lines.push("- Image available: " + e.linked_image_url);
  } else {
    lines.push("- No image available — post text only, or generate image first via Phase 6C.");
  }
  lines.push("- Recommended channel: " + e.recommended_channel);
  lines.push("");
  lines.push("## Safety Note");
  lines.push("");
  lines.push("- **not published automatically**");
  lines.push("- **no X API called**");
  lines.push("- All text is verbatim from the content pack — no rewriting.");
  lines.push("");
  writeFile(path.join(ASSETS, "publishing/x/posts/" + slug + ".md"), lines.join("\n") + "\n");
}

// === publishing/blog/README.md ===
writeFile(path.join(ASSETS, "publishing/blog/README.md"), [
  "# Blog Publishing Pack",
  "",
  "**Phase:** 6B  ",
  "**Generated:** " + new Date().toISOString() + "  ",
  "**no_platform_publish:** true",
  "",
  "---",
  "",
  "## Overview",
  "",
  "**" + blogItems.length + " blog draft skeletons** built from existing content pack materials.",
  "Drafts are `outline_only` or `draft_ready` — no long-form writing was performed.",
  "No blog platform has been published to.",
  "",
  "## Files",
  "",
  "- `index.json` — machine-readable index of all blog drafts",
  "- `drafts/<slug>.md` — " + blogItems.length + " draft markdown files",
  "",
  "## Status Summary",
  "",
  "| Status | Count |",
  "|--------|-------|",
  "| draft_ready (has webpage-outline + content-summary) | " + blogItems.filter((e: any) => e.publish_status === "draft_ready").length + " |",
  "| outline_only (no webpage-outline) | " + blogItems.filter((e: any) => e.publish_status === "outline_only").length + " |",
  "| blocked | " + blogItems.filter((e: any) => e.publish_status === "blocked").length + " |",
  "| Needs expansion | " + blogItems.filter((e: any) => e.needs_expansion).length + " |",
  "",
  "## Source Type Distribution",
  "",
  "| Source Type | Count |",
  "|-------------|-------|",
].concat(
  Object.entries(
    blogItems.reduce((acc: Record<string, number>, e: any) => {
      acc[e.source_type] = (acc[e.source_type] || 0) + 1;
      return acc;
    }, {})
  ).map(([k, v]) => `| ${k} | ${v} |`)
).join("\n") + "\n\n## Manual Expansion Workflow\n\n1. Open `index.json` to see all draft IDs and statuses.\n2. Read each `drafts/<slug>.md` file.\n3. For `draft_ready` drafts, the structure is already in place — add 2-3 paragraphs per section.\n4. For `outline_only` drafts, the `webpage-outline.md` is missing — copy from the content pack or use `content-summary.zh.md`.\n5. Expand manually using your preferred writing tool.\n6. Do not auto-publish to any blog platform.\n7. Do not call models to expand — preserve the verbatim facts from the content pack.\n");

// === publishing/blog/index.json ===
const blogIndex = {
  phase: "6B",
  mode: "blog_publishing_index",
  generated_at: new Date().toISOString(),
  no_platform_publish: true,
  total_drafts: blogItems.length,
  source: "creative-quota-assets/content-packs/**/webpage-outline.md, content-summary.zh.md, facts.enriched.md",
  drafts: blogItems.map((e: any) => ({
    id: e.id,
    title: e.title,
    title_slug: e.title_slug,
    source_type: e.source_type,
    source_label_zh: e.source_label_zh,
    one_sentence_summary: e.one_sentence_summary,
    linked_content_pack: e.linked_content_pack,
    linked_content_pack_url: e.linked_content_pack_url,
    linked_gallery_url: e.linked_gallery_url,
    linked_image_url: e.linked_image_url,
    needs_image: e.needs_image,
    needs_expansion: e.needs_expansion,
    priority: e.priority,
    publish_status: e.publish_status,
    quality_score: e.quality_score,
    post_status: e.post_status,
    no_platform_publish: true,
    file: "publishing/blog/drafts/" + e.title_slug + ".md",
  })),
};
writeFile(path.join(ASSETS, "publishing/blog/index.json"), JSON.stringify(blogIndex, null, 2) + "\n");

// === publishing/blog/drafts/*.md ===
for (const e of blogItems) {
  const slug = e.title_slug;
  const packDir = path.join(ASSETS, "content-packs");
  // find content pack dir by slug
  let packFound: string | null = null;
  function findPack(dir: string): string | null {
    if (!fs.existsSync(dir)) return null;
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) {
        if (entry === e.linked_content_pack) return full;
        const deeper = findPack(full);
        if (deeper) return deeper;
      }
    }
    return null;
  }
  packFound = findPack(packDir);

  const lines: string[] = [];
  lines.push("# " + e.title);
  lines.push("");
  lines.push("**Phase:** 6B (Blog Publishing Pack)  ");
  lines.push("**Generated:** " + new Date().toISOString() + "  ");
  lines.push("**post_status:** " + e.post_status + "  ");
  lines.push("**no_platform_publish:** true");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Metadata");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|-------|-------|");
  lines.push("| ID | " + e.id + " |");
  lines.push("| Title | " + e.title + " |");
  lines.push("| Source type | " + e.source_type + " |");
  lines.push("| Linked content pack | " + e.linked_content_pack + " |");
  lines.push("| Content pack URL | " + e.linked_content_pack_url + " |");
  lines.push("| Gallery URL | " + (e.linked_gallery_url || "—") + " |");
  lines.push("| Image URL | " + (e.linked_image_url || "—") + " |");
  lines.push("| Needs image | " + e.needs_image + " |");
  lines.push("| Needs expansion | " + e.needs_expansion + " |");
  lines.push("| Priority | " + e.priority + " |");
  lines.push("| Publish status | " + e.publish_status + " |");
  lines.push("");
  lines.push("## Short Summary");
  lines.push("");
  if (e.one_sentence_summary) {
    lines.push(e.one_sentence_summary);
  } else {
    lines.push("_(no one_sentence_summary available — see content pack)_");
  }
  lines.push("");
  lines.push("## Source Facts (from content pack)");
  lines.push("");
  if (packFound) {
    const factsPath = path.join(packFound, "facts.enriched.md");
    if (fs.existsSync(factsPath)) {
      const facts = readText(factsPath);
      lines.push("```");
      lines.push(facts.slice(0, 1500) + (facts.length > 1500 ? "\n..." : ""));
      lines.push("```");
    } else {
      lines.push("_(facts.enriched.md not found)_");
    }
  } else {
    lines.push("_(content pack not found)_");
  }
  lines.push("");
  lines.push("## Related Prompts");
  lines.push("");
  lines.push("- Image prompt: `" + e.linked_content_pack + "/image-prompt.md`");
  lines.push("- Music prompt: `" + e.linked_content_pack + "/music-prompt.enriched.md`");
  if (e.source_type === "ai-ecosystem") {
    lines.push("- Video prompt: `" + e.linked_content_pack + "/video-prompt.enriched.md`");
  }
  lines.push("");
  lines.push("## Gallery Links");
  lines.push("");
  if (e.linked_gallery_url) {
    lines.push("- Image: " + e.linked_gallery_url + " (score " + e.quality_score + ")");
    lines.push("- Review: " + (e.linked_image_url || "").replace(/\.jpg$/, ".review.zh.md"));
  } else {
    lines.push("- No image generated yet — generate via Phase 6C first.");
  }
  lines.push("");
  lines.push("## Suggested Structure");
  lines.push("");
  lines.push("1. **Introduction** — Open with the one-sentence summary. Why does this matter?");
  lines.push("2. **Background** — Use the source facts verbatim. Do not invent.");
  lines.push("3. **Why it matters** — Connect to the broader signal/trend.");
  lines.push("4. **Visual asset** — Reference the generated image (if available).");
  lines.push("5. **Related prompts** — Link the image/music/video prompts.");
  lines.push("6. **Further reading** — Link to source (HuggingFace, Met Collection, etc.)");
  lines.push("");
  lines.push("## Safety Note");
  lines.push("");
  lines.push("- **not published automatically**");
  lines.push("- **no blog platform auto-publish**");
  lines.push("- All facts are verbatim from the content pack — no rewriting, no invention.");
  if (e.needs_expansion) {
    lines.push("- ⚠️ This draft needs_expansion=true — no `webpage-outline.md` was found in the content pack.");
  }
  lines.push("");
  writeFile(path.join(ASSETS, "publishing/blog/drafts/" + slug + ".md"), lines.join("\n") + "\n");
}

console.log("[Phase 6B Assets] Publishing pack built:");
console.log("  - publishing/README.md");
console.log("  - publishing/x/README.md");
console.log("  - publishing/x/index.json");
console.log("  - publishing/x/posts/*.md (" + xItems.length + " files)");
console.log("  - publishing/blog/README.md");
console.log("  - publishing/blog/index.json");
console.log("  - publishing/blog/drafts/*.md (" + blogItems.length + " files)");