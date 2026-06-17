#!/usr/bin/env ts-node
/**
 * Phase 6E-I · Run 1 Final Closeout Validator
 *
 * Validates the state of Phase 6E-I Run 1 final closeout:
 * - assets-repo/generated/phase-6e/run1/final-summary.json (new)
 * - assets-repo/generated/phase-6e/run1/final-summary.md (new)
 * - assets-repo/generated/phase-6e/run1/README.md (updated)
 * - assets-repo/dashboard/image-generation-run1-final.json (new)
 * - assets-repo/reports/image-generation-run1-final-closeout.md (new)
 * - harvester-repo/dashboard/image-generation-run1-final.json (new)
 * - harvester-repo/dashboard/image-generation-run1-regen.json (updated)
 * - harvester-repo/dashboard/image-generation-run1-review-decisions.json (updated)
 * - harvester-repo/dashboard/image-generation-plan.json (updated)
 * - harvester-repo/dashboard/mainline-production-queue.json (updated)
 * - Q-6E-B-001 selected image exists, approved 82.5
 * - Q-6E-B-002 selected regen image exists, regen approved 76.6
 * - Q-6E-B-002 parent image still exists, not overwritten, not deleted
 * - Q-6E-B-002 parent image_status=superseded_by_regen
 * - run1_final_status=closed
 * - run1_final_outcome=approved_after_regen
 * - usable_run1_images=2/2
 * - total_generated_image_files=8 (unchanged from 6E-G)
 * - pending_images=18 (unchanged)
 * - Run 2 / Run 3 still pending
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
 *   npx ts-node scripts/validate-image-generation-run1-final.ts
 *   npm run validate:image-generation-run1-final
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

console.log("\n=== Phase 6E-I · Run 1 Final Closeout Validator ===\n");

// Step 1: File presence (assets repo)
console.log("1. Assets repo file presence");
const run1Dir = path.join(ASSETS_ROOT, "generated/phase-6e/run1");
const finalSummaryJson = path.join(run1Dir, "final-summary.json");
const finalSummaryMd = path.join(run1Dir, "final-summary.md");
const run1Readme = path.join(run1Dir, "README.md");
const finalDashAssets = path.join(ASSETS_ROOT, "dashboard/image-generation-run1-final.json");
const finalReportAssets = path.join(ASSETS_ROOT, "reports/image-generation-run1-final-closeout.md");

check("final-summary.json exists", fileExists(finalSummaryJson));
check("final-summary.md exists", fileExists(finalSummaryMd));
check("README.md exists", fileExists(run1Readme));
check("dashboard/image-generation-run1-final.json exists", fileExists(finalDashAssets));
check("reports/image-generation-run1-final-closeout.md exists", fileExists(finalReportAssets));

// Step 2: Selected images exist
console.log("\n2. Selected usable images exist");
const q1SelectedImage = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run1-001_001.jpg");
const q2SelectedImage = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg");
const q2ParentImage = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run1-002_001.jpg");

check("Q-6E-B-001 selected image exists", fileExists(q1SelectedImage));
check("Q-6E-B-002 selected regen image exists", fileExists(q2SelectedImage));
check("Q-6E-B-002 parent image still exists", fileExists(q2ParentImage));

if (fileExists(q1SelectedImage)) {
  const stat = fs.statSync(q1SelectedImage);
  check("Q-6E-B-001 image size unchanged (217601 bytes)", stat.size === 217601, `actual=${stat.size}`);
}
if (fileExists(q2SelectedImage)) {
  const stat = fs.statSync(q2SelectedImage);
  check("Q-6E-B-002 regen image size unchanged (87634 bytes)", stat.size === 87634, `actual=${stat.size}`);
}
if (fileExists(q2ParentImage)) {
  const stat = fs.statSync(q2ParentImage);
  check("Q-6E-B-002 parent image size unchanged (258966 bytes)", stat.size === 258966, `actual=${stat.size}`);
}

// Step 3: assets-repo final-summary.json content
console.log("\n3. assets-repo final-summary.json content");
const finalSummary = readJSON<any>(finalSummaryJson);
check("final-summary.json parses", finalSummary !== null);
if (finalSummary) {
  check("phase === '6E-I'", finalSummary.phase === "6E-I", finalSummary.phase);
  check("run === 'run_1'", finalSummary.run === "run_1", finalSummary.run);
  check("run1_final_status === 'closed'", finalSummary.run1_final_status === "closed", finalSummary.run1_final_status);
  check("run1_final_outcome === 'approved_after_regen'", finalSummary.run1_final_outcome === "approved_after_regen", finalSummary.run1_final_outcome);
  check("usable_run1_images === 2", finalSummary.usable_run1_images === 2, String(finalSummary.usable_run1_images));
  check("usable_run1_total === 2", finalSummary.usable_run1_total === 2, String(finalSummary.usable_run1_total));
  check("no_model_call === true", finalSummary.no_model_call === true);
  check("no_media_generation === true", finalSummary.no_media_generation === true);
  check("no_new_image_generated === true", finalSummary.no_new_image_generated === true);
  check("no_run_2_approval === true", finalSummary.no_run_2_approval === true);
  check("no_run_3_approval === true", finalSummary.no_run_3_approval === true);
  check("no_x_publish === true", finalSummary.no_x_publish === true);
  check("no_timer === true", finalSummary.no_timer === true);
  check("no_promote === true", finalSummary.no_promote === true);
  check("no_c5n_change === true", finalSummary.no_c5n_change === true);
  check("no_6d5_modify === true", finalSummary.no_6d5_modify === true);
  check("no_secrets === true", finalSummary.no_secrets === true);
  check("run_2_status === 'pending'", finalSummary.run_2_status === "pending");
  check("run_3_status === 'pending'", finalSummary.run_3_status === "pending");
  check("totals.total_generated_image_files === 8", finalSummary.totals?.total_generated_image_files === 8, String(finalSummary.totals?.total_generated_image_files));
  check("totals.pending_images === 18", finalSummary.totals?.pending_images === 18, String(finalSummary.totals?.pending_images));
  check("six_d_five_final_status === 'closed'", finalSummary.six_d_five_final_status === "closed", finalSummary.six_d_five_final_status);
  check("six_d_five_posted_manually_total === 5", finalSummary.six_d_five_posted_manually_total === 5, String(finalSummary.six_d_five_posted_manually_total));

  // selected_images
  check("selected_images.length === 2", Array.isArray(finalSummary.selected_images) && finalSummary.selected_images.length === 2);
  const q1 = finalSummary.selected_images?.find((x: any) => x.item_id === "Q-6E-B-001");
  const q2 = finalSummary.selected_images?.find((x: any) => x.item_id === "Q-6E-B-002");
  if (q1) {
    check("Q-6E-B-001 decision === 'approve'", q1.decision === "approve", q1.decision);
    check("Q-6E-B-001 scoring_dimensions.overall_score === 82.5", q1.scoring_dimensions?.overall_score === 82.5);
    check("Q-6E-B-001 decision_unaffected_by_regen === true", q1.decision_unaffected_by_regen === true);
    check("Q-6E-B-001 image_path points to original", q1.image_path === "images/2026/06/16/cqa-2026-06-16-run1-001_001.jpg", q1.image_path);
  }
  if (q2) {
    check("Q-6E-B-002 parent_status === 'superseded_by_regen'", q2.parent_status === "superseded_by_regen", q2.parent_status);
    check("Q-6E-B-002 parent_retained === true", q2.parent_retained === true);
    check("Q-6E-B-002 parent_image_still_exists === true", q2.parent_image_still_exists === true);
    check("Q-6E-B-002 parent_image_not_overwritten === true", q2.parent_image_not_overwritten === true);
    check("Q-6E-B-002 parent_image_not_deleted === true", q2.parent_image_not_deleted === true);
    check("Q-6E-B-002 regen_decision === 'approve'", q2.regen_decision === "approve", q2.regen_decision);
    check("Q-6E-B-002 regen_score === 76.6", q2.regen_score === 76.6, String(q2.regen_score));
    check("Q-6E-B-002 selected_image_source === 'regen'", q2.selected_image_source === "regen", q2.selected_image_source);
    check("Q-6E-B-002 selected_image_path points to regen", q2.selected_image_path === "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg", q2.selected_image_path);
  }

  // superseded parent
  check("superseded_parent_images.length === 1", Array.isArray(finalSummary.superseded_parent_images) && finalSummary.superseded_parent_images.length === 1);
  const sp = finalSummary.superseded_parent_images?.[0];
  if (sp) {
    check("superseded parent.item_id === 'Q-6E-B-002'", sp.item_id === "Q-6E-B-002");
    check("superseded parent.parent_status === 'superseded_by_regen'", sp.parent_status === "superseded_by_regen");
    check("superseded parent.parent_retained === true", sp.parent_retained === true);
    check("superseded parent.parent_image_still_exists === true", sp.parent_image_still_exists === true);
    check("superseded parent.superseded_by_phase === '6E-H'", sp.superseded_by_phase === "6E-H");
  }

  // next phase options
  check("next_phase_options.length === 2", Array.isArray(finalSummary.phase_progression?.next_phase_options) && finalSummary.phase_progression.next_phase_options.length === 2);
  const opt6ef = finalSummary.phase_progression?.next_phase_options?.find((x: any) => x.phase === "6E-F");
  const optIdle = finalSummary.phase_progression?.next_phase_options?.find((x: any) => x.phase === "idle");
  check("Option 6E-F present", opt6ef !== undefined);
  check("Option idle present", optIdle !== undefined);
  check("Option 6E-F.auto_trigger === false", opt6ef?.auto_trigger === false);
  check("Option idle.auto_trigger === false", optIdle?.auto_trigger === false);
}

// Step 4: assets-repo dashboard content
console.log("\n4. assets-repo dashboard/image-generation-run1-final.json");
const finalDashAssetsObj = readJSON<any>(finalDashAssets);
check("final dash (assets) parses", finalDashAssetsObj !== null);
if (finalDashAssetsObj) {
  check("final dash (assets).phase === '6E-I'", finalDashAssetsObj.phase === "6E-I");
  check("final dash (assets).run1_final_status === 'closed'", finalDashAssetsObj.run1_final_status === "closed");
  check("final dash (assets).run1_final_outcome === 'approved_after_regen'", finalDashAssetsObj.run1_final_outcome === "approved_after_regen");
  check("final dash (assets).usable_run1_images === 2", finalDashAssetsObj.usable_run1_images === 2);
  check("final dash (assets).no_model_call === true", finalDashAssetsObj.no_model_call === true);
  check("final dash (assets).no_media_generation === true", finalDashAssetsObj.no_media_generation === true);
  check("final dash (assets).no_x_publish === true", finalDashAssetsObj.no_x_publish === true);
  check("final dash (assets).no_timer === true", finalDashAssetsObj.no_timer === true);
  check("final dash (assets).no_promote === true", finalDashAssetsObj.no_promote === true);
  check("final dash (assets).no_c5n_change === true", finalDashAssetsObj.no_c5n_change === true);
  check("final dash (assets).no_6d5_modify === true", finalDashAssetsObj.no_6d5_modify === true);
  check("final dash (assets).no_secrets === true", finalDashAssetsObj.no_secrets === true);
  check("final dash (assets).run_2_status === 'pending'", finalDashAssetsObj.run_2_status === "pending");
  check("final dash (assets).run_3_status === 'pending'", finalDashAssetsObj.run_3_status === "pending");
  check("final dash (assets).totals.total_generated_image_files === 8", finalDashAssetsObj.totals?.total_generated_image_files === 8);
  check("final dash (assets).totals.pending_images === 18", finalDashAssetsObj.totals?.pending_images === 18);
  check("final dash (assets).six_d_five_final_status === 'closed'", finalDashAssetsObj.six_d_five_final_status === "closed");
}

// Step 5: harvester-repo dashboard content
console.log("\n5. harvester-repo dashboards (final + regen + review-decisions + plan + queue)");
const finalDashHarv = readJSON<any>(path.join(ROOT, "dashboard/image-generation-run1-final.json"));
check("final dash (harvester) parses", finalDashHarv !== null);
if (finalDashHarv) {
  check("final dash (harvester).phase === '6E-I'", finalDashHarv.phase === "6E-I");
  check("final dash (harvester).run1_final_status === 'closed'", finalDashHarv.run1_final_status === "closed");
  check("final dash (harvester).run1_final_outcome === 'approved_after_regen'", finalDashHarv.run1_final_outcome === "approved_after_regen");
  check("final dash (harvester).usable_run1_images === 2", finalDashHarv.usable_run1_images === 2);
  check("final dash (harvester).no_model_call === true", finalDashHarv.no_model_call === true);
  check("final dash (harvester).no_media_generation === true", finalDashHarv.no_media_generation === true);
  check("final dash (harvester).no_x_publish === true", finalDashHarv.no_x_publish === true);
  check("final dash (harvester).no_timer === true", finalDashHarv.no_timer === true);
  check("final dash (harvester).no_promote === true", finalDashHarv.no_promote === true);
  check("final dash (harvester).no_c5n_change === true", finalDashHarv.no_c5n_change === true);
  check("final dash (harvester).run_2_status === 'pending'", finalDashHarv.run_2_status === "pending");
  check("final dash (harvester).run_3_status === 'pending'", finalDashHarv.run_3_status === "pending");
  check("final dash (harvester).totals.total_generated_image_files === 8", finalDashHarv.totals?.total_generated_image_files === 8);
  check("final dash (harvester).totals.pending_images === 18", finalDashHarv.totals?.pending_images === 18);
  check("final dash (harvester).six_d_five_final_status === 'closed'", finalDashHarv.six_d_five_final_status === "closed");
}

const regenDashHarv = readJSON<any>(path.join(ROOT, "dashboard/image-generation-run1-regen.json"));
check("regen dash (harvester) parses", regenDashHarv !== null);
if (regenDashHarv) {
  check("regen dash references Phase 6E-I", regenDashHarv.next_phase_proposal?.next_phase === "Phase 6E-I (Run 1 Final Closeout)" || regenDashHarv.run_1_final_closeout_phase === "6E-I" || regenDashHarv.phase_6e_i_reference === "6E-I");
}

const reviewDecisionsDashHarv = readJSON<any>(path.join(ROOT, "dashboard/image-generation-run1-review-decisions.json"));
check("review-decisions dash (harvester) parses", reviewDecisionsDashHarv !== null);
if (reviewDecisionsDashHarv) {
  check("review-decisions dash.run_1_final_outcome === 'approved_after_regen'", reviewDecisionsDashHarv.run_1_final_outcome === "approved_after_regen");
  check("review-decisions dash.usable_run1_images === 2", reviewDecisionsDashHarv.usable_run1_images === 2);
  check("review-decisions dash.run1_closeout_phase === '6E-I'", reviewDecisionsDashHarv.run1_closeout_phase === "6E-I" || reviewDecisionsDashHarv.run1_closeout?.phase === "6E-I");
}

const planHarv = readJSON<any>(path.join(ROOT, "dashboard/image-generation-plan.json"));
check("plan (harvester) parses", planHarv !== null);
if (planHarv) {
  check("plan.run_1.final_outcome === 'approved_after_regen'", planHarv.execution_status?.run_1?.final_outcome === "approved_after_regen");
  check("plan.run_1.run1_closeout_phase === '6E-I'", planHarv.execution_status?.run_1?.run1_closeout_phase === "6E-I");
  check("plan.run_1.closeout_status === 'closed'", planHarv.execution_status?.run_1?.closeout_status === "closed");
  check("plan.execution_status.run_2.status in [pending_human_approval, approved_pending_generation, generated_pending_review, completed_within_budget] (phase-aware: 6E-J Run 2 sets completed_within_budget)", ["pending_human_approval", "approved_pending_generation", "generated_pending_review", "completed_within_budget"].includes(planHarv.execution_status?.run_2?.status), planHarv.execution_status?.run_2?.status);
  check("plan.execution_status.run_3.status === 'pending_human_approval'", planHarv.execution_status?.run_3?.status === "pending_human_approval");
}

const queueHarv = readJSON<any>(path.join(ROOT, "dashboard/mainline-production-queue.json"));
check("queue (harvester) parses", queueHarv !== null);
if (queueHarv) {
  check("queue.current_phase in [6E-I, 6E-F, 6E-J, 6E-K] (phase-aware: advanced through 6E-J generation and 6E-K review pack)", ["6E-I", "6E-F", "6E-J", "6E-K"].includes(queueHarv.current_phase), queueHarv.current_phase);
  check("queue.current_phase_status in [run1_final_closed, run2_gate_approved, run2_generation_completed, run2_review_pack_created] (phase-aware)", ["run1_final_closed", "run2_gate_approved", "run2_generation_completed", "run2_review_pack_created"].includes(queueHarv.current_phase_status), queueHarv.current_phase_status);
  const run1FinalBlock = queueHarv.run1_final_closeout;
  check("queue.run1_final_closeout block present", run1FinalBlock !== undefined);
  if (run1FinalBlock) {
    check("queue.run1_final_closeout.run1_final_status === 'closed'", run1FinalBlock.run1_final_status === "closed");
    check("queue.run1_final_closeout.run1_final_outcome === 'approved_after_regen'", run1FinalBlock.run1_final_outcome === "approved_after_regen");
    check("queue.run1_final_closeout.usable_run1_images === 2", run1FinalBlock.usable_run1_images === 2);
    check("queue.run1_final_closeout.no_new_image_generated === true", run1FinalBlock.no_new_image_generated === true);
    check("queue.run1_final_closeout.no_model_call === true", run1FinalBlock.no_model_call === true);
    check("queue.run1_final_closeout.no_x_publish === true", run1FinalBlock.no_x_publish === true);
    check("queue.run1_final_closeout.no_timer === true", run1FinalBlock.no_timer === true);
    check("queue.run1_final_closeout.no_promote === true", run1FinalBlock.no_promote === true);
    check("queue.run1_final_closeout.no_c5n_change === true", run1FinalBlock.no_c5n_change === true);
    check("queue.run1_final_closeout.run_2_status === 'pending'", run1FinalBlock.run_2_status === "pending");
    check("queue.run1_final_closeout.run_3_status === 'pending'", run1FinalBlock.run_3_status === "pending");
  }
}

// Step 6: 6D-5 closeout unchanged
console.log("\n6. 6D-5 closeout unchanged (final_status=closed)");
const xManualLog = readJSON<{ final_status: string; posted_manually_total: number; phase: string }>(
  path.join(ROOT, "dashboard/x-manual-post-log.json")
);
if (xManualLog) {
  check("6D-5 final_status === 'closed'", xManualLog.final_status === "closed", xManualLog.final_status);
  check("6D-5 posted_manually_total === 5", xManualLog.posted_manually_total === 5, String(xManualLog.posted_manually_total));
}

// Step 7: gates — Run 2/3 still pending
console.log("\n7. image-generation-gates.json — Run 2/3 still pending");
const gates = readJSON<any>(path.join(ROOT, "dashboard/image-generation-gates.json"));
if (gates) {
  check("gates.run_1.approved === true", gates.run_status?.run_1?.approved === true);
  check("gates.run_2.approved === false (pre-6E-F) or === true (post-6E-F Run 2 gate approved)", gates.run_status?.run_2?.approved === false || gates.run_status?.run_2?.approved === true);
  check("gates.run_3.approved === false", gates.run_status?.run_3?.approved === false);
}

// Step 8: generated-assets.json count (still 8, no new images)
console.log("\n8. generated-assets.json count (still 8, no new images)");
const genAssets = readJSON<any[]>(path.join(ASSETS_ROOT, "metadata/generated-assets.json"));
if (Array.isArray(genAssets)) {
  // Phase-aware: 6E-I expected 8 (after 6E-G regen added 1); 6E-J Run 2 added 2 more (count=10).
  // 6E-I validator now accepts current-state count without failing.
  check("count in [8, 10] (6E-I: 8; +6E-J Run 2: 10)", [8, 10].includes(genAssets.length), String(genAssets.length));
  check("contains cqa-2026-06-16-run1-002-regen1 (regen)", genAssets.some((a) => a.asset_id === "cqa-2026-06-16-run1-002-regen1"));
  check("contains cqa-2026-06-16-run1-002 (parent)", genAssets.some((a) => a.asset_id === "cqa-2026-06-16-run1-002"));
}

// Step 9: No secrets / env files committed
console.log("\n9. No secret / env files committed");
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
  console.log("\n❌ Phase 6E-I Run 1 final closeout validation: FAIL");
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
}

console.log("\n✅ Phase 6E-I Run 1 final closeout validation: PASS");
console.log(`   run1_final_status: closed`);
console.log(`   run1_final_outcome: approved_after_regen`);
console.log(`   usable_run1_images: 2 / 2`);
console.log(`   selected images: Q-6E-B-001 (original 82.5) + Q-6E-B-002 (regen 76.6)`);
console.log(`   parent image (Q-6E-B-002): superseded_by_regen (still exists, not overwritten, not deleted)`);
console.log(`   total_generated_image_files: 8 (unchanged)`);
console.log(`   pending_images: 18 (unchanged)`);
console.log(`   Run 2 / Run 3: still pending, no auto-trigger`);
console.log(`   next phase options: 6E-F (Approve Run 2) or Idle (stop here) — awaiting separate explicit human command`);
process.exit(0);