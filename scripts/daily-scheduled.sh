#!/bin/bash
# daily-scheduled.sh — Phase 4B-0
# Scheduled wrapper for daily digest. Does NOT call MiniMax.
# Logs to logs/daily-scheduled.log

set -euo pipefail

PROJECT_DIR="/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester"
LOG_FILE="$PROJECT_DIR/logs/daily-scheduled.log"
TIMESTAMP=$(date '+%Y-%m-%dT%H:%M:%S%z')

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

cd "$PROJECT_DIR"

log "=== Scheduled Daily Digest Run Started ==="
log "Project: creative-quota-harvester"
log "Command: npm run daily:manual"

# Run digest pipeline (data is assumed fresh from prior manual runs)
# collect + briefs are resource-intensive; run them separately when needed
if npm run digest:telegram >> "$LOG_FILE" 2>&1; then
    log "Result: SUCCESS"
else
    EXIT_CODE=$?
    log "Result: FAIL (exit code: $EXIT_CODE) — continuing without restart"
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
log ""
