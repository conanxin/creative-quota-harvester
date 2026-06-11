#!/usr/bin/env npx ts-node
/**
 * check-generation-guard.ts — Phase 3C
 * 
 * Validates the generation guard logic.
 * Tests all deny/allow scenarios without calling MiniMax.
 * 
 * Usage:
 *   npm run guard:check
 */

import { evaluateGeneration, GenerationRequest } from '../src/generators/generation-guard';

interface TestCase {
  name: string;
  request: GenerationRequest;
  expected: 'ALLOW' | 'DENY' | 'ALLOW_DRY_RUN';
}

const testCases: TestCase[] = [
  // DENY: Ambiguous commands
  {
    name: 'command="继续" → DENY',
    request: { media_type: 'image', max_count: 1, confirm_spend: true, dry_run: false, command_hint: '继续' },
    expected: 'DENY',
  },
  {
    name: 'command="continue" → DENY',
    request: { media_type: 'image', max_count: 1, confirm_spend: true, dry_run: false, command_hint: 'continue' },
    expected: 'DENY',
  },
  {
    name: 'command="下一步" → DENY',
    request: { media_type: 'image', max_count: 1, confirm_spend: true, dry_run: false, command_hint: '下一步' },
    expected: 'DENY',
  },
  {
    name: 'command="run next" → DENY',
    request: { media_type: 'image', max_count: 1, confirm_spend: true, dry_run: false, command_hint: 'run next' },
    expected: 'DENY',
  },

  // DENY: No confirm_spend
  {
    name: 'image + confirm_spend=false → DENY',
    request: { media_type: 'image', max_count: 1, confirm_spend: false, dry_run: false, command_hint: 'explicit command' },
    expected: 'DENY',
  },

  // DENY: Exceeds count limit
  {
    name: 'image + max_count=3 → DENY',
    request: { media_type: 'image', max_count: 3, confirm_spend: true, dry_run: false, command_hint: 'explicit command' },
    expected: 'DENY',
  },

  // DENY: Video disabled
  {
    name: 'video + confirm_spend=true → DENY',
    request: { media_type: 'video', max_count: 1, confirm_spend: true, dry_run: false, command_hint: 'explicit command' },
    expected: 'DENY',
  },

  // DENY: Music disabled
  {
    name: 'music + confirm_spend=true → DENY',
    request: { media_type: 'music', max_count: 1, confirm_spend: true, dry_run: false, command_hint: 'explicit command' },
    expected: 'DENY',
  },

  // DENY: No media_type
  {
    name: 'media_type=null → DENY',
    request: { media_type: null, max_count: 1, confirm_spend: true, dry_run: false, command_hint: 'explicit command' },
    expected: 'DENY',
  },

  // ALLOW_DRY_RUN: dry-run with all conditions
  {
    name: 'image + max_count=2 + confirm_spend=true + dry_run=true → ALLOW_DRY_RUN',
    request: { media_type: 'image', max_count: 2, confirm_spend: true, dry_run: true, command_hint: 'explicit command' },
    expected: 'ALLOW_DRY_RUN',
  },
  {
    name: 'image + max_count=1 + confirm_spend=true + dry_run=true → ALLOW_DRY_RUN',
    request: { media_type: 'image', max_count: 1, confirm_spend: true, dry_run: true, command_hint: 'explicit command' },
    expected: 'ALLOW_DRY_RUN',
  },

  // DENY: max_count=0
  {
    name: 'image + max_count=0 → DENY',
    request: { media_type: 'image', max_count: 0, confirm_spend: true, dry_run: false, command_hint: 'explicit command' },
    expected: 'DENY',
  },
];

function run() {
  console.log('\n=== Generation Guard Check (Phase 3C) ===\n');
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const result = evaluateGeneration(tc.request);
    const ok = result.decision === tc.expected;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${tc.name}`);
    if (!ok) {
      console.log(`       Expected: ${tc.expected}, Got: ${result.decision}`);
      console.log(`       Reason: ${result.reason}`);
      failed++;
    } else {
      passed++;
    }
  }

  console.log(`\n${passed}/${passed + failed} passed`);
  console.log(`Overall: ${failed === 0 ? 'PASS' : 'FAIL'}\n`);

  return failed === 0;
}

const ok = run();
process.exit(ok ? 0 : 1);
