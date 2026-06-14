# Phase 5C-2C-C2: Daily Digest Staged Plan Report

**Date:** 2026-06-14
**Phase:** 5C-2C-C2
**Status:** PASS ✅

---

## Summary

Phase 5C-2C-C2 establishes a **staged execution plan** for the daily digest workflow, separating collect → build → validate → send → timer into risk-assessed stages with explicit gates.

This phase remains **plan-only** — no real execution of collect/send/timer/generate/git.

---

## Stages

### Stage 1: Collect (Blocked)
- **status:** `blocked_real_execution`
- **reason:** External network collection; needs separate CQA_ALLOW_COLLECT gate
- **future gate:** CQA_ALLOW_COLLECT=1 + source health check pass
- **risk:** high

### Stage 2: Build Digest (Candidate)
- **status:** `dry_run_only_or_candidate`
- **reason:** Writes digest/status files; needs explicit future review
- **future gate:** Phase 5C-2C-C3+ review: digest build writes reports/ without collect/send/model
- **risk:** medium

### Stage 3: Validate Outputs (Executable)
- **status:** `executable_low_risk`
- **allowed scripts:**
  - `validate:daily-archive`
  - `dashboard:validate`
  - `dashboard:control:validate`
- **risk:** safe

### Stage 4: Send Telegram (Blocked)
- **status:** `blocked_real_execution`
- **reason:** Sends external Telegram message; requires CQA_ALLOW_TELEGRAM_SEND
- **future gate:** CQA_ALLOW_TELEGRAM_SEND=1 + digest sanitized + send-gate validated
- **risk:** high

### Stage 5: Timer Integration (Blocked)
- **status:** `blocked_real_execution`
- **reason:** Modifies or depends on systemd timer; not allowed here
- **future gate:** Phase 6+ timer governance review + manual systemd setup
- **risk:** danger

---

## Changes Made

### 1. dashboard/daily-digest-staged-plan.json (NEW)
- Staged plan configuration with 5 stages
- Each stage has: stage_id, label_zh, risk_level, current_execution_status, allowed_now, blocked_reason, future_gate_required, related_actions, expected_outputs
- Blocked categories: collect, send, timer, generate, git, build, deploy, release
- Allowed validation scripts: validate:daily-archive, dashboard:validate, dashboard:control:validate

### 2. scripts/daily-digest-staged-planner.ts (NEW)
- Reads staged plan JSON
- Reads control-catalog.json and control-execution-allowlist.json
- Returns structured staged plan JSON
- No command execution, no child_process, no exec/spawn, no network calls
- Pure read-only planner

### 3. scripts/control-server.ts
- Added GET `/api/daily-digest/staged-plan` endpoint
- Read-only, returns staged plan JSON
- Does not call runner, does not execute commands
- GET only (no POST)

### 4. dashboard/control.html
- Added "Daily Digest Staged Plan / 日报分阶段执行计划" module
- Shows 5 stages with color-coded status badges
- Summary cards: Total Stages, Executable, Blocked, Candidates
- Warning banner: "本阶段只展示 staged plan，不执行 collect/send/timer。"
- No collect/send/generate/timer buttons

### 5. scripts/validate-daily-digest-staged-plan.ts (NEW)
- Validates staged plan JSON validity
- Validates 5 stages present
- Validates collect/send/timer blocked
- Validates build digest is candidate
- Validates validation stage is executable
- Validates validation scripts in allowlist
- Validates planner does not use child_process/exec/spawn/network
- Validates server has GET /api/daily-digest/staged-plan
- Validates no secrets in planner code
- Validates package.json has validate:daily-digest-staged-plan script

### 6. package.json
- Added `validate:daily-digest-staged-plan` script

---

## Validation Results

All validation scripts pass:

| Script | Checks | Result |
|--------|--------|--------|
| validate:daily-digest-staged-plan | 21 | ✅ PASS |
| validate:control-workflow-execution | 26 | ✅ PASS |
| validate:control-workflows | 10 | ✅ PASS |
| validate:control-hardening | 15 | ✅ PASS |
| validate:control-low-risk-execution | 176 | ✅ PASS |
| dashboard:policy:validate | 35 | ✅ PASS |
| validate:sanitizer-secret-completeness | 36 | ✅ PASS |
| validate:sanitizer-false-positives | 25 | ✅ PASS |
| validate:telegram-sanitizer | 43 | ✅ PASS |
| validate:project-report-send | 11 | ✅ PASS |

**Total: 398/398 checks passed**

---

## Smoke Test Results

| Test | Result |
|------|--------|
| GET /api/daily-digest/staged-plan returns JSON | ✅ PASS |
| collect stage blocked | ✅ PASS |
| send stage blocked | ✅ PASS |
| timer stage blocked | ✅ PASS |
| validation stage executable | ✅ PASS |
| page contains staged plan module | ✅ PASS |

---

## Safety Model

- localhost-only: ✅
- token auth required: ✅
- confirmation phrase required: ✅ (for execution endpoints)
- audit logging: ✅
- rate limiting: ✅
- execution lock: ✅
- output redaction: ✅
- no secrets in env: ✅

---

## Model Call Status

- No model calls in this phase
- Model generation remains blocked in all stages

## Generated Media Status

- No media generated in this phase
- Media generation remains blocked in all stages

## Limitations

- Staged plan is read-only; no real execution of collect/send/timer/build
- Validation stage scripts are limited to 3 allowlist commands
- Future gates require manual review and env flag activation
- Timer integration is danger-level and will always require manual confirmation

## Next Phase Proposal

Phase 5C-2C-C3: Digest Build Candidate Review — evaluate whether stage 2 (build digest) can be promoted from dry_run_only_or_candidate to executable with additional constraints (no model, no send, no collect, writes only to reports/).

---

*Report generated by Phase 5C-2C-C2 validation pipeline.*
