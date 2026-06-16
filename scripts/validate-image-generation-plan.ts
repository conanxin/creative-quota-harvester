#!/usr/bin/env ts-node
/**
 * Phase 6E-B Controlled Image Generation Plan Validator
 *
 * Validates the structure and content of:
 * - dashboard/image-generation-plan.json (this repo)
 * - assets-repo/dashboard/image-generation-plan.json (mirror)
 *
 * Strict boundaries:
 * - READ-ONLY validator. Does not call any model or generate any media.
 * - Does not send Telegram / trigger timer / promote / publish.
 * - Pure structural check on the PLAN (not on actual generation).
 *
 * Usage:
 *   npx ts-node scripts/validate-image-generation-plan.ts
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const ASSETS_ROOT = path.resolve(ROOT, "..", "creative-quota-assets");

interface PlanItem {
  item_id: string;
  pack_id: string;
  title: string;
  source_type: string;
  risk_level: string;
  score: number;
  aspect_ratio: string;
  watermark: boolean;
  batch: number;
  run: number;
  run_order: number;
  model_recommended: string;
  review_required: boolean;
}

interface PlanRun {
  run_id: string;
  run_order: number;
  items: string[];
  estimated_images: number;
  budget_tier: string;
  human_gate: string;
  preconditions: string[];
  expected_outputs: string[];
}

interface PlanData {
  phase: string;
  mode: string;
  no_model_call: boolean;
  no_media_generation: boolean;
  no_telegram: boolean;
  no_timer: boolean;
  no_x_publish: boolean;
  no_promote: boolean;
  no_c5n_change: boolean;
  no_6d5_modify: boolean;
  no_secrets: boolean;
  stats: {
    total_content_packs: number;
    generated_already: number;
    pending: number;
    first_batch_selected: number;
    diversity_coverage: string;
    runs_planned: number;
    items_per_run: Record<string, number>;
    total_estimated_images_run_1_2_3: number;
  };
  selection_criteria: Record<string, string>;
  items: PlanItem[];
  runs: PlanRun[];
  human_gates: Record<string, {
    description: string;
    decision_owner: string;
    default_decision: string;
  }>;
  safety_strategy: Record<string, unknown>;
  out_of_scope: Record<string, string>;
  boundaries_enforced: Record<string, boolean>;
}

let pass = 0;
let fail = 0;
const errors: string[] = [];

function check(name: string, ok: boolean, detail: string = ""): void {
  if (ok) {
    pass++;
    console.log(`  ✅ ${name}${detail ? "  — " + detail : ""}`);
  } else {
    fail++;
    errors.push(`${name}: ${detail}`);
    console.log(`  ❌ ${name}${detail ? "  — " + detail : ""}`);
  }
}

function validateOne(p: PlanData, label: string): void {
  console.log(`\n=== ${label} ===`);

  check(`${label}: phase === "6E-B"`, p.phase === "6E-B", `got ${p.phase}`);
  check(`${label}: mode === "controlled_image_generation_plan"`, p.mode === "controlled_image_generation_plan", `got ${p.mode}`);

  // Boundary flags
  check(`${label}: no_model_call === true`, p.no_model_call === true);
  check(`${label}: no_media_generation === true`, p.no_media_generation === true);
  check(`${label}: no_telegram === true`, p.no_telegram === true);
  check(`${label}: no_timer === true`, p.no_timer === true);
  check(`${label}: no_x_publish === true`, p.no_x_publish === true);
  check(`${label}: no_promote === true`, p.no_promote === true);
  check(`${label}: no_c5n_change === true`, p.no_c5n_change === true);
  check(`${label}: no_6d5_modify === true`, p.no_6d5_modify === true);
  check(`${label}: no_secrets === true`, p.no_secrets === true);

  // Stats
  check(`${label}: stats.total_content_packs === 25`, p.stats.total_content_packs === 25);
  check(`${label}: stats.generated_already === 5`, p.stats.generated_already === 5);
  check(`${label}: stats.pending === 20`, p.stats.pending === 20);
  check(`${label}: stats.first_batch_selected === 5`, p.stats.first_batch_selected === 5);
  check(`${label}: stats.diversity_coverage === "5/5 source_types"`, p.stats.diversity_coverage === "5/5 source_types");
  check(`${label}: stats.runs_planned === 3`, p.stats.runs_planned === 3);
  check(`${label}: stats.items_per_run.run_1 === 2`, p.stats.items_per_run.run_1 === 2);
  check(`${label}: stats.items_per_run.run_2 === 2`, p.stats.items_per_run.run_2 === 2);
  check(`${label}: stats.items_per_run.run_3 === 1`, p.stats.items_per_run.run_3 === 1);
  check(`${label}: stats.total_estimated_images === 5`, p.stats.total_estimated_images_run_1_2_3 === 5);

  // Items: 5 total, 1 per source_type
  check(`${label}: items count === 5`, p.items.length === 5, `got ${p.items.length}`);
  const sourceTypes = new Set(p.items.map((it) => it.source_type));
  check(`${label}: 5 unique source_types`, sourceTypes.size === 5, `got ${sourceTypes.size}: ${[...sourceTypes].join(",")}`);
  for (const st of ["academic", "code", "ai-ecosystem", "dev-community", "culture-art"]) {
    check(`${label}: source_type=${st} has exactly 1 item`, p.items.filter((it) => it.source_type === st).length === 1);
  }

  // Risk levels
  const cultureArt = p.items.find((it) => it.source_type === "culture-art");
  check(`${label}: culture-art item risk_level === "medium"`, cultureArt?.risk_level === "medium");
  const otherItems = p.items.filter((it) => it.source_type !== "culture-art");
  check(`${label}: all non-culture-art items risk_level === "low"`, otherItems.every((it) => it.risk_level === "low"));

  // Watermark and aspect ratio
  check(`${label}: all items watermark === true (pre-publish safety)`, p.items.every((it) => it.watermark === true));
  const river = p.items.find((it) => it.source_type === "dev-community");
  check(`${label}: dev-community aspect_ratio === "1:1"`, river?.aspect_ratio === "1:1", `got ${river?.aspect_ratio}`);
  const otherAspect = p.items.filter((it) => it.source_type !== "dev-community");
  check(`${label}: non-dev-community items aspect_ratio === "16:9"`, otherAspect.every((it) => it.aspect_ratio === "16:9"));

  // Run distribution
  const run1 = p.items.filter((it) => it.run === 1);
  const run2 = p.items.filter((it) => it.run === 2);
  const run3 = p.items.filter((it) => it.run === 3);
  check(`${label}: run 1 has 2 items`, run1.length === 2);
  check(`${label}: run 2 has 2 items`, run2.length === 2);
  check(`${label}: run 3 has 1 item`, run3.length === 1);
  check(`${label}: culture-art in run 3 (lowest risk ladder last)`, run3[0]?.source_type === "culture-art");

  // Runs array
  check(`${label}: runs array length === 3`, p.runs.length === 3);
  for (const run of p.runs) {
    check(`${label}: run ${run.run_order} has human_gate defined`, !!run.human_gate);
    check(`${label}: run ${run.run_order} has preconditions`, run.preconditions.length >= 1);
    check(`${label}: run ${run.run_order} has expected_outputs`, run.expected_outputs.length >= 1);
  }

  // Human gates
  const requiredGates = ["approve_batch_1", "approve_batch_2", "approve_batch_3", "approve_model_spend"];
  for (const g of requiredGates) {
    const present = Object.keys(p.human_gates).some((k) => k.includes(g));
    check(`${label}: human_gate contains "${g}"`, present);
  }
  check(`${label}: all human_gates default_decision === "pending"`, Object.values(p.human_gates).every((g) => g.default_decision === "pending"));

  // Out of scope
  check(`${label}: out_of_scope mentions video_generation`, !!p.out_of_scope.video_generation);
  check(`${label}: out_of_scope mentions music_generation`, !!p.out_of_scope.music_generation);
  check(`${label}: out_of_scope mentions 6d5_closeout`, !!p.out_of_scope.changing_6d5_closeout);

  // Safety strategy
  check(`${label}: safety_strategy.watermark_default === true`, (p.safety_strategy as Record<string, unknown>).watermark_default === true);

  // Boundaries
  check(
    `${label}: boundaries_enforced has all keys`,
    Object.keys(p.boundaries_enforced).length >= 10,
    `got ${Object.keys(p.boundaries_enforced).length}`
  );
  check(`${label}: boundaries_enforced.image_api_called === false`, p.boundaries_enforced.image_api_called === false);
  check(`${label}: boundaries_enforced.media_generation_allowed === false`, p.boundaries_enforced.media_generation_allowed === false);
  check(`${label}: boundaries_enforced.model_call_allowed === false`, p.boundaries_enforced.model_call_allowed === false);
}

function main(): void {
  console.log("=== Phase 6E-B Controlled Image Generation Plan Validator ===");
  console.log("Read-only structural check on PLAN. No model call. No media generation.\n");

  // 1. Validate harvester dashboard file
  const harvesterPath = path.join(ROOT, "dashboard", "image-generation-plan.json");
  if (!fs.existsSync(harvesterPath)) {
    console.log(`  ❌ Missing: ${harvesterPath}`);
    process.exit(1);
  }
  const harvesterData = JSON.parse(fs.readFileSync(harvesterPath, "utf-8")) as PlanData;
  validateOne(harvesterData, "harvester/dashboard");

  // 2. Validate assets dashboard file (cross-repo mirror)
  const assetsPath = path.join(ASSETS_ROOT, "dashboard", "image-generation-plan.json");
  if (fs.existsSync(assetsPath)) {
    const assetsData = JSON.parse(fs.readFileSync(assetsPath, "utf-8")) as PlanData;
    validateOne(assetsData, "assets/dashboard");
  } else {
    console.log(`  ⚠️  Assets mirror not found at ${assetsPath} (skipping)`);
  }

  // 3. Verify 6D-5 closeout is unchanged
  const xLogPath = path.join(ROOT, "dashboard", "x-manual-post-log.json");
  if (fs.existsSync(xLogPath)) {
    const xLog = JSON.parse(fs.readFileSync(xLogPath, "utf-8"));
    check(`6D-5 closeout unchanged: final_status=closed`, xLog.final_status === "closed");
    check(
      `6D-5 closeout unchanged: posted_manually_total=5`,
      xLog.posted_manually_total === 5
    );
  } else {
    console.log(`  ⚠️  x-manual-post-log.json not found (skipping 6D-5 check)`);
  }

  // 4. Verify 6E-A preflight still valid
  const preflightPath = path.join(ROOT, "dashboard", "image-generation-preflight.json");
  if (fs.existsSync(preflightPath)) {
    const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf-8"));
    check(`6E-A preflight unchanged: phase=6E-A`, preflight.phase === "6E-A");
    check(`6E-A preflight unchanged: total=25`, preflight.stats.total_content_packs === 25);
    check(`6E-A preflight unchanged: pending=20`, preflight.stats.pending_images === 20);
  }

  console.log("\n=== Summary ===");
  console.log(`Pass: ${pass}`);
  console.log(`Fail: ${fail}`);

  if (fail > 0) {
    console.log("\n=== Errors ===");
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  } else {
    console.log("\n✅ Phase 6E-B plan validation: PASS");
    process.exit(0);
  }
}

main();
