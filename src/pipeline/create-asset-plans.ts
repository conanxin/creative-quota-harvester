/**
 * src/pipeline/create-asset-plans.ts
 * Phase 2A: Generate Asset Plans from Creative Briefs
 *
 * Template-based generation (no MiniMax call).
 * Asset generation with MiniMax is Phase 2B.
 */
import type { CreativeBrief } from "../types/creative-brief";
import type { AssetPlan, AssetOutput } from "../types/asset-plan";
import { generateId } from "../sources/utils";

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function estimatePriority(score: number): "high" | "medium" | "low" {
  if (score >= 0.65) return "high";
  if (score >= 0.50) return "medium";
  return "low";
}

function generateXPost(brief: CreativeBrief): { zh: string; en: string } {
  const zh = `📌 ${brief.title}\n\n${brief.why_it_matters}\n\n${brief.content_angle}\n\n#AI #创意 #${brief.tags.slice(0,3).join(" #")}`;
  const en = `📌 ${brief.title}\n\n${brief.why_it_matters}\n\n${brief.content_angle}\n\n#AI #creative #${brief.tags.slice(0,3).join(" #")}`;
  return { zh, en };
}

function generateImagePrompt(brief: CreativeBrief): string {
  const type = brief.source_types[0] || "tech";
  const prompts: Record<string, string[]> = {
    "code": [
      `A clean, modern visualization of "${brief.title}" — code flowing like rivers of light on a dark interface, futuristic data streams, minimal aesthetic`,
      `Abstract representation of open source AI tools — interconnected nodes glowing in blue and purple, dark background, tech art style`,
    ],
    "academic": [
      `A scholarly yet vibrant illustration of "${brief.title}" — neural networks intertwined with classical manuscripts, warm lighting, academic aesthetic`,
      `Conceptual visualization of AI research — geometric patterns merging with organic forms, deep blue and gold tones, contemplative mood`,
    ],
    "ai-ecosystem": [
      `A breathtaking visualization of AI model ecosystem — "${brief.title}" as a central star with radiating capabilities, holographic style`,
      `Futuristic depiction of machine learning landscape — flowing data streams, glowing nodes, cyberpunk meets academic aesthetic`,
    ],
    "dev-community": [
      `A warm, human-centered illustration of developer experience — "${brief.title}" theme, soft lighting, collaborative atmosphere`,
      `Minimalist tech illustration — a developer workspace with AI assistant elements, clean lines, inviting color palette`,
    ],
    "culture-art": [
      `Museum-quality illustration inspired by "${brief.title}" — classical techniques meet digital art, rich textures, museum lighting`,
      `Artistic visualization of cultural heritage — "${brief.title}" reimagined with modern AI aesthetic, dramatic lighting, museum backdrop`,
    ],
    "context": [
      `Serene illustration of "${brief.title}" — natural elements with subtle AI integration, peaceful mood, warm natural light`,
      `Minimalist scene capturing the essence of "${brief.title}" — poetic, contemplative, soft color palette`,
    ],
    "news": [
      `Editorial illustration of "${brief.title}" — professional yet dynamic, newsprint aesthetic meets digital, bold colors`,
    ],
  };
  const candidates = prompts[type] || prompts["code"];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function generateVideoPrompt(brief: CreativeBrief): string {
  return `Cinematic video sequence: opening with "${brief.title}" concept visualization, 5-second establishing shot, smooth camera movement, warm color grade, ending on a reflective moment — high production value, professional voiceover ready`;
}

function generateMusicPrompt(brief: CreativeBrief): string {
  return `Ambient music track inspired by "${brief.title}" — soft synthesizer pads, gentle rhythmic pulses, contemplative mood, 60-90 seconds, suitable for tech/creative content background`;
}

function generateWebpageOutline(brief: CreativeBrief): string {
  return `# ${brief.title}\n\n## Overview\n${brief.why_it_matters}\n\n## Key Insights\n${brief.content_angle}\n\n## Factual Basis\n${brief.factual_basis.key_facts.map((f, i) => `${i+1}. ${f}`).join("\n")}\n\n## Recommended Assets\n${brief.recommended_assets.join(", ")}\n\n## Further Reading\n${brief.source_urls.map(u => `- ${u}`).join("\n")}`;
}

export function createAssetPlans(briefs: CreativeBrief[]): AssetPlan[] {
  return briefs.map(brief => {
    const outputs: AssetOutput[] = brief.recommended_assets.map(assetType => ({
      type: assetType as AssetOutput["type"],
      priority: estimatePriority(brief.final_score),
    }));

    const xPost = generateXPost(brief);
    const targetDir = `brief-${brief.id.slice(0, 16)}-${slugify(brief.title)}`;

    const plan: AssetPlan = {
      brief_id: brief.id,
      brief_title: brief.title,
      recommended_outputs: outputs,
      x_post: xPost,
      image_prompt: brief.recommended_assets.includes("image") ? generateImagePrompt(brief) : undefined,
      video_prompt: brief.recommended_assets.includes("video") ? generateVideoPrompt(brief) : undefined,
      music_prompt: brief.recommended_assets.includes("music") ? generateMusicPrompt(brief) : undefined,
      webpage_outline: brief.recommended_assets.includes("webpage") ? generateWebpageOutline(brief) : undefined,
      asset_repo_target_dir: targetDir,
      estimated_generation_priority: estimatePriority(brief.final_score),
      created_at: new Date().toISOString(),
    };

    return plan;
  });
}