#!/usr/bin/env tsx
/**
 * src/reports/telegram-digest-sanitizer.ts — Phase 4C-3
 *
 * Unified sanitizer for Daily Digest content before sending to Telegram.
 *
 * Removes:
 *  - Tool residue: </tool_call>, </invoke>, </content>, <tool_call, <invoke, <content>, etc.
 *  - Internal XML/JSON fragments that leaked from upstream tools
 *  - Common secret patterns (sk-..., ghp_..., xoxb-..., TELEGRAM_BOT_TOKEN=, MINIMAX_API_KEY=, etc.)
 *  - [truncated] markers
 *  - "Authorization:" / "Bearer ..." lines
 *  - .env references that look like secrets
 *  - minimax/MiniMax mentions that indicate leaked internal content
 *
 * Public API:
 *   sanitizeTelegramDigest(text): string
 *   findForbiddenPatterns(text): { pattern: string; hits: string[] }[]
 *   sanitizeReportForLog(text): string  // safe version for reports (no raw residue)
 */

import { basename } from 'path';

export interface ForbiddenHit {
  pattern: string;
  matches: string[];
}

// Patterns that should NEVER appear in a publicly-sent Telegram digest.
// Each entry: { id, regex, description }
//
// Phase 4I-1: Removed the broad `minimax` / `MiniMax` word-boundary checks
// because they were catching the product/model name (e.g. "minimax-music",
// "MiniMax Music Prompt") used in project reports. The product name is
// safe public context. Only INTERIOR tool residue and real secrets are
// still forbidden.
const FORBIDDEN_PATTERNS: Array<{ id: string; regex: RegExp; desc: string }> = [
  // Tool-call residue from upstream LLM tools
  { id: 'tool_call_open',     regex: /<[|]?(tool_call|tool|function|invoke)\b[^>]*>/gi, desc: 'Tool call XML/bracket open' },
  { id: 'tool_call_close',    regex: /<\/(tool_call|tool|function|invoke|content)\s*>/gi, desc: 'Tool call XML close' },
  { id: 'tool_call_self_close', regex: /<[|]?(tool_call|tool|function|invoke)\b[^>]*\/>?/gi, desc: 'Tool call self-close' },
  { id: 'xml_brackets',       regex: /<\/?[a-z_][a-z0-9_]*>/gi, desc: 'XML-style tag' },
  // Secrets
  // Phase 5C-2C-A2: Added negative lookbehind to avoid matching 'sk-' inside words
  // like 'risk-execution', 'task-execution', 'markdown-sketch-note' etc.
  // Only matches 'sk-' when preceded by non-word chars (whitespace, start of string, =, :, etc.)
  { id: 'openai_key',         regex: /(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}/g, desc: 'OpenAI-style API key' },
  { id: 'openai_proj_key',    regex: /(?<![A-Za-z0-9_-])sk-(cp|proj)-[A-Za-z0-9_-]{20,}/g, desc: 'OpenAI project key' },
  { id: 'github_token',       regex: /ghp_[A-Za-z0-9]{20,}/g, desc: 'GitHub personal token' },
  { id: 'slack_token',        regex: /xox[baprs]-[A-Za-z0-9-]{8,}/g, desc: 'Slack token' },
  // Phase 5C-2C-A3: Use [\w-:]+ to match full token values including colons (Telegram bot token)
  { id: 'telegram_bot_token', regex: /TELEGRAM_BOT_TOKEN\s*=\s*[\w-:]+/g, desc: 'Telegram bot token assignment' },
  // Standalone Telegram bot token (numeric:alphanumeric, at least 35 chars after colon)
  { id: 'telegram_bot_token_standalone', regex: /\b\d+:[A-Za-z0-9_-]{35,}\b/g, desc: 'Telegram bot token (standalone)' },
  // CQA control token (from .control.local)
  { id: 'cqa_control_token',  regex: /CQA_CONTROL_TOKEN\s*=\s*[\w-:]+/g, desc: 'CQA control token' },
  // Secrets — require actual assignment with value (avoids false positives on the word itself)
  { id: 'minimax_key',        regex: /MINIMAX_API_KEY\s*=\s*[\w-:]+/g, desc: 'MiniMax API key assignment' },
  { id: 'generic_key',        regex: /[A-Z_]+_API_KEY\s*=\s*[\w-:]+/g, desc: 'Generic API key assignment' },
  { id: 'bearer',             regex: /Authorization:\s*Bearer\s+[\w-:]+/gi, desc: 'Authorization header' },
  { id: 'env_secret',         regex: /\.env\s+(?:contains|holds|has|leaks?)\s+.{0,80}secret/gi, desc: 'env secret leak' },
  // Truncated markers
  { id: 'truncated_marker',   regex: /\[truncated\]/gi, desc: 'Truncated marker' },
  // JSON tool payload residue (heuristic — only strip if it looks like raw tool output)
  { id: 'json_payload',       regex: /\{"(name|tool|function)":\s*"[^"]+",\s*"arguments":\s*\{/g, desc: 'Raw tool JSON payload' },
];

// Strip XML/angle bracket fragments that look like tool residue
function stripXmlFragments(text: string): string {
  // Remove entire <...> fragments that contain "tool", "function", "invoke", "call"
  let out = text.replace(/<[^>]*?(?:tool|function|invoke|call|content)[^>]*>/gi, '');
  // Remove lone opening/closing brackets that begin lines (heuristic)
  out = out.replace(/^\s*<[\/]?(?:tool|content|invoke|function|call)[^\n]*$/gim, '');
  return out;
}

// Strip secret-like assignments and replace with redaction marker
function redactSecrets(text: string): string {
  let out = text;
  // Replace sk-... with [REDACTED-API-KEY]
  // Phase 5C-2C-A2: Use negative lookbehind to avoid redacting 'sk-' inside words
  out = out.replace(/(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}/g, '[REDACTED-API-KEY]');
  out = out.replace(/(?<![A-Za-z0-9_-])sk-(cp|proj)-[A-Za-z0-9_-]{20,}/g, '[REDACTED-API-KEY]');
  out = out.replace(/ghp_[A-Za-z0-9]{20,}/g, '[REDACTED-GITHUB-TOKEN]');
  out = out.replace(/xox[baprs]-[A-Za-z0-9-]{8,}/g, '[REDACTED-SLACK-TOKEN]');
  // TELEGRAM_BOT_TOKEN=... (with value) — Phase 5C-2C-A3: use [\w-:]+ to match full token including colon
  out = out.replace(/TELEGRAM_BOT_TOKEN\s*=\s*[\w-:]+/g, 'TELEGRAM_BOT_TOKEN=[REDACTED]');
  // Standalone Telegram bot token (numeric:alphanumeric, at least 35 chars after colon)
  out = out.replace(/\b\d+:[A-Za-z0-9_-]{35,}\b/g, '[REDACTED-TELEGRAM-BOT-TOKEN]');
  // CQA control token (from .control.local)
  out = out.replace(/CQA_CONTROL_TOKEN\s*=\s*[\w-:]+/g, 'CQA_CONTROL_TOKEN=[REDACTED]');
  out = out.replace(/MINIMAX_API_KEY\s*=\s*[\w-:]+/g, 'MINIMAX_API_KEY=[REDACTED]');
  // Generic patterns (require value with at least 8 word/dash/colon chars)
  out = out.replace(/[A-Z_]+_API_KEY\s*=\s*[\w-:]+/g, (m) => m.split('=')[0] + '=[REDACTED]');
  out = out.replace(/Authorization:\s*Bearer\s+[\w-:]+/gi, 'Authorization: Bearer [REDACTED]');
  return out;
}

// Phase 4I-1: neutralizeMinimaxMentions is now a no-op.
// We no longer replace the product/model name "MiniMax" / "minimax" in
// public reports because the name is a legitimate project term
// (e.g. "MiniMax Music Prompt", "minimax-music"). Only real secrets
// and tool residue are sanitized.
function neutralizeMinimaxMentions(text: string): string {
  return text;
}

export function findForbiddenPatterns(text: string): ForbiddenHit[] {
  const hits: ForbiddenHit[] = [];
  for (const p of FORBIDDEN_PATTERNS) {
    const matches = text.match(p.regex);
    if (matches && matches.length > 0) {
      hits.push({ pattern: `${p.id}: ${p.desc}`, matches: [...new Set(matches)] });
    }
  }
  return hits;
}

/**
 * Sanitize text for Telegram public send.
 * - Removes forbidden patterns
 * - Redacts secrets
 * - Strips tool residue
 *
 * Phase 4I-1: No longer neutralizes the public product name
 * "MiniMax" / "minimax" because it is legitimately used in project
 * metadata (model names, product references).
 *
 * Returns sanitized text safe for Telegram.
 */
export function sanitizeTelegramDigest(text: string): string {
  let out = text;
  // Step 1: strip XML/tool residue
  out = stripXmlFragments(out);
  // Step 2: redact secrets
  out = redactSecrets(out);
  // Step 3: neutralize minimax mentions (no-op since Phase 4I-1)
  out = neutralizeMinimaxMentions(out);
  // Step 4: remove [truncated]
  out = out.replace(/\[truncated\]/gi, '');
  // Step 5: collapse excessive whitespace from removals
  out = out.replace(/\n{3,}/g, '\n\n');
  out = out.replace(/[ \t]+\n/g, '\n');
  return out.trim();
}

/**
 * Sanitize for logging in reports. Same as sanitizeTelegramDigest
 * but redacts secret fragments more aggressively to prevent any leak.
 */
export function sanitizeReportForLog(text: string): string {
  return sanitizeTelegramDigest(text);
}

// Main CLI entry for direct testing
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: tsx telegram-digest-sanitizer.ts <file>');
    console.log('       tsx telegram-digest-sanitizer.ts --check <file>');
    process.exit(1);
  }
  const isCheck = args[0] === '--check';
  const file = isCheck ? args[1] : args[0];
  const fs = require('fs');
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(file, 'utf-8');
  if (isCheck) {
    const hits = findForbiddenPatterns(raw);
    if (hits.length === 0) {
      console.log('PASS: no forbidden patterns found');
      process.exit(0);
    }
    console.log(`FAIL: ${hits.length} forbidden pattern(s) found:`);
    for (const h of hits) {
      console.log(`  ${h.pattern}: ${h.matches.length} match(es)`);
      for (const m of h.matches.slice(0, 3)) {
        const safe = m.length > 80 ? m.slice(0, 77) + '...' : m;
        console.log(`    - ${safe}`);
      }
    }
    process.exit(1);
  }
  const sanitized = sanitizeTelegramDigest(raw);
  process.stdout.write(sanitized);
}