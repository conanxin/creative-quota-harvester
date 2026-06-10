/**
 * plan-assets.ts — Pipeline Stage 5: Plan Assets
 * Phase: 0A (stub with mock data)
 */
import type { CreativeBrief } from "../sources/types";
import type { AssetPlan, PlannedAsset } from "../sources/types";

export async function planAssets(briefs: CreativeBrief[]): Promise<AssetPlan[]> {
  console.log(`[plan-assets] Phase 0A dry-run: planning assets for ${briefs.length} briefs`);

  const plans: AssetPlan[] = [
    {
      id: "plan-001",
      briefId: "brief-001",
      assets: [
        {
          type: "image",
          priority: 1,
          prompt: "A futuristic neural network visualization with autonomous AI agents in a state of flow, floating holographic interfaces, deep blue and cyan color palette, cinematic lighting, particle effects, 8K detail, concept art style",
          estimatedTokens: 50000,
          style: "cinematic concept art",
          dimensions: { width: 1024, height: 1024 },
        },
        {
          type: "prompt-text",
          priority: 2,
          prompt: "A futuristic neural network visualization with autonomous AI agents in a state of flow, floating holographic interfaces, deep blue and cyan color palette, cinematic lighting, particle effects, 8K detail, concept art style\n\nStyle: Cinematic concept art\nMood: Mysterious, high-tech, serene\nComposition: Central neural core with radiating agent nodes",
          estimatedTokens: 5000,
        },
        {
          type: "prompt-text",
          priority: 3,
          prompt: "Multi-agent AI system visualization showing agents in collaborative flow, conversation bubbles, tool usage, memory sharing, emergent orchestration, holographic UI, dark sci-fi aesthetic, 8K",
          estimatedTokens: 5000,
        },
      ],
      totalEstimatedTokens: 60000,
      createdAt: "2026-06-10T15:52:00Z",
    },
    {
      id: "plan-002",
      briefId: "brief-002",
      assets: [
        {
          type: "prompt-text",
          priority: 1,
          prompt: "Ancient Egyptian broad collar (wesekh) necklace, gold and faience beads, inlaid semi-precious stones, funerary context, New Kingdom dynasty style, detailed textile background, museum lighting, photographic quality\n\nStyle: Museum photography with dramatic lighting\nMood: Regal, ancient, reverent\nComposition: Centered jewelry piece with shallow depth of field",
          estimatedTokens: 5000,
        },
      ],
      totalEstimatedTokens: 5000,
      createdAt: "2026-06-10T15:52:00Z",
    },
  ];

  console.log(`[plan-assets] Created ${plans.length} asset plans`);
  return plans;
}

export default planAssets;