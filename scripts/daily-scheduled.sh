#!/bin/bash
# daily-scheduled.sh — Phase 4C-4
# Scheduled wrapper for daily digest. Does NOT call MiniMax.
# Logs to logs/daily-scheduled.log
# Handles partial collect failures gracefully.

set -uo pipefail

PROJECT_DIR="/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester"
LOG_FILE="$PROJECT_DIR/logs/daily-scheduled.log"
TIMESTAMP=$(date '+%Y-%m-%dT%H:%M:%S%z')

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

cd "$PROJECT_DIR"

log "=== Scheduled Daily Digest Run Started ==="
log "Project: creative-quota-harvester"
log "Command: npm run collect:fresh + digest:telegram"

# Step 1: Force fresh collect (allow partial failure)
COLLECT_EXIT=0
if npm run collect:fresh >> "$LOG_FILE" 2>&1; then
    log "Collect: SUCCESS (or PARTIAL)"
else
    COLLECT_EXIT=$?
    log "Collect: PARTIAL/FAIL (exit code: $COLLECT_EXIT) — continuing to digest"
fi

# Step 2: Generate digest regardless of collect result
DIGEST_EXIT=0
if npm run digest:telegram >> "$LOG_FILE" 2>&1; then
    log "Digest: SUCCESS"
else
    DIGEST_EXIT=$?
    log "Digest: FAIL (exit code: $DIGEST_EXIT)"
fi

# Step 3: Validate digest freshness
if npm run validate:digest-freshness >> "$LOG_FILE" 2>&1; then
    log "Validate freshness: PASS"
else
    log "Validate freshness: FAIL"
fi

# Step 4: Validate telegram sanitizer
if npm run validate:telegram-sanitizer >> "$LOG_FILE" 2>&1; then
    log "Validate sanitizer: PASS"
else
    log "Validate sanitizer: FAIL"
fi

# Phase 4C-1: Optional auto-send via current OpenClaw Telegram bot
# Only sends if .env.telegram.local exists and CQA_ALLOW_TELEGRAM_SEND=1
ENV_LOCAL="$PROJECT_DIR/.env.telegram.local"
if [ -f "$ENV_LOCAL" ]; then
    # Source env (token not logged)
    set +u
    set -a
    . "$ENV_LOCAL"
    set +a
    if [ "${CQA_ALLOW_TELEGRAM_SEND:-0}" = "1" ]; then
        log "Telegram auto-send: ENABLED — sending digest"
        if CQA_ALLOW_TELEGRAM_SEND=1 npm run digest:send:confirmed >> "$LOG_FILE" 2>&1; then
            log "Telegram send: SUCCESS"
        else
            SEND_EXIT=$?
            log "Telegram send: FAIL (exit code: $SEND_EXIT) — will retry next run"
        fi
    else
        log "Telegram auto-send: DISABLED (CQA_ALLOW_TELEGRAM_SEND!=1)"
    fi
    set -u
else
    log "Telegram env missing; digest generated only (no auto-send)"
fi

log "=== Scheduled Daily Digest Run Complete ==="
log "collect_exit=$COLLECT_EXIT digest_exit=$DIGEST_EXIT"
log ""
