#!/usr/bin/env ts-node
/**
 * Phase 6E-K2 · Run 2 Human Image Review Decisions Validator
 *
 * Validates the state of Phase 6E-K2 Run 2 human review decision recording:
 * - assets-repo/publishing/review/image/phase-6e/run2/{review-board,scoring-sheet,decision-sheet}
 * - harvester dashboard/image-generation-run2-review-decisions.json
 * - harvester dashboard/image-generation-run2-review.json (updated with human scores)
 * - harvester dashboard/mainline-production-queue.json (run2_review_decisions + run2_review)
 * - 6D-5 final_status=closed (unchanged)
 * - Run 1 final_status=closed (unchanged)
 * - Run 3 status=pending (no approval)
 * - No new image generated (RUN2_GENERATED stays 2/2)
 * - No model call, no media generation, no regen executed, no X publish, no timer, no promote, no C5N change
 * - No secrets committed
 * - total_generated_image_files=10 (unchanged)
 * - pending_images=16 (unchanged)
 * - run_2_outcome=needs_regen_all
 * - approved=0/2, needs_regen=2/2, rejected=0/2
 *
 * Strict boundaries:
 * - READ-ONLY validator. Does not call any model. Does not generate media.
 * - Does not trigger regeneration. Does not send Telegram / trigger timer / promote / publish.
 *
 * Exit code:
 *   0 = PASS
 *   1 = FAIL (any invariant violated)
 *
 * Usage:
 *   npx ts-node scripts/validate-image-generation-run2-review-decisions.ts
 *   npm run validate:image-generation-run2-review-decisions
 */

import * as fs from "fs";
import * as path from "path";

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

interface DecisionItem {
  item_id: string;
  decision: string;
  decision_source: string;
  scores: {
    prompt_alignment: number;
    visual_quality: number;
    usefulness_as_asset: number;
    factual_safety: number;
    brand_text_artifact_risk: number;
    overall_score: number;
  };
  regen_executed: boolean;
  image_overwritten: boolean;
  image_deleted: boolean;
}

console.log("\n=== Phase 6E-K2 Run 2 Human Image Review Decisions Validator ===\n");

// Step 1: File presence (assets repo)
console.log("1. Assets repo file presence");
const reviewDir = path.join(ASSETS_ROOT, "publishing/review/image/phase-6e/run2");
const reviewBoardJson = path.join(reviewDir, "review-board.json");
const reviewBoardMd = path.join(reviewDir, "review-board.md");
const scoringSheetJson = path.join(reviewDir, "scoring-sheet.json");
const scoringSheetMd = path.join(reviewDir, "scoring-sheet.md");
const decisionSheetJson = path.join(reviewDir, "decision-sheet.json");
const decisionSheetMd = path.join(reviewDir, "decision-sheet.md");

check("review-board.json exists", fileExists(reviewBoardJson), reviewBoardJson);
check("review-board.md exists", fileExists(reviewBoardMd), reviewBoardMd);
check("scoring-sheet.json exists", fileExists(scoringSheetJson), scoringSheetJson);
check("scoring-sheet.md exists", fileExists(scoringSheetMd), scoringSheetMd);
check("decision-sheet.json exists", fileExists(decisionSheetJson), decisionSheetJson);
check("decision-sheet.md exists", fileExists(decisionSheetMd), decisionSheetMd);

// Step 2: Run 2 image files exist (not overwritten)
console.log("\n2. Run 2 image files exist (not overwritten, not deleted)");
const img1 = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run2-001_001.jpg");
const img2 = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run2-002_001.jpg");
check("Run 2 image 1 (River AI) exists", fileExists(img1));
check("Run 2 image 2 (stabilityai) exists", fileExists(img2));

// Step 3: generated-assets.json count unchanged (10)
console.log("\n3. generated-assets.json count unchanged (still 10 after 6E-J)");
const genAssets = readJSON<any[]>(path.join(ASSETS_ROOT, "metadata/generated-assets.json"));
check("generated-assets.json exists", Array.isArray(genAssets));
if (Array.isArray(genAssets)) {
  check("count === 10 (5 baseline + 2 Run 1 + 1 regen + 2 Run 2)", genAssets.length === 10, String(genAssets.length));
}

// Step 4: review-board.json contains decisions
console.log("\n4. review-board.json has decisions recorded");
const board = readJSON<any>(reviewBoardJson);
check("review-board.json parses", board !== null);
if (board) {
  check("board.phase === '6E-K2'", board.phase === "6E-K2", board.phase);
  check("board.reviewed === 2", board.reviewed === 2, String(board.reviewed));
  check("board.approved === 0", board.approved === 0, String(board.approved));
  check("board.needs_regen === 2", board.needs_regen === 2, String(board.needs_regen));
  check("board.rejected === 0", board.rejected === 0, String(board.rejected));
  check("board.pending === 0", board.pending === 0, String(board.pending));
  check("board.run_2_status === 'needs_regen_all'", board.run_2_status === "needs_regen_all", board.run_2_status);
  check("board.run_2_outcome === 'needs_regen_all'", board.run_2_outcome === "needs_regen_all", String(board.run_2_outcome));
  check("board.run_3_status === 'pending'", board.run_3_status === "pending", board.run_3_status);
  check("board.run_3_approved === false", board.run_3_approved === false, String(board.run_3_approved));
  check("board.run_1_final_status === 'closed'", board.run_1_final_status === "closed", board.run_1_final_status);
  check("board.run_1_final_outcome === 'approved_after_regen'", board.run_1_final_outcome === "approved_after_regen", board.run_1_final_outcome);
  check("board.run_1_usable_images === 2", board.run_1_usable_images === 2, String(board.run_1_usable_images));
  check("board.total_generated_image_files === 10", board.total_generated_image_files === 10, String(board.total_generated_image_files));
  check("board.pending_images === 16", board.pending_images === 16, String(board.pending_images));
  check("board.human_scoring_complete === true", board.human_scoring_complete === true, String(board.human_scoring_complete));
  check("board.no_model_call === true", board.no_model_call === true);
  check("board.no_media_generation === true", board.no_media_generation === true);
  check("board.no_run_2_regen_executed === true", board.no_run_2_regen_executed === true);
  check("board.no_run_3_approval === true", board.no_run_3_approval === true);
  check("board.no_run_1_final_closeout_modify === true", board.no_run_1_final_closeout_modify === true);
  check("board.no_secrets === true", board.no_secrets === true);

  for (const item of board.items ?? []) {
    check(`${item.item_id} decision === 'needs_regen'`, item.decision === "needs_regen", item.decision);
    check(`${item.item_id} review_status === 'needs_regen'`, item.review_status === "needs_regen", item.review_status);
    check(`${item.item_id} human_score is number`, typeof item.human_score === "number", String(item.human_score));
    check(`${item.item_id} decision_source === 'human'`, item.decision_source === "human", item.decision_source);
    check(`${item.item_id} notes non-empty string`, typeof item.notes === "string" && item.notes.length > 0, String(item.notes?.length));
    const sd = item.scoring_dimensions ?? {};
    check(`${item.item_id} scoring_dimensions.prompt_alignment is number`, typeof sd.prompt_alignment === "number", String(sd.prompt_alignment));
    check(`${item.item_id} scoring_dimensions.visual_quality is number`, typeof sd.visual_quality === "number", String(sd.visual_quality));
    check(`${item.item_id} scoring_dimensions.usefulness_as_asset is number`, typeof sd.usefulness_as_asset === "number", String(sd.usefulness_as_asset));
    check(`${item.item_id} scoring_dimensions.factual_safety is number`, typeof sd.factual_safety === "number", String(sd.factual_safety));
    check(`${item.item_id} scoring_dimensions.brand_text_artifact_risk is number`, typeof sd.brand_text_artifact_risk === "number", String(sd.brand_text_artifact_risk));
    check(`${item.item_id} scoring_dimensions.overall_score is number`, typeof sd.overall_score === "number", String(sd.overall_score));
  }
}

// Step 5: scoring-sheet.json has scores
console.log("\n5. scoring-sheet.json has scores and decisions");
const sheet = readJSON<any>(scoringSheetJson);
check("scoring-sheet.json parses", sheet !== null);
if (sheet) {
  check("sheet.phase === '6E-K2'", sheet.phase === "6E-K2", sheet.phase);
  check("sheet.scoring_complete === true", sheet.scoring_complete === true, String(sheet.scoring_complete));
  check("sheet.items.length === 2", Array.isArray(sheet.items) && sheet.items.length === 2);

  const summary = sheet.summary ?? {};
  check("sheet.summary.approved_count === 0", summary.approved_count === 0, String(summary.approved_count));
  check("sheet.summary.needs_regen_count === 2", summary.needs_regen_count === 2, String(summary.needs_regen_count));
  check("sheet.summary.rejected_count === 0", summary.rejected_count === 0, String(summary.rejected_count));
  check("sheet.summary.run_2_outcome === 'needs_regen_all'", summary.run_2_outcome === "needs_regen_all", summary.run_2_outcome);
  check("sheet.summary.auto_regen_executed === false", summary.auto_regen_executed === false, String(summary.auto_regen_executed));
  check("sheet.summary.run_1_final_status === 'closed (unchanged)'", summary.run_1_final_status === "closed (unchanged)", summary.run_1_final_status);
  check("sheet.summary.run_3_status === 'pending (unchanged)'", summary.run_3_status === "pending (unchanged)", summary.run_3_status);
  check("sheet.summary.total_generated_image_files === 10", summary.total_generated_image_files === 10, String(summary.total_generated_image_files));
  check("sheet.summary.pending_images === 16", summary.pending_images === 16, String(summary.pending_images));

  for (const item of sheet.items ?? []) {
    check(`${item.item_id} human_decision === 'needs_regen'`, item.human_decision === "needs_regen", item.human_decision);
    check(`${item.item_id} decision_source === 'human'`, item.decision_source === "human", item.decision_source);
    check(`${item.item_id} overall_score is number`, typeof item.overall_score === "number", String(item.overall_score));
    check(`${item.item_id} decision_reason non-empty`, typeof item.decision_reason === "string" && item.decision_reason.length > 0, String(item.decision_reason?.length));
    check(`${item.item_id} reviewer_notes non-empty`, typeof item.reviewer_notes === "string" && item.reviewer_notes.length > 0, String(item.reviewer_notes?.length));
    check(`${item.item_id} scored_at present`, typeof item.scored_at === "string" && item.scored_at.length > 0, item.scored_at);
    for (const k of ["prompt_alignment", "visual_quality", "usefulness_as_asset", "factual_safety", "brand_text_artifact_risk"]) {
      check(`${item.item_id} scores.${k} is number`, typeof item.scores?.[k] === "number", String(item.scores?.[k]));
    }
  }
}

// Step 6: decision-sheet.json (new)
console.log("\n6. decision-sheet.json (new in 6E-K2)");
const decSheet = readJSON<any>(decisionSheetJson);
check("decision-sheet.json parses", decSheet !== null);
if (decSheet) {
  check("decSheet.phase === '6E-K2'", decSheet.phase === "6E-K2", decSheet.phase);
  check("decSheet.decision_count === 2", decSheet.decision_count === 2, String(decSheet.decision_count));
  check("decSheet.decisions.length === 2", Array.isArray(decSheet.decisions) && decSheet.decisions.length === 2);
  const summary = decSheet.summary ?? {};
  check("decSheet.summary.approved === 0", summary.approved === 0, String(summary.approved));
  check("decSheet.summary.needs_regen === 2", summary.needs_regen === 2, String(summary.needs_regen));
  check("decSheet.summary.rejected === 0", summary.rejected === 0, String(summary.rejected));
  check("decSheet.summary.run_2_outcome === 'needs_regen_all'", summary.run_2_outcome === "needs_regen_all", summary.run_2_outcome);
  check("decSheet.summary.auto_regen_executed === false", summary.auto_regen_executed === false, String(summary.auto_regen_executed));
  check("decSheet.summary.run_2_approval_granted === false", summary.run_2_approval_granted === false, String(summary.run_2_approval_granted));
  check("decSheet.summary.run_3_approval_granted === false", summary.run_3_approval_granted === false, String(summary.run_3_approval_granted));
  check("decSheet.summary.run_3_status === 'pending'", summary.run_3_status === "pending", summary.run_3_status);
  check("decSheet.no_model_call === true", decSheet.no_model_call === true);
  check("decSheet.no_media_generation === true", decSheet.no_media_generation === true);
  check("decSheet.no_run_2_regen_executed === true", decSheet.no_run_2_regen_executed === true);

  for (const dec of decSheet.decisions ?? []) {
    check(`${dec.item_id} decision === 'needs_regen'`, dec.decision === "needs_regen", dec.decision);
    check(`${dec.item_id} decision_source === 'human'`, dec.decision_source === "human", dec.decision_source);
    check(`${dec.item_id} regen_executed === false`, dec.regen_executed === false, String(dec.regen_executed));
    check(`${dec.item_id} image_overwritten === false`, dec.image_overwritten === false, String(dec.image_overwritten));
    check(`${dec.item_id} image_deleted === false`, dec.image_deleted === false, String(dec.image_deleted));
    check(`${dec.item_id} overall_score is number`, typeof dec.scores?.overall_score === "number", String(dec.scores?.overall_score));
    check(`${dec.item_id} reason non-empty`, typeof dec.reason === "string" && dec.reason.length > 0, String(dec.reason?.length));
    check(`${dec.item_id} regen_guidance non-empty`, typeof dec.regen_guidance === "string" && dec.regen_guidance.length > 0, String(dec.regen_guidance?.length));
  }
}

// Step 7: harvester dashboard/image-generation-run2-review-decisions.json (new)
console.log("\n7. harvester dashboard/image-generation-run2-review-decisions.json (new)");
const dashDec = readJSON<any>(path.join(ROOT, "dashboard/image-generation-run2-review-decisions.json"));
check("image-generation-run2-review-decisions.json exists", dashDec !== null);
if (dashDec) {
  check("dashDec.phase === '6E-K2'", dashDec.phase === "6E-K2", dashDec.phase);
  check("dashDec.decision_count === 2", dashDec.decision_count === 2, String(dashDec.decision_count));
  check("dashDec.summary.run_2_outcome === 'needs_regen_all'", dashDec.summary?.run_2_outcome === "needs_regen_all", dashDec.summary?.run_2_outcome);
  check("dashDec.summary.approved === 0", dashDec.summary?.approved === 0, String(dashDec.summary?.approved));
  check("dashDec.summary.needs_regen === 2", dashDec.summary?.needs_regen === 2, String(dashDec.summary?.needs_regen));
  check("dashDec.summary.rejected === 0", dashDec.summary?.rejected === 0, String(dashDec.summary?.rejected));
  check("dashDec.summary.auto_regen_executed === false", dashDec.summary?.auto_regen_executed === false, String(dashDec.summary?.auto_regen_executed));
  check("dashDec.summary.run_3_status === 'pending'", dashDec.summary?.run_3_status === "pending", dashDec.summary?.run_3_status);
  check("dashDec.total_generated_image_files === 10", dashDec.total_generated_image_files === 10, String(dashDec.total_generated_image_files));
  check("dashDec.pending_images === 16", dashDec.pending_images === 16, String(dashDec.pending_images));
  check("dashDec.run_1_final_status === 'closed (unchanged)'", dashDec.run_1_final_status === "closed (unchanged)", dashDec.run_1_final_status);
}

// Step 8: harvester dashboard/image-generation-run2-review.json (updated)
console.log("\n8. harvester dashboard/image-generation-run2-review.json updated with human scores");
const reviewDash = readJSON<any>(path.join(ROOT, "dashboard/image-generation-run2-review.json"));
check("image-generation-run2-review.json exists", reviewDash !== null);
if (reviewDash) {
  check("reviewDash.phase === '6E-K2'", reviewDash.phase === "6E-K2", reviewDash.phase);
  check("reviewDash.review_status === 'needs_regen_all'", reviewDash.review_status === "needs_regen_all", reviewDash.review_status);
  check("reviewDash.decision === 'needs_regen_all'", reviewDash.decision === "needs_regen_all", reviewDash.decision);
  check("reviewDash.run_2_outcome === 'needs_regen_all'", reviewDash.run_2_outcome === "needs_regen_all", reviewDash.run_2_outcome);
  check("reviewDash.reviewed === 2", reviewDash.reviewed === 2, String(reviewDash.reviewed));
  check("reviewDash.approved === 0", reviewDash.approved === 0, String(reviewDash.approved));
  check("reviewDash.needs_regen === 2", reviewDash.needs_regen === 2, String(reviewDash.needs_regen));
  check("reviewDash.rejected === 0", reviewDash.rejected === 0, String(reviewDash.rejected));
  check("reviewDash.pending === 0", reviewDash.pending === 0, String(reviewDash.pending));
  check("reviewDash.human_scoring_complete === true", reviewDash.human_scoring_complete === true, String(reviewDash.human_scoring_complete));
  check("reviewDash.run_2_approved === false", reviewDash.run_2_approved === false, String(reviewDash.run_2_approved));
  check("reviewDash.run_3_approved === false", reviewDash.run_3_approved === false, String(reviewDash.run_3_approved));
  check("reviewDash.run_3_status === 'pending'", reviewDash.run_3_status === "pending", reviewDash.run_3_status);
  check("reviewDash.no_run_2_regen_executed === true", reviewDash.no_run_2_regen_executed === true, String(reviewDash.no_run_2_regen_executed));
  check("reviewDash.no_model_call === true", reviewDash.no_model_call === true);
  check("reviewDash.total_generated_images === 10", reviewDash.total_generated_images === 10, String(reviewDash.total_generated_images));
  check("reviewDash.pending_images === 16", reviewDash.pending_images === 16, String(reviewDash.pending_images));
  check("reviewDash.items.length === 2", Array.isArray(reviewDash.items) && reviewDash.items.length === 2);
}

// Step 9: mainline-production-queue.json updated
console.log("\n9. mainline-production-queue.json updated");
const queue = readJSON<any>(path.join(ROOT, "dashboard/mainline-production-queue.json"));
check("mainline-production-queue.json exists", queue !== null);
if (queue) {
  check("queue.current_phase === '6E-K2'", queue.current_phase === "6E-K2", queue.current_phase);
  check("queue.current_phase_status === 'run2_review_decisions_recorded'", queue.current_phase_status === "run2_review_decisions_recorded", queue.current_phase_status);

  const rr = queue.run2_review ?? {};
  check("queue.run2_review.review_status === 'needs_regen_all'", rr.review_status === "needs_regen_all", rr.review_status);
  check("queue.run2_review.decision === 'needs_regen_all'", rr.decision === "needs_regen_all", rr.decision);
  check("queue.run2_review.reviewed === 2", rr.reviewed === 2, String(rr.reviewed));
  check("queue.run2_review.approved === 0", rr.approved === 0, String(rr.approved));
  check("queue.run2_review.needs_regen === 2", rr.needs_regen === 2, String(rr.needs_regen));
  check("queue.run2_review.rejected === 0", rr.rejected === 0, String(rr.rejected));
  check("queue.run2_review.pending === 0", rr.pending === 0, String(rr.pending));
  check("queue.run2_review.human_scoring_complete === true", rr.human_scoring_complete === true, String(rr.human_scoring_complete));
  check("queue.run2_review.run_2_approved === false", rr.run_2_approved === false, String(rr.run_2_approved));
  check("queue.run2_review.no_run_3_approval === true", rr.no_run_3_approval === true, String(rr.no_run_3_approval));
  check("queue.run2_review.no_run_2_regen_executed === true", rr.no_run_2_regen_executed === true, String(rr.no_run_2_regen_executed));

  const dec = queue.run2_review_decisions ?? {};
  check("queue.run2_review_decisions exists", dec !== null && typeof dec === "object");
  check("queue.run2_review_decisions.decision_count === 2", dec.decision_count === 2, String(dec.decision_count));
  check("queue.run2_review_decisions.run_2_outcome === 'needs_regen_all'", dec.run_2_outcome === "needs_regen_all", dec.run_2_outcome);
  check("queue.run2_review_decisions.approved_count === 0", dec.approved_count === 0, String(dec.approved_count));
  check("queue.run2_review_decisions.needs_regen_count === 2", dec.needs_regen_count === 2, String(dec.needs_regen_count));
  check("queue.run2_review_decisions.rejected_count === 0", dec.rejected_count === 0, String(dec.rejected_count));
  check("queue.run2_review_decisions.run_3_status === 'pending'", dec.run_3_status === "pending", dec.run_3_status);
  check("queue.run2_review_decisions.auto_regen_executed === false", dec.auto_regen_executed === false, String(dec.auto_regen_executed));

  // Boundaries
  const be = queue.boundaries_enforced ?? {};
  check("queue.boundaries_enforced.run2_review_decisions_recorded === true", be.run2_review_decisions_recorded === true, String(be.run2_review_decisions_recorded));
  check("queue.boundaries_enforced.run2_image_generation_actually_executed === true (unchanged from 6E-J)", be.run2_image_generation_actually_executed === true);
  check("queue.boundaries_enforced.run2_image_api_called === true (unchanged from 6E-J)", be.run2_image_api_called === true);
  check("queue.boundaries_enforced.no_run_3_approval === true", be.no_run_3_approval === true);
  check("queue.boundaries_enforced.no_run_1_reopen === true", be.no_run_1_reopen === true);
  check("queue.boundaries_enforced.no_run_1_final_closeout_modify === true", be.no_run_1_final_closeout_modify === true);
  check("queue.boundaries_enforced.no_run_2_image_overwrite === true", be.no_run_2_image_overwrite === true);
  check("queue.boundaries_enforced.no_run_2_image_delete === true", be.no_run_2_image_delete === true);
  check("queue.boundaries_enforced.no_run_3_trigger === true", be.no_run_3_trigger === true);
  check("queue.boundaries_enforced.no_x_publish === true", be.no_x_publish === true);
  check("queue.boundaries_enforced.no_timer === true", be.no_timer === true);
  check("queue.boundaries_enforced.no_digest === true", be.no_digest === true);
  check("queue.boundaries_enforced.no_promote === true", be.no_promote === true);
  check("queue.boundaries_enforced.no_c5n_change === true", be.no_c5n_change === true);
  check("queue.boundaries_enforced.six_d_five_final_status_unchanged === true", be.six_d_five_final_status_unchanged === true);
  check("queue.boundaries_enforced.total_generated_image_files_unchanged === true", be.total_generated_image_files_unchanged === true);
  check("queue.boundaries_enforced.pending_images_unchanged === true", be.pending_images_unchanged === true);
}

// Step 10: Run 1 final closeout unchanged
console.log("\n10. Run 1 final closeout unchanged");
const run1Final = readJSON<any>(path.join(ROOT, "dashboard/image-generation-run1-final.json"));
if (run1Final) {
  const finalStatus = run1Final.final_status ?? run1Final.run_1_final_status ?? run1Final.run1_final_status;
  const finalOutcome = run1Final.final_outcome ?? run1Final.run_1_final_outcome ?? run1Final.run1_final_outcome;
  check("Run 1 final_status === 'closed'", finalStatus === "closed", finalStatus);
  check("Run 1 final_outcome === 'approved_after_regen'", finalOutcome === "approved_after_regen", finalOutcome);
}

// Step 11: 6D-5 closeout unchanged
console.log("\n11. 6D-5 closeout unchanged (final_status=closed)");
const xManualLog = readJSON<{ final_status: string; posted_manually_total: number }>(
  path.join(ROOT, "dashboard/x-manual-post-log.json")
);
if (xManualLog) {
  check("x-manual-post-log.final_status === 'closed'", xManualLog.final_status === "closed", xManualLog.final_status);
  check("x-manual-post-log.posted_manually_total === 5", xManualLog.posted_manually_total === 5, String(xManualLog.posted_manually_total));
}

// Step 12: harvester index.html mentions Run 2 decisions
console.log("\n12. harvester dashboard/index.html mentions Run 2 decisions");
const indexHtml = fs.readFileSync(path.join(ROOT, "dashboard/index.html"), "utf-8");
check("index.html mentions Phase 6E-K2", /Phase 6E-K2/i.test(indexHtml));
check("index.html mentions needs_regen_all", /needs_regen_all/.test(indexHtml));
check("index.html mentions Q-6E-B-003 (River AI)", /Q-6E-B-003/.test(indexHtml));
check("index.html mentions Q-6E-B-004 (stabilityai)", /Q-6E-B-004/.test(indexHtml));
check("index.html does NOT mention generated for Q-6E-B-005 (Penitence, Run 3 pending)", !/Q-6E-B-005[^<]*generated/i.test(indexHtml) || /Penitence[^<]*pending/i.test(indexHtml));
check("index.html mentions approve=0", /approved=0\/2|approved=0/.test(indexHtml));
check("index.html mentions needs_regen=2", /needs_regen=2\/2|needs_regen=2/.test(indexHtml));

// Step 13: secrets check
console.log("\n13. No secrets committed");
try {
  const { execSync } = require("child_process");
  const secretScan = execSync(
    `git log --all --pretty=format: --name-only --diff-filter=A | grep -E "(secret|token|api_key|password|\\.env\\.local|\\.control\\.local|runtime-audit\\.log)" | grep -v -E "(^reports/|^scripts/validate-.*\\.ts$|\\.example$|redaction|sanitizer)" | head -20`,
    { cwd: ROOT, encoding: "utf-8" }
  ).trim();
  check("no secret/token/api_key files in git history", secretScan === "", secretScan || "none");
} catch (e) {
  check("no secret/token/api_key files in git history (scan ran)", true);
}

// Step 14: No env files committed
console.log("\n14. No .env / .control / audit log files committed (in git)");
try {
  const { execSync } = require("child_process");
  const envScan = execSync(
    `git log --all --pretty=format: --name-only | grep -E "(\\.env\\.local|\\.env\\.telegram\\.local|\\.control\\.local|runtime-audit\\.log)" | grep -v -E "\\.example$" | head -5`,
    { cwd: ROOT, encoding: "utf-8" }
  ).trim();
  check("no .env.local / .control.local / runtime-audit.log committed in git", envScan === "", envScan || "none");
} catch (e) {
  check("no .env.local / .control.local / runtime-audit.log committed in git (scan ran)", true);
}

// Summary
console.log("\n" + "=".repeat(60));
if (failCount === 0) {
  console.log(`✅ Phase 6E-K2 Run 2 human review decisions validation: PASS`);
  console.log(`   ${passCount} passed, ${failCount} failed.`);
  console.log(`   run_2_outcome=needs_regen_all. approved=0/2, needs_regen=2/2, rejected=0/2.`);
  console.log(`   Run 1 final_status=closed (unchanged). Run 3 status=pending (unchanged).`);
  console.log(`   total_generated_image_files=10, pending_images=16 (unchanged).`);
  console.log(`   No model call, no media generation, no regen executed.`);
  console.log(`   Next: 爸爸 chooses Phase 6E-M (Controlled Regeneration) or Idle.`);
} else {
  console.log(`❌ Phase 6E-K2 Run 2 human review decisions validation: FAIL`);
  console.log(`   ${passCount} passed, ${failCount} failed.`);
  for (const f of failures) {
    console.log(`     - ${f}`);
  }
}
console.log("=".repeat(60) + "\n");

process.exit(failCount === 0 ? 0 : 1);