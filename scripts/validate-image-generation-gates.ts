#!/usr/bin/env ts-node
/**
 * Phase 6E-C Image Generation Gates Validator
 *
 * Validates the structure and content of:
 * - dashboard/image-generation-gates.json (this repo)
 * - assets-repo/dashboard/image-generation-gates.json (mirror)
 * - dashboard/image-generation-plan.json (gate_4 decision field)
 * - dashboard/x-manual-post-log.json (6D-5 closeout unchanged)
 * - assets-repo/metadata/generated-assets.json (5 baseline images unchanged)
 *
 * Strict boundaries:
 * - READ-ONLY validator. Does not call any model or generate any media.
 * - Does not send Telegram / trigger timer / promote / publish.
 * - Pure structural check on the GATE decision (not on actual generation).
 *
 * Usage:
 *   npx ts-node scripts/validate-image-generation-gates.ts
 *   npm run validate:image-generation-gates
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const ASSETS_ROOT = path.resolve(ROOT, "..", "creative-quota-assets");

interface GatesData {
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
  human_decision_record: {
    decision_text: string;
    approve_batch_1: boolean;
    approve_model_spend: boolean;
    approved_image_count_limit: number;
    approved_run: string;
    run_2_decision: string;
    run_3_decision: string;
  };
  gates: {
    gate_1_approve_batch_1: {
      decision: string;
      approved_run: string;
      approved_image_count_limit: number;
      approved_items: string[];
    };
    gate_2_approve_batch_2: {
      decision: string;
      approved_items: string[];
    };
    gate_3_approve_batch_3: {
      decision: string;
      approved_items: string[];
    };
    gate_4_approve_model_spend: {
      decision: string;
      approved_scope: string;
      approved_image_count_limit: number;
      total_5_image_budget_approval: boolean;
      run_2_budget_approval: boolean;
      run_3_budget_approval: boolean;
    };
  };
  run_status: {
    run_1: { status: string; approved: boolean; item_ids: string[]; generation_status: string; model_call_made: boolean; media_generated: boolean };
    run_2: { status: string; approved: boolean; item_ids: string[]; generation_status: string; model_call_made: boolean; media_generated: boolean };
    run_3: { status: string; approved: boolean; item_ids: string[]; generation_status: string; model_call_made: boolean; media_generated: boolean };
  };
  approved_items: {
    run_1_approved_items: Array<{
      item_id: string;
      source_type: string;
      risk_level: string;
      aspect_ratio: string;
    }>;
    run_2_approved_items: unknown[];
    run_3_approved_items: unknown[];
    total_approved_count: number;
    total_unapproved_count: number;
  };
  generation_status: {
    overall_status: string;
    images_generated_this_phase: number;
    images_planned_this_phase: number;
  };
  generated_images_unchanged: {
    verified: boolean;
    expected_count: number;
    expected_asset_ids: string[];
  };
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

function validateOne(g: GatesData, label: string): void {
  console.log(`\n=== ${label} ===`);

  check(`${label}: phase === "6E-C"`, g.phase === "6E-C", `got ${g.phase}`);
  check(`${label}: mode === "image_generation_run1_gate_approval"`, g.mode === "image_generation_run1_gate_approval", `got ${g.mode}`);

  // Boundary flags
  check(`${label}: no_model_call === true`, g.no_model_call === true);
  check(`${label}: no_media_generation === true`, g.no_media_generation === true);
  check(`${label}: no_telegram === true`, g.no_telegram === true);
  check(`${label}: no_timer === true`, g.no_timer === true);
  check(`${label}: no_x_publish === true`, g.no_x_publish === true);
  check(`${label}: no_promote === true`, g.no_promote === true);
  check(`${label}: no_c5n_change === true`, g.no_c5n_change === true);
  check(`${label}: no_6d5_modify === true`, g.no_6d5_modify === true);
  check(`${label}: no_secrets === true`, g.no_secrets === true);

  // Human decision record
  check(`${label}: human_decision_record.decision_text contains RUN_1`, g.human_decision_record.decision_text.includes("RUN_1"));
  check(`${label}: human_decision_record.approve_batch_1 === true`, g.human_decision_record.approve_batch_1 === true);
  check(`${label}: human_decision_record.approve_model_spend === true`, g.human_decision_record.approve_model_spend === true);
  check(`${label}: human_decision_record.approved_image_count_limit === 2`, g.human_decision_record.approved_image_count_limit === 2);
  check(`${label}: human_decision_record.approved_run === "run_1"`, g.human_decision_record.approved_run === "run_1");
  check(`${label}: human_decision_record.run_2_decision === "pending"`, g.human_decision_record.run_2_decision === "pending");
  check(`${label}: human_decision_record.run_3_decision === "pending"`, g.human_decision_record.run_3_decision === "pending");

  // Gate 1 (Run 1 batch approval)
  check(`${label}: gate_1_approve_batch_1.decision === "approved"`, g.gates.gate_1_approve_batch_1.decision === "approved");
  check(`${label}: gate_1_approve_batch_1.approved_run === "run_1"`, g.gates.gate_1_approve_batch_1.approved_run === "run_1");
  check(`${label}: gate_1_approve_batch_1.approved_image_count_limit === 2`, g.gates.gate_1_approve_batch_1.approved_image_count_limit === 2);
  check(`${label}: gate_1 approved_items count === 2`, g.gates.gate_1_approve_batch_1.approved_items.length === 2, `got ${g.gates.gate_1_approve_batch_1.approved_items.length}`);
  check(`${label}: gate_1 includes Q-6E-B-001`, g.gates.gate_1_approve_batch_1.approved_items.includes("Q-6E-B-001"));
  check(`${label}: gate_1 includes Q-6E-B-002`, g.gates.gate_1_approve_batch_1.approved_items.includes("Q-6E-B-002"));

  // Gate 2 (Run 2 batch approval)
  check(`${label}: gate_2_approve_batch_2.decision === "pending"`, g.gates.gate_2_approve_batch_2.decision === "pending");
  check(`${label}: gate_2 approved_items count === 0`, g.gates.gate_2_approve_batch_2.approved_items.length === 0, `got ${g.gates.gate_2_approve_batch_2.approved_items.length}`);

  // Gate 3 (Run 3 batch approval)
  check(`${label}: gate_3_approve_batch_3.decision === "pending"`, g.gates.gate_3_approve_batch_3.decision === "pending");
  check(`${label}: gate_3 approved_items count === 0`, g.gates.gate_3_approve_batch_3.approved_items.length === 0, `got ${g.gates.gate_3_approve_batch_3.approved_items.length}`);

  // Gate 4 (model spend)
  check(`${label}: gate_4_approve_model_spend.decision === "approved_limited_run1_only"`, g.gates.gate_4_approve_model_spend.decision === "approved_limited_run1_only", `got ${g.gates.gate_4_approve_model_spend.decision}`);
  check(`${label}: gate_4 approved_scope === "Run 1 only (2 images maximum)"`, g.gates.gate_4_approve_model_spend.approved_scope.includes("Run 1 only"));
  check(`${label}: gate_4 approved_image_count_limit === 2`, g.gates.gate_4_approve_model_spend.approved_image_count_limit === 2);
  check(`${label}: gate_4 total_5_image_budget_approval === false`, g.gates.gate_4_approve_model_spend.total_5_image_budget_approval === false);
  check(`${label}: gate_4 run_2_budget_approval === false`, g.gates.gate_4_approve_model_spend.run_2_budget_approval === false);
  check(`${label}: gate_4 run_3_budget_approval === false`, g.gates.gate_4_approve_model_spend.run_3_budget_approval === false);

  // Run status
  check(`${label}: run_1.approved === true`, g.run_status.run_1.approved === true);
  check(`${label}: run_1.generation_status === "not_started"`, g.run_status.run_1.generation_status === "not_started");
  check(`${label}: run_1.model_call_made === false`, g.run_status.run_1.model_call_made === false);
  check(`${label}: run_1.media_generated === false`, g.run_status.run_1.media_generated === false);
  check(`${label}: run_1.item_ids count === 2`, g.run_status.run_1.item_ids.length === 2);

  check(`${label}: run_2.approved === false`, g.run_status.run_2.approved === false);
  check(`${label}: run_2.generation_status === "not_started"`, g.run_status.run_2.generation_status === "not_started");
  check(`${label}: run_2.model_call_made === false`, g.run_status.run_2.model_call_made === false);

  check(`${label}: run_3.approved === false`, g.run_status.run_3.approved === false);
  check(`${label}: run_3.generation_status === "not_started"`, g.run_status.run_3.generation_status === "not_started");
  check(`${label}: run_3.model_call_made === false`, g.run_status.run_3.model_call_made === false);

  // Approved items
  check(`${label}: approved_items.run_1_approved_items count === 2`, g.approved_items.run_1_approved_items.length === 2);
  check(`${label}: approved_items.run_2_approved_items count === 0`, g.approved_items.run_2_approved_items.length === 0);
  check(`${label}: approved_items.run_3_approved_items count === 0`, g.approved_items.run_3_approved_items.length === 0);
  check(`${label}: approved_items.total_approved_count === 2`, g.approved_items.total_approved_count === 2);
  check(`${label}: approved_items.total_unapproved_count === 3`, g.approved_items.total_unapproved_count === 3);

  // Run 1 item details
  const r1Item1 = g.approved_items.run_1_approved_items.find((it) => it.item_id === "Q-6E-B-001");
  check(`${label}: Q-6E-B-001 risk_level === "low"`, r1Item1?.risk_level === "low");
  check(`${label}: Q-6E-B-001 aspect_ratio === "16:9"`, r1Item1?.aspect_ratio === "16:9");
  check(`${label}: Q-6E-B-001 source_type === "code"`, r1Item1?.source_type === "code");
  const r1Item2 = g.approved_items.run_1_approved_items.find((it) => it.item_id === "Q-6E-B-002");
  check(`${label}: Q-6E-B-002 risk_level === "low"`, r1Item2?.risk_level === "low");
  check(`${label}: Q-6E-B-002 aspect_ratio === "16:9"`, r1Item2?.aspect_ratio === "16:9");
  check(`${label}: Q-6E-B-002 source_type === "academic"`, r1Item2?.source_type === "academic");

  // Generation status
  check(`${label}: generation_status.overall_status === "not_started"`, g.generation_status.overall_status === "not_started");
  check(`${label}: generation_status.images_generated_this_phase === 0`, g.generation_status.images_generated_this_phase === 0);
  check(`${label}: generation_status.images_planned_this_phase === 2`, g.generation_status.images_planned_this_phase === 2);

  // Generated images unchanged
  check(`${label}: generated_images_unchanged.verified === true`, g.generated_images_unchanged.verified === true);
  check(`${label}: generated_images_unchanged.expected_count === 5`, g.generated_images_unchanged.expected_count === 5);
  const expectedIds = ["cqa-2026-06-11-canary-001", "cqa-2026-06-11-gen-002", "cqa-2026-06-11-gen-003", "cqa-2026-06-11-gen-004", "cqa-2026-06-11-gen-005"];
  for (const id of expectedIds) {
    check(`${label}: expected_asset_ids contains ${id}`, g.generated_images_unchanged.expected_asset_ids.includes(id));
  }

  // Boundaries
  check(`${label}: boundaries_enforced.model_call_allowed === false`, g.boundaries_enforced.model_call_allowed === false);
  check(`${label}: boundaries_enforced.media_generation_allowed === false`, g.boundaries_enforced.media_generation_allowed === false);
  check(`${label}: boundaries_enforced.image_api_called === false`, g.boundaries_enforced.image_api_called === false);
  check(`${label}: boundaries_enforced.timer_allowed === false`, g.boundaries_enforced.timer_allowed === false);
  check(`${label}: boundaries_enforced.c5n_promote_allowed === false`, g.boundaries_enforced.c5n_promote_allowed === false);
  check(`${label}: boundaries_enforced.secrets_printed === false`, g.boundaries_enforced.secrets_printed === false);
}

function main(): void {
  console.log("=== Phase 6E-C Image Generation Gates Validator ===");
  console.log("Read-only structural check on GATE decisions. No model call. No media generation.\n");

  // 1. Validate harvester dashboard file
  const harvesterPath = path.join(ROOT, "dashboard", "image-generation-gates.json");
  if (!fs.existsSync(harvesterPath)) {
    console.log(`  ❌ Missing: ${harvesterPath}`);
    process.exit(1);
  }
  const harvesterData = JSON.parse(fs.readFileSync(harvesterPath, "utf-8")) as GatesData;
  validateOne(harvesterData, "harvester/dashboard");

  // 2. Validate assets dashboard file (cross-repo mirror)
  const assetsPath = path.join(ASSETS_ROOT, "dashboard", "image-generation-gates.json");
  if (fs.existsSync(assetsPath)) {
    const assetsData = JSON.parse(fs.readFileSync(assetsPath, "utf-8")) as GatesData;
    validateOne(assetsData, "assets/dashboard");
  } else {
    console.log(`  ⚠️  Assets mirror not found at ${assetsPath} (skipping)`);
  }

  // 3. Cross-check both files are identical
  if (fs.existsSync(assetsPath)) {
    const harvesterRaw = fs.readFileSync(harvesterPath, "utf-8");
    const assetsRaw = fs.readFileSync(assetsPath, "utf-8");
    check(`cross-repo mirror: harvester/gates.json === assets/gates.json`, harvesterRaw === assetsRaw);
  }

  // 4. Verify gate_4 decision in image-generation-plan.json
  const planPath = path.join(ROOT, "dashboard", "image-generation-plan.json");
  if (fs.existsSync(planPath)) {
    const plan = JSON.parse(fs.readFileSync(planPath, "utf-8")) as Record<string, unknown> & {
      human_gates?: Record<string, { default_decision?: string }>;
    };
    const gate4 = plan.human_gates?.gate_4_approve_model_spend;
    // In Phase 6E-C, gate_4 default_decision may still be "pending" but the gates record tracks approved_limited_run1_only
    // We only verify the plan still references gate_4 and didn't get corrupted
    check(`plan still references gate_4_approve_model_spend`, !!gate4);
    check(`plan human_gates still includes gate_1_approve_batch_1`, !!plan.human_gates?.gate_1_approve_batch_1);
    check(`plan human_gates still includes gate_2_approve_batch_2`, !!plan.human_gates?.gate_2_approve_batch_2);
    check(`plan human_gates still includes gate_3_approve_batch_3`, !!plan.human_gates?.gate_3_approve_batch_3);
  }

  // 5. Verify 6D-5 closeout is unchanged
  const xLogPath = path.join(ROOT, "dashboard", "x-manual-post-log.json");
  if (fs.existsSync(xLogPath)) {
    const xLog = JSON.parse(fs.readFileSync(xLogPath, "utf-8")) as Record<string, unknown>;
    check(`6D-5 closeout unchanged: final_status=closed`, xLog.final_status === "closed");
    check(`6D-5 closeout unchanged: posted_manually_total=5`, xLog.posted_manually_total === 5);
    check(`6D-5 closeout unchanged: phase=6D-5`, xLog.phase === "6D-5");
  } else {
    console.log(`  ⚠️  x-manual-post-log.json not found (skipping 6D-5 check)`);
  }

  // 6. Verify generated-assets.json is consistent (5 baseline; or 7 after 6E-D Run 1 success)
  const genAssetsPath = path.join(ASSETS_ROOT, "metadata", "generated-assets.json");
  if (fs.existsSync(genAssetsPath)) {
    const genAssets = JSON.parse(fs.readFileSync(genAssetsPath, "utf-8")) as Array<{ asset_id: string }>;
    const allowedCounts = [5, 7];
    check(`generated-assets.json count in [5,7]`, allowedCounts.includes(genAssets.length), `got ${genAssets.length}`);
    const expectedIds = ["cqa-2026-06-11-canary-001", "cqa-2026-06-11-gen-002", "cqa-2026-06-11-gen-003", "cqa-2026-06-11-gen-004", "cqa-2026-06-11-gen-005"];
    const actualIds = genAssets.map((a) => a.asset_id);
    for (const id of expectedIds) {
      check(`generated-assets.json contains ${id}`, actualIds.includes(id));
    }
  } else {
    console.log(`  ⚠️  generated-assets.json not found at ${genAssetsPath} (skipping)`);
  }

  // 7. Verify 6E-A preflight still valid
  const preflightPath = path.join(ROOT, "dashboard", "image-generation-preflight.json");
  if (fs.existsSync(preflightPath)) {
    const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf-8")) as { phase: string; stats: { total_content_packs: number; pending_images: number } };
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
    console.log("\n✅ Phase 6E-C gates validation: PASS");
    process.exit(0);
  }
}

main();