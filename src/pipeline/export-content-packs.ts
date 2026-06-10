/**
 * src/pipeline/export-content-packs.ts
 * Phase 2A: Export Creative Briefs + Asset Plans to creative-quota-assets repo
 */
import * as fs from "fs";
import * as path from "path";
import type { CreativeBrief } from "../types/creative-brief";
import type { AssetPlan } from "../types/asset-plan";

export interface ContentPackExport {
  brief: CreativeBrief;
  plan: AssetPlan;
  pack_dir: string;
  files_written: string[];
}

export interface ExportManifest {
  exported_at: string;
  pack_count: number;
  briefs: Array<{
    id: string;
    title: string;
    source_types: string[];
    final_score: number;
    pack_dir: string;
  }>;
  total_files: number;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath: string, content: string) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function exportContentPacks(options: {
  briefs: CreativeBrief[];
  plans: AssetPlan[];
  assetRepoDir: string;
  dateStr?: string;
}): ExportManifest {
  const { assetRepoDir, dateStr = new Date().toISOString().slice(0, 10) } = options;
  const [year, month] = dateStr.slice(0, 7).split("-");
  const baseDir = path.join(assetRepoDir, "content-packs", year, month, dateStr);
  ensureDir(baseDir);

  const packs: ContentPackExport[] = [];
  let totalFiles = 0;

  for (const brief of options.briefs) {
    const plan = options.plans.find(p => p.brief_id === brief.id) || options.plans[0];
    const dirName = `brief-${brief.id.slice(0, 16)}-${slugify(brief.title)}`;
    const packDir = path.join(baseDir, dirName);
    ensureDir(packDir);
    const filesWritten: string[] = [];

    // manifest.json
    const manifest = {
      id: brief.id,
      title: brief.title,
      source_types: brief.source_types,
      source_signal_ids: brief.source_signal_ids,
      final_score: brief.final_score,
      recommended_assets: brief.recommended_assets,
      tags: brief.tags,
      created_at: brief.created_at,
      plan_id: plan?.brief_id,
      asset_repo_target_dir: plan?.asset_repo_target_dir,
    };
    writeFile(path.join(packDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    filesWritten.push("manifest.json");

    // source.json
    const sourceJson = {
      source_types: brief.source_types,
      source_titles: brief.source_titles,
      source_urls: brief.source_urls,
    };
    writeFile(path.join(packDir, "source.json"), JSON.stringify(sourceJson, null, 2));
    filesWritten.push("source.json");

    // signal.json
    const signalJson = {
      id: brief.id,
      title: brief.title,
      summary: brief.summary,
      source_signal_ids: brief.source_signal_ids,
    };
    writeFile(path.join(packDir, "signal.json"), JSON.stringify(signalJson, null, 2));
    filesWritten.push("signal.json");

    // brief.md
    const briefMd = [
      `# ${brief.title}`,
      "",
      `**ID:** ${brief.id}`,
      `**Score:** ${brief.final_score.toFixed(3)}`,
      `**Created:** ${brief.created_at}`,
      "",
      `## Summary`,
      brief.summary,
      "",
      `## Why It Matters`,
      brief.why_it_matters,
      "",
      `## Content Angle`,
      brief.content_angle,
      "",
      `## Target Audience`,
      brief.target_audience,
      "",
      `## Recommended Assets`,
      brief.recommended_assets.join(", "),
      "",
      `## Tags`,
      brief.tags.join(", "),
      "",
      `## Uncertainty Notes`,
      ...brief.uncertainty_notes.map(n => `- ${n}`),
      "",
      `## Source Signals`,
      ...brief.source_signal_ids.map((id, i) => `- [${id}](${brief.source_urls[i]})`),
    ].join("\n");
    writeFile(path.join(packDir, "brief.md"), briefMd);
    filesWritten.push("brief.md");

    // facts.md
    const factsMd = [
      `# Factual Basis: ${brief.title}`,
      "",
      `**Source Confidence:** ${brief.factual_basis.source_confidence}`,
      "",
      `## Key Facts`,
      ...brief.factual_basis.key_facts.map((f, i) => `${i+1}. ${f}`),
      "",
      `## Source References`,
      ...brief.factual_basis.source_urls.map((u, i) => `- [${brief.source_titles[i]}](${u})`),
    ].join("\n");
    writeFile(path.join(packDir, "facts.md"), factsMd);
    filesWritten.push("facts.md");

    // x-post.zh.md
    if (plan?.x_post) {
      writeFile(path.join(packDir, "x-post.zh.md"), plan.x_post.zh);
      filesWritten.push("x-post.zh.md");
    }

    // image-prompt.md
    if (plan?.image_prompt) {
      writeFile(path.join(packDir, "image-prompt.md"), plan.image_prompt);
      filesWritten.push("image-prompt.md");
    }

    // video-prompt.md
    if (plan?.video_prompt) {
      writeFile(path.join(packDir, "video-prompt.md"), plan.video_prompt);
      filesWritten.push("video-prompt.md");
    }

    // music-prompt.md
    if (plan?.music_prompt) {
      writeFile(path.join(packDir, "music-prompt.md"), plan.music_prompt);
      filesWritten.push("music-prompt.md");
    }

    // webpage-outline.md
    if (plan?.webpage_outline) {
      writeFile(path.join(packDir, "webpage-outline.md"), plan.webpage_outline);
      filesWritten.push("webpage-outline.md");
    }

    // asset-plan.json
    writeFile(path.join(packDir, "asset-plan.json"), JSON.stringify(plan, null, 2));
    filesWritten.push("asset-plan.json");

    totalFiles += filesWritten.length;
    packs.push({ brief, plan, pack_dir: packDir, files_written: filesWritten });
  }

  const manifest: ExportManifest = {
    exported_at: new Date().toISOString(),
    pack_count: packs.length,
    briefs: packs.map(p => ({
      id: p.brief.id,
      title: p.brief.title,
      source_types: p.brief.source_types,
      final_score: p.brief.final_score,
      pack_dir: p.pack_dir,
    })),
    total_files: totalFiles,
  };

  // Write index.json for this content pack batch
  const indexPath = path.join(baseDir, "index.json");
  fs.writeFileSync(indexPath, JSON.stringify(manifest, null, 2), "utf-8");

  return manifest;
}