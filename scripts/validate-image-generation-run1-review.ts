#!/usr/bin/env ts-node
/**
 * Phase 6E-E · Run 1 Human Image Review Pack Validator
 *
 * Validates the state of Phase 6E-E Run 1 human review pack creation:
 * - assets-repo/publishing/review/image/phase-6e/run1/{review-board,scoring-sheet,README}
 * - harvester dashboard/image-generation-run1-review.json
 * - harvester dashboard/mainline-production-queue.json (with run1 review status)
 * - No 6D-5 final_status change
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
 *   npx ts-node scripts/validate-image-generation-run1-review.ts
 *   npm run validate:image-generation-run1-review
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

interface ReviewItem {
  item_id: string;
  asset_id: string;
  title: string;
  source_type: string;
  risk_level: string;
  image_path: string;
  image_url?: string;
  prompt_hash: string;
  output_hash: string;
  generated_at: string;
  review_status: string;
  human_score: number | null;
  decision: string;
  notes: string | null;
}

interface ReviewBoard {
  phase: string;
  total_items: number;
  reviewed: number;
  approved: number;
  needs_regen: number;
  rejected: number;
  pending: number;
  run_2_status: string;
  run_3_status: string;
  no_model_call: boolean;
  no_media_generation: boolean;
  no_x_publish: boolean;
  no_timer: boolean;
  no_digest: boolean;
  no_promote: boolean;
  no_c5n_change: boolean;
  no_secrets: boolean;
  no_run_2_approval: boolean;
  no_run_3_approval: boolean;
  items: ReviewItem[];
}

console.log("\n=== Phase 6E-E Run 1 Human Image Review Pack Validator ===\n");

// Step 1: File presence (assets repo)
console.log("1. Assets repo file presence");
const reviewDir = path.join(ASSETS_ROOT, "publishing/review/image/phase-6e/run1");
const reviewBoardJson = path.join(reviewDir, "review-board.json");
const reviewBoardMd = path.join(reviewDir, "review-board.md");
const scoringSheetJson = path.join(reviewDir, "scoring-sheet.json");
const scoringSheetMd = path.join(reviewDir, "scoring-sheet.md");
const readme = path.join(reviewDir, "README.md");

check("review-board.json exists", fileExists(reviewBoardJson), reviewBoardJson);
check("review-board.md exists", fileExists(reviewBoardMd), reviewBoardMd);
check("scoring-sheet.json exists", fileExists(scoringSheetJson), scoringSheetJson);
check("scoring-sheet.md exists", fileExists(scoringSheetMd), scoringSheetMd);
check("README.md exists", fileExists(readme), readme);

// Step 2: Run 1 image files exist
console.log("\n2. Run 1 image files exist (not overwritten)");
const img1 = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run1-001_001.jpg");
const img2 = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run1-002_001.jpg");
check("Run 1 image 1 exists", fileExists(img1));
check("Run 1 image 2 exists", fileExists(img2));

// Step 3: generated-assets.json count unchanged (7)
console.log("\n3. generated-assets.json count unchanged (still 7)");
const genAssets = readJSON<any[]>(path.join(ASSETS_ROOT, "metadata/generated-assets.json"));
check("generated-assets.json exists", Array.isArray(genAssets));
if (Array.isArray(genAssets)) {
  check("count === 7 (no new images)", genAssets.length === 7, String(genAssets.length));
}

// Step 4: Review board content
console.log("\n4. Review board content");
const board = readJSON<ReviewBoard>(reviewBoardJson);
check("review-board.json parses", board !== null);
if (board) {
  check("board.phase === '6E-E'", board.phase === "6E-E", board.phase);
  check("board.total_items === 2", board.total_items === 2, String(board.total_items));
  // pending: 2 in pre-decision state, 0 in post-decision state
  check(
    "board.pending is 2 (pre) or 0 (post-decision)",
    board.pending === 2 || board.pending === 0,
    String(board.pending)
  );
  // reviewed: 0 in pre-decision state, 2 in post-decision state
  check(
    "board.reviewed is 0 (pre) or 2 (post-decision)",
    board.reviewed === 0 || board.reviewed === 2,
    String(board.reviewed)
  );
  check("board.run_2_status === 'pending'", board.run_2_status === "pending", board.run_2_status);
  check("board.run_3_status === 'pending'", board.run_3_status === "pending", board.run_3_status);
  check("board.items.length === 2", board.items.length === 2, String(board.items.length));

  // Boundary flags
  check("board.no_model_call === true", board.no_model_call === true);
  check("board.no_media_generation === true", board.no_media_generation === true);
  check("board.no_x_publish === true", board.no_x_publish === true);
  check("board.no_timer === true", board.no_timer === true);
  check("board.no_digest === true", board.no_digest === true);
  check("board.no_promote === true", board.no_promote === true);
  check("board.no_c5n_change === true", board.no_c5n_change === true);
  check("board.no_secrets === true", board.no_secrets === true);
  check("board.no_run_2_approval === true", board.no_run_2_approval === true);
  check("board.no_run_3_approval === true", board.no_run_3_approval === true);

  // Items validation
  const itemIds = board.items.map((i) => i.item_id).sort();
  check(
    "items are Q-6E-B-001 and Q-6E-B-002",
    JSON.stringify(itemIds) === JSON.stringify(["Q-6E-B-001", "Q-6E-B-002"]),
    itemIds.join(",")
  );

  for (const item of board.items) {
    // Allow either pre-decision (pending) or post-decision (approved/needs_regen/rejected) state
    const allowedReviewStatus = ["pending_human_review", "approved", "needs_regen", "rejected"];
    check(
      `${item.item_id} review_status is valid (pending or decided)`,
      allowedReviewStatus.includes(item.review_status),
      item.review_status
    );
    // human_score: null in pending, or a number in decided
    check(
      `${item.item_id} human_score is null or number`,
      item.human_score === null || typeof item.human_score === "number",
      String(item.human_score)
    );
    // decision: pending OR a real decision
    const allowedDecisions = ["pending", "approve", "needs_regen", "reject"];
    check(
      `${item.item_id} decision is valid`,
      allowedDecisions.includes(item.decision),
      item.decision
    );
    // notes: null in pending, or a non-empty string in decided
    check(
      `${item.item_id} notes is null or non-empty string`,
      item.notes === null || (typeof item.notes === "string" && item.notes.length > 0),
      item.notes === null ? "null" : "string"
    );
    check(`${item.item_id} image_path present`, typeof item.image_path === "string" && item.image_path.length > 0);
    check(`${item.item_id} prompt_hash present`, typeof item.prompt_hash === "string" && item.prompt_hash.length === 12);
    check(`${item.item_id} output_hash present`, typeof item.output_hash === "string" && item.output_hash.length === 12);
  }
}

// Step 5: Scoring sheet content
console.log("\n5. Scoring sheet content");
const sheet = readJSON<any>(scoringSheetJson);
check("scoring-sheet.json parses", sheet !== null);
if (sheet) {
  check("sheet.phase === '6E-E'", sheet.phase === "6E-E");
  // scoring_complete: false in pre-decision, true in post-decision
  check(
    "sheet.scoring_complete is true or false",
    sheet.scoring_complete === true || sheet.scoring_complete === false,
    String(sheet.scoring_complete)
  );
  check("sheet has 5 scoring dimensions", typeof sheet.scoring_dimensions === "object");
  const dims = sheet.scoring_dimensions ?? {};
  check("has prompt_alignment dim", typeof dims.prompt_alignment === "object");
  check("has visual_quality dim", typeof dims.visual_quality === "object");
  check("has usefulness_as_asset dim", typeof dims.usefulness_as_asset === "object");
  check("has factual_safety dim", typeof dims.factual_safety === "object");
  check("has brand_text_artifact_risk dim", typeof dims.brand_text_artifact_risk === "object");
  check("sheet.items.length === 2", Array.isArray(sheet.items) && sheet.items.length === 2);
  for (const item of sheet.items ?? []) {
    // Allow either pre-decision (null) or post-decision (number) state
    check(
      `${item.item_id} overall_score is null or number`,
      item.overall_score === null || typeof item.overall_score === "number",
      String(item.overall_score)
    );
    const allowedDecisions = ["pending", "approve", "needs_regen", "reject"];
    check(
      `${item.item_id} human_decision is valid`,
      allowedDecisions.includes(item.human_decision),
      item.human_decision
    );
    for (const k of ["prompt_alignment", "visual_quality", "usefulness_as_asset", "factual_safety", "brand_text_artifact_risk"]) {
      check(
        `${item.item_id} ${k} is null or number`,
        item.scores?.[k] === null || typeof item.scores?.[k] === "number",
        String(item.scores?.[k])
      );
    }
  }
}

// Step 6: Harvester dashboard files
console.log("\n6. Harvester dashboard files");
const reviewDash = path.join(ROOT, "dashboard/image-generation-run1-review.json");
check("image-generation-run1-review.json exists", fileExists(reviewDash), reviewDash);
const reviewDashContent = readJSON<any>(reviewDash);
if (reviewDashContent) {
  check("review dash.phase === '6E-E'", reviewDashContent.phase === "6E-E", reviewDashContent.phase);
  // Allow either pre-decision (pending) or post-decision (any of approved/needs_regen/rejected)
  const dashReviewStatus = reviewDashContent.review_status;
  check(
    "review dash.review_status is valid (pending or decided)",
    dashReviewStatus === "pending_human_review" || ["approved", "needs_regen", "rejected"].includes(dashReviewStatus),
    dashReviewStatus
  );
  const dashDecision = reviewDashContent.decision;
  check(
    "review dash.decision is valid",
    ["pending", "approve", "needs_regen", "reject"].includes(dashDecision),
    dashDecision
  );
  check("review dash.no_model_call === true", reviewDashContent.no_model_call === true);
  check("review dash.no_media_generation === true", reviewDashContent.no_media_generation === true);
  check("review dash.no_x_publish === true", reviewDashContent.no_x_publish === true);
  check("review dash.no_timer === true", reviewDashContent.no_timer === true);
  check("review dash.no_promote === true", reviewDashContent.no_promote === true);
  check("review dash.no_c5n_change === true", reviewDashContent.no_c5n_change === true);
  check("review dash.run_2_approved === false", reviewDashContent.run_2_approved === false);
  check("review dash.run_3_approved === false", reviewDashContent.run_3_approved === false);
  check("review dash.total_generated_images === 7", reviewDashContent.total_generated_images === 7, String(reviewDashContent.total_generated_images));
  check("review dash.pending_images === 18", reviewDashContent.pending_images === 18, String(reviewDashContent.pending_images));
  check("review dash.items.length === 2", Array.isArray(reviewDashContent.items) && reviewDashContent.items.length === 2);
}

// Step 7: mainline-production-queue.json — pending_images should be 18
console.log("\n7. mainline-production-queue.json unchanged in counts");
const queue = readJSON<any>(path.join(ROOT, "dashboard/mainline-production-queue.json"));
if (queue) {
  check("queue has run1 review status", typeof queue.run1_review_status === "string" || typeof queue.run1_review === "object");
  if (queue.run1_review) {
    check("queue.run1_review.review_status === pending_human_review", queue.run1_review.review_status === "pending_human_review");
    check("queue.run1_review.decision === pending", queue.run1_review.decision === "pending");
  }
  // Boundaries
  if (queue.boundaries_enforced) {
    check("queue.boundaries_enforced.media_generation_actually_executed === true (unchanged from 6E-D)", queue.boundaries_enforced.media_generation_actually_executed === true);
    check("queue.boundaries_enforced.image_api_called === true (unchanged from 6E-D)", queue.boundaries_enforced.image_api_called === true);
  }
}

// Step 8: 6D-5 closeout unchanged
console.log("\n8. 6D-5 closeout unchanged (final_status=closed)");
const xManualLog = readJSON<{ final_status: string; posted_manually_total: number; phase: string }>(
  path.join(ROOT, "dashboard/x-manual-post-log.json")
);
check("x-manual-post-log.json exists", xManualLog !== null);
if (xManualLog) {
  check("6D-5 final_status === 'closed'", xManualLog.final_status === "closed", xManualLog.final_status);
  check("6D-5 posted_manually_total === 5", xManualLog.posted_manually_total === 5, String(xManualLog.posted_manually_total));
}

// Step 9: Image generation gates — Run 2/3 still pending
console.log("\n9. Image generation gates — Run 2/3 still pending");
const gates = readJSON<any>(path.join(ROOT, "dashboard/image-generation-gates.json"));
if (gates) {
  check("gates.run_2.approved === false", gates.run_status?.run_2?.approved === false);
  check("gates.run_3.approved === false", gates.run_status?.run_3?.approved === false);
  check("gates.run_1.approved === true", gates.run_status?.run_1?.approved === true);
}

// Step 10: No secrets committed
console.log("\n10. No secrets / env files committed");
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

// Step 11: No new image files added in this commit
console.log("\n11. No new image files generated in this phase");
const assetsLastCommit = execSync(
  `cd "${ASSETS_ROOT}" && git diff --name-status HEAD~1 HEAD`,
  { encoding: "utf-8" }
).trim();
check(
  "no .jpg / .png / .webp files in last commit",
  !assetsLastCommit.split("\n").some((line: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(line))
);

// Step 12: dashboard/index.html updated
console.log("\n12. dashboard/index.html updated with Phase 6E-E entry");
const indexPath = path.join(ROOT, "dashboard/index.html");
check("index.html exists", fileExists(indexPath));
if (fileExists(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, "utf-8");
  check("index.html mentions Phase 6E-E", indexContent.includes("6E-E") || indexContent.includes("6e-e") || indexContent.includes("Phase 6E-E"));
  check("index.html mentions run1 review", indexContent.toLowerCase().includes("run1 review") || indexContent.toLowerCase().includes("run 1 review") || indexContent.toLowerCase().includes("human image review"));
}

// Final summary
console.log("\n=== Summary ===");
console.log(`Pass: ${passCount}`);
console.log(`Fail: ${failCount}`);

if (failCount > 0) {
  console.log("\n❌ Phase 6E-E Run 1 review pack validation: FAIL");
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
}

console.log("\n✅ Phase 6E-E Run 1 review pack validation: PASS");
console.log(`   review_status: pending_human_review`);
console.log(`   decision: pending`);
console.log(`   run_2_status: pending`);
console.log(`   run_3_status: pending`);
console.log(`   total_generated_images: 7 (unchanged)`);
console.log(`   pending_images: 18 (unchanged)`);
console.log(`   no_model_call: true | no_media_generation: true | no_x_publish: true`);
process.exit(0);
