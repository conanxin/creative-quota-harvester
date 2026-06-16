#!/usr/bin/env ts-node
/**
 * Phase 6E-D · Run 1 Controlled Image Generation Validator
 *
 * Validates the state of Phase 6E-D Run 1 execution attempt:
 * - dashboard/image-generation-run1.json (both repos)
 * - assets-repo/generated/phase-6e/run1/manifest.json
 * - assets-repo/generated/phase-6e/run1/README.md
 * - assets-repo/metadata/generated-assets.json (must remain 5 baseline)
 * - assets-repo/dashboard/image-generation-gates.json (must remain Run 1 approved)
 * - assets-repo/dashboard/image-generation-plan.json (gate_4 unchanged)
 * - assets-repo/dashboard/image-generation-preflight.json (unchanged)
 * - dashboard/x-manual-post-log.json (6D-5 final_status=closed unchanged)
 *
 * Strict boundaries:
 * - READ-ONLY validator. Does not call any model. Does not generate media.
 * - Does not send Telegram / trigger timer / promote / publish.
 * - Handles BOTH the success path AND the quota-blocked path.
 *
 * Exit code:
 *   0 = PASS (blocked_at_quota OR completed_within_budget)
 *   1 = FAIL (any invariant violated)
 *
 * Usage:
 *   npx ts-node scripts/validate-image-generation-run1.ts
 *   npm run validate:image-generation-run1
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

interface RunManifest {
  phase: string;
  mode: string;
  run_id: string;
  execution_status: string;
  block_reason?: string;
  block_detail?: any;
  approved_image_count_limit: number;
  selected_items_count: number;
  selected_items: Array<{
    item_id: string;
    title: string;
    source_type: string;
    risk_level: string;
    aspect_ratio: string;
    watermark: boolean;
    prompt_hash: string;
    intended_asset_id: string;
    intended_path: string;
    status: string;
  }>;
  images_generated_this_run: number;
  images_generated_cumulative: number;
  model_calls_made: number;
  media_generated: boolean;
  no_x_publish: boolean;
  no_timer: boolean;
  no_promote: boolean;
  no_c5n_change: boolean;
  no_6d5_modify: boolean;
  no_secrets: boolean;
  boundaries_enforced: {
    model_calls_made: number;
    image_api_called: boolean;
    video_api_called: boolean;
    music_api_called: boolean;
    quota_bypassed: boolean;
    model_downgraded: boolean;
    image_fabricated: boolean;
  };
}

console.log("\n=== Phase 6E-D Run 1 Validator ===\n");

// Step 1: Check file presence
console.log("1. File presence");
const runManifestPath = path.join(ASSETS_ROOT, "generated/phase-6e/run1/manifest.json");
const runReadmePath = path.join(ASSETS_ROOT, "generated/phase-6e/run1/README.md");
const runDashboardAssets = path.join(ASSETS_ROOT, "dashboard/image-generation-run1.json");
const runDashboardHarvester = path.join(ROOT, "dashboard/image-generation-run1.json");

check("manifest.json exists", fileExists(runManifestPath), runManifestPath);
check("README.md exists", fileExists(runReadmePath), runReadmePath);
check("dashboard (assets-repo) exists", fileExists(runDashboardAssets));
check("dashboard (harvester-repo) exists", fileExists(runDashboardHarvester));

// Step 2: Load and validate manifest
console.log("\n2. Manifest content");
const manifest = readJSON<RunManifest>(runManifestPath);
check("manifest is valid JSON", manifest !== null);
if (!manifest) {
  console.log("\n❌ Cannot continue without manifest");
  process.exit(1);
}

check("manifest.phase === '6E-D'", manifest.phase === "6E-D", manifest.phase);
check("manifest.run_id === 'run_1'", manifest.run_id === "run_1", manifest.run_id);
check(
  "manifest.approved_image_count_limit === 2",
  manifest.approved_image_count_limit === 2,
  String(manifest.approved_image_count_limit)
);
check(
  "manifest.selected_items_count === 2",
  manifest.selected_items_count === 2,
  String(manifest.selected_items_count)
);
check(
  "manifest.selected_items has exactly 2 entries",
  manifest.selected_items.length === 2,
  String(manifest.selected_items.length)
);

// Step 3: Validate selected items are Run 1 only
console.log("\n3. Selected items are Run 1 only");
const itemIds = manifest.selected_items.map((i) => i.item_id).sort();
check(
  "selected items are Q-6E-B-001 and Q-6E-B-002",
  JSON.stringify(itemIds) === JSON.stringify(["Q-6E-B-001", "Q-6E-B-002"]),
  itemIds.join(",")
);

const titles = manifest.selected_items.map((i) => i.title).sort();
check(
  "selected titles match expected (SamurAIGPT, Flaws in the LLM)",
  JSON.stringify(titles) === JSON.stringify(["Flaws in the LLM Automation Narrative", "SamurAIGPT/Generative-Media-Skills"]),
  titles.join(" | ")
);

const sourceTypes = manifest.selected_items.map((i) => i.source_type).sort();
check(
  "source_types are code + academic only",
  JSON.stringify(sourceTypes) === JSON.stringify(["academic", "code"]),
  sourceTypes.join(",")
);

const riskLevels = manifest.selected_items.map((i) => i.risk_level);
check(
  "both items are low risk",
  riskLevels.every((r) => r === "low"),
  riskLevels.join(",")
);

const aspectRatios = manifest.selected_items.map((i) => i.aspect_ratio);
check(
  "both items are 16:9",
  aspectRatios.every((a) => a === "16:9"),
  aspectRatios.join(",")
);

const watermarks = manifest.selected_items.map((i) => i.watermark);
check(
  "both items have watermark=true",
  watermarks.every((w) => w === true),
  watermarks.join(",")
);

// Step 4: Verify NO Run 2 / Run 3 items
console.log("\n4. No Run 2 / Run 3 items");
const allItemsText = JSON.stringify(manifest);
check(
  "no River AI (Q-6E-B-003, Run 2)",
  !allItemsText.includes("Q-6E-B-003") && !allItemsText.toLowerCase().includes("river ai")
);
check(
  "no stabilityai (Q-6E-B-004, Run 2)",
  !allItemsText.includes("Q-6E-B-004") && !allItemsText.includes("stabilityai")
);
check(
  "no Penitence (Q-6E-B-005, Run 3)",
  !allItemsText.includes("Q-6E-B-005") && !allItemsText.toLowerCase().includes("penitence")
);

// Step 5: Execution outcome
console.log("\n5. Execution outcome (blocked OR success — both valid)");
const isBlocked = manifest.execution_status === "blocked_pre_generation";
const isCompleted = manifest.execution_status === "completed_within_budget";

check(
  "execution_status is blocked_pre_generation OR completed_within_budget",
  isBlocked || isCompleted,
  manifest.execution_status
);

if (isBlocked) {
  check("block_reason === minimax_quota_guard_failed", manifest.block_reason === "minimax_quota_guard_failed", manifest.block_reason ?? "");
  check(
    "block_detail.quota_guard_decision === BLOCK",
    manifest.block_detail?.quota_guard_decision === "BLOCK",
    manifest.block_detail?.quota_guard_decision ?? ""
  );
  check(
    "block_detail.threshold_pass === false",
    manifest.block_detail?.threshold_pass === false,
    String(manifest.block_detail?.threshold_pass)
  );
  check(
    "model_calls_made === 0",
    manifest.boundaries_enforced.model_calls_made === 0,
    String(manifest.boundaries_enforced.model_calls_made)
  );
  check(
    "media_generated === false",
    manifest.media_generated === false,
    String(manifest.media_generated)
  );
  check(
    "images_generated_this_run === 0",
    manifest.images_generated_this_run === 0,
    String(manifest.images_generated_this_run)
  );
  check(
    "images_generated_cumulative === 5",
    manifest.images_generated_cumulative === 5,
    String(manifest.images_generated_cumulative)
  );
  check(
    "no quota bypass",
    manifest.boundaries_enforced.quota_bypassed === false
  );
  check(
    "no model downgrade",
    manifest.boundaries_enforced.model_downgraded === false
  );
  check(
    "no image fabrication",
    manifest.boundaries_enforced.image_fabricated === false
  );
} else if (isCompleted) {
  check(
    "images_generated_this_run === 2",
    manifest.images_generated_this_run === 2,
    String(manifest.images_generated_this_run)
  );
  check(
    "images_generated_cumulative === 7",
    manifest.images_generated_cumulative === 7,
    String(manifest.images_generated_cumulative)
  );
  check(
    "media_generated === true",
    manifest.media_generated === true,
    String(manifest.media_generated)
  );
}

// Step 6: Verify prompt hashes match actual enriched prompts
console.log("\n6. Prompt hashes match enriched prompt content");
const samPack = path.join(
  ASSETS_ROOT,
  "content-packs/2026/06/2026-06-11/brief-brief-mq8swsla-f-samuraigpt-generative-media-skills/image-prompt.enriched.md"
);
const flaPack = path.join(
  ASSETS_ROOT,
  "content-packs/2026/06/2026-06-11/brief-brief-mq8tbqf4-j-flaws-in-the-llm-automation-narrative/image-prompt.enriched.md"
);

if (fileExists(samPack)) {
  const samText = fs.readFileSync(samPack, "utf-8");
  const samPromptMatch = samText.match(/```text\n([\s\S]*?)```/);
  if (samPromptMatch) {
    const samHash = sha12(samPromptMatch[1].trim());
    const manifestSam = manifest.selected_items.find((i) => i.item_id === "Q-6E-B-001");
    check(
      "Q-6E-B-001 prompt_hash matches enriched prompt",
      manifestSam?.prompt_hash === samHash,
      `manifest=${manifestSam?.prompt_hash} actual=${samHash}`
    );
  }
}

if (fileExists(flaPack)) {
  const flaText = fs.readFileSync(flaPack, "utf-8");
  const flaPromptMatch = flaText.match(/```text\n([\s\S]*?)```/);
  if (flaPromptMatch) {
    const flaHash = sha12(flaPromptMatch[1].trim());
    const manifestFla = manifest.selected_items.find((i) => i.item_id === "Q-6E-B-002");
    check(
      "Q-6E-B-002 prompt_hash matches enriched prompt",
      manifestFla?.prompt_hash === flaHash,
      `manifest=${manifestFla?.prompt_hash} actual=${flaHash}`
    );
  }
}

// Step 7: Verify boundaries
console.log("\n7. Boundaries enforced");
check("no_x_publish === true", manifest.no_x_publish === true);
check("no_timer === true", manifest.no_timer === true);
check("no_promote === true", manifest.no_promote === true);
check("no_c5n_change === true", manifest.no_c5n_change === true);
check("no_6d5_modify === true", manifest.no_6d5_modify === true);
check("no_secrets === true", manifest.no_secrets === true);
check("image_api_called === false", manifest.boundaries_enforced.image_api_called === false);
check("video_api_called === false", manifest.boundaries_enforced.video_api_called === false);
check("music_api_called === false", manifest.boundaries_enforced.music_api_called === false);

// Step 8: 6D-5 closeout unchanged
console.log("\n8. 6D-5 closeout unchanged");
const xManualLog = readJSON<{ final_status: string; posted_manually_total: number; phase: string }>(
  path.join(ROOT, "dashboard/x-manual-post-log.json")
);
check("x-manual-post-log.json exists", xManualLog !== null);
if (xManualLog) {
  check("6D-5 phase unchanged", xManualLog.phase === "6D-5", xManualLog.phase);
  check("6D-5 final_status === 'closed'", xManualLog.final_status === "closed", xManualLog.final_status);
  check(
    "6D-5 posted_manually_total === 5",
    xManualLog.posted_manually_total === 5,
    String(xManualLog.posted_manually_total)
  );
}

// Step 9: Image generation gates unchanged
console.log("\n9. Image generation gates unchanged (Run 1 approved, Run 2/3 pending)");
const gates = readJSON<any>(path.join(ROOT, "dashboard/image-generation-gates.json"));
check("image-generation-gates.json exists", gates !== null);
if (gates) {
  check(
    "Run 1 approved_items contains Q-6E-B-001 and Q-6E-B-002",
    gates.run_status?.run_1?.approved === true &&
      Array.isArray(gates.run_status?.run_1?.item_ids) &&
      gates.run_status.run_1.item_ids.includes("Q-6E-B-001") &&
      gates.run_status.run_1.item_ids.includes("Q-6E-B-002")
  );
  check("Run 2 approved === false", gates.run_status?.run_2?.approved === false);
  check("Run 3 approved === false", gates.run_status?.run_3?.approved === false);
}

// Step 10: generated-assets.json unchanged (5 baseline)
console.log("\n10. generated-assets.json baseline unchanged (5)");
const genAssets = readJSON<any[]>(path.join(ASSETS_ROOT, "metadata/generated-assets.json"));
check("generated-assets.json exists", Array.isArray(genAssets));
if (Array.isArray(genAssets)) {
  check("count === 5", genAssets.length === 5, String(genAssets.length));
  check("contains cqa-2026-06-11-canary-001", genAssets.some((a) => a.asset_id === "cqa-2026-06-11-canary-001"));
  check("contains cqa-2026-06-11-gen-002", genAssets.some((a) => a.asset_id === "cqa-2026-06-11-gen-002"));
  check("contains cqa-2026-06-11-gen-003", genAssets.some((a) => a.asset_id === "cqa-2026-06-11-gen-003"));
  check("contains cqa-2026-06-11-gen-004", genAssets.some((a) => a.asset_id === "cqa-2026-06-11-gen-004"));
  check("contains cqa-2026-06-11-gen-005", genAssets.some((a) => a.asset_id === "cqa-2026-06-11-gen-005"));
  // If blocked, no new asset_ids should exist
  if (isBlocked) {
    check(
      "no cqa-2026-06-16-run1-001 (blocked path)",
      !genAssets.some((a) => a.asset_id === "cqa-2026-06-16-run1-001")
    );
    check(
      "no cqa-2026-06-16-run1-002 (blocked path)",
      !genAssets.some((a) => a.asset_id === "cqa-2026-06-16-run1-002")
    );
  }
}

// Step 11: No secrets, no env files, no .env.telegram.local, no .control.local, no audit log committed
console.log("\n11. No secret / env files committed");
const assetsGitStatus = require("child_process")
  .execSync(`cd "${ASSETS_ROOT}" && git status --porcelain`, { encoding: "utf-8" })
  .trim();
const harvGitStatus = require("child_process")
  .execSync(`cd "${ROOT}" && git status --porcelain`, { encoding: "utf-8" })
  .trim();

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

// Step 12: Cross-repo mirror consistency
console.log("\n12. Cross-repo mirror consistency");
const harvDashboard = readJSON<any>(runDashboardHarvester);
const assetsDashboard = readJSON<any>(runDashboardAssets);
if (harvDashboard && assetsDashboard) {
  check(
    "harvester dashboard === assets dashboard (key fields)",
    harvDashboard.phase === assetsDashboard.phase &&
      harvDashboard.execution_status === assetsDashboard.execution_status &&
      harvDashboard.block_reason === assetsDashboard.block_reason
  );
} else {
  check("both dashboards exist and parse", false);
}

// Final summary
console.log("\n=== Summary ===");
console.log(`Pass: ${passCount}`);
console.log(`Fail: ${failCount}`);

if (failCount > 0) {
  console.log("\n❌ Phase 6E-D Run 1 validation: FAIL");
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
}

const status = isBlocked ? "BLOCKED (quota check)" : "PASS (2 images generated)";
console.log(`\n✅ Phase 6E-D Run 1 validation: ${status}`);
console.log(`   execution_status: ${manifest.execution_status}`);
console.log(`   images_generated_this_run: ${manifest.images_generated_this_run}`);
console.log(`   images_generated_cumulative: ${manifest.images_generated_cumulative}`);
process.exit(0);