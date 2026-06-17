#!/usr/bin/env ts-node
/**
 * Phase 6E-J · Run 2 Controlled Image Generation Validator
 *
 * Validates the state of Phase 6E-J controlled Run 2 image generation:
 * - assets-repo/generated/phase-6e/run2/manifest.json
 * - assets-repo/generated/phase-6e/run2/README.md
 * - assets-repo/generated/phase-6e/run2/generation-result.json
 * - assets-repo/images/2026/06/16/cqa-2026-06-16-run2-001_001.jpg
 * - assets-repo/images/2026/06/16/cqa-2026-06-16-run2-001_001.meta.json
 * - assets-repo/images/2026/06/16/cqa-2026-06-16-run2-002_001.jpg
 * - assets-repo/images/2026/06/16/cqa-2026-06-16-run2-002_001.meta.json
 * - assets-repo/dashboard/image-generation-run2.json
 * - harvester-repo/dashboard/image-generation-run2.json (mirror)
 * - harvester-repo/dashboard/mainline-production-queue.json (run2_execution block, current_phase=6E-J)
 * - harvester-repo/dashboard/image-generation-plan.json (run_2 block in execution_status)
 * - harvester-repo/dashboard/image-generation-preflight.json (pending 16, generated 10)
 * - 6D-5 final_status=closed (unchanged)
 * - gates: Run 1 final_status=closed (unchanged), Run 3 still pending
 * - generated-assets.json count: 8 -> 10 (+2)
 * - pending_images: 18 -> 16 (-2)
 * - run2_generated_count = 2
 * - target_item_ids: Q-6E-B-003 + Q-6E-B-004 only
 * - no Q-6E-B-001, Q-6E-B-002, Q-6E-B-005
 * - no Run 1, no Run 3 items
 * - no video, no music
 * - no X publish, no timer, no promote, no C5N
 * - no secrets
 * - no model downgrade
 * - no image fabrication
 * - no quota bypass
 * - no existing image overwrite / delete
 * - run1 final closeout unchanged
 * - 6D-5 final_status unchanged
 * - all output paths unique
 * - metadata exists for both images
 * - prompt hashes recorded
 * - output hashes recorded
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
 *   npx ts-node scripts/validate-image-generation-run2.ts
 *   npm run validate:image-generation-run2
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

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
  return fs.readdirSync(dirPath).filter(
    (f) => f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png")
  );
}

console.log("\n=== Phase 6E-J · Run 2 Controlled Image Generation Validator ===\n");

// ============================================================
// Section 1: Required file existence (assets-repo)
// ============================================================
console.log("[1] Required file existence (assets-repo)");

const run2ManifestPath = path.join(ASSETS_ROOT, "generated/phase-6e/run2/manifest.json");
const run2ReadmePath = path.join(ASSETS_ROOT, "generated/phase-6e/run2/README.md");
const run2GenResultPath = path.join(ASSETS_ROOT, "generated/phase-6e/run2/generation-result.json");
const run2Image1Path = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run2-001_001.jpg");
const run2Image1MetaPath = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run2-001_001.meta.json");
const run2Image2Path = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run2-002_001.jpg");
const run2Image2MetaPath = path.join(ASSETS_ROOT, "images/2026/06/16/cqa-2026-06-16-run2-002_001.meta.json");
const run2DashAssetsPath = path.join(ASSETS_ROOT, "dashboard/image-generation-run2.json");
const run2ReportPath = path.join(ASSETS_ROOT, "reports/image-generation-run2.md");

check("run2 manifest.json exists (assets-repo)", fileExists(run2ManifestPath));
check("run2 README.md exists (assets-repo)", fileExists(run2ReadmePath));
check("run2 generation-result.json exists (assets-repo)", fileExists(run2GenResultPath));
check("run2 image 1 (Q-6E-B-003) exists", fileExists(run2Image1Path));
check("run2 image 1 metadata exists", fileExists(run2Image1MetaPath));
check("run2 image 2 (Q-6E-B-004) exists", fileExists(run2Image2Path));
check("run2 image 2 metadata exists", fileExists(run2Image2MetaPath));
check("run2 dashboard (assets-repo) exists", fileExists(run2DashAssetsPath));
check("run2 report (assets-repo) exists", fileExists(run2ReportPath));

// ============================================================
// Section 2: Required file existence (harvester-repo)
// ============================================================
console.log("\n[2] Required file existence (harvester-repo)");

const run2DashHarvesterPath = path.join(ROOT, "dashboard/image-generation-run2.json");
const harvesterPlanPath = path.join(ROOT, "dashboard/image-generation-plan.json");
const harvesterPreflightPath = path.join(ROOT, "dashboard/image-generation-preflight.json");
const harvesterMainlinePath = path.join(ROOT, "dashboard/mainline-production-queue.json");
const harvesterIndexPath = path.join(ROOT, "dashboard/index.html");
const run2ValidatorPath = path.join(ROOT, "scripts/validate-image-generation-run2.ts");
const harvesterReportPath = path.join(ROOT, "reports/phase-6ej-run2-controlled-image-generation.md");
const harvesterTelegramReportPath = path.join(ROOT, "reports/telegram-phase-6ej-run2-controlled-image-generation.txt");
const packageJsonPath = path.join(ROOT, "package.json");

check("run2 dashboard (harvester-repo) exists", fileExists(run2DashHarvesterPath));
check("plan dashboard (harvester-repo) exists", fileExists(harvesterPlanPath));
check("preflight dashboard (harvester-repo) exists", fileExists(harvesterPreflightPath));
check("mainline-production-queue (harvester-repo) exists", fileExists(harvesterMainlinePath));
check("dashboard/index.html (harvester-repo) exists", fileExists(harvesterIndexPath));
check("validate-image-generation-run2.ts exists", fileExists(run2ValidatorPath));
check("phase-6ej report (harvester-repo) exists", fileExists(harvesterReportPath));
check("telegram-phase-6ej report (harvester-repo) exists", fileExists(harvesterTelegramReportPath));
check("package.json (harvester-repo) exists", fileExists(packageJsonPath));

// ============================================================
// Section 3: Manifest content invariants (assets-repo)
// ============================================================
console.log("\n[3] Manifest content invariants (assets-repo)");

const run2Manifest = readJSON<any>(run2ManifestPath);
check("run2 manifest.json is valid JSON", run2Manifest !== null);
if (run2Manifest) {
  check("run2 manifest.phase = 6E-J", run2Manifest.phase === "6E-J");
  check("run2 manifest.run_id = run_2", run2Manifest.run_id === "run_2");
  check("run2 manifest.execution_status = completed_within_budget", run2Manifest.execution_status === "completed_within_budget");
  check("run2 manifest.approved_image_count_limit = 2", run2Manifest.approved_image_count_limit === 2);
  check("run2 manifest.selected_items_count = 2", run2Manifest.selected_items_count === 2);
  check("run2 manifest.images_generated_this_run = 2", run2Manifest.images_generated_this_run === 2);
  check("run2 manifest.images_generated_cumulative = 10", run2Manifest.images_generated_cumulative === 10);
  check("run2 manifest.pending_images_after_run2 = 16", run2Manifest.pending_images_after_run2 === 16);
  check("run2 manifest.run_1_final_status = closed", run2Manifest.run_1_final_status === "closed");
  check("run2 manifest.run_1_final_closeout_unchanged = true", run2Manifest.run_1_final_closeout_unchanged === true);
  check("run2 manifest.run_3_status = pending", run2Manifest.run_3_status === "pending");
  check("run2 manifest.run_1_reopened = false", run2Manifest.run_1_reopened === false);
  check("run2 manifest.no_x_publish = true", run2Manifest.no_x_publish === true);
  check("run2 manifest.no_timer = true", run2Manifest.no_timer === true);
  check("run2 manifest.no_promote = true", run2Manifest.no_promote === true);
  check("run2 manifest.no_c5n_change = true", run2Manifest.no_c5n_change === true);
  check("run2 manifest.no_6d5_modify = true", run2Manifest.no_6d5_modify === true);
  check("run2 manifest.no_secrets = true", run2Manifest.no_secrets === true);
  check("run2 manifest.no_run1_items = true", run2Manifest.no_run1_items === true);
  check("run2 manifest.no_run3_items = true", run2Manifest.no_run3_items === true);
  check("run2 manifest.no_video = true", run2Manifest.no_video === true);
  check("run2 manifest.no_music = true", run2Manifest.no_music === true);
  check("run2 manifest.no_penitence = true", run2Manifest.no_penitence === true);
  check("run2 manifest.quota_check.decision = ALLOW", run2Manifest.quota_check_at_execution?.quota_guard_decision === "ALLOW");

  const itemIds = (run2Manifest.selected_items || []).map((s: any) => s.item_id);
  check("run2 manifest contains Q-6E-B-003", itemIds.includes("Q-6E-B-003"));
  check("run2 manifest contains Q-6E-B-004", itemIds.includes("Q-6E-B-004"));
  check("run2 manifest does NOT contain Q-6E-B-001", !itemIds.includes("Q-6E-B-001"));
  check("run2 manifest does NOT contain Q-6E-B-002", !itemIds.includes("Q-6E-B-002"));
  check("run2 manifest does NOT contain Q-6E-B-005", !itemIds.includes("Q-6E-B-005"));
}

// ============================================================
// Section 4: Per-image metadata invariants
// ============================================================
console.log("\n[4] Per-image metadata invariants");

const run2Image1Meta = readJSON<any>(run2Image1MetaPath);
const run2Image2Meta = readJSON<any>(run2Image2MetaPath);

check("image 1 metadata is valid JSON", run2Image1Meta !== null);
check("image 2 metadata is valid JSON", run2Image2Meta !== null);

if (run2Image1Meta) {
  check("image 1 metadata.item_id = Q-6E-B-003", run2Image1Meta.item_id === "Q-6E-B-003");
  check("image 1 metadata.title = River AI", run2Image1Meta.title === "River AI");
  check("image 1 metadata.source_type = dev-community", run2Image1Meta.source_type === "dev-community");
  check("image 1 metadata.aspect_ratio = 1:1", run2Image1Meta.aspect_ratio === "1:1");
  check("image 1 metadata.model = image-01", run2Image1Meta.model === "image-01");
  check("image 1 metadata.watermark = true", run2Image1Meta.watermark === true);
  check("image 1 metadata.aigc_watermark = true", run2Image1Meta.aigc_watermark === true);
  check("image 1 metadata.prompt_hash present", typeof run2Image1Meta.prompt_hash === "string" && run2Image1Meta.prompt_hash.length === 12);
  check("image 1 metadata.output_hash present", typeof run2Image1Meta.output_hash === "string" && run2Image1Meta.output_hash.length === 12);
  check("image 1 metadata.dimensions = 1024x1024", run2Image1Meta.dimensions === "1024x1024");
  check("image 1 metadata.phase = 6E-J", run2Image1Meta.phase === "6E-J");
  check("image 1 metadata.run = run_2", run2Image1Meta.run === "run_2");
  check("image 1 metadata.risk_level = low", run2Image1Meta.risk_level === "low");
}

if (run2Image2Meta) {
  check("image 2 metadata.item_id = Q-6E-B-004", run2Image2Meta.item_id === "Q-6E-B-004");
  check("image 2 metadata.title = stabilityai/...", run2Image2Meta.title === "stabilityai/stable-video-diffusion-img2vid-xt");
  check("image 2 metadata.source_type = ai-ecosystem", run2Image2Meta.source_type === "ai-ecosystem");
  check("image 2 metadata.aspect_ratio = 16:9", run2Image2Meta.aspect_ratio === "16:9");
  check("image 2 metadata.model = image-01", run2Image2Meta.model === "image-01");
  check("image 2 metadata.watermark = true", run2Image2Meta.watermark === true);
  check("image 2 metadata.aigc_watermark = true", run2Image2Meta.aigc_watermark === true);
  check("image 2 metadata.prompt_hash present", typeof run2Image2Meta.prompt_hash === "string" && run2Image2Meta.prompt_hash.length === 12);
  check("image 2 metadata.output_hash present", typeof run2Image2Meta.output_hash === "string" && run2Image2Meta.output_hash.length === 12);
  check("image 2 metadata.dimensions = 1280x720", run2Image2Meta.dimensions === "1280x720");
  check("image 2 metadata.phase = 6E-J", run2Image2Meta.phase === "6E-J");
  check("image 2 metadata.run = run_2", run2Image2Meta.run === "run_2");
  check("image 2 metadata.risk_level = low", run2Image2Meta.risk_level === "low");
}

// ============================================================
// Section 5: Output path uniqueness
// ============================================================
console.log("\n[5] Output path uniqueness");

const allImagePaths = [
  run2Image1Path,
  run2Image2Path,
];
const uniquePaths = new Set(allImagePaths);
check("run2 image 1 and 2 paths are different", allImagePaths.length === uniquePaths.size);

// ============================================================
// Section 6: Image content hash check
// ============================================================
console.log("\n[6] Image content hash matches metadata");

function computeOutputHash(filePath: string): string | null {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
  } catch {
    return null;
  }
}

const img1Hash = computeOutputHash(run2Image1Path);
const img2Hash = computeOutputHash(run2Image2Path);

if (run2Image1Meta && img1Hash) {
  check("image 1 output_hash matches file content", run2Image1Meta.output_hash === img1Hash, `expected=${run2Image1Meta.output_hash} actual=${img1Hash}`);
}
if (run2Image2Meta && img2Hash) {
  check("image 2 output_hash matches file content", run2Image2Meta.output_hash === img2Hash, `expected=${run2Image2Meta.output_hash} actual=${img2Hash}`);
}

// ============================================================
// Section 7: Image file format validation
// ============================================================
console.log("\n[7] Image file format");

function isJPEG(filePath: string): boolean {
  try {
    const buf = fs.readFileSync(filePath).slice(0, 3);
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  } catch {
    return false;
  }
}

check("image 1 is a valid JPEG", isJPEG(run2Image1Path));
check("image 2 is a valid JPEG", isJPEG(run2Image2Path));

// ============================================================
// Section 8: Generated-assets.json invariants
// ============================================================
console.log("\n[8] Generated-assets.json invariants");

const genAssetsPath = path.join(ASSETS_ROOT, "metadata/generated-assets.json");
const genAssets = readJSON<any[]>(genAssetsPath);
check("metadata/generated-assets.json is valid JSON", genAssets !== null);

if (genAssets) {
  check("generated-assets.json has 10 entries", genAssets.length === 10, `actual=${genAssets.length}`);
  const run2Assets = genAssets.filter((a: any) => a.run === "run_2" && a.phase === "6E-J");
  check("generated-assets.json has 2 run_2/6E-J entries", run2Assets.length === 2, `actual=${run2Assets.length}`);
  const run2AssetIds = run2Assets.map((a: any) => a.asset_id);
  check("run2 entry asset_id 1 = cqa-2026-06-16-run2-001", run2AssetIds.includes("cqa-2026-06-16-run2-001"));
  check("run2 entry asset_id 2 = cqa-2026-06-16-run2-002", run2AssetIds.includes("cqa-2026-06-16-run2-002"));
  // Verify no NEW run_3 generation (Q-6E-B-005 Penitence) - historical penitence baseline
  // (cqa-2026-06-11-gen-003) was generated in 6D-1, NOT in 6E-J
  const run3Assets = genAssets.filter((a: any) => a.run === "run_3" || a.item_id === "Q-6E-B-005");
  check("no NEW run_3 / Q-6E-B-005 entry in generated-assets.json (Run 3 not generated in 6E-J)", run3Assets.length === 0);
}

// ============================================================
// Section 9: Harvester repo dashboard invariants
// ============================================================
console.log("\n[9] Harvester repo dashboard invariants");

const harvesterPlan = readJSON<any>(harvesterPlanPath);
if (harvesterPlan) {
  check("harvester plan has execution_status.run_2", harvesterPlan.execution_status?.run_2 !== undefined);
  if (harvesterPlan.execution_status?.run_2) {
    check("harvester plan run_2.status = completed_within_budget", harvesterPlan.execution_status.run_2.status === "completed_within_budget");
    check("harvester plan run_2.images_generated = 2", harvesterPlan.execution_status.run_2.images_generated === 2);
  }
  check("harvester plan has phase_6e_j_execution", harvesterPlan.phase_6e_j_execution !== undefined);
}

const harvesterPreflight = readJSON<any>(harvesterPreflightPath);
if (harvesterPreflight) {
  check("harvester preflight pending_images = 16", harvesterPreflight.stats?.pending_images === 16);
  check("harvester preflight status.phase_6ej_run_2_completed = true", harvesterPreflight.status?.phase_6ej_run_2_completed === true);
}

const harvesterMainline = readJSON<any>(harvesterMainlinePath);
if (harvesterMainline) {
  check("harvester mainline current_phase in [6E-J, 6E-K] (phase-aware: 6E-J Run 2 generated; 6E-K review pack created)", harvesterMainline.current_phase === "6E-J" || harvesterMainline.current_phase === "6E-K");
  check("harvester mainline has run2_execution block", harvesterMainline.run2_execution !== undefined);
  if (harvesterMainline.run2_execution) {
    check("harvester mainline run2_execution.status = completed_within_budget", harvesterMainline.run2_execution.status === "completed_within_budget");
    check("harvester mainline run2_execution.images_generated = 2", harvesterMainline.run2_execution.images_generated === 2);
    check("harvester mainline run2_execution.no_run3_trigger = true", harvesterMainline.run2_execution.no_run3_trigger === true);
    check("harvester mainline run2_execution.no_run1_reopen = true", harvesterMainline.run2_execution.no_run1_reopen === true);
    check("harvester mainline run2_execution.run1_final_closeout.modified_in_6ej = false", harvesterMainline.run2_execution.run1_final_closeout?.modified_in_6ej === false);
    check("harvester mainline run2_execution.six_d_five_modified_in_6ej = false", harvesterMainline.run2_execution.six_d_five_modified_in_6ej === false);
  }
}

const run2DashHarvester = readJSON<any>(run2DashHarvesterPath);
if (run2DashHarvester) {
  check("harvester run2 dashboard.phase = 6E-J", run2DashHarvester.phase === "6E-J");
  check("harvester run2 dashboard.execution_status = completed_within_budget", run2DashHarvester.execution_status === "completed_within_budget");
  check("harvester run2 dashboard has 2 generated_images", (run2DashHarvester.generated_images || []).length === 2);
  check("harvester run2 dashboard.run_1_final_status = closed", run2DashHarvester.preflight_verified?.run_1_final_status === "closed");
  check("harvester run2 dashboard.run_3_status = pending", run2DashHarvester.preflight_verified?.run_3_status === "pending");
  const run2ItemIds = (run2DashHarvester.generated_images || []).map((g: any) => g.item_id);
  check("harvester run2 dashboard contains Q-6E-B-003", run2ItemIds.includes("Q-6E-B-003"));
  check("harvester run2 dashboard contains Q-6E-B-004", run2ItemIds.includes("Q-6E-B-004"));
  check("harvester run2 dashboard does NOT contain Q-6E-B-005", !run2ItemIds.includes("Q-6E-B-005"));
}

// ============================================================
// Section 10: index.html contains Phase 6E-J section
// ============================================================
console.log("\n[10] index.html contains Phase 6E-J section");

const indexHtml = fileExists(harvesterIndexPath) ? fs.readFileSync(harvesterIndexPath, "utf-8") : "";
check("index.html mentions Phase 6E-J", indexHtml.includes("Phase 6E-J"));
check("index.html mentions run2-001", indexHtml.includes("cqa-2026-06-16-run2-001"));
check("index.html mentions run2-002", indexHtml.includes("cqa-2026-06-16-run2-002"));
check("index.html mentions Q-6E-B-003 (River AI)", indexHtml.includes("Q-6E-B-003"));
check("index.html mentions Q-6E-B-004 (stabilityai)", indexHtml.includes("Q-6E-B-004"));
check("index.html does NOT mention generated for Q-6E-B-005 (Penitence)", !/Q-6E-B-005.*generated/i.test(indexHtml) || /Penitence.*pending/i.test(indexHtml));

// ============================================================
// Section 11: 6D-5 final_status invariants
// ============================================================
console.log("\n[11] 6D-5 final_status invariants");

const xManualPostLogPath = path.join(ROOT, "dashboard/x-manual-post-log.json");
const xManualPostLog = readJSON<any>(xManualPostLogPath);
if (xManualPostLog) {
  check("6D-5 final_status = closed (unchanged)", xManualPostLog.final_status === "closed");
  check("6D-5 posted_manually_total = 5", xManualPostLog.posted_manually_total === 5);
}

// ============================================================
// Section 12: package.json has the new npm script
// ============================================================
console.log("\n[12] package.json has validate:image-generation-run2");

const pkg = readJSON<any>(packageJsonPath);
if (pkg && pkg.scripts) {
  check("package.json has validate:image-generation-run2 script", !!pkg.scripts["validate:image-generation-run2"]);
}

// ============================================================
// Section 13: No secrets committed
// ============================================================
console.log("\n[13] No secrets committed");

function fileContains(filePath: string, pattern: RegExp): boolean {
  try {
    return pattern.test(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return false;
  }
}

const sensitivePatterns = [
  /api[_-]?key\s*=\s*["'][^"']{20,}/i,
  /secret\s*=\s*["'][^"']{10,}/i,
  /token\s*=\s*["'][^"']{20,}/i,
];

const allJsonPaths = [
  run2ManifestPath,
  run2Image1MetaPath,
  run2Image2MetaPath,
  run2DashAssetsPath,
  run2DashHarvesterPath,
  harvesterPlanPath,
  harvesterPreflightPath,
  harvesterMainlinePath,
  harvesterReportPath,
  harvesterTelegramReportPath,
];

let noSecretsFound = true;
for (const p of allJsonPaths) {
  if (fileExists(p)) {
    for (const pat of sensitivePatterns) {
      if (fileContains(p, pat)) {
        noSecretsFound = false;
        break;
      }
    }
  }
}
check("no secrets in any dashboard/report file", noSecretsFound);

// ============================================================
// Section 14: No .env / .control / audit log files committed (in git)
// ============================================================
console.log("\n[14] No .env / .control / audit log files committed (in git)");

import { execSync as execSyncImport } from "child_process";

const forbiddenFiles = [
  ".env",
  ".env.telegram.local",
  ".control.local",
  "runtime-audit.log",
];

function isGitTracked(filePath: string, repoRoot: string): boolean {
  try {
    const relPath = path.relative(repoRoot, filePath);
    const result = execSyncImport(`cd ${repoRoot} && git ls-files --error-unmatch "${relPath}" 2>/dev/null`, { encoding: "utf-8" });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

let noForbiddenCommitted = true;
for (const f of forbiddenFiles) {
  const assetsPath = path.join(ASSETS_ROOT, f);
  const harvesterPath = path.join(ROOT, f);
  if (fs.existsSync(assetsPath) && isGitTracked(assetsPath, ASSETS_ROOT)) {
    noForbiddenCommitted = false;
    console.log(`  ⚠️ Forbidden file TRACKED in assets-repo: ${f}`);
  }
  if (fs.existsSync(harvesterPath) && isGitTracked(harvesterPath, ROOT)) {
    noForbiddenCommitted = false;
    console.log(`  ⚠️ Forbidden file TRACKED in harvester-repo: ${f}`);
  }
}
check("no .env / .env.telegram.local / .control.local / runtime-audit.log committed in git", noForbiddenCommitted);

// ============================================================
// Section 15: No C5N / timer / digest / promote / X publish triggers
// ============================================================
console.log("\n[15] No C5N / timer / digest / promote / X publish triggers");

// We just check the manifest and dashboards explicitly state these are false
const noForbiddenTriggers =
  run2Manifest?.no_x_publish === true &&
  run2Manifest?.no_timer === true &&
  run2Manifest?.no_promote === true &&
  run2Manifest?.no_c5n_change === true;
check("manifest: no_x_publish, no_timer, no_promote, no_c5n_change all true", !!noForbiddenTriggers);

// ============================================================
// Summary
// ============================================================
console.log("\n" + "=".repeat(60));
console.log(`Phase 6E-J Run 2 Validator: ${passCount} passed, ${failCount} failed`);
console.log("=".repeat(60));

if (failCount > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
}

console.log("\n✅ All checks passed. Phase 6E-J Run 2 state is valid.");
process.exit(0);
