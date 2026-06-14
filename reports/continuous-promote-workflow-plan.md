# Continuous Controlled Promote Workflow Plan

- Phase: 5C-2C-C5N-0
- Mode: continuous_promote_plan_only
- Generated at: 2026-06-14T23:42:15.512Z
- Continuous promote enabled: **false**
- Real promote allowed: **false**
- Production write allowed: **false**
- Telegram send allowed: **false**
- Required env gate: `CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1`
- Env gate satisfied (static, in this script): **false**
- Required confirm phrase: `PROMOTE DAILY DIGEST FROM SANDBOX`
- Backup retention days: 7
- Auto-rollback enabled: **false**
- Manual rollback supported: **true**
- Required human approval: **true**

## Workflow Stages

### detect_candidate_sandbox_run — 检测候选沙盒运行
- current_status: read_only_design
- allowed_now: true
- effective_status: **ready_now**
- preconditions_met: true
- requires_human_approval: false
- requires_env_gate: —
- writes_production: false
- future_enable_condition: always allowed (read-only scan of latest.json)

### run_output_validation — 运行沙盒输出校验
- current_status: read_only_design
- allowed_now: true
- effective_status: **ready_now**
- preconditions_met: true
- requires_human_approval: false
- requires_env_gate: —
- writes_production: false
- future_enable_condition: always allowed (reuses existing validator)

### run_diff_check — 运行 diff 检查
- current_status: read_only_design
- allowed_now: true
- effective_status: **ready_now**
- preconditions_met: true
- requires_human_approval: false
- requires_env_gate: —
- writes_production: false
- future_enable_condition: always allowed (reuses existing diff tooling)

### run_promote_readiness — 运行推送就绪度
- current_status: read_only_design
- allowed_now: true
- effective_status: **ready_now**
- preconditions_met: true
- requires_human_approval: false
- requires_env_gate: —
- writes_production: false
- future_enable_condition: always allowed (reuses existing readiness check)

### run_promote_gate — 运行推送门禁
- current_status: read_only_design
- allowed_now: true
- effective_status: **ready_now**
- preconditions_met: true
- requires_human_approval: false
- requires_env_gate: —
- writes_production: false
- future_enable_condition: always allowed (reuses existing promote gate)

### build_human_approval_pack — 生成人工审批包
- current_status: read_only_design
- allowed_now: true
- effective_status: **ready_now**
- preconditions_met: true
- requires_human_approval: false
- requires_env_gate: —
- writes_production: false
- future_enable_condition: always allowed (reuses C5M0 approval pack generator)

### wait_for_human_approval — 等待人工审批
- current_status: plan_only
- allowed_now: false
- effective_status: **blocked_by_design**
- preconditions_met: false
- missing_preconditions: human_approval:not_yet_implemented_in_c5n0
- requires_human_approval: true
- requires_env_gate: —
- writes_production: false
- blocked_reason: no_human_in_loop_yet
- future_enable_condition: future phase must implement human approval UI/CLI; not in C5N-0

### one_shot_promote — 受控推送（一次性）
- current_status: future_manual_gate
- allowed_now: false
- effective_status: **blocked_by_design**
- preconditions_met: false
- missing_preconditions: env_gate:CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1, human_approval:not_yet_implemented_in_c5n0
- requires_human_approval: true
- requires_env_gate: CQA_DAILY_DIGEST_CONTINUOUS_PROMOTE=1
- writes_production: true
- blocked_reason: design_only_no_continuous_enable
- future_enable_condition: requires both env gate AND human confirm phrase; even then, every run is one-shot (not a loop)

### post_promote_validation — 推送后校验
- current_status: read_only_design
- allowed_now: true
- effective_status: **ready_now**
- preconditions_met: true
- requires_human_approval: false
- requires_env_gate: —
- writes_production: false
- future_enable_condition: always allowed (reuses existing post-promote validators)

### rollback_if_human_approved — 人工授权后回滚
- current_status: future_manual_gate
- allowed_now: false
- effective_status: **blocked_by_design**
- preconditions_met: false
- missing_preconditions: env_gate:CQA_DAILY_DIGEST_AUTO_ROLLBACK=1, human_approval:not_yet_implemented_in_c5n0
- requires_human_approval: true
- requires_env_gate: CQA_DAILY_DIGEST_AUTO_ROLLBACK=1
- writes_production: true
- blocked_reason: auto_rollback_disabled_by_default
- future_enable_condition: requires BOTH env gate (off by default) AND human confirm phrase; auto-rollback is opt-in per environment

## Inputs (read-only scan)

- Latest sandbox run: `sandbox-2026-06-14-06-50-12`
- Latest promote history: `daily-digest-promote-sandbox-2026-06-14-06-50-12-20260614-223423.json`
- Approval pack present: true
- Rollback manifest present: true

## Next Eligible Stage

- detect_candidate_sandbox_run

## Blocked Stages

- wait_for_human_approval
- one_shot_promote
- rollback_if_human_approved

## Recommendation

continuous_promote_enabled=false (current). Planner ONLY produces a plan and a UI-readable status. No dispatch is generated. To enable, a future phase would set the env gate, document the human-in-loop process, and add explicit UI for stage transitions.

## Blocked Actions

- automatic_production_write
- telegram_send
- timer
- collect
- generate
- git
- unattended_promote
- auto_rollback
- media_generation
- model_call

## Safety Constraints (verified)

- no_child_process: true
- no_exec_spawn: true
- no_env_read: true
- no_control_local_read: true
- no_network_calls: true
- no_production_writes: true
- no_timer: true
- no_telegram_send: true
- output_redacted: true