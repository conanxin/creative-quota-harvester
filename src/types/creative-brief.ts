/**
 * src/types/creative-brief.ts — Creative Brief data structure
 * Phase 2A: Creative Brief Engine
 */

export interface FactualBasis {
  source_signal_ids: string[];
  source_types: string[];
  source_titles: string[];
  source_urls: string[];
  key_facts: string[];
  source_confidence: "high" | "medium" | "low";
}

export interface CreativeBrief {
  id: string;
  title: string;
  source_signal_ids: string[];
  source_types: string[];
  source_titles: string[];
  source_urls: string[];
  summary: string;
  why_it_matters: string;
  content_angle: string;
  target_audience: string;
  factual_basis: FactualBasis;
  uncertainty_notes: string[];
  recommended_assets: string[]; // e.g. ["x-post", "image", "video", "music", "webpage"]
  tags: string[];
  final_score: number;
  created_at: string;
}