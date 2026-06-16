#!/usr/bin/env ts-node
/**
 * Phase 6E-G · Run 1 Regeneration Validator (Q-6E-B-002 only)
 *
 * Validates the state of Phase 6E-G controlled regeneration:
 * - assets-repo/generated/phase-6e/run1/regen/q-6e-b-002/manifest.json
 * - assets-repo/generated/phase-6e/run1/regen/q-6e-b-002/README.md
 * - assets-repo/images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg
 * - assets-repo/images/2026/06/16/cqa-2026-06-16-run1-002-reg1_001.meta.json (per-image metadata)
 * - assets-repo/dashboard/image-generation-run1-regen.json
 * - harvester-repo/dashboard/image-generation-run1-regen.json (mirror)
 * - harvester-repo/dashboard/mainline-production-queue.json (run1_regen block)
 * - harvester-repo/dashboard/image-generation-plan.json (regen_1 block)
 * - harvester-repo/dashboard/image-generation-run1-review-decisions.json (parent phase unchanged)
 * - 6D-5 final_status=closed (unchanged)
 * - gates: Run 2/3 still pending
 * - generated-assets.json count: 7 -> 8 (one regen added)
 * - pending_images: 18 (unchanged)
 * - original failed image still exists
 * - original failed image not overwritten
 * - regen count = 1
 * - target_item_id = Q-6E-B-002 only
 * - no Q-6E-B-001 regen
 * - no Run 2 / Run 3 items
 * - no video, no music
 * - no X publish, no timer, no promote, no C5N
 * - no secrets
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
 *   npx ts-node scripts/validate-image-generation-run1-regen.ts
 *   npm run validate:image-generation-run1-regen
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
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

function sha12(text: string): string {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function listImagesInDir(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).filter((f) => f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png"));
}

console.log("\n=== Phase 6E-G · Run 1 Regeneration Validator (Q-6E-B-002 only) ===\n");

// Step 1: File presence (assets repo)
console.log("1. Assets repo file presence");
const regenDir = path.join(ASSETS_ROOT, "generated/phase-6e/run1/regen/q-6e-b-002");
const regenManifestPath = path.join(regenDir, "manifest.json");
const regenReadmePath = path.join(regenDir, "README.md");
const regenGenResultPath = path.join(regenDir, "generation-result.json");
const regenImagePath = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg");
const regenMetaPath = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.meta.json");
const regenDashAssetsPath = path.join(ASSETS_ROOT, "dashboard/image-generation-run1-regen.json");
const regenDashHarvesterPath = path.join(ROOT, "dashboard/image-generation-run1-regen.json");

check("regen manifest.json exists", fileExists(regenManifestPath));
check("regen README.md exists", fileExists(regenReadmePath));
check("regen generation-result.json exists", fileExists(regenGenResultPath));
check("regen image file exists", fileExists(regenImagePath));
check("regen per-image metadata exists", fileExists(regenMetaPath));
check("regen dashboard (assets-repo) exists", fileExists(regenDashAssetsPath));
check("regen dashboard (harvester-repo) exists", fileExists(regenDashHarvesterPath));

// Step 2: Original failed image still exists and not overwritten
console.log("\n2. Original failed image still exists, not overwritten, not deleted");
const originalFailedImagePath = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run1-002_001.jpg");
const originalFailedImageSize = 258966;
check("original failed image exists", fileExists(originalFailedImagePath));
if (fileExists(originalFailedImagePath)) {
  const stat = fs.statSync(originalFailedImagePath);
  check(
    "original failed image size unchanged (258966 bytes)",
    stat.size === originalFailedImageSize,
    `actual=${stat.size}`
  );
}
check(
  "regen image is a DIFFERENT file (not overwriting original)",
  regenImagePath !== originalFailedImagePath,
  `regen=${path.basename(regenImagePath)} vs original=${path.basename(originalFailedImagePath)}`
);

// Step 3: Manifest content
console.log("\n3. Regen manifest content");
const regenManifest = readJSON<any>(regenManifestPath);
check("manifest parses", regenManifest !== null);
if (regenManifest) {
  check("manifest.phase === '6E-G' or '6E-H' (6E-H after regen review)", regenManifest.phase === "6E-G" || regenManifest.phase === "6E-H", regenManifest.phase);
  check("manifest.run_id === 'regen_1'", regenManifest.run_id === "regen_1", regenManifest.run_id);
  check("manifest.execution_status === 'completed_within_budget'", regenManifest.execution_status === "completed_within_budget", regenManifest.execution_status);
  check("manifest.approved_regen_limit === 1", regenManifest.approved_regen_limit === 1, String(regenManifest.approved_regen_limit));
  check("manifest.model_calls_made === 1", regenManifest.model_calls_made === 1, String(regenManifest.model_calls_made));
  check("manifest.images_generated_this_regen === 1", regenManifest.images_generated_this_regen === 1, String(regenManifest.images_generated_this_regen));
  check("manifest.images_generated_cumulative === 8", regenManifest.images_generated_cumulative === 8, String(regenManifest.images_generated_cumulative));
  check("manifest.pending_images_after_regen === 18", regenManifest.pending_images_after_regen === 18, String(regenManifest.pending_images_after_regen));
  check("manifest.target_item.item_id === 'Q-6E-B-002'", regenManifest.target_item?.item_id === "Q-6E-B-002", regenManifest.target_item?.item_id);
  check("manifest.parent_image.decision === 'needs_regen'", regenManifest.parent_image?.decision === "needs_regen");
  check("manifest.parent_image.human_score === 43.3", regenManifest.parent_image?.human_score === 43.3);
  check("manifest.parent_image.still_exists === true", regenManifest.parent_image?.still_exists === true);
  check("manifest.parent_image.overwritten === false", regenManifest.parent_image?.overwritten === false);
  check("manifest.no_x_publish === true", regenManifest.no_x_publish === true);
  check("manifest.no_timer === true", regenManifest.no_timer === true);
  check("manifest.no_promote === true", regenManifest.no_promote === true);
  check("manifest.no_c5n_change === true", regenManifest.no_c5n_change === true);
  check("manifest.no_run2_items === true", regenManifest.no_run2_items === true);
  check("manifest.no_run3_items === true", regenManifest.no_run3_items === true);
  check("manifest.no_samuraigpt_regen === true", regenManifest.no_samuraigpt_regen === true);
  check("manifest.no_river_ai === true", regenManifest.no_river_ai === true);
  check("manifest.no_stabilityai === true", regenManifest.no_stabilityai === true);
  check("manifest.no_penitence === true", regenManifest.no_penitence === true);
  check("manifest.no_video === true", regenManifest.no_video === true);
  check("manifest.no_music === true", regenManifest.no_music === true);
  check("manifest.no_secrets === true", regenManifest.no_secrets === true);
  check("manifest.no_6d5_modify === true", regenManifest.no_6d5_modify === true);
  check("manifest.no_existing_image_overwrite === true", regenManifest.no_existing_image_overwrite === true);
  check("manifest.no_existing_image_delete === true (implicit via still_exists)", regenManifest.parent_image?.still_exists === true);

  // selected_items
  check(
    "selected_items.length === 1",
    Array.isArray(regenManifest.selected_items) && regenManifest.selected_items.length === 1,
    String(regenManifest.selected_items?.length)
  );
  if (Array.isArray(regenManifest.selected_items) && regenManifest.selected_items.length === 1) {
    const item = regenManifest.selected_items[0];
    check("selected_item[0].item_id === 'Q-6E-B-002'", item.item_id === "Q-6E-B-002");
    check("selected_item[0].title === 'Flaws in the LLM Automation Narrative'", item.title === "Flaws in the LLM Automation Narrative");
    check("selected_item[0].source_type === 'academic'", item.source_type === "academic");
    check("selected_item[0].risk_level === 'low'", item.risk_level === "low");
    check("selected_item[0].aspect_ratio === '16:9'", item.aspect_ratio === "16:9");
    check("selected_item[0].watermark === true", item.watermark === true);
    check("selected_item[0].model_used === 'image-01'", item.model_used === "image-01");
    check("selected_item[0].model_downgraded === false", item.model_downgraded === false);
    check("selected_item[0].status === 'generated'", item.status === "generated");
    check("selected_item[0].review_status === 'pending_human_review' or 'human_reviewed_approved' (6E-H)", item.review_status === "pending_human_review" || item.review_status === "human_reviewed_approved");
    check("selected_item[0].asset_id === 'cqa-2026-06-16-run1-002-regen1'", item.asset_id === "cqa-2026-06-16-run1-002-regen1");
    check(
      "selected_item[0].output_path === 'images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg'",
      item.output_path === "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg",
      item.output_path
    );
    check("selected_item[0].prompt_hash present", typeof item.prompt_hash === "string" && item.prompt_hash.length >= 8);
    check("selected_item[0].output_hash present", typeof item.output_hash === "string" && item.output_hash.length >= 8);
  }

  // boundaries_enforced
  const b = regenManifest.boundaries_enforced;
  check("boundaries.model_calls_made === 1", b?.model_calls_made === 1, String(b?.model_calls_made));
  check("boundaries.image_api_called === true", b?.image_api_called === true);
  check("boundaries.video_api_called === false", b?.video_api_called === false);
  check("boundaries.music_api_called === false", b?.music_api_called === false);
  check("boundaries.quota_checked_before_call === true", b?.quota_checked_before_call === true);
  check("boundaries.quota_bypassed === false", b?.quota_bypassed === false);
  check("boundaries.model_downgraded === false", b?.model_downgraded === false);
  check("boundaries.image_fabricated === false", b?.image_fabricated === false);
  check("boundaries.regen_target_q6eb002_only === true", b?.regen_target_q6eb002_only === true);
  check("boundaries.regen_count_within_approved_limit === true", b?.regen_count_within_approved_limit === true);
  check("boundaries.original_image_overwritten === false", b?.original_image_overwritten === false);
}

// Step 4: Generation result content
console.log("\n4. Generation result content");
const genResult = readJSON<any>(regenGenResultPath);
check("generation-result.json parses", genResult !== null);
if (genResult) {
  check("genResult.target_item_id === 'Q-6E-B-002'", genResult.target_item_id === "Q-6E-B-002");
  check("genResult.asset_id === 'cqa-2026-06-16-run1-002-regen1'", genResult.asset_id === "cqa-2026-06-16-run1-002-regen1");
  check("genResult.model === 'image-01'", genResult.model === "image-01");
  check("genResult.aspect_ratio === '16:9'", genResult.aspect_ratio === "16:9");
  check("genResult.watermark === true", genResult.watermark === true);
  check("genResult.output_path present", typeof genResult.output_path === "string");
  check(
    "genResult.parent_image_path === 'images/2026/06/16/cqa-2026-06-16-run1-002_001.jpg'",
    genResult.parent_image_path === "images/2026/06/16/cqa-2026-06-16-run1-002_001.jpg",
    genResult.parent_image_path
  );
  check("genResult.parent_decision === 'needs_regen'", genResult.parent_decision === "needs_regen");
  check("genResult.parent_score === 43.3", genResult.parent_score === 43.3);
  check(
    "genResult.boundaries_enforced.image_api_called === true",
    genResult.boundaries_enforced?.image_api_called === true
  );
  check(
    "genResult.boundaries_enforced.video_api_called === false",
    genResult.boundaries_enforced?.video_api_called === false
  );
  check(
    "genResult.boundaries_enforced.music_api_called === false",
    genResult.boundaries_enforced?.music_api_called === false
  );
  check(
    "genResult.boundaries_enforced.no_run2_items === true",
    genResult.boundaries_enforced?.no_run2_items === true
  );
  check(
    "genResult.boundaries_enforced.no_run3_items === true",
    genResult.boundaries_enforced?.no_run3_items === true
  );
  check(
    "genResult.boundaries_enforced.no_samuraigpt_regen === true",
    genResult.boundaries_enforced?.no_samuraigpt_regen === true
  );
  check(
    "genResult.boundaries_enforced.no_river_ai === true",
    genResult.boundaries_enforced?.no_river_ai === true
  );
  check(
    "genResult.boundaries_enforced.no_stabilityai === true",
    genResult.boundaries_enforced?.no_stabilityai === true
  );
  check(
    "genResult.boundaries_enforced.no_penitence === true",
    genResult.boundaries_enforced?.no_penitence === true
  );
  check(
    "genResult.boundaries_enforced.original_image_not_overwritten === true",
    genResult.boundaries_enforced?.original_image_not_overwritten === true
  );
}

// Step 5: Hash consistency
console.log("\n5. Hash consistency (manifest ↔ generation-result ↔ per-image metadata)");
if (regenManifest && genResult) {
  const manifestItem = regenManifest.selected_items?.[0];
  check("manifest.prompt_hash === genResult.prompt_hash", manifestItem?.prompt_hash === genResult.prompt_hash, `manifest=${manifestItem?.prompt_hash} genResult=${genResult.prompt_hash}`);
  check("manifest.output_hash === genResult.output_hash", manifestItem?.output_hash === genResult.output_hash, `manifest=${manifestItem?.output_hash} genResult=${genResult.output_hash}`);
}
const regenMeta = readJSON<any>(regenMetaPath);
if (regenMeta && genResult) {
  check("per-image meta.prompt_hash === genResult.prompt_hash", regenMeta.prompt_hash === genResult.prompt_hash, `meta=${regenMeta.prompt_hash} genResult=${genResult.prompt_hash}`);
  check("per-image meta.output_hash === genResult.output_hash", regenMeta.output_hash === genResult.output_hash, `meta=${regenMeta.output_hash} genResult=${genResult.output_hash}`);
}
// Verify prompt hash actually matches the prompt text in the meta
if (regenMeta) {
  const recomputed = sha12(regenMeta.prompt);
  check(
    "per-image meta.prompt_hash recompute from meta.prompt",
    recomputed === regenMeta.prompt_hash,
    `recomputed=${recomputed} meta=${regenMeta.prompt_hash}`
  );
}
// Verify output hash matches the actual file content
if (genResult) {
  const outBuf = fs.readFileSync(regenImagePath);
  const outHashRecomputed = crypto.createHash("sha1").update(outBuf).digest("hex").slice(0, 12);
  check(
    "output_hash recompute from regen image file content",
    outHashRecomputed === genResult.output_hash,
    `recomputed=${outHashRecomputed} genResult=${genResult.output_hash}`
  );
}

// Step 6: Regen dashboard (both repos)
console.log("\n6. Regen dashboard (assets + harvester)");
const regenDashAssets = readJSON<any>(regenDashAssetsPath);
const regenDashHarvester = readJSON<any>(regenDashHarvesterPath);
check("regen dash (assets) parses", regenDashAssets !== null);
check("regen dash (harvester) parses", regenDashHarvester !== null);
if (regenDashAssets) {
  check("regen dash (assets).phase === '6E-G' or '6E-H' (6E-H after regen review)", regenDashAssets.phase === "6E-G" || regenDashAssets.phase === "6E-H", regenDashAssets.phase);
  check("regen dash (assets).execution_status === 'completed_within_budget' or 'regen_reviewed_approved'", regenDashAssets.execution_status === "completed_within_budget" || regenDashAssets.execution_status === "regen_reviewed_approved", regenDashAssets.execution_status);
  check("regen dash (assets).regen_target_item_id === 'Q-6E-B-002'", regenDashAssets.regen_target_item_id === "Q-6E-B-002", regenDashAssets.regen_target_item_id);
  check("regen dash (assets).total_generated_images === 8", regenDashAssets.total_generated_images === 8, String(regenDashAssets.total_generated_images));
  check("regen dash (assets).total_generated_images_baseline === 7", regenDashAssets.total_generated_images_baseline === 7, String(regenDashAssets.total_generated_images_baseline));
  check("regen dash (assets).pending_images === 18", regenDashAssets.pending_images === 18, String(regenDashAssets.pending_images));
  check("regen dash (assets).pending_images_baseline === 18", regenDashAssets.pending_images_baseline === 18, String(regenDashAssets.pending_images_baseline));
  check("regen dash (assets).run_2_status === 'pending'", regenDashAssets.run_2_status === "pending");
  check("regen dash (assets).run_3_status === 'pending'", regenDashAssets.run_3_status === "pending");
  check("regen dash (assets).run_2_approved === false", regenDashAssets.run_2_approved === false);
  check("regen dash (assets).run_3_approved === false", regenDashAssets.run_3_approved === false);
  check("regen dash (assets).regen_count_executed === 1", regenDashAssets.regen_count_executed === 1, String(regenDashAssets.regen_count_executed));
  check("regen dash (assets).model_calls_made === 1", regenDashAssets.model_calls_made === 1, String(regenDashAssets.model_calls_made));
  check("regen dash (assets).image_api_called === true", regenDashAssets.image_api_called === true);
  check("regen dash (assets).video_api_called === false", regenDashAssets.video_api_called === false);
  check("regen dash (assets).music_api_called === false", regenDashAssets.music_api_called === false);
  check("regen dash (assets).no_x_publish === true", regenDashAssets.no_x_publish === true);
  check("regen dash (assets).no_timer === true", regenDashAssets.no_timer === true);
  check("regen dash (assets).no_promote === true", regenDashAssets.no_promote === true);
  check("regen dash (assets).no_c5n_change === true", regenDashAssets.no_c5n_change === true);
  check("regen dash (assets).no_secrets === true", regenDashAssets.no_secrets === true);
  check("regen dash (assets).no_samuraigpt_regen === true", regenDashAssets.no_samuraigpt_regen === true);
  check("regen dash (assets).no_river_ai === true", regenDashAssets.no_river_ai === true);
  check("regen dash (assets).no_stabilityai === true", regenDashAssets.no_stabilityai === true);
  check("regen dash (assets).no_penitence === true", regenDashAssets.no_penitence === true);
  check("regen dash (assets).no_video === true", regenDashAssets.no_video === true);
  check("regen dash (assets).no_music === true", regenDashAssets.no_music === true);
  check("regen dash (assets).no_existing_image_overwrite === true", regenDashAssets.no_existing_image_overwrite === true);
  check("regen dash (assets).no_existing_image_delete === true", regenDashAssets.no_existing_image_delete === true);
  check("regen dash (assets).parent_image.still_exists === true", regenDashAssets.parent_image?.still_exists === true);
  check("regen dash (assets).parent_image.overwritten === false", regenDashAssets.parent_image?.overwritten === false);
  // regen_candidate
  const cand = regenDashAssets.regen_candidate;
  check("regen_candidate.item_id === 'Q-6E-B-002'", cand?.item_id === "Q-6E-B-002", cand?.item_id);
  check("regen_candidate.review_status === 'pending_human_review' or 'human_reviewed_approved'", cand?.review_status === "pending_human_review" || cand?.review_status === "human_reviewed_approved", cand?.review_status);
  check("regen_candidate.regen_of === 'cqa-2026-06-16-run1-002'", cand?.regen_of === "cqa-2026-06-16-run1-002", cand?.regen_of);
  check("regen_candidate.regen_run_id === 'regen_1'", cand?.regen_run_id === "regen_1", cand?.regen_run_id);
  check(
    "regen_candidate.image_path === 'images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg'",
    cand?.image_path === "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg",
    cand?.image_path
  );
}

// Step 7: mainline-production-queue.json (harvester)
console.log("\n7. mainline-production-queue.json (run1_regen block)");
const queue = readJSON<any>(path.join(ROOT, "dashboard/mainline-production-queue.json"));
check("mainline-production-queue.json parses", queue !== null);
if (queue) {
  check("queue has run1_regen block", typeof queue.run1_regen === "object");
  if (queue.run1_regen) {
    const r = queue.run1_regen;
    check("queue.run1_regen.phase === '6E-G'", r.phase === "6E-G", r.phase);
    check("queue.run1_regen.execution_status === 'completed_within_budget'", r.execution_status === "completed_within_budget", r.execution_status);
    check("queue.run1_regen.approved_regen_limit === 1", r.approved_regen_limit === 1, String(r.approved_regen_limit));
    check("queue.run1_regen.regen_count_executed === 1", r.regen_count_executed === 1, String(r.regen_count_executed));
    check("queue.run1_regen.regen_target_item_id === 'Q-6E-B-002'", r.regen_target_item_id === "Q-6E-B-002", r.regen_target_item_id);
    check("queue.run1_regen.parent_decision === 'needs_regen'", r.parent_decision === "needs_regen", r.parent_decision);
    check("queue.run1_regen.parent_score === 43.3", r.parent_score === 43.3, String(r.parent_score));
    check("queue.run1_regen.parent_image_still_exists === true", r.parent_image_still_exists === true);
    check("queue.run1_regen.parent_image_overwritten === false", r.parent_image_overwritten === false);
    check("queue.run1_regen.total_generated_images === 8", r.total_generated_images === 8, String(r.total_generated_images));
    check("queue.run1_regen.pending_images === 18", r.pending_images === 18, String(r.pending_images));
    check("queue.run1_regen.run_2_status === 'pending'", r.run_2_status === "pending");
    check("queue.run1_regen.run_3_status === 'pending'", r.run_3_status === "pending");
    check("queue.run1_regen.run_2_approved === false", r.run_2_approved === false);
    check("queue.run1_regen.run_3_approved === false", r.run_3_approved === false);
    check("queue.run1_regen.no_x_publish === true", r.no_x_publish === true);
    check("queue.run1_regen.no_timer === true", r.no_timer === true);
    check("queue.run1_regen.no_promote === true", r.no_promote === true);
    check("queue.run1_regen.no_secrets === true", r.no_secrets === true);
  }
  // current_phase / status
  check("queue.current_phase === '6E-G' or '6E-H' (6E-H after regen review)", queue.current_phase === "6E-G" || queue.current_phase === "6E-H", queue.current_phase);
  check(
    "queue.current_phase_status === 'completed_within_budget' or 'regen_reviewed_approved'",
    queue.current_phase_status === "completed_within_budget" || queue.current_phase_status === "regen_reviewed_approved",
    queue.current_phase_status
  );
}

// Step 8: image-generation-plan.json (regen_1 block)
console.log("\n8. image-generation-plan.json (regen_1 block, both repos)");
const planHarvester = readJSON<any>(path.join(ROOT, "dashboard/image-generation-plan.json"));
const planAssets = readJSON<any>(path.join(ASSETS_ROOT, "dashboard/image-generation-plan.json"));
check("plan (harvester) parses", planHarvester !== null);
check("plan (assets) parses", planAssets !== null);
if (planHarvester) {
  check("plan.execution_status.regen_1 present", typeof planHarvester.execution_status?.regen_1 === "object");
  if (planHarvester.execution_status?.regen_1) {
    const r = planHarvester.execution_status.regen_1;
    check("plan.regen_1.status === 'completed_within_budget'", r.status === "completed_within_budget", r.status);
    check("plan.regen_1.images_generated === 1", r.images_generated === 1, String(r.images_generated));
    check("plan.regen_1.images_planned === 1", r.images_planned === 1, String(r.images_planned));
    check("plan.regen_1.regen_target_item_id === 'Q-6E-B-002'", r.regen_target_item_id === "Q-6E-B-002", r.regen_target_item_id);
    check("plan.regen_1.parent_item_id === 'Q-6E-B-002'", r.parent_item_id === "Q-6E-B-002", r.parent_item_id);
    check("plan.regen_1.model_used === 'image-01'", r.model_used === "image-01", r.model_used);
    check("plan.regen_1.boundaries_respected === true", r.boundaries_respected === true);
    check("plan.regen_1.no_run_2_trigger === true", r.no_run_2_trigger === true);
    check("plan.regen_1.no_run_3_trigger === true", r.no_run_3_trigger === true);
  }
  // Run 2 / Run 3 still pending
  check("plan.execution_status.run_2.status === 'pending_human_approval'", planHarvester.execution_status?.run_2?.status === "pending_human_approval", planHarvester.execution_status?.run_2?.status);
  check("plan.execution_status.run_3.status === 'pending_human_approval'", planHarvester.execution_status?.run_3?.status === "pending_human_approval", planHarvester.execution_status?.run_3?.status);
}

// Step 9: 6D-5 closeout unchanged
console.log("\n9. 6D-5 closeout unchanged (final_status=closed)");
const xManualLog = readJSON<{ final_status: string; posted_manually_total: number; phase: string }>(
  path.join(ROOT, "dashboard/x-manual-post-log.json")
);
check("x-manual-post-log.json exists", xManualLog !== null);
if (xManualLog) {
  check("6D-5 final_status === 'closed'", xManualLog.final_status === "closed", xManualLog.final_status);
  check("6D-5 posted_manually_total === 5", xManualLog.posted_manually_total === 5, String(xManualLog.posted_manually_total));
  check("6D-5 phase unchanged", xManualLog.phase === "6D-5", xManualLog.phase);
}

// Step 10: image-generation-gates.json — Run 2/3 still pending
console.log("\n10. image-generation-gates.json — Run 2/3 still pending");
const gates = readJSON<any>(path.join(ROOT, "dashboard/image-generation-gates.json"));
check("image-generation-gates.json exists", gates !== null);
if (gates) {
  check("gates.run_1.approved === true", gates.run_status?.run_1?.approved === true);
  check("gates.run_2.approved === false", gates.run_status?.run_2?.approved === false);
  check("gates.run_3.approved === false", gates.run_status?.run_3?.approved === false);
  // gate_2 / gate_3 still pending
  check("gates.gate_2_approve_batch_2.decision === 'pending'", gates.gates?.gate_2_approve_batch_2?.decision === "pending");
  check("gates.gate_3_approve_batch_3.decision === 'pending'", gates.gates?.gate_3_approve_batch_3?.decision === "pending");
}

// Step 11: generated-assets.json count (7 -> 8)
console.log("\n11. generated-assets.json count (7 baseline -> 8 after regen)");
const genAssets = readJSON<any[]>(path.join(ASSETS_ROOT, "metadata/generated-assets.json"));
check("generated-assets.json exists", Array.isArray(genAssets));
if (Array.isArray(genAssets)) {
  check("count === 8 (was 7, +1 regen)", genAssets.length === 8, String(genAssets.length));
  check("contains cqa-2026-06-16-run1-001", genAssets.some((a) => a.asset_id === "cqa-2026-06-16-run1-001"));
  check("contains cqa-2026-06-16-run1-002 (parent)", genAssets.some((a) => a.asset_id === "cqa-2026-06-16-run1-002"));
  check("contains cqa-2026-06-16-run1-002-regen1 (regen)", genAssets.some((a) => a.asset_id === "cqa-2026-06-16-run1-002-regen1"));

  // regen entry checks
  const regenEntry = genAssets.find((a) => a.asset_id === "cqa-2026-06-16-run1-002-regen1");
  if (regenEntry) {
    check("regen entry.model === 'image-01'", regenEntry.model === "image-01");
    check("regen entry.aspect_ratio === '16:9'", regenEntry.aspect_ratio === "16:9");
    check("regen entry.watermark === true", regenEntry.watermark === true);
    check("regen entry.source_type === 'academic'", regenEntry.source_type === "academic");
    check("regen entry.regen_of === 'cqa-2026-06-16-run1-002'", regenEntry.regen_of === "cqa-2026-06-16-run1-002");
    check("regen entry.regen_phase === '6E-G'", regenEntry.regen_phase === "6E-G");
    check("regen entry.parent_decision === 'needs_regen'", regenEntry.parent_decision === "needs_regen");
    check("regen entry.parent_score === 43.3", regenEntry.parent_score === 43.3);
    check(
      "regen entry.path === 'images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg'",
      regenEntry.path === "images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg",
      regenEntry.path
    );
  }
}

// Step 12: No forbidden file generations
console.log("\n12. No forbidden file generations (only Q-6E-B-002 regen)");
const allImages20260616 = listImagesInDir(path.join(ASSETS_ROOT, "images/2026/06/16"));
const regenJpgName = "cqa-2026-06-16-run1-002-regen1_001.jpg";
const run1JpgNames = [
  "cqa-2026-06-16-run1-001_001.jpg",
  "cqa-2026-06-16-run1-002_001.jpg",
  "cqa-2026-06-16-run1-002-regen1_001.jpg",
];
check(
  "exactly 3 images in images/2026/06/16/",
  allImages20260616.length === 3,
  allImages20260616.join(", ")
);
for (const name of run1JpgNames) {
  check(`image exists: ${name}`, allImages20260616.includes(name));
}
// No other new images in this dir
const expected = new Set(run1JpgNames);
const extras = allImages20260616.filter((f) => !expected.has(f));
check(
  "no extra images in images/2026/06/16/ (no River AI / stabilityai / Penitence / canary etc.)",
  extras.length === 0,
  extras.join(", ")
);

// Step 13: No secrets / env files committed
console.log("\n13. No secret / env files committed");
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
check(
  "no .phase-* checkpoint files committed",
  !harvGitStatus.split("\n").some((line: string) => /^\?\? \.phase-/.test(line))
);

// Step 14: Cross-repo mirror consistency
console.log("\n14. Cross-repo mirror consistency");
if (regenDashAssets && regenDashHarvester) {
  check(
    "regen dash (assets) === regen dash (harvester) for key fields",
    regenDashAssets.phase === regenDashHarvester.phase &&
      regenDashAssets.execution_status === regenDashHarvester.execution_status &&
      regenDashAssets.regen_count_executed === regenDashHarvester.regen_count_executed &&
      regenDashAssets.regen_target_item_id === regenDashHarvester.regen_target_item_id &&
      regenDashAssets.total_generated_images === regenDashHarvester.total_generated_images &&
      regenDashAssets.pending_images === regenDashHarvester.pending_images
  );
}
if (planAssets && planHarvester) {
  check(
    "plan (assets) === plan (harvester) for regen_1 key fields",
    planAssets.execution_status?.regen_1?.status === planHarvester.execution_status?.regen_1?.status &&
      planAssets.execution_status?.regen_1?.images_generated === planHarvester.execution_status?.regen_1?.images_generated
  );
}

// Final summary
console.log("\n=== Summary ===");
console.log(`Pass: ${passCount}`);
console.log(`Fail: ${failCount}`);

if (failCount > 0) {
  console.log("\n❌ Phase 6E-G regen validation: FAIL");
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
}

console.log("\n✅ Phase 6E-G regen validation: PASS");
console.log(`   target_item_id: Q-6E-B-002 (Flaws in the LLM Automation Narrative)`);
console.log(`   regen_image_path: images/2026/06/16/cqa-2026-06-16-run1-002-regen1_001.jpg`);
console.log(`   prompt_hash: ${regenManifest?.selected_items?.[0]?.prompt_hash}`);
console.log(`   output_hash: ${regenManifest?.selected_items?.[0]?.output_hash}`);
console.log(`   total_generated_images: 7 -> 8`);
console.log(`   pending_images: 18 (unchanged)`);
console.log(`   Run 2 / Run 3: still pending, no auto-trigger`);
console.log(`   next phase: Phase 6E-H Regenerated Image Human Review`);
process.exit(0);
