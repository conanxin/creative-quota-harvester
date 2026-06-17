#!/usr/bin/env ts-node
/**
 * Phase 6E-A Image Generation Preflight Validator
 *
 * Validates the structure and content of:
 * - dashboard/image-generation-preflight.json (this repo)
 * - assets-repo/dashboard/image-generation-preflight.json (mirror)
 *
 * Strict boundaries:
 * - READ-ONLY validator. Does not call any model or generate any media.
 * - Does not send Telegram / trigger timer / promote / publish.
 * - Pure structural check.
 *
 * Usage:
 *   npx ts-node scripts/validate-image-generation-preflight.ts
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const ASSETS_ROOT = path.resolve(ROOT, "..", "creative-quota-assets");

interface PreflightItem {
  pack_id: string;
  item_id: string;
  title: string;
  source_type: string;
  is_generated: boolean;
  decision: string;
  priority: string;
  risk_level: string;
  has_image_prompt_enriched: boolean;
  has_x_post: boolean;
  has_summary: boolean;
  has_music_prompt: boolean;
  visual_clarity: string;
  facts_complete: boolean;
}

interface PreflightData {
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
  stats: {
    total_content_packs: number;
    generated_images: number;
    pending_images: number;
    ready_count: number;
    hold_count: number;
    skip_count: number;
  };
  items: PreflightItem[];
  recommended_next_phase: string;
  recommended_batches: Record<string, unknown>;
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

function validateOne(p: PreflightData, label: string): void {
  console.log(`\n=== ${label} ===`);

  check(`${label}: phase === "6E-A"`, p.phase === "6E-A", `got ${p.phase}`);
  check(`${label}: mode === "image_generation_preflight"`, p.mode === "image_generation_preflight", `got ${p.mode}`);

  // Boundary flags
  check(`${label}: no_model_call === true`, p.no_model_call === true);
  check(`${label}: no_media_generation === true`, p.no_media_generation === true);
  check(`${label}: no_telegram === true`, p.no_telegram === true);
  check(`${label}: no_timer === true`, p.no_timer === true);
  check(`${label}: no_x_publish === true`, p.no_x_publish === true);
  check(`${label}: no_promote === true`, p.no_promote === true);
  check(`${label}: no_c5n_change === true`, p.no_c5n_change === true);
  check(`${label}: no_6d5_modify === true`, p.no_6d5_modify === true);
  check(`${label}: no_secrets === true`, p.no_secrets === true);

  // Stats
  check(`${label}: total === 25`, p.stats.total_content_packs === 25, `got ${p.stats.total_content_packs}`);
  check(`${label}: generated === 5`, p.stats.generated_images === 5, `got ${p.stats.generated_images}`);
  check(`${label}: pending === 20 (pre-6E-J) or === 16 (after 6E-J Run 2 generated 2)`, p.stats.pending_images === 20 || p.stats.pending_images === 16, `got ${p.stats.pending_images}`);
  check(`${label}: ready === 20`, p.stats.ready_count === 20, `got ${p.stats.ready_count}`);
  check(`${label}: hold === 0`, p.stats.hold_count === 0, `got ${p.stats.hold_count}`);
  check(`${label}: skip === 0`, p.stats.skip_count === 0, `got ${p.stats.skip_count}`);

  // Items
  check(`${label}: items count === 25`, p.items.length === 25, `got ${p.items.length}`);
  const generated = p.items.filter((it) => it.is_generated);
  const pending = p.items.filter((it) => !it.is_generated);
  check(`${label}: 5 generated items`, generated.length === 5, `got ${generated.length}`);
  check(`${label}: 20 pending items`, pending.length === 20, `got ${pending.length}`);

  // All pending have decision=ready_for_human_approval
  const allPendingReady = pending.every((it) => it.decision === "ready_for_human_approval");
  check(`${label}: all 20 pending decision=ready_for_human_approval`, allPendingReady);
  const allGeneratedCompleted = generated.every((it) => it.decision === "completed");
  check(`${label}: all 5 generated decision=completed`, allGeneratedCompleted);

  // All items have complete assets (image_prompt/x_post/summary/music_prompt)
  const allComplete = p.items.every(
    (it) =>
      it.has_image_prompt_enriched &&
      it.has_x_post &&
      it.has_summary &&
      it.has_music_prompt
  );
  check(`${label}: 25/25 have image_prompt/x_post/summary/music_prompt`, allComplete);

  // Source type distribution: 5 each
  const stDist: Record<string, number> = {};
  for (const it of p.items) stDist[it.source_type] = (stDist[it.source_type] || 0) + 1;
  for (const st of ["academic", "code", "ai-ecosystem", "dev-community", "culture-art"]) {
    check(
      `${label}: source_type=${st} count === 5`,
      stDist[st] === 5,
      `got ${stDist[st] || 0}`
    );
  }

  // Recommended next phase
  check(
    `${label}: recommended_next_phase === "6E-B (gated image generation execution)"`,
    p.recommended_next_phase.startsWith("6E-B"),
    `got ${p.recommended_next_phase}`
  );

  // Recommended batches present
  check(
    `${label}: recommended_batches has 2 entries`,
    Object.keys(p.recommended_batches).length === 2,
    `got ${Object.keys(p.recommended_batches).length}`
  );

  // boundaries_enforced object present
  check(
    `${label}: boundaries_enforced has all keys`,
    Object.keys(p.boundaries_enforced).length >= 10,
    `got ${Object.keys(p.boundaries_enforced).length}`
  );

  // Visual clarity
  const clarityLevels = new Set(p.items.map((it) => it.visual_clarity));
  check(
    `${label}: all items have valid visual_clarity`,
    [...clarityLevels].every((c) => ["high", "medium", "low"].includes(c))
  );
}

function main(): void {
  console.log("=== Phase 6E-A Image Generation Preflight Validator ===");
  console.log("Read-only structural check. No model call. No media generation.\n");

  // 1. Validate harvester dashboard file
  const harvesterPath = path.join(ROOT, "dashboard", "image-generation-preflight.json");
  if (!fs.existsSync(harvesterPath)) {
    console.log(`  ❌ Missing: ${harvesterPath}`);
    process.exit(1);
  }
  const harvesterData = JSON.parse(fs.readFileSync(harvesterPath, "utf-8")) as PreflightData;
  validateOne(harvesterData, "harvester/dashboard");

  // 2. Validate assets dashboard file (cross-repo mirror)
  const assetsPath = path.join(ASSETS_ROOT, "dashboard", "image-generation-preflight.json");
  if (fs.existsSync(assetsPath)) {
    const assetsData = JSON.parse(fs.readFileSync(assetsPath, "utf-8")) as PreflightData;
    validateOne(assetsData, "assets/dashboard");
  } else {
    console.log(`  ⚠️  Assets mirror not found at ${assetsPath} (skipping)`);
  }

  // 3. Verify 6D-5 closeout is unchanged
  const xLogPath = path.join(ROOT, "dashboard", "x-manual-post-log.json");
  if (fs.existsSync(xLogPath)) {
    const xLog = JSON.parse(fs.readFileSync(xLogPath, "utf-8"));
    check(`6D-5 closeout unchanged: final_status=closed`, xLog.final_status === "closed");
    check(
      `6D-5 closeout unchanged: posted_manually_total=5`,
      xLog.posted_manually_total === 5
    );
  } else {
    console.log(`  ⚠️  x-manual-post-log.json not found (skipping 6D-5 check)`);
  }

  console.log("\n=== Summary ===");
  console.log(`Pass: ${pass}`);
  console.log(`Fail: ${fail}`);

  if (fail > 0) {
    console.log("\n=== Errors ===");
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  } else {
    console.log("\n✅ Phase 6E-A preflight validation: PASS");
    process.exit(0);
  }
}

main();
