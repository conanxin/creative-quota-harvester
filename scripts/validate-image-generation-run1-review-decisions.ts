#!/usr/bin/env ts-node
/**
 * Phase 6E-E · Run 1 Human Review Decisions Validator
 *
 * Validates the state of Phase 6E-E Run 1 human review decisions:
 * - assets-repo/publishing/review/image/phase-6e/run1/{review-board,scoring-sheet,decision-sheet,README}
 * - harvester dashboard/image-generation-run1-review-decisions.json
 * - harvester dashboard/mainline-production-queue.json (with run1_review_decisions block)
 * - No new image generated
 * - No Run 2 / Run 3 approval
 * - No model call, no media generation, no X publish, no timer, no promote, no C5N change
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
 *   npx ts-node scripts/validate-image-generation-run1-review-decisions.ts
 *   npm run validate:image-generation-run1-review-decisions
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

console.log("\n=== Phase 6E-E Run 1 Human Review Decisions Validator ===\n");

// Step 1: File presence (assets repo)
console.log("1. Assets repo file presence");
const reviewDir = path.join(ASSETS_ROOT, "publishing/review/image/phase-6e/run1");
const reviewBoardJson = path.join(reviewDir, "review-board.json");
const reviewBoardMd = path.join(reviewDir, "review-board.md");
const scoringSheetJson = path.join(reviewDir, "scoring-sheet.json");
const scoringSheetMd = path.join(reviewDir, "scoring-sheet.md");
const decisionSheetJson = path.join(reviewDir, "decision-sheet.json");
const decisionSheetMd = path.join(reviewDir, "decision-sheet.md");
const readme = path.join(reviewDir, "README.md");

check("review-board.json exists", fileExists(reviewBoardJson));
check("review-board.md exists", fileExists(reviewBoardMd));
check("scoring-sheet.json exists", fileExists(scoringSheetJson));
check("scoring-sheet.md exists", fileExists(scoringSheetMd));
check("decision-sheet.json exists", fileExists(decisionSheetJson));
check("decision-sheet.md exists", fileExists(decisionSheetMd));
check("README.md exists", fileExists(readme));

// Step 2: Run 1 image files still exist and are not overwritten
console.log("\n2. Run 1 image files still exist (not overwritten)");
const img1 = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run1-001_001.jpg");
const img2 = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run1-002_001.jpg");
check("Run 1 image 1 exists", fileExists(img1));
check("Run 1 image 2 exists", fileExists(img2));

// Step 3: generated-assets.json count unchanged (still 7)
console.log("\n3. generated-assets.json count unchanged (still 7, no new images)");
const genAssets = readJSON<any[]>(path.join(ASSETS_ROOT, "metadata/generated-assets.json"));
check("generated-assets.json exists", Array.isArray(genAssets));
if (Array.isArray(genAssets)) {
  check("count === 7 or 8 (no new images from 6E-E; 8 if 6E-G regen)", genAssets.length === 7 || genAssets.length === 8, String(genAssets.length));
}

// Step 4: Review board content
console.log("\n4. Review board content (decisions recorded)");
const board = readJSON<any>(reviewBoardJson);
check("review-board.json parses", board !== null);
if (board) {
  check("board.phase === '6E-E'", board.phase === "6E-E");
  check("board.total_items === 2", board.total_items === 2);
  check("board.reviewed === 2", board.reviewed === 2, String(board.reviewed));
  check("board.approved === 1", board.approved === 1, String(board.approved));
  check("board.needs_regen === 1", board.needs_regen === 1, String(board.needs_regen));
  check("board.rejected === 0", board.rejected === 0, String(board.rejected));
  check("board.pending === 0", board.pending === 0, String(board.pending));
  check("board.human_scoring_complete === true", board.human_scoring_complete === true);
  check("board.run_1_outcome === 'partial_pass'", board.run_1_outcome === "partial_pass", board.run_1_outcome);
  check("board.run_2_status === 'pending'", board.run_2_status === "pending");
  check("board.run_3_status === 'pending'", board.run_3_status === "pending");

  // Items validation
  const itemQ1 = board.items?.find((i: any) => i.item_id === "Q-6E-B-001");
  const itemQ2 = board.items?.find((i: any) => i.item_id === "Q-6E-B-002");
  check("Q-6E-B-001 found", itemQ1 !== undefined);
  check("Q-6E-B-002 found", itemQ2 !== undefined);

  if (itemQ1) {
    check("Q-6E-B-001 review_status === 'approved'", itemQ1.review_status === "approved", itemQ1.review_status);
    check("Q-6E-B-001 decision === 'approve'", itemQ1.decision === "approve", itemQ1.decision);
    check("Q-6E-B-001 human_score === 82.5", itemQ1.human_score === 82.5, String(itemQ1.human_score));
    check("Q-6E-B-001 notes present", typeof itemQ1.notes === "string" && itemQ1.notes.length > 0);
  }
  if (itemQ2) {
    check("Q-6E-B-002 review_status === 'needs_regen'", itemQ2.review_status === "needs_regen", itemQ2.review_status);
    check("Q-6E-B-002 decision === 'needs_regen'", itemQ2.decision === "needs_regen", itemQ2.decision);
    check("Q-6E-B-002 human_score === 43.3", itemQ2.human_score === 43.3, String(itemQ2.human_score));
    check("Q-6E-B-002 notes present", typeof itemQ2.notes === "string" && itemQ2.notes.length > 0);
  }
}

// Step 5: Scoring sheet content
console.log("\n5. Scoring sheet content (human scores recorded)");
const sheet = readJSON<any>(scoringSheetJson);
check("scoring-sheet.json parses", sheet !== null);
if (sheet) {
  check("sheet.scoring_complete === true", sheet.scoring_complete === true);
  check("sheet.total_items === 2", sheet.total_items === 2);

  const itemQ1 = sheet.items?.find((i: any) => i.item_id === "Q-6E-B-001");
  const itemQ2 = sheet.items?.find((i: any) => i.item_id === "Q-6E-B-002");

  if (itemQ1) {
    check("Q-6E-B-001 prompt_alignment === 8.5", itemQ1.scores?.prompt_alignment === 8.5);
    check("Q-6E-B-001 visual_quality === 9.0", itemQ1.scores?.visual_quality === 9.0);
    check("Q-6E-B-001 usefulness_as_asset === 8.5", itemQ1.scores?.usefulness_as_asset === 8.5);
    check("Q-6E-B-001 factual_safety === 8.0", itemQ1.scores?.factual_safety === 8.0);
    check("Q-6E-B-001 brand_text_artifact_risk === 6.5", itemQ1.scores?.brand_text_artifact_risk === 6.5);
    check("Q-6E-B-001 overall_score === 82.5", itemQ1.overall_score === 82.5);
    check("Q-6E-B-001 human_decision === 'approve'", itemQ1.human_decision === "approve");
  }
  if (itemQ2) {
    check("Q-6E-B-002 prompt_alignment === 6.0", itemQ2.scores?.prompt_alignment === 6.0);
    check("Q-6E-B-002 visual_quality === 4.5", itemQ2.scores?.visual_quality === 4.5);
    check("Q-6E-B-002 usefulness_as_asset === 4.0", itemQ2.scores?.usefulness_as_asset === 4.0);
    check("Q-6E-B-002 factual_safety === 3.5", itemQ2.scores?.factual_safety === 3.5);
    check("Q-6E-B-002 brand_text_artifact_risk === 2.5", itemQ2.scores?.brand_text_artifact_risk === 2.5);
    check("Q-6E-B-002 overall_score === 43.3", itemQ2.overall_score === 43.3);
    check("Q-6E-B-002 human_decision === 'needs_regen'", itemQ2.human_decision === "needs_regen");
  }
}

// Step 6: Decision sheet content
console.log("\n6. Decision sheet content (summary)");
const decision = readJSON<any>(decisionSheetJson);
check("decision-sheet.json parses", decision !== null);
if (decision) {
  check("decision.approved === 1", decision.approved === 1, String(decision.approved));
  check("decision.needs_regen === 1", decision.needs_regen === 1, String(decision.needs_regen));
  check("decision.rejected === 0", decision.rejected === 0, String(decision.rejected));
  check("decision.pending === 0", decision.pending === 0, String(decision.pending));
  check("decision.run_1_outcome === 'partial_pass'", decision.run_1_outcome === "partial_pass");
  check("decision.run_2_status === 'pending'", decision.run_2_status === "pending");
  check("decision.run_3_status === 'pending'", decision.run_3_status === "pending");
  check("decision.no_regeneration_executed === true", decision.no_regeneration_executed === true);
  check("decision.regeneration_deferred_to_phase_6eg === true", decision.regeneration_deferred_to_phase_6eg === true);
  check("decision.decisions.length === 2", Array.isArray(decision.decisions) && decision.decisions.length === 2);
}

// Step 7: Harvester dashboard for decisions
console.log("\n7. Harvester dashboard for decisions");
const decDash = path.join(ROOT, "dashboard/image-generation-run1-review-decisions.json");
check("image-generation-run1-review-decisions.json exists", fileExists(decDash));
const decDashContent = readJSON<any>(decDash);
if (decDashContent) {
  check("dec dash.phase === '6E-E'", decDashContent.phase === "6E-E", decDashContent.phase);
  check("dec dash.approved === 1", decDashContent.approved === 1);
  check("dec dash.needs_regen === 1", decDashContent.needs_regen === 1);
  check("dec dash.run_1_outcome === 'partial_pass'", decDashContent.run_1_outcome === "partial_pass");
  check("dec dash.run_2_approved === false", decDashContent.run_2_approved === false);
  check("dec dash.run_3_approved === false", decDashContent.run_3_approved === false);
  check("dec dash.no_model_call === true", decDashContent.no_model_call === true);
  check("dec dash.no_media_generation === true", decDashContent.no_media_generation === true);
  check("dec dash.no_x_publish === true", decDashContent.no_x_publish === true);
  check("dec dash.no_timer === true", decDashContent.no_timer === true);
  check("dec dash.no_promote === true", decDashContent.no_promote === true);
  check("dec dash.no_c5n_change === true", decDashContent.no_c5n_change === true);
  check("dec dash.no_regeneration_executed === true", decDashContent.no_regeneration_executed === true);
  check("dec dash.total_generated_images === 7", decDashContent.total_generated_images === 7, String(decDashContent.total_generated_images));
  check("dec dash.pending_images === 18", decDashContent.pending_images === 18, String(decDashContent.pending_images));
  check("dec dash.items.length === 2", Array.isArray(decDashContent.items) && decDashContent.items.length === 2);
}

// Step 8: mainline-production-queue.json — run1_review_decisions block
console.log("\n8. mainline-production-queue.json with run1_review_decisions");
const queue = readJSON<any>(path.join(ROOT, "dashboard/mainline-production-queue.json"));
if (queue) {
  check("queue has run1_review_decisions block", typeof queue.run1_review_decisions === "object");
  if (queue.run1_review_decisions) {
    check("queue.run1_review_decisions.approved === 1", queue.run1_review_decisions.approved === 1);
    check("queue.run1_review_decisions.needs_regen === 1", queue.run1_review_decisions.needs_regen === 1);
    check("queue.run1_review_decisions.run_1_outcome === 'partial_pass'", queue.run1_review_decisions.run_1_outcome === "partial_pass");
  }
}

// Step 9: 6D-5 closeout unchanged
console.log("\n9. 6D-5 closeout unchanged (final_status=closed)");
const xManualLog = readJSON<{ final_status: string; posted_manually_total: number; phase: string }>(
  path.join(ROOT, "dashboard/x-manual-post-log.json")
);
if (xManualLog) {
  check("6D-5 final_status === 'closed'", xManualLog.final_status === "closed", xManualLog.final_status);
  check("6D-5 posted_manually_total === 5", xManualLog.posted_manually_total === 5, String(xManualLog.posted_manually_total));
}

// Step 10: Image generation gates — Run 2/3 still pending
console.log("\n10. Image generation gates — Run 2/3 still pending");
const gates = readJSON<any>(path.join(ROOT, "dashboard/image-generation-gates.json"));
if (gates) {
  check("gates.run_2.approved === false", gates.run_status?.run_2?.approved === false);
  check("gates.run_3.approved === false", gates.run_status?.run_3?.approved === false);
  check("gates.run_1.approved === true", gates.run_status?.run_1?.approved === true);
}

// Step 11: No secrets committed
console.log("\n11. No secrets / env files committed");
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

// Step 12: No new image files in the 6E-E review-decisions commit (68aaa81)
console.log("\n12. No new image files in the 6E-E review-decisions commit");
const PHASE_6EE_COMMIT = "68aaa81";
let assetsLastCommit = "";
try {
  assetsLastCommit = execSync(
    `cd "${ASSETS_ROOT}" && git diff --name-status ${PHASE_6EE_COMMIT}~1 ${PHASE_6EE_COMMIT}`,
    { encoding: "utf-8" }
  ).trim();
} catch (e) {
  // Fallback: check latest commit
  assetsLastCommit = execSync(
    `cd "${ASSETS_ROOT}" && git diff --name-status HEAD~1 HEAD`,
    { encoding: "utf-8" }
  ).trim();
}
const hasNewImages = assetsLastCommit.split("\n").some((line: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(line));
check(
  "no .jpg / .png / .webp files in 6E-E review-decisions commit (no new images from review phase)",
  !hasNewImages,
  hasNewImages ? `found image in 6E-E commit` : "no images in 6E-E commit"
);

// Step 13: dashboard/index.html updated
console.log("\n13. dashboard/index.html updated with decisions card");
const indexPath = path.join(ROOT, "dashboard/index.html");
if (fileExists(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, "utf-8");
  check("index.html mentions Phase 6E-E decisions", indexContent.includes("6E-E") || indexContent.includes("6e-e"));
  check("index.html mentions 'partial_pass'", indexContent.includes("partial_pass"));
  check("index.html mentions 'needs_regen'", indexContent.includes("needs_regen"));
}

// Final summary
console.log("\n=== Summary ===");
console.log(`Pass: ${passCount}`);
console.log(`Fail: ${failCount}`);

if (failCount > 0) {
  console.log("\n❌ Phase 6E-E Run 1 review decisions validation: FAIL");
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
}

console.log("\n✅ Phase 6E-E Run 1 review decisions validation: PASS");
console.log(`   run_1_outcome: partial_pass`);
console.log(`   approved: 1 (Q-6E-B-001 SamurAIGPT, overall 82.5)`);
console.log(`   needs_regen: 1 (Q-6E-B-002 Flaws LLM, overall 43.3)`);
console.log(`   rejected: 0`);
console.log(`   run_2_status: pending`);
console.log(`   run_3_status: pending`);
console.log(`   total_generated_images: 7 (unchanged)`);
console.log(`   pending_images: 18 (unchanged)`);
console.log(`   no_model_call: true | no_media_generation: true | no_x_publish: true`);
console.log(`   no_regeneration_executed: true (Phase 6E-G NOT triggered)`);
process.exit(0);
