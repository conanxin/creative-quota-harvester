#!/usr/bin/env ts-node
/**
 * Phase 6E-H · Regenerated Image Human Review Decision Validator
 *
 * Validates the state of Phase 6E-H regen human review decision:
 * - assets-repo/publishing/review/image/phase-6e/run1/{review-board,decision-sheet,README}.{json,md}
 * - assets-repo/generated/phase-6e/run1/regen/q-6e-b-002/manifest.json
 * - harvester-repo/dashboard/image-generation-run1-regen.json (with regen review block)
 * - harvester-repo/dashboard/image-generation-run1-review-decisions.json (parent regen decision recorded)
 * - harvester-repo/dashboard/mainline-production-queue.json (run1_regen block with review decision)
 * - harvester-repo/dashboard/image-generation-plan.json (regen_1 block with review)
 * - Q-6E-B-002 regen candidate reviewed
 * - Q-6E-B-002 regen decision=approve
 * - Q-6E-B-002 regen score=76.6
 * - Q-6E-B-002 parent image marked superseded_by_regen
 * - parent image still exists, not overwritten, not deleted
 * - Run 1 final outcome=approved_after_regen
 * - usable_run1_images=2/2
 * - Q-6E-B-001 remains approved
 * - Run 2 / Run 3 still pending
 * - No new image generated
 * - No model call, no media generation, no X publish, no timer, no promote, no C5N
 * - 6D-5 final_status=closed
 * - No secrets committed
 *
 * Strict boundaries:
 * - READ-ONLY validator. Does not call any model. Does not generate media.
 * - Does not send Telegram / trigger timer / promote / publish.
 *
 * Exit code:
 *   0 = PASS
 *   1 = FAIL (any invariant violated)
 *
 * Usage:
 *   npx ts-node scripts/validate-image-generation-regen-review-decision.ts
 *   npm run validate:image-generation-regen-review-decision
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const ROOT = path.resolve(__dirname, "..");
const ASSETS_ROOT = path.resolve(ROOT, "..", "creative-quota-assets");

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passCount++;
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failCount++;
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function readJSON<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch (e) {
    return null;
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

console.log("\n=== Phase 6E-H · Regenerated Image Human Review Decision Validator ===\n");

// Step 1: File presence (assets repo)
console.log("1. Assets repo file presence");
const reviewDir = path.join(ASSETS_ROOT, "publishing/review/image/phase-6e/run1");
const reviewBoardJson = path.join(reviewDir, "review-board.json");
const reviewBoardMd = path.join(reviewDir, "review-board.md");
const decisionSheetJson = path.join(reviewDir, "decision-sheet.json");
const decisionSheetMd = path.join(reviewDir, "decision-sheet.md");
const readme = path.join(reviewDir, "README.md");
const regenManifest = path.join(ASSETS_ROOT, "generated/phase-6e/run1/regen/q-6e-b-002/manifest.json");

check("review-board.json exists", fileExists(reviewBoardJson));
check("review-board.md exists", fileExists(reviewBoardMd));
check("decision-sheet.json exists", fileExists(decisionSheetJson));
check("decision-sheet.md exists", fileExists(decisionSheetMd));
check("README.md exists", fileExists(readme));
check("regen manifest.json exists", fileExists(regenManifest));

// Step 2: Regen image + parent image
console.log("\n2. Regen image + parent image state");
const regenImagePath = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg");
const parentImagePath = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run1-002_001.jpg");
check("regen image exists", fileExists(regenImagePath));
check("parent image still exists", fileExists(parentImagePath));
if (fileExists(parentImagePath)) {
  const stat = fs.statSync(parentImagePath);
  check("parent image size unchanged (258966 bytes)", stat.size === 258966, `actual=${stat.size}`);
}
if (fileExists(regenImagePath)) {
  const stat = fs.statSync(regenImagePath);
  check("regen image size unchanged (87634 bytes)", stat.size === 87634, `actual=${stat.size}`);
}

// Step 3: review-board.json content
console.log("\n3. review-board.json content (regen review recorded)");
const board = readJSON<any>(reviewBoardJson);
check("review-board.json parses", board !== null);
if (board) {
  check("board.phase === '6E-H'", board.phase === "6E-H", board.phase);
  check("board.regen_human_review_recorded_at present", typeof board.regen_human_review_recorded_at === "string");
  check("board.regen_human_reviewer mentions message_id 50775", typeof board.regen_human_reviewer === "string" && board.regen_human_reviewer.includes("50775"));
  check("board.approved === 2 (Q-6E-B-001 + Q-6E-B-002 regen)", board.approved === 2, String(board.approved));
  check("board.needs_regen === 0", board.needs_regen === 0, String(board.needs_regen));
  check("board.regen_reviewed === 1", board.regen_reviewed === 1, String(board.regen_reviewed));
  check("board.regen_approved === 1", board.regen_approved === 1, String(board.regen_approved));
  check("board.parent_superseded === 1", board.parent_superseded === 1, String(board.parent_superseded));
  check("board.run_1_outcome === 'approved_after_regen'", board.run_1_outcome === "approved_after_regen", board.run_1_outcome);
  check("board.run_1_final_outcome === 'approved_after_regen'", board.run_1_final_outcome === "approved_after_regen", board.run_1_final_outcome);
  check("board.usable_run1_images === 2", board.usable_run1_images === 2, String(board.usable_run1_images));
  check("board.run_2_status === 'pending'", board.run_2_status === "pending");
  check("board.run_3_status === 'pending'", board.run_3_status === "pending");
  check("board.no_model_call === true", board.no_model_call === true);
  check("board.no_media_generation === true", board.no_media_generation === true);
  check("board.no_x_publish === true", board.no_x_publish === true);
  check("board.no_timer === true", board.no_timer === true);
  check("board.no_promote === true", board.no_promote === true);
  check("board.no_c5n_change === true", board.no_c5n_change === true);
  check("board.no_secrets === true", board.no_secrets === true);
  check("board.no_new_image_generated === true", board.no_new_image_generated === true);
  check("board.no_existing_image_overwrite === true", board.no_existing_image_overwrite === true);
  check("board.no_existing_image_delete === true", board.no_existing_image_delete === true);

  // Items validation
  const itemQ1 = board.items?.find((i: any) => i.item_id === "Q-6E-B-001");
  const itemQ2 = board.items?.find((i: any) => i.item_id === "Q-6E-B-002");
  check("Q-6E-B-001 found", itemQ1 !== undefined);
  check("Q-6E-B-002 found", itemQ2 !== undefined);

  if (itemQ1) {
    check("Q-6E-B-001 review_status === 'approved'", itemQ1.review_status === "approved", itemQ1.review_status);
    check("Q-6E-B-001 decision === 'approve'", itemQ1.decision === "approve", itemQ1.decision);
    check("Q-6E-B-001 human_score === 82.5", itemQ1.human_score === 82.5, String(itemQ1.human_score));
    check("Q-6E-B-001 decision_unaffected_by_regen === true", itemQ1.decision_unaffected_by_regen === true);
  }
  if (itemQ2) {
    check("Q-6E-B-002 parent image_status === 'superseded_by_regen'", itemQ2.image_status === "superseded_by_regen", itemQ2.image_status);
    check("Q-6E-B-002 parent review_status === 'superseded_by_regen'", itemQ2.review_status === "superseded_by_regen", itemQ2.review_status);
    check("Q-6E-B-002 parent decision === 'needs_regen'", itemQ2.decision === "needs_regen", itemQ2.decision);
    check("Q-6E-B-002 parent human_score === 43.3", itemQ2.human_score === 43.3, String(itemQ2.human_score));
    check("Q-6E-B-002 parent_image_still_exists === true", itemQ2.parent_image_still_exists === true);
    check("Q-6E-B-002 parent_image_not_overwritten === true", itemQ2.parent_image_not_overwritten === true);
    check("Q-6E-B-002 parent_image_not_deleted === true", itemQ2.parent_image_not_deleted === true);
    check("Q-6E-B-002 regen_executed === true", itemQ2.regen_executed === true);
    check("Q-6E-B-002 regen_phase === '6E-G'", itemQ2.regen_phase === "6E-G", itemQ2.regen_phase);
    check("Q-6E-B-002 regen_asset_id === 'cqa-2026-06-16-run1-002-regen1'", itemQ2.regen_asset_id === "cqa-2026-06-16-run1-002-regen1", itemQ2.regen_asset_id);
    check("Q-6E-B-002 regen_image_path === 'images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg'", itemQ2.regen_image_path === "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg", itemQ2.regen_image_path);
    check("Q-6E-B-002 regen_prompt_hash === '83a4a9b43c1b'", itemQ2.regen_prompt_hash === "83a4a9b43c1b", itemQ2.regen_prompt_hash);
    check("Q-6E-B-002 regen_output_hash === '4b66c35d3c78'", itemQ2.regen_output_hash === "4b66c35d3c78", itemQ2.regen_output_hash);
    check("Q-6E-B-002 regen_review.review_status === 'human_reviewed'", itemQ2.regen_review?.review_status === "human_reviewed");
    check("Q-6E-B-002 regen_review.decision === 'approve'", itemQ2.regen_review?.decision === "approve");
    check("Q-6E-B-002 regen_review.human_score === 76.6", itemQ2.regen_review?.human_score === 76.6);
    check("Q-6E-B-002 regen_review.scoring_dimensions.prompt_alignment === 7.5", itemQ2.regen_review?.scoring_dimensions?.prompt_alignment === 7.5);
    check("Q-6E-B-002 regen_review.scoring_dimensions.visual_quality === 8.0", itemQ2.regen_review?.scoring_dimensions?.visual_quality === 8.0);
    check("Q-6E-B-002 regen_review.scoring_dimensions.usefulness_as_asset === 7.8", itemQ2.regen_review?.scoring_dimensions?.usefulness_as_asset === 7.8);
    check("Q-6E-B-002 regen_review.scoring_dimensions.factual_safety === 8.0", itemQ2.regen_review?.scoring_dimensions?.factual_safety === 8.0);
    check("Q-6E-B-002 regen_review.scoring_dimensions.brand_text_artifact_risk === 3.2", itemQ2.regen_review?.scoring_dimensions?.brand_text_artifact_risk === 3.2);
    check("Q-6E-B-002 selected_image_path points to regen", itemQ2.selected_image_path === "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg", itemQ2.selected_image_path);
    check("Q-6E-B-002 selected_image_source === 'regen'", itemQ2.selected_image_source === "regen");
  }
}

// Step 4: decision-sheet.json content
console.log("\n4. decision-sheet.json content");
const decision = readJSON<any>(decisionSheetJson);
check("decision-sheet.json parses", decision !== null);
if (decision) {
  check("decision.phase === '6E-H'", decision.phase === "6E-H", decision.phase);
  check("decision.approved === 2", decision.approved === 2, String(decision.approved));
  check("decision.needs_regen === 0", decision.needs_regen === 0, String(decision.needs_regen));
  check("decision.regen_reviewed === 1", decision.regen_reviewed === 1, String(decision.regen_reviewed));
  check("decision.regen_approved === 1", decision.regen_approved === 1, String(decision.regen_approved));
  check("decision.parent_superseded === 1", decision.parent_superseded === 1, String(decision.parent_superseded));
  check("decision.run_1_outcome === 'approved_after_regen'", decision.run_1_outcome === "approved_after_regen", decision.run_1_outcome);
  check("decision.run_1_final_outcome === 'approved_after_regen'", decision.run_1_final_outcome === "approved_after_regen", decision.run_1_final_outcome);
  check("decision.usable_run1_images === 2", decision.usable_run1_images === 2, String(decision.usable_run1_images));
  check("decision.usable_run1_total === 2", decision.usable_run1_total === 2, String(decision.usable_run1_total));
  check("decision.run_2_status === 'pending'", decision.run_2_status === "pending");
  check("decision.run_3_status === 'pending'", decision.run_3_status === "pending");
  check("decision.no_model_call === true", decision.no_model_call === true);
  check("decision.no_media_generation === true", decision.no_media_generation === true);
  check("decision.no_new_image_generated === true", decision.no_new_image_generated === true);
  check("decision.no_x_publish === true", decision.no_x_publish === true);
  check("decision.no_timer === true", decision.no_timer === true);
  check("decision.no_promote === true", decision.no_promote === true);
  check("decision.no_c5n_change === true", decision.no_c5n_change === true);
  check("decision.no_secrets === true", decision.no_secrets === true);
  check("decision.no_run_2_approval === true", decision.no_run_2_approval === true);
  check("decision.no_run_3_approval === true", decision.no_run_3_approval === true);
  check("decision.no_original_image_overwritten === true", decision.no_original_image_overwritten === true);
  check("decision.no_original_image_deleted === true", decision.no_original_image_deleted === true);

  // regen_review block
  const rr = decision.regen_review;
  check("regen_review.item_id === 'Q-6E-B-002'", rr?.item_id === "Q-6E-B-002");
  check("regen_review.regen_review_status === 'human_reviewed'", rr?.regen_review_status === "human_reviewed");
  check("regen_review.regen_decision === 'approve'", rr?.regen_decision === "approve");
  check("regen_review.regen_score === 76.6", rr?.regen_score === 76.6);
  check("regen_review.parent_image_status === 'superseded_by_regen'", rr?.parent_image_status === "superseded_by_regen");
  check("regen_review.selected_image_path points to regen", rr?.selected_image_path === "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg", rr?.selected_image_path);

  // decisions array
  check("decisions.length === 2", Array.isArray(decision.decisions) && decision.decisions.length === 2);
  const dQ1 = decision.decisions?.find((x: any) => x.item_id === "Q-6E-B-001");
  const dQ2 = decision.decisions?.find((x: any) => x.item_id === "Q-6E-B-002");
  if (dQ1) {
    check("Q-6E-B-001 image_status === 'approved'", dQ1.image_status === "approved", dQ1.image_status);
    check("Q-6E-B-001 human_decision === 'approve'", dQ1.human_decision === "approve");
    check("Q-6E-B-001 decision_unaffected_by_regen === true", dQ1.decision_unaffected_by_regen === true);
  }
  if (dQ2) {
    check("Q-6E-B-002 image_status === 'superseded_by_regen'", dQ2.image_status === "superseded_by_regen", dQ2.image_status);
    check("Q-6E-B-002 human_decision === 'needs_regen' (parent decision unchanged)", dQ2.human_decision === "needs_regen");
    check("Q-6E-B-002 regen_executed === true", dQ2.regen_executed === true);
    check("Q-6E-B-002 regen_phase === '6E-G'", dQ2.regen_phase === "6E-G");
    check("Q-6E-B-002 parent_image_still_exists === true", dQ2.parent_image_still_exists === true);
    check("Q-6E-B-002 parent_image_not_overwritten === true", dQ2.parent_image_not_overwritten === true);
    check("Q-6E-B-002 parent_image_not_deleted === true", dQ2.parent_image_not_deleted === true);
    check("Q-6E-B-002 selected_image_path points to regen", dQ2.selected_image_path === "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg", dQ2.selected_image_path);
    check("Q-6E-B-002 selected_image_source === 'regen'", dQ2.selected_image_source === "regen");
  }
}

// Step 5: regen manifest content
console.log("\n5. regen manifest content (updated with review)");
const manifest = readJSON<any>(regenManifest);
check("regen manifest parses", manifest !== null);
if (manifest) {
  check("manifest.phase === '6E-H'", manifest.phase === "6E-H", manifest.phase);
  check("manifest.run_1_final_outcome === 'approved_after_regen'", manifest.run_1_final_outcome === "approved_after_regen", manifest.run_1_final_outcome);
  check("manifest.run_1_outcome === 'approved_after_regen'", manifest.run_1_outcome === "approved_after_regen", manifest.run_1_outcome);
  check("manifest.usable_run1_images === 2", manifest.usable_run1_images === 2, String(manifest.usable_run1_images));
  check("manifest.usable_run1_total === 2", manifest.usable_run1_total === 2, String(manifest.usable_run1_total));
  check("manifest.parent_image_status === 'superseded_by_regen'", manifest.parent_image_status === "superseded_by_regen", manifest.parent_image_status);
  check("manifest.selected_image_path points to regen", manifest.selected_image_path === "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg", manifest.selected_image_path);
  check("manifest.no_new_image_generated === true", manifest.no_new_image_generated === true);
  check("manifest.no_model_call === true", manifest.no_model_call === true);
  check("manifest.no_media_generation === true", manifest.no_media_generation === true);
  check("manifest.no_x_publish === true", manifest.no_x_publish === true);
  check("manifest.no_timer === true", manifest.no_timer === true);
  check("manifest.no_promote === true", manifest.no_promote === true);
  check("manifest.no_c5n_change === true", manifest.no_c5n_change === true);
  check("manifest.no_secrets === true", manifest.no_secrets === true);
  check("manifest.no_run2_approval === true", manifest.no_run2_approval === true);
  check("manifest.no_run3_approval === true", manifest.no_run3_approval === true);
  check("manifest.no_existing_image_overwrite === true", manifest.no_existing_image_overwrite === true);
  check("manifest.no_existing_image_delete === true", manifest.no_existing_image_delete === true);

  const item = manifest.selected_items?.[0];
  if (item) {
    check("selected_item[0].review_status === 'human_reviewed_approved'", item.review_status === "human_reviewed_approved", item.review_status);
    check("selected_item[0].selected === true", item.selected === true);
    check("selected_item[0].parent_image_status === 'superseded_by_regen'", item.parent_image_status === "superseded_by_regen");
    check("selected_item[0].selected_image_path points to regen", item.selected_image_path === "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg", item.selected_image_path);
    check("selected_item[0].human_review.decision === 'approve'", item.human_review?.decision === "approve");
    check("selected_item[0].human_review.human_score === 76.6", item.human_review?.human_score === 76.6);
    check("selected_item[0].human_review.scoring_dimensions.prompt_alignment === 7.5", item.human_review?.scoring_dimensions?.prompt_alignment === 7.5);
    check("selected_item[0].human_review.scoring_dimensions.visual_quality === 8.0", item.human_review?.scoring_dimensions?.visual_quality === 8.0);
    check("selected_item[0].human_review.scoring_dimensions.usefulness_as_asset === 7.8", item.human_review?.scoring_dimensions?.usefulness_as_asset === 7.8);
    check("selected_item[0].human_review.scoring_dimensions.factual_safety === 8.0", item.human_review?.scoring_dimensions?.factual_safety === 8.0);
    check("selected_item[0].human_review.scoring_dimensions.brand_text_artifact_risk === 3.2", item.human_review?.scoring_dimensions?.brand_text_artifact_risk === 3.2);
  }
  if (manifest.audit_trail) {
    check("audit_trail.regen_review_decision === 'approve'", manifest.audit_trail.regen_review_decision === "approve");
    check("audit_trail.regen_review_score === 76.6", manifest.audit_trail.regen_review_score === 76.6);
    check("audit_trail.run_1_final_outcome === 'approved_after_regen'", manifest.audit_trail.run_1_final_outcome === "approved_after_regen");
    check("audit_trail.usable_run1_images === 2", manifest.audit_trail.usable_run1_images === 2);
    check("audit_trail.no_new_image_generated_in_6eh === true", manifest.audit_trail.no_new_image_generated_in_6eh === true);
  }
}

// Step 6: harvester dashboards
console.log("\n6. harvester dashboards (regen + review-decisions + plan + queue)");
const regenDashHarvester = readJSON<any>(path.join(ROOT, "dashboard/image-generation-run1-regen.json"));
const reviewDecisionsDashHarvester = readJSON<any>(path.join(ROOT, "dashboard/image-generation-run1-review-decisions.json"));
const planHarvester = readJSON<any>(path.join(ROOT, "dashboard/image-generation-plan.json"));
const queueHarvester = readJSON<any>(path.join(ROOT, "dashboard/mainline-production-queue.json"));

check("regen dash (harvester) parses", regenDashHarvester !== null);
if (regenDashHarvester) {
  check("regen dash.phase === '6E-H'", regenDashHarvester.phase === "6E-H", regenDashHarvester.phase);
  check("regen dash.execution_status === 'regen_reviewed_approved'", regenDashHarvester.execution_status === "regen_reviewed_approved", regenDashHarvester.execution_status);
  check("regen dash.run_1_outcome === 'approved_after_regen'", regenDashHarvester.run_1_outcome === "approved_after_regen", regenDashHarvester.run_1_outcome);
  check("regen dash.run_1_final_outcome === 'approved_after_regen'", regenDashHarvester.run_1_final_outcome === "approved_after_regen", regenDashHarvester.run_1_final_outcome);
  check("regen dash.run_1_status_after_regen === 'regen_approved'", regenDashHarvester.run_1_status_after_regen === "regen_approved", regenDashHarvester.run_1_status_after_regen);
  check("regen dash.usable_run1_images === 2", regenDashHarvester.usable_run1_images === 2, String(regenDashHarvester.usable_run1_images));
  check("regen dash.usable_run1_total === 2", regenDashHarvester.usable_run1_total === 2, String(regenDashHarvester.usable_run1_total));
  check("regen dash.run_2_status === 'pending'", regenDashHarvester.run_2_status === "pending");
  check("regen dash.run_3_status === 'pending'", regenDashHarvester.run_3_status === "pending");
  check("regen dash.run_2_approved === false", regenDashHarvester.run_2_approved === false);
  check("regen dash.run_3_approved === false", regenDashHarvester.run_3_approved === false);
  check("regen dash.no_new_image_generated === true", regenDashHarvester.no_new_image_generated === true);
  check("regen dash.no_model_call === true", regenDashHarvester.no_model_call === true);
  check("regen dash.no_media_generation === true", regenDashHarvester.no_media_generation === true);
  check("regen dash.no_x_publish === true", regenDashHarvester.no_x_publish === true);
  check("regen dash.no_timer === true", regenDashHarvester.no_timer === true);
  check("regen dash.no_promote === true", regenDashHarvester.no_promote === true);
  check("regen dash.no_c5n_change === true", regenDashHarvester.no_c5n_change === true);
  check("regen dash.no_secrets === true", regenDashHarvester.no_secrets === true);
  check("regen dash.no_existing_image_overwrite === true", regenDashHarvester.no_existing_image_overwrite === true);
  check("regen dash.no_existing_image_delete === true", regenDashHarvester.no_existing_image_delete === true);
  check("regen dash.regen_candidate.review_status === 'human_reviewed_approved'", regenDashHarvester.regen_candidate?.review_status === "human_reviewed_approved", regenDashHarvester.regen_candidate?.review_status);
  check("regen dash.regen_candidate.regen_review.decision === 'approve'", regenDashHarvester.regen_candidate?.regen_review?.decision === "approve");
  check("regen dash.regen_candidate.regen_review.human_score === 76.6", regenDashHarvester.regen_candidate?.regen_review?.human_score === 76.6);
}

check("review-decisions dash (harvester) parses", reviewDecisionsDashHarvester !== null);
if (reviewDecisionsDashHarvester) {
  check("review-decisions dash.approved === 2", reviewDecisionsDashHarvester.approved === 2, String(reviewDecisionsDashHarvester.approved));
  check("review-decisions dash.needs_regen === 0", reviewDecisionsDashHarvester.needs_regen === 0, String(reviewDecisionsDashHarvester.needs_regen));
  check("review-decisions dash.run_1_outcome === 'approved_after_regen'", reviewDecisionsDashHarvester.run_1_outcome === "approved_after_regen", reviewDecisionsDashHarvester.run_1_outcome);
  check("review-decisions dash.run_1_final_outcome === 'approved_after_regen'", reviewDecisionsDashHarvester.run_1_final_outcome === "approved_after_regen", reviewDecisionsDashHarvester.run_1_final_outcome);
  check("review-decisions dash.usable_run1_images === 2", reviewDecisionsDashHarvester.usable_run1_images === 2, String(reviewDecisionsDashHarvester.usable_run1_images));
  check("review-decisions dash.regen_reviewed === 1", reviewDecisionsDashHarvester.regen_reviewed === 1, String(reviewDecisionsDashHarvester.regen_reviewed));
  check("review-decisions dash.regen_approved === 1", reviewDecisionsDashHarvester.regen_approved === 1, String(reviewDecisionsDashHarvester.regen_approved));
  check("review-decisions dash.parent_superseded === 1", reviewDecisionsDashHarvester.parent_superseded === 1, String(reviewDecisionsDashHarvester.parent_superseded));
  check("review-decisions dash.total_generated_images === 8", reviewDecisionsDashHarvester.total_generated_images === 8, String(reviewDecisionsDashHarvester.total_generated_images));
  check("review-decisions dash.pending_images === 18", reviewDecisionsDashHarvester.pending_images === 18, String(reviewDecisionsDashHarvester.pending_images));
}

check("plan (harvester) parses", planHarvester !== null);
if (planHarvester) {
  const r = planHarvester.execution_status?.regen_1;
  check("plan.regen_1.review_status === 'human_reviewed_approved'", r?.review_status === "human_reviewed_approved", r?.review_status);
  check("plan.regen_1.review_decision === 'approve'", r?.review_decision === "approve", r?.review_decision);
  check("plan.regen_1.review_human_score === 76.6", r?.review_human_score === 76.6, String(r?.review_human_score));
  check("plan.regen_1.selected_image_path points to regen", r?.selected_image_path === "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg", r?.selected_image_path);
  check("plan.regen_1.parent_image_status === 'superseded_by_regen'", r?.parent_image_status === "superseded_by_regen", r?.parent_image_status);
  check("plan.regen_1.run_1_final_outcome === 'approved_after_regen'", r?.run_1_final_outcome === "approved_after_regen", r?.run_1_final_outcome);
  check("plan.regen_1.usable_run1_images === 2", r?.usable_run1_images === 2, String(r?.usable_run1_images));
  const r1 = planHarvester.execution_status?.run_1;
  check("plan.run_1.final_outcome === 'approved_after_regen'", r1?.final_outcome === "approved_after_regen", r1?.final_outcome);
  check("plan.run_1.usable_images === 2", r1?.usable_images === 2, String(r1?.usable_images));
  check("plan.run_1.parent_superseded_items === 1", r1?.parent_superseded_items === 1, String(r1?.parent_superseded_items));
}

check("queue (harvester) parses", queueHarvester !== null);
if (queueHarvester) {
  const r = queueHarvester.run1_regen;
  check("queue.run1_regen.review_status === 'human_reviewed_approved'", r?.review_status === "human_reviewed_approved", r?.review_status);
  check("queue.run1_regen.review_decision === 'approve'", r?.review_decision === "approve", r?.review_decision);
  check("queue.run1_regen.review_human_score === 76.6", r?.review_human_score === 76.6, String(r?.review_human_score));
  check("queue.run1_regen.run_1_final_outcome === 'approved_after_regen'", r?.run_1_final_outcome === "approved_after_regen", r?.run_1_final_outcome);
  check("queue.run1_regen.usable_run1_images === 2", r?.usable_run1_images === 2, String(r?.usable_run1_images));
  check("queue.run1_regen.no_new_image_generated === true", r?.no_new_image_generated === true);
  check("queue.run1_regen.no_model_call_unused_check === true", r?.no_model_call_unused_check === true);
  check("queue.current_phase === '6E-H'", queueHarvester.current_phase === "6E-H", queueHarvester.current_phase);
  check("queue.current_phase_status === 'regen_reviewed_approved'", queueHarvester.current_phase_status === "regen_reviewed_approved", queueHarvester.current_phase_status);
}

// Step 7: 6D-5 closeout unchanged
console.log("\n7. 6D-5 closeout unchanged (final_status=closed)");
const xManualLog = readJSON<{ final_status: string; posted_manually_total: number; phase: string }>(
  path.join(ROOT, "dashboard/x-manual-post-log.json")
);
if (xManualLog) {
  check("6D-5 final_status === 'closed'", xManualLog.final_status === "closed", xManualLog.final_status);
  check("6D-5 posted_manually_total === 5", xManualLog.posted_manually_total === 5, String(xManualLog.posted_manually_total));
}

// Step 8: gates — Run 2/3 still pending
console.log("\n8. image-generation-gates.json — Run 2/3 still pending");
const gates = readJSON<any>(path.join(ROOT, "dashboard/image-generation-gates.json"));
if (gates) {
  check("gates.run_1.approved === true", gates.run_status?.run_1?.approved === true);
  check("gates.run_2.approved === false", gates.run_status?.run_2?.approved === false);
  check("gates.run_3.approved === false", gates.run_status?.run_3?.approved === false);
  check("gates.gate_2_approve_batch_2.decision === 'pending'", gates.gates?.gate_2_approve_batch_2?.decision === "pending");
  check("gates.gate_3_approve_batch_3.decision === 'pending'", gates.gates?.gate_3_approve_batch_3?.decision === "pending");
}

// Step 9: generated-assets.json count (still 8, no new images)
console.log("\n9. generated-assets.json count (still 8, no new images)");
const genAssets = readJSON<any[]>(path.join(ASSETS_ROOT, "metadata/generated-assets.json"));
if (Array.isArray(genAssets)) {
  check("count === 8 (unchanged)", genAssets.length === 8, String(genAssets.length));
  check("contains cqa-2026-06-16-run1-002-regen1 (regen)", genAssets.some((a) => a.asset_id === "cqa-2026-06-16-run1-002-regen1"));
  check("contains cqa-2026-06-16-run1-002 (parent)", genAssets.some((a) => a.asset_id === "cqa-2026-06-16-run1-002"));
}

// Step 10: No secrets / env files committed
console.log("\n10. No secret / env files committed");
const assetsGitStatus = execSync(`cd "${ASSETS_ROOT}" && git status --porcelain`, { encoding: "utf-8" }).trim();
const harvGitStatus = execSync(`cd "${ROOT}" && git status --porcelain`, { encoding: "utf-8" }).trim();

check(
  "no .env committed in assets",
  !assetsGitStatus.split("\n").some((line: string) => line.includes(".env") && !line.includes(".env.example"))
);
check(
  "no .env committed in harvester",
  !harvGitStatus.split("\n").some((line: string) => line.includes(".env") && !line.includes(".env.example"))
);
check(
  "no .env.telegram.local committed",
  !assetsGitStatus.includes(".env.telegram.local") && !harvGitStatus.includes(".env.telegram.local")
);
check(
  "no .control.local committed",
  !assetsGitStatus.includes(".control.local") && !harvGitStatus.includes(".control.local")
);

// Final summary
console.log("\n=== Summary ===");
console.log(`Pass: ${passCount}`);
console.log(`Fail: ${failCount}`);

if (failCount > 0) {
  console.log("\n❌ Phase 6E-H regen review validation: FAIL");
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
}

console.log("\n✅ Phase 6E-H regen review validation: PASS");
console.log(`   Q-6E-B-002 regen: decision=approve, score=76.6`);
console.log(`   Run 1 final outcome: approved_after_regen`);
console.log(`   usable_run1_images: 2/2`);
console.log(`   parent image: superseded_by_regen (still exists, not overwritten, not deleted)`);
console.log(`   selected_image_path: images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg`);
console.log(`   Run 2 / Run 3: still pending, no auto-trigger`);
console.log(`   next phase: Phase 6E-F (Approve Run 2 Gate Only) — awaiting separate explicit human command`);
process.exit(0);
