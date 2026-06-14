#!/usr/bin/env tsx
/**
 * scripts/validate-dashboard-control-safety.ts
 * Phase 5C-2C-C5M1B: Standalone validator for dashboard/control.html safety policy.
 *
 * Source of truth: dashboard/control-safety-policy.json
 *
 * This validator codifies the same safety intent as the inline check 6b in
 * validate-control-catalog.ts, but as a standalone script that:
 *   - Loads the policy file (no hard-coded allow/hint lists)
 *   - Reports each check individually with a stable id
 *   - Surfaces concrete offending elements on FAIL
 *   - Does not produce false positives on ordinary prose
 *
 * The inline check 6b is kept for defense in depth; if they ever diverge,
 * the standalone one is canonical (because it reads the policy file).
 */

import * as fs from "fs";
import * as path from "path";

const HARVESTER_DIR = path.resolve(__dirname, "..");
const POLICY_PATH = path.join(HARVESTER_DIR, "dashboard/control-safety-policy.json");
const HTML_PATH = path.join(HARVESTER_DIR, "dashboard/control.html");

interface Check {
  id: string;
  met: boolean;
  message: string;
}

const checks: Check[] = [];
function addCheck(id: string, met: boolean, message: string) {
  checks.push({ id, met, message });
}

function loadJson<T>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as T; } catch { return null; }
}

function fileExists(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}

// 0. Policy + HTML present
if (!fileExists(POLICY_PATH)) {
  addCheck("policy_present", false, `${POLICY_PATH} missing`);
  console.log(JSON.stringify({ validator: "validate-dashboard-control-safety", phase: "5C-2C-C5M1B", total_checks: 1, passed: 0, failed: 1, all_pass: false, checks }, null, 2));
  process.exit(1);
}
if (!fileExists(HTML_PATH)) {
  addCheck("html_present", false, `${HTML_PATH} missing`);
  console.log(JSON.stringify({ validator: "validate-dashboard-control-safety", phase: "5C-2C-C5M1B", total_checks: 2, passed: 0, failed: 2, all_pass: false, checks }, null, 2));
  process.exit(1);
}
addCheck("policy_present", true, POLICY_PATH);
addCheck("html_present", true, HTML_PATH);

const policy = loadJson<any>(POLICY_PATH);
const html = fs.readFileSync(HTML_PATH, "utf-8");

const ALLOWED_SAFETY: string[] = policy?.allowed_data_safety_values || [];
const FORBIDDEN_HINTS: string[] = policy?.forbidden_hints || [];
const FORBIDDEN_ELEMENTS: string[] = policy?.forbidden_elements || ["button"];
const FORBIDDEN_INLINE_HANDLERS: string[] = policy?.forbidden_inline_event_handlers || [];
const REQUIRED_ATTRS: string[] = policy?.required_attributes_for_interactive_elements || ["data-safety"];
const INTERACTIVE_CLASS: string = policy?.interactive_class || "cqa-action-btn";
const ALLOWED_ENDPOINTS: string[] = policy?.allowed_endpoint_categories || [];
const FORBIDDEN_ENDPOINT_HINTS: string[] = policy?.forbidden_endpoint_hints || [];

// 1. Policy shape sanity
addCheck(
  "policy_phase",
  policy?.phase === "5C-2C-C5M1B",
  `policy.phase=${policy?.phase}`,
);
addCheck(
  "policy_allow_list_nonempty",
  Array.isArray(ALLOWED_SAFETY) && ALLOWED_SAFETY.length > 0,
  `allowed_data_safety_values (${ALLOWED_SAFETY.length}): ${ALLOWED_SAFETY.join(", ")}`,
);
addCheck(
  "policy_forbidden_hints_nonempty",
  Array.isArray(FORBIDDEN_HINTS) && FORBIDDEN_HINTS.length > 0,
  `forbidden_hints (${FORBIDDEN_HINTS.length}): ${FORBIDDEN_HINTS.join(", ")}`,
);

// 2. No forbidden elements (after stripping comments / style / script blocks)
const htmlStripped = html
  .replace(/<!--[\s\S]*?-->/g, "")  // HTML comments
  .replace(/\/\*[\s\S]*?\*\//g, "")  // CSS comments
  .replace(/\/\/[^\n]*/g, "")        // JS line comments
  .replace(/<style[\s\S]*?<\/style>/gi, "");  // CSS blocks
for (const tag of FORBIDDEN_ELEMENTS) {
  const re = new RegExp(`<${tag}\\b`, "i");
  if (re.test(htmlStripped)) {
    addCheck(`no_${tag}_tag`, false, `Found <${tag}> tag in dashboard/control.html (forbidden by policy)`);
  } else {
    addCheck(`no_${tag}_tag`, true, `no <${tag}> tag (after stripping comments/style)`);
  }
}

// 3. No inline event handlers UNLESS on cqa-action-btn with data-safety (escape hatch from C5M1A, codified in C5M1B)
const inlineHandlerIssues: string[] = [];
for (const handler of FORBIDDEN_INLINE_HANDLERS) {
  const elementRe = new RegExp(`<\\w+[^>]*\\s${handler}\\s*=[^>]*>`, "gi");
  let mm: RegExpExecArray | null;
  while ((mm = elementRe.exec(htmlStripped)) !== null) {
    const element = mm[0];
    // Escape hatch: cqa-action-btn with data-safety
    const isActionBtn = /\bclass\s*=\s*["'][^"']*\bcqa-action-btn\b/i.test(element);
    const hasSafety = /\sdata-safety\s*=\s*["'][^"']*["']/i.test(element);
    if (isActionBtn && hasSafety) continue;
    inlineHandlerIssues.push(`inline ${handler} on non-cqa-action-btn or missing data-safety: ${element.slice(0, 100)}...`);
  }
}
if (inlineHandlerIssues.length === 0) {
  addCheck("no_inline_event_handlers", true, `forbidden handlers (${FORBIDDEN_INLINE_HANDLERS.length}): none outside the cqa-action-btn + data-safety escape hatch`);
} else {
  for (const issue of inlineHandlerIssues) {
    addCheck("no_inline_event_handlers", false, issue);
  }
}

// 4. Every cqa-action-btn must declare data-safety
const actionBtnRe = /<[a-zA-Z][a-zA-Z0-9]*[^>]*class\s*=\s*["'][^"']*\bcqa-action-btn\b[^"']*["'][^>]*>/gi;
let m: RegExpExecArray | null;
const actionBtnCount = { found: 0, missingSafety: 0 };
const actionBtnIssues: string[] = [];
while ((m = actionBtnRe.exec(html)) !== null) {
  actionBtnCount.found++;
  const element = m[0];
  const hasAll = REQUIRED_ATTRS.every(a => new RegExp(`\\s${a}\\s*=\\s*["'][^"']*["']`, "i").test(element));
  if (!hasAll) {
    actionBtnCount.missingSafety++;
    actionBtnIssues.push(`cqa-action-btn missing required attrs (${REQUIRED_ATTRS.join(",")}): ${element.slice(0, 120)}...`);
  }
}
if (actionBtnCount.found === 0) {
  addCheck("cqa_action_btns_have_data_safety", true, "no cqa-action-btn elements found (no-op)");
} else if (actionBtnCount.missingSafety === 0) {
  addCheck("cqa_action_btns_have_data_safety", true, `${actionBtnCount.found} cqa-action-btn elements all have required attrs`);
} else {
  addCheck("cqa_action_btns_have_data_safety", false, `${actionBtnCount.missingSafety}/${actionBtnCount.found} cqa-action-btn elements missing required attrs`);
  for (const issue of actionBtnIssues) addCheck("cqa_action_btns_details", false, issue);
}

// 5. All data-safety values must be in allow-list and not contain forbidden hints
const safetyAttrRe = /\sdata-safety\s*=\s*["']([^"']+)["']/gi;
const safetyValues = new Set<string>();
let sm: RegExpExecArray | null;
while ((sm = safetyAttrRe.exec(html)) !== null) {
  safetyValues.add(sm[1].toLowerCase());
}
const safetyIssues: string[] = [];
for (const v of safetyValues) {
  if (FORBIDDEN_HINTS.some(h => v.includes(h))) {
    safetyIssues.push(`data-safety="${v}" contains forbidden hint (${FORBIDDEN_HINTS.filter(h => v.includes(h)).join(",")})`);
    continue;
  }
  if (!ALLOWED_SAFETY.includes(v)) {
    safetyIssues.push(`data-safety="${v}" not in allow-list (${ALLOWED_SAFETY.join(", ")})`);
  }
}
if (safetyIssues.length === 0) {
  addCheck("data_safety_values_allowed", true, `${safetyValues.size} unique data-safety values, all in allow-list`);
} else {
  for (const issue of safetyIssues) addCheck("data_safety_values_allowed", false, issue);
}

// 6. No interactive element may point at forbidden endpoint categories
//    (only meaningful if cqa-action-btn has data-endpoint attribute or href)
const endpointRe = /\s(?:data-endpoint|href)\s*=\s*["']([^"']+)["']/gi;
const endpointIssues: string[] = [];
const foundEndpoints = new Set<string>();
let em: RegExpExecArray | null;
while ((em = endpointRe.exec(html)) !== null) {
  foundEndpoints.add(em[1]);
}
for (const ep of foundEndpoints) {
  for (const forbidden of FORBIDDEN_ENDPOINT_HINTS) {
    if (ep.includes(forbidden)) {
      endpointIssues.push(`endpoint "${ep}" matches forbidden hint "${forbidden}"`);
    }
  }
}
if (endpointIssues.length === 0) {
  addCheck("no_forbidden_endpoints", true, `no interactive endpoint matches forbidden patterns (${FORBIDDEN_ENDPOINT_HINTS.length} hints)`);
} else {
  for (const issue of endpointIssues) addCheck("no_forbidden_endpoints", false, issue);
}

// 7. No tokens / secrets committed
const secretPatterns: { id: string; re: RegExp }[] = [
  { id: "sk-cp", re: /sk-cp-[A-Za-z0-9_-]{10,}/g },
  { id: "openai-key", re: /(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}/g },
  { id: "telegram-bot-token-var", re: /TELEGRAM_BOT_TOKEN\s*=\s*['"][A-Za-z0-9_-]{10,}/g },
  { id: "minimax-key-var", re: /MINIMAX_API_KEY\s*=\s*['"][A-Za-z0-9_-]{10,}/g },
  { id: "control-token-var", re: /CQA_CONTROL_TOKEN\s*=\s*['"][A-Za-z0-9_-]{10,}/g },
  { id: "github-pat", re: /ghp_[A-Za-z0-9]{20,}/g },
];
const secretIssues: string[] = [];
for (const p of secretPatterns) {
  const m = p.re.exec(html);
  if (m) secretIssues.push(`${p.id}: ${m[0].slice(0, 30)}...`);
}
if (secretIssues.length === 0) {
  addCheck("no_secrets_in_html", true, "no token patterns detected");
} else {
  for (const issue of secretIssues) addCheck("no_secrets_in_html", false, issue);
}

// 8. Policy file itself is consistent (defensive)
if (policy && FORBIDDEN_HINTS.length > 0 && ALLOWED_SAFETY.length > 0) {
  const collisions = ALLOWED_SAFETY.filter(a => FORBIDDEN_HINTS.some(h => a.includes(h)));
  if (collisions.length > 0) {
    addCheck("policy_no_allow_forbid_collision", false, `allow-list values collide with forbidden hints: ${collisions.join(", ")}`);
  } else {
    addCheck("policy_no_allow_forbid_collision", true, "no overlap between allow-list and forbidden hints");
  }
}

const allMet = checks.every(c => c.met);
const summary = {
  validator: "validate-dashboard-control-safety",
  phase: "5C-2C-C5M1B",
  policy_path: POLICY_PATH,
  html_path: HTML_PATH,
  generated_at: new Date().toISOString(),
  total_checks: checks.length,
  passed: checks.filter(c => c.met).length,
  failed: checks.filter(c => !c.met).length,
  all_pass: allMet,
  checks,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(allMet ? 0 : 1);
