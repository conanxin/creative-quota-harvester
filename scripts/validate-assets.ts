/**
 * scripts/validate-assets.ts — Phase 2B Asset Validation
 * npm run validate:assets
 *
 * Validates the creative-quota-assets repository structure.
 * Writes reports/asset-validation.md.
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const ASSET_REPO_DIR = path.resolve(HARVESTER_DIR, "..", "creative-quota-assets");
const REPORTS_DIR = path.resolve(HARVESTER_DIR, "reports");

interface ValidationResult {
  passed: boolean;
  severity: "error" | "warning" | "info";
  check: string;
  detail: string;
}

const REQUIRED_PACK_FILES = [
  "manifest.json",
  "source.json",
  "signal.json",
  "brief.md",
  "facts.md",
  "x-post.zh.md",
  "image-prompt.md",
  "video-prompt.md",
  "music-prompt.md",
  "webpage-outline.md",
  "asset-plan.json",
];

function checkFileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function checkJsonValid(filePath: string): { valid: boolean; error?: string } {
  try {
    JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { valid: true };
  } catch (e: unknown) {
    return { valid: false, error: (e as Error).message };
  }
}

function validateAssetRepo(): ValidationResult[] {
  const results: ValidationResult[] = [];

  // ── Metadata JSON files ────────────────────────────────────────
  const metaFiles = [
    ["metadata/asset-index.json", "Asset index"],
    ["metadata/source-index.json", "Source index"],
    ["metadata/daily-index.json", "Daily index"],
    ["gallery/assets.json", "Gallery assets"],
  ];

  for (const [relPath, label] of metaFiles) {
    const fullPath = path.join(ASSET_REPO_DIR, relPath);
    if (!checkFileExists(fullPath)) {
      results.push({ passed: false, severity: "error", check: label, detail: `File missing: ${relPath}` });
    } else {
      const { valid, error } = checkJsonValid(fullPath);
      if (!valid) {
        results.push({ passed: false, severity: "error", check: label, detail: `Invalid JSON: ${error}` });
      } else {
        results.push({ passed: true, severity: "info", check: label, detail: `Valid JSON: ${relPath}` });
      }
    }
  }

  // ── README ────────────────────────────────────────────────────
  const readmePath = path.join(ASSET_REPO_DIR, "README.md");
  results.push({
    passed: checkFileExists(readmePath),
    severity: "error",
    check: "README.md",
    detail: checkFileExists(readmePath) ? "README.md found" : "README.md missing",
  });

  // ── Content packs ─────────────────────────────────────────────
  const packsDir = path.join(ASSET_REPO_DIR, "content-packs");
  if (!fs.existsSync(packsDir)) {
    results.push({ passed: false, severity: "error", check: "Content packs directory", detail: "content-packs/ not found" });
    return results;
  }

  // Find all manifest.json files
  const manifestFiles: string[] = [];
  function findManifests(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const manifestInDir = path.join(full, "manifest.json");
        if (fs.existsSync(manifestInDir)) {
          manifestFiles.push(manifestInDir);
        } else {
          findManifests(full); // recurse
        }
      }
    }
  }
  findManifests(packsDir);

  results.push({
    passed: manifestFiles.length > 0,
    severity: "error",
    check: "Content packs found",
    detail: `Found ${manifestFiles.length} content packs`,
  });

  // Validate each pack
  for (const manifestPath of manifestFiles) {
    const packDir = path.dirname(manifestPath);
    const packName = path.basename(packDir);
    const relPackDir = path.relative(ASSET_REPO_DIR, packDir);

    // Check manifest.json
    const { valid: manifestValid } = checkJsonValid(manifestPath);
    results.push({
      passed: manifestValid,
      severity: manifestValid ? "info" : "error",
      check: `manifest.json: ${packName}`,
      detail: manifestValid ? "Valid JSON" : "Invalid JSON",
    });

    if (!manifestValid) {
      // Can't check rest if manifest is invalid
      continue;
    }

    // Read manifest for recommended_assets check
    let sourceTypes: string[] = [];
    let recommendedAssets: string[] = [];
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      sourceTypes = manifest.source_types || [];
      recommendedAssets = manifest.recommended_assets || [];
    } catch { /* ignore */ }

    // Check required files
    // video-prompt.md, music-prompt.md, webpage-outline.md are CONDITIONAL
    // They only pass if the corresponding recommended_assets type is in manifest
    const CONDITIONAL_FILES: Record<string, string> = {
      "video-prompt.md": "video",
      "music-prompt.md": "music",
      "webpage-outline.md": "webpage",
    };


    for (const reqFile of REQUIRED_PACK_FILES) {
      const reqPath = path.join(packDir, reqFile);
      const conditionalType = CONDITIONAL_FILES[reqFile];
      if (!checkFileExists(reqPath)) {
        if (conditionalType && !recommendedAssets.includes(conditionalType)) {
          // Conditional file — not required if this asset type not in recommended_assets
          results.push({
            passed: true,
            severity: "info",
            check: `Optional file (${conditionalType} not recommended): ${reqFile}`,
            detail: `Skipped: ${relPackDir}/${reqFile} — ${conditionalType} not in recommended_assets`,
          });
        } else {
          results.push({
            passed: false,
            severity: "error",
            check: `Required file: ${reqFile}`,
            detail: `Missing in ${relPackDir}${conditionalType ? ` (${conditionalType} IS recommended but file absent)` : ""}`,
          });
        }
      } else {
        results.push({
          passed: true,
          severity: "info",
          check: `File present: ${reqFile}`,
          detail: `${relPackDir}/${reqFile}`,
        });
      }
    }

    // Check for conanxin in source.json
    const sourceJsonPath = path.join(packDir, "source.json");
    if (checkFileExists(sourceJsonPath)) {
      try {
        const sourceJson = JSON.parse(fs.readFileSync(sourceJsonPath, "utf-8"));
        const src = JSON.stringify(sourceJson);
        if (src.toLowerCase().includes("conanxin")) {
          results.push({
            passed: false,
            severity: "error",
            check: `conanxin exclusion: ${packName}`,
            detail: `conanxin/* found in source.json`,
          });
        } else {
          results.push({
            passed: true,
            severity: "info",
            check: `conanxin exclusion: ${packName}`,
            detail: "Clean — no conanxin/* contamination",
          });
        }
      } catch {
        results.push({
          passed: false,
          severity: "warning",
          check: `source.json parse: ${packName}`,
          detail: "Could not parse source.json",
        });
      }
    }
  }

  // ── Gallery index.html ────────────────────────────────────────
  const galleryPath = path.join(ASSET_REPO_DIR, "gallery", "index.html");
  results.push({
    passed: checkFileExists(galleryPath),
    severity: "error",
    check: "Gallery index.html",
    detail: checkFileExists(galleryPath) ? "gallery/index.html found" : "gallery/index.html missing",
  });

  // ── License files ─────────────────────────────────────────────
  const licensePath = path.join(ASSET_REPO_DIR, "LICENSE");
  const licenseAssetsPath = path.join(ASSET_REPO_DIR, "LICENSE-ASSETS");
  results.push({
    passed: checkFileExists(licensePath),
    severity: "error",
    check: "LICENSE",
    detail: checkFileExists(licensePath) ? "LICENSE found" : "LICENSE missing",
  });
  results.push({
    passed: checkFileExists(licenseAssetsPath),
    severity: "warning",
    check: "LICENSE-ASSETS",
    detail: checkFileExists(licenseAssetsPath) ? "LICENSE-ASSETS found" : "LICENSE-ASSETS missing (optional)",
  });

  return results;
}

function generateReport(results: ValidationResult[]): string {
  const lines: string[] = [];

  const s = (txt: string) => lines.push(txt);
  const pass = (r: ValidationResult) => r.passed;
  const fail = (r: ValidationResult) => !r.passed;

  const errors = results.filter(r => !r.passed && r.severity === "error");
  const warnings = results.filter(r => !r.passed && r.severity === "warning");
  const passed = results.filter(r => r.passed);

  s("# Asset Validation Report — Phase 2B");
  s("");
  s("**Generated:** " + new Date().toISOString());
  s("**Asset Repo:** `~/projects/creative-quota-assets/`");
  s("");
  s("---");
  s("");

  s("## SUMMARY");
  s("");
  s("| Status | Count |");
  s("|--------|-------|");
  s("| ✅ Passed | " + passed.length + " |");
  s("| ❌ Errors | " + errors.length + " |");
  s("| ⚠️  Warnings | " + warnings.length + " |");
  s("");
  s("**Overall:** " + (errors.length === 0 ? "✅ PASS" : "❌ FAIL — " + errors.length + " error(s)"));
  s("");

  s("## ERRORS");
  s("");
  if (errors.length === 0) {
    s("No errors.");
  } else {
    for (const r of errors) {
      s("- **" + r.check + "**: " + r.detail);
    }
  }
  s("");

  s("## WARNINGS");
  s("");
  if (warnings.length === 0) {
    s("No warnings.");
  } else {
    for (const r of warnings) {
      s("- **" + r.check + "**: " + r.detail);
    }
  }
  s("");

  s("## PASSED_CHECKS");
  s("");
  for (const r of passed.slice(0, 30)) {
    s("- ✅ " + r.check + ": " + r.detail);
  }
  if (passed.length > 30) {
    s("- ... and " + (passed.length - 30) + " more passed checks");
  }
  s("");

  s("## CONTENT_PACKS");
  s("");
  const manifestFiles: string[] = [];
  const packsDir = path.join(ASSET_REPO_DIR, "content-packs");
  function findManifests(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const mp = path.join(dir, entry.name, "manifest.json");
          if (fs.existsSync(mp)) manifestFiles.push(mp);
          else findManifests(path.join(dir, entry.name));
        }
      }
    } catch { /* ignore */ }
  }
  findManifests(packsDir);

  s("| # | Pack | Source Types | Score | Required Files |");
  s("|---|------|-------------|-------|----------------|");
  manifestFiles.forEach((mp, i) => {
    try {
      const m = JSON.parse(fs.readFileSync(mp, "utf-8"));
      const packDir = path.dirname(mp);
      const packName = path.basename(packDir);
      const files = REQUIRED_PACK_FILES.map(f =>
        fs.existsSync(path.join(packDir, f)) ? "✅" : "❌"
      ).join(" ");
      s("| " + (i+1) + " | " + packName.slice(0, 40) + " | " + (m.source_types || []).join(", ") + " | " + (m.final_score || "N/A") + " | " + files + " |");
    } catch {
      s("| " + (i+1) + " | " + path.basename(path.dirname(mp)) + " | parse error | — | — |");
    }
  });
  s("");
  s("**Total content packs:** " + manifestFiles.length);
  s("");

  s("## CONANXIN_EXCLUSION");
  s("");
  const conanxinFailures = results.filter(r =>
    !r.passed && r.check.includes("conanxin") && r.detail.includes("conanxin")
  );
  if (conanxinFailures.length === 0) {
    s("✅ No conanxin/* contamination detected across all content packs.");
  } else {
    for (const r of conanxinFailures) {
      s("❌ " + r.detail);
    }
  }
  s("");

  s("## FILE_STRUCTURE");
  s("");
  s("```");
  s("creative-quota-assets/");
  s("├── README.md                    ✅ validated");
  s("├── LICENSE                     ✅ validated");
  s("├── LICENSE-ASSETS             ⚠️  optional");
  s("├── metadata/");
  s("│   ├── asset-index.json        " + (results.find(r => r.check === "Asset index")?.passed ? "✅" : "❌"));
  s("│   ├── source-index.json       " + (results.find(r => r.check === "Source index")?.passed ? "✅" : "❌"));
  s("│   └── daily-index.json        " + (results.find(r => r.check === "Daily index")?.passed ? "✅" : "❌"));
  s("├── gallery/");
  s("│   ├── index.html              " + (results.find(r => r.check === "Gallery index.html")?.passed ? "✅" : "❌"));
  s("│   └── assets.json             " + (results.find(r => r.check === "Gallery assets")?.passed ? "✅" : "❌"));
  s("└── content-packs/              ✅ " + manifestFiles.length + " packs");
  s("    └── YYYY/MM/YYYY-MM-DD/");
  s("        ├── manifest.json");
  s("        ├── source.json");
  s("        ├── signal.json");
  s("        ├── brief.md");
  s("        ├── facts.md");
  s("        ├── x-post.zh.md");
  s("        ├── image-prompt.md");
  s("        ├── video-prompt.md");
  s("        ├── music-prompt.md");
  s("        ├── webpage-outline.md");
  s("        └── asset-plan.json");
  s("```");
  s("");

  return lines.join("\n");
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("🔮 Phase 2B — Asset Repository Validation");
  console.log("=".repeat(60));
  console.log("");

  if (!fs.existsSync(ASSET_REPO_DIR)) {
    console.error("[ERROR] Asset repo not found:", ASSET_REPO_DIR);
    process.exit(1);
  }

  const results = validateAssetRepo();

  const errors = results.filter(r => !r.passed && r.severity === "error");
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total checks: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed} (${errors.length} errors)`);
  console.log("");

  if (errors.length > 0) {
    console.log("Errors:");
    errors.forEach(r => console.log("  ❌ " + r.check + ": " + r.detail));
    console.log("");
  }

  // Write report
  const reportMd = generateReport(results);
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, "asset-validation.md");
  fs.writeFileSync(reportPath, reportMd, "utf-8");
  console.log("📄 Report: " + reportPath);

  console.log("");
  console.log("=".repeat(60));
  console.log(errors.length === 0 ? "✅ VALIDATION PASSED" : "❌ VALIDATION FAILED — " + errors.length + " error(s)");
  console.log("=".repeat(60));

  if (errors.length > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error("[ERROR]", err);
  process.exit(1);
});