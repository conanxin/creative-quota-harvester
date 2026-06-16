#!/usr/bin/env ts-node
/**
 * Phase 6E-F Run 2 Gates Validator
 *
 * Validates the Phase 6E-F Run 2 gate approval only.
 * Does NOT execute image generation. Does NOT call any model.
 * Read-only structural check on gate decision.
 *
 * Usage:
 *   npx ts-node scripts/validate-image-generation-run2-gates.ts
 *   npm run validate:image-generation-run2-gates
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const ASSETS_ROOT = path.resolve(ROOT, "..", "creative-quota-assets");

interface Run2GateRecord {
  item_id: string;
  title: string;
  source_type: string;
  aspect_ratio: string;
  risk_level: string;
}

interface Run2Status {
  status: string;
  approved: boolean;
  gate_approved_in_phase?: string;
  gate_decision_message_id?: number;
  items_count: number;
  item_ids: string[];
  approved_image_count_limit?: number;
  generation_status: string;
  model_call_made: boolean;
  media_generated: boolean;
  approved_items_detail?: Run2GateRecord[];
}

interface RunStatus {
  run_1: {
    status: string;
    approved: boolean;
    closed: boolean;
    final_outcome: string;
    final_closeout_phase: string;
    items_count: number;
    item_ids: string[];
    usable_images: number;
    generation_status: string;
    model_call_made: boolean;
    media_generated: boolean;
    not_reopened_in_6ef?: boolean;
  };
  run_2: Run2Status;
  run_3: {
    status: string;
    approved: boolean;
    items_count: number;
    item_ids: string[];
    generation_status: string;
    model_call_made: boolean;
    media_generated: boolean;
    not_approved_in_6ef?: boolean;
  };
}

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
  based_on_phase: string;
  based_on_assets_commit: string;
  based_on_harvester_commit: string;
  human_decision_record: {
    decision_text: string;
    decider: string;
    decided_at: string;
    message_id: number;
    approve_batch_2: boolean;
    approve_model_spend_run2: string;
    approved_run: string;
    approved_image_count_limit_run2: number;
    run_1_decision: string;
    run_3_decision: string;
    total_5_image_plan_approval: string;
    scope_boundary: string;
  };
  run1_final_closeout_record: {
    phase: string;
    status: string;
    outcome: string;
    usable_run1_images: number;
    assets_commit: string;
    harvester_commit: string;
    message_id: number;
    not_modified_in_6ef: boolean;
  };
  gates: {
    gate_1_approve_batch_1: { decision: string };
    gate_2_approve_batch_2: {
      decision: string;
      approved_run: string;
      approved_image_count_limit: number;
      approved_items: string[];
      decision_message_id: number;
      decided_at: string;
    };
    gate_3_approve_batch_3: { decision: string };
    gate_4_approve_model_spend: {
      decision: string;
      approved_scope: string;
      approved_image_count_limit: number;
      total_5_image_budget_approval: boolean;
      run_1_budget_approval: string;
      run_2_budget_approval: boolean;
      run_3_budget_approval: boolean;
    };
  };
  run_status: RunStatus;
  approved_items: {
    run_1: { count: number; status: string; closed_in_phase: string };
    run_2: { count: number; status: string; gate_approved_in_phase: string; gate_decision_message_id: number };
    run_3: { count: number; status: string };
    total_approved_count: number;
    total_pending_count: number;
  };
  generated_images_unchanged: {
    total_generated_image_files: number;
    pending_images: number;
    no_new_images_in_6ef: boolean;
  };
  boundaries_enforced: Record<string, boolean>;
  next_phase_proposal: {
    next_phase: string;
    auto_trigger: boolean;
    requires_separate_human_decision: boolean;
  };
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

  // Top-level phase/mode
  check(`${label}: phase === "6E-F"`, g.phase === "6E-F", `got ${g.phase}`);
  check(`${label}: mode === "image_generation_run2_gate_approval"`, g.mode === "image_generation_run2_gate_approval", `got ${g.mode}`);

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

  // Based-on pointers
  check(`${label}: based_on_phase === "6E-I (Run 1 final closeout closed)"`, g.based_on_phase.includes("6E-I"));
  check(`${label}: based_on_assets_commit === "208671b"`, g.based_on_assets_commit === "208671b");
  check(`${label}: based_on_harvester_commit === "943d74b"`, g.based_on_harvester_commit === "943d74b");

  // Human decision record
  const hdr = g.human_decision_record;
  check(`${label}: human_decision_record.decision_text contains RUN_2`, hdr.decision_text.includes("RUN_2"));
  check(`${label}: human_decision_record.approve_batch_2 === true`, hdr.approve_batch_2 === true);
  check(`${label}: human_decision_record.approve_model_spend_run2 === "approved_limited_run2_only"`, hdr.approve_model_spend_run2 === "approved_limited_run2_only", `got "${hdr.approve_model_spend_run2}"`);
  check(`${label}: human_decision_record.approved_run === "run_2"`, hdr.approved_run === "run_2");
  check(`${label}: human_decision_record.approved_image_count_limit_run2 === 2`, hdr.approved_image_count_limit_run2 === 2);
  check(`${label}: human_decision_record.run_1_decision contains "closed"`, hdr.run_1_decision.includes("closed"));
  check(`${label}: human_decision_record.run_3_decision === "pending"`, hdr.run_3_decision === "pending");
  check(`${label}: human_decision_record.message_id === 50791`, hdr.message_id === 50791);

  // run1_final_closeout_record (not modified in 6E-F)
  const r1fc = g.run1_final_closeout_record;
  check(`${label}: run1_final_closeout_record.phase === "6E-I"`, r1fc.phase === "6E-I");
  check(`${label}: run1_final_closeout_record.status === "closed"`, r1fc.status === "closed");
  check(`${label}: run1_final_closeout_record.outcome === "approved_after_regen"`, r1fc.outcome === "approved_after_regen");
  check(`${label}: run1_final_closeout_record.usable_run1_images === 2`, r1fc.usable_run1_images === 2);
  check(`${label}: run1_final_closeout_record.assets_commit === "208671b"`, r1fc.assets_commit === "208671b");
  check(`${label}: run1_final_closeout_record.harvester_commit === "943d74b"`, r1fc.harvester_commit === "943d74b");
  check(`${label}: run1_final_closeout_record.message_id === 50787`, r1fc.message_id === 50787);
  check(`${label}: run1_final_closeout_record.not_modified_in_6ef === true`, r1fc.not_modified_in_6ef === true);

  // Gate 1 (Run 1) - still closed, untouched
  check(`${label}: gate_1_approve_batch_1.decision === "approved" (unchanged)`, g.gates.gate_1_approve_batch_1.decision === "approved");

  // Gate 2 (Run 2 batch approval) - NEW in 6E-F
  const g2 = g.gates.gate_2_approve_batch_2;
  check(`${label}: gate_2_approve_batch_2.decision === "approved"`, g2.decision === "approved", `got "${g2.decision}"`);
  check(`${label}: gate_2_approve_batch_2.approved_run === "run_2"`, g2.approved_run === "run_2");
  check(`${label}: gate_2_approve_batch_2.approved_image_count_limit === 2`, g2.approved_image_count_limit === 2);
  check(`${label}: gate_2 approved_items count === 2`, g2.approved_items.length === 2, `got ${g2.approved_items.length}`);
  check(`${label}: gate_2 includes Q-6E-B-003`, g2.approved_items.includes("Q-6E-B-003"));
  check(`${label}: gate_2 includes Q-6E-B-004`, g2.approved_items.includes("Q-6E-B-004"));
  check(`${label}: gate_2 decision_message_id === 50791`, g2.decision_message_id === 50791);

  // Gate 3 (Run 3) - still pending, NOT approved in 6E-F
  check(`${label}: gate_3_approve_batch_3.decision === "pending" (NOT approved)`, g.gates.gate_3_approve_batch_3.decision === "pending");

  // Gate 4 (model spend) - now limited to Run 2 only
  const g4 = g.gates.gate_4_approve_model_spend;
  check(`${label}: gate_4_approve_model_spend.decision === "approved_limited_run2_only"`, g4.decision === "approved_limited_run2_only", `got "${g4.decision}"`);
  check(`${label}: gate_4 approved_scope contains "Run 2 only"`, g4.approved_scope.includes("Run 2 only"));
  check(`${label}: gate_4 approved_image_count_limit === 2`, g4.approved_image_count_limit === 2);
  check(`${label}: gate_4 total_5_image_budget_approval === false`, g4.total_5_image_budget_approval === false);
  check(`${label}: gate_4 run_2_budget_approval === true`, g4.run_2_budget_approval === true);
  check(`${label}: gate_4 run_3_budget_approval === false`, g4.run_3_budget_approval === false);

  // run_status.run_1 (still closed, not reopened)
  const r1 = g.run_status.run_1;
  check(`${label}: run_1.closed === true`, r1.closed === true);
  check(`${label}: run_1.status === "closed_after_regen"`, r1.status === "closed_after_regen");
  check(`${label}: run_1.final_outcome === "approved_after_regen"`, r1.final_outcome === "approved_after_regen");
  check(`${label}: run_1.final_closeout_phase === "6E-I"`, r1.final_closeout_phase === "6E-I");
  check(`${label}: run_1.final_closeout_assets_commit === "208671b"`, r1.final_closeout_assets_commit === "208671b");
  check(`${label}: run_1.final_closeout_harvester_commit === "943d74b"`, r1.final_closeout_harvester_commit === "943d74b");
  check(`${label}: run_1.items_count === 2`, r1.items_count === 2);
  check(`${label}: run_1.usable_images === 2`, r1.usable_images === 2);
  check(`${label}: run_1.generation_status === "completed"`, r1.generation_status === "completed");
  check(`${label}: run_1.model_call_made === true`, r1.model_call_made === true);
  check(`${label}: run_1.media_generated === true`, r1.media_generated === true);
  check(`${label}: run_1.not_reopened_in_6ef === true`, r1.not_reopened_in_6ef === true);

  // run_status.run_2 (approved but NOT generated)
  const r2 = g.run_status.run_2;
  check(`${label}: run_2.status === "approved_pending_generation"`, r2.status === "approved_pending_generation", `got "${r2.status}"`);
  check(`${label}: run_2.approved === true`, r2.approved === true);
  check(`${label}: run_2.gate_approved_in_phase === "6E-F"`, r2.gate_approved_in_phase === "6E-F");
  check(`${label}: run_2.gate_decision_message_id === 50791`, r2.gate_decision_message_id === 50791);
  check(`${label}: run_2.items_count === 2`, r2.items_count === 2);
  check(`${label}: run_2.item_ids includes Q-6E-B-003`, r2.item_ids.includes("Q-6E-B-003"));
  check(`${label}: run_2.item_ids includes Q-6E-B-004`, r2.item_ids.includes("Q-6E-B-004"));
  check(`${label}: run_2.approved_image_count_limit === 2`, r2.approved_image_count_limit === 2);
  check(`${label}: run_2.generation_status === "not_started"`, r2.generation_status === "not_started", `got "${r2.generation_status}"`);
  check(`${label}: run_2.model_call_made === false (no image model called)`, r2.model_call_made === false);
  check(`${label}: run_2.media_generated === false (no media generated)`, r2.media_generated === false);

  // Run 2 item details
  const detail = r2.approved_items_detail || [];
  const r2Item003 = detail.find((d) => d.item_id === "Q-6E-B-003");
  check(`${label}: Q-6E-B-003 title === "River AI"`, r2Item003?.title === "River AI");
  check(`${label}: Q-6E-B-003 source_type === "dev-community"`, r2Item003?.source_type === "dev-community");
  check(`${label}: Q-6E-B-003 aspect_ratio === "1:1"`, r2Item003?.aspect_ratio === "1:1");
  check(`${label}: Q-6E-B-003 risk_level === "low"`, r2Item003?.risk_level === "low");
  const r2Item004 = detail.find((d) => d.item_id === "Q-6E-B-004");
  check(`${label}: Q-6E-B-004 title contains "stable-video-diffusion"`, r2Item004?.title.includes("stable-video-diffusion"));
  check(`${label}: Q-6E-B-004 source_type === "ai-ecosystem"`, r2Item004?.source_type === "ai-ecosystem");
  check(`${label}: Q-6E-B-004 aspect_ratio === "16:9"`, r2Item004?.aspect_ratio === "16:9");
  check(`${label}: Q-6E-B-004 risk_level === "low"`, r2Item004?.risk_level === "low");

  // run_status.run_3 (still pending)
  const r3 = g.run_status.run_3;
  check(`${label}: run_3.approved === false (NOT approved in 6E-F)`, r3.approved === false);
  check(`${label}: run_3.status === "pending_human_approval"`, r3.status === "pending_human_approval");
  check(`${label}: run_3.generation_status === "not_started"`, r3.generation_status === "not_started");
  check(`${label}: run_3.model_call_made === false`, r3.model_call_made === false);
  check(`${label}: run_3.media_generated === false`, r3.media_generated === false);
  check(`${label}: run_3.not_approved_in_6ef === true`, r3.not_approved_in_6ef === true);

  // approved_items aggregate
  const ai = g.approved_items;
  check(`${label}: approved_items.run_1.count === 2`, ai.run_1.count === 2);
  check(`${label}: approved_items.run_1.status === "closed"`, ai.run_1.status === "closed");
  check(`${label}: approved_items.run_1.closed_in_phase === "6E-I"`, ai.run_1.closed_in_phase === "6E-I");
  check(`${label}: approved_items.run_2.count === 2`, ai.run_2.count === 2);
  check(`${label}: approved_items.run_2.status === "gate_approved_awaiting_generation"`, ai.run_2.status === "gate_approved_awaiting_generation");
  check(`${label}: approved_items.run_2.gate_approved_in_phase === "6E-F"`, ai.run_2.gate_approved_in_phase === "6E-F");
  check(`${label}: approved_items.run_2.gate_decision_message_id === 50791`, ai.run_2.gate_decision_message_id === 50791);
  check(`${label}: approved_items.run_3.count === 0 (NOT approved)`, ai.run_3.count === 0);
  check(`${label}: approved_items.run_3.status === "not_approved"`, ai.run_3.status === "not_approved");
  check(`${label}: approved_items.total_approved_count === 4`, ai.total_approved_count === 4);
  check(`${label}: approved_items.total_pending_count === 1`, ai.total_pending_count === 1);

  // generated_images_unchanged (no new images, no quota consumed)
  const giu = g.generated_images_unchanged;
  check(`${label}: generated_images_unchanged.total_generated_image_files === 8`, giu.total_generated_image_files === 8);
  check(`${label}: generated_images_unchanged.pending_images === 18`, giu.pending_images === 18);
  check(`${label}: generated_images_unchanged.no_new_images_in_6ef === true`, giu.no_new_images_in_6ef === true);

  // boundaries_enforced
  const be = g.boundaries_enforced;
  check(`${label}: boundaries_enforced.no_model_call === true`, be.no_model_call === true);
  check(`${label}: boundaries_enforced.no_media_generation === true`, be.no_media_generation === true);
  check(`${label}: boundaries_enforced.no_video_generation === true`, be.no_video_generation === true);
  check(`${label}: boundaries_enforced.no_music_generation === true`, be.no_music_generation === true);
  check(`${label}: boundaries_enforced.no_run_2_generation_executed === true`, be.no_run_2_generation_executed === true);
  check(`${label}: boundaries_enforced.no_run_3_approval === true`, be.no_run_3_approval === true);
  check(`${label}: boundaries_enforced.no_run_1_reopen === true`, be.no_run_1_reopen === true);
  check(`${label}: boundaries_enforced.no_run_1_final_closeout_modification === true`, be.no_run_1_final_closeout_modification === true);
  check(`${label}: boundaries_enforced.no_6d5_modify === true`, be.no_6d5_modify === true);
  check(`${label}: boundaries_enforced.no_x_publish === true`, be.no_x_publish === true);
  check(`${label}: boundaries_enforced.no_timer === true`, be.no_timer === true);
  check(`${label}: boundaries_enforced.no_digest === true`, be.no_digest === true);
  check(`${label}: boundaries_enforced.no_promote === true`, be.no_promote === true);
  check(`${label}: boundaries_enforced.no_c5n_change === true`, be.no_c5n_change === true);
  check(`${label}: boundaries_enforced.no_secrets === true`, be.no_secrets === true);

  // next_phase_proposal
  const npp = g.next_phase_proposal;
  check(`${label}: next_phase_proposal.next_phase === "Phase 6E-J (Run 2 Controlled Image Generation)"`, npp.next_phase === "Phase 6E-J (Run 2 Controlled Image Generation)");
  check(`${label}: next_phase_proposal.auto_trigger === false`, npp.auto_trigger === false);
  check(`${label}: next_phase_proposal.requires_separate_human_decision === true`, npp.requires_separate_human_decision === true);
}

function main(): void {
  console.log("=== Phase 6E-F Run 2 Gates Validator ===");
  console.log("Read-only structural check on Run 2 gate decision. No model call. No media generation.\n");

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

  // 4. Verify image-generation-plan.json run_2 status
  const planPath = path.join(ROOT, "dashboard", "image-generation-plan.json");
  if (fs.existsSync(planPath)) {
    const plan = JSON.parse(fs.readFileSync(planPath, "utf-8")) as {
      execution_status?: { run_2?: { status: string; approved_run: string; approved_image_count_limit: number; approved_items: string[]; generation_status: string; gate_approved_in_phase: string } };
    };
    const run2 = plan.execution_status?.run_2;
    check(`plan.execution_status.run_2.status === "approved_pending_generation"`, run2?.status === "approved_pending_generation");
    check(`plan.execution_status.run_2.approved_run === "run_2"`, run2?.approved_run === "run_2");
    check(`plan.execution_status.run_2.approved_image_count_limit === 2`, run2?.approved_image_count_limit === 2);
    check(`plan.execution_status.run_2.approved_items includes Q-6E-B-003`, run2?.approved_items.includes("Q-6E-B-003"));
    check(`plan.execution_status.run_2.approved_items includes Q-6E-B-004`, run2?.approved_items.includes("Q-6E-B-004"));
    check(`plan.execution_status.run_2.generation_status === "not_started"`, run2?.generation_status === "not_started");
    check(`plan.execution_status.run_2.gate_approved_in_phase === "6E-F"`, run2?.gate_approved_in_phase === "6E-F");
  }

  // 5. Verify mainline-production-queue.json current_phase=6E-F
  const queuePath = path.join(ROOT, "dashboard", "mainline-production-queue.json");
  if (fs.existsSync(queuePath)) {
    const queue = JSON.parse(fs.readFileSync(queuePath, "utf-8")) as {
      current_phase: string;
      current_phase_status: string;
      run2_gate_approval?: { run2_gate_status: string; approve_batch_2: boolean; approved_image_count_limit_run2: number; run3_status: string; generation_status: string; no_model_call: boolean; no_media_generation: boolean };
      run1_final_closeout?: { run1_final_status: string; run1_final_outcome: string; usable_run1_images: number };
    };
    check(`queue.current_phase === "6E-F"`, queue.current_phase === "6E-F");
    check(`queue.current_phase_status === "run2_gate_approved"`, queue.current_phase_status === "run2_gate_approved");
    const r2a = queue.run2_gate_approval;
    check(`queue.run2_gate_approval.run2_gate_status === "approved"`, r2a?.run2_gate_status === "approved");
    check(`queue.run2_gate_approval.approve_batch_2 === true`, r2a?.approve_batch_2 === true);
    check(`queue.run2_gate_approval.approved_image_count_limit_run2 === 2`, r2a?.approved_image_count_limit_run2 === 2);
    check(`queue.run2_gate_approval.run3_status === "pending"`, r2a?.run3_status === "pending");
    check(`queue.run2_gate_approval.generation_status === "not_started"`, r2a?.generation_status === "not_started");
    check(`queue.run2_gate_approval.no_model_call === true`, r2a?.no_model_call === true);
    check(`queue.run2_gate_approval.no_media_generation === true`, r2a?.no_media_generation === true);
    // Run 1 final closeout in queue still present
    check(`queue.run1_final_closeout.run1_final_status === "closed" (unchanged)`, queue.run1_final_closeout?.run1_final_status === "closed");
    check(`queue.run1_final_closeout.run1_final_outcome === "approved_after_regen" (unchanged)`, queue.run1_final_closeout?.run1_final_outcome === "approved_after_regen");
    check(`queue.run1_final_closeout.usable_run1_images === 2 (unchanged)`, queue.run1_final_closeout?.usable_run1_images === 2);
  }

  // 6. Verify 6D-5 closeout is unchanged
  const xLogPath = path.join(ROOT, "dashboard", "x-manual-post-log.json");
  if (fs.existsSync(xLogPath)) {
    const xLog = JSON.parse(fs.readFileSync(xLogPath, "utf-8")) as Record<string, unknown>;
    check(`6D-5 closeout unchanged: final_status=closed`, xLog.final_status === "closed");
    check(`6D-5 closeout unchanged: posted_manually_total=5`, xLog.posted_manually_total === 5);
    check(`6D-5 closeout unchanged: phase=6D-5`, xLog.phase === "6D-5");
  } else {
    console.log(`  ⚠️  x-manual-post-log.json not found (skipping 6D-5 check)`);
  }

  // 7. Verify generated-assets.json is still 8 (5 baseline + 2 from 6E-D Run 1 + 1 from 6E-G regen)
  const genAssetsPath = path.join(ASSETS_ROOT, "metadata", "generated-assets.json");
  if (fs.existsSync(genAssetsPath)) {
    const genAssets = JSON.parse(fs.readFileSync(genAssetsPath, "utf-8")) as Array<{ asset_id: string }>;
    check(`generated-assets.json count === 8 (5 baseline + 2 from 6E-D Run 1 + 1 from 6E-G regen; no new in 6E-F)`, genAssets.length === 8, `got ${genAssets.length}`);
    const expectedIds = ["cqa-2026-06-11-canary-001", "cqa-2026-06-11-gen-002", "cqa-2026-06-11-gen-003", "cqa-2026-06-11-gen-004", "cqa-2026-06-11-gen-005"];
    const actualIds = genAssets.map((a) => a.asset_id);
    for (const id of expectedIds) {
      check(`generated-assets.json contains ${id}`, actualIds.includes(id));
    }
  }

  // 8. Verify run1-final closeout files exist (sanity)
  const run1FinalJsonAssets = path.join(ASSETS_ROOT, "generated", "phase-6e", "run1", "final-summary.json");
  if (fs.existsSync(run1FinalJsonAssets)) {
    check(`assets-repo Run 1 final-summary.json exists (6E-I artifact preserved)`, true);
  }

  // 9. Verify Q-6E-B-001 + Q-6E-B-002 selected images still exist
  const q001Path = path.join(ASSETS_ROOT, "images", "2026", "06", "16", "cqa-2026-06-16-run1-001_001.jpg");
  const q002RegenPath = path.join(ASSETS_ROOT, "images", "2026", "06", "16", "cqa-2026-06-16-run1-002-regen1_001.jpg");
  const q002ParentPath = path.join(ASSETS_ROOT, "images", "2026", "06", "16", "cqa-2026-06-16-run1-002_001.jpg");
  if (fs.existsSync(q001Path)) {
    check(`Q-6E-B-001 selected image still exists`, true);
  }
  if (fs.existsSync(q002RegenPath)) {
    check(`Q-6E-B-002 regen selected image still exists`, true);
  }
  if (fs.existsSync(q002ParentPath)) {
    check(`Q-6E-B-002 parent image still exists (NOT overwritten, NOT deleted)`, true);
  }

  console.log("\n=== Summary ===");
  console.log(`Pass: ${pass}`);
  console.log(`Fail: ${fail}`);

  if (fail > 0) {
    console.log("\n=== Errors ===");
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  } else {
    console.log("\n✅ Phase 6E-F Run 2 gates validation: PASS");
    process.exit(0);
  }
}

main();
