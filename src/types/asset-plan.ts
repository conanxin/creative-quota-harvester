/**
 * src/types/asset-plan.ts — Asset Plan data structure
 * Phase 2A: Creative Brief Engine
 */

export interface AssetOutput {
  type: "x-post" | "image" | "video" | "music" | "webpage";
  prompt?: string; // generation prompt for this asset type
  outline?: string; // for webpage
  language?: "zh" | "en";
  priority: "high" | "medium" | "low";
  estimated_tokens?: number; // rough cost proxy
}

export interface AssetPlan {
  brief_id: string;
  brief_title: string;
  recommended_outputs: AssetOutput[];
  x_post?: {
    zh: string;
    en: string;
  };
  image_prompt?: string;
  video_prompt?: string;
  music_prompt?: string;
  webpage_outline?: string;
  asset_repo_target_dir: string;
  estimated_generation_priority: "high" | "medium" | "low";
  created_at: string;
}