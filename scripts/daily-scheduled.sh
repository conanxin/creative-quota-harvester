#!/bin/bash
# daily-scheduled.sh — Phase 4C-5
# Scheduled wrapper for daily digest. Does NOT call MiniMax.
# Logs to logs/daily-scheduled.log
# Handles partial collect failures gracefully.
#
# Phase 4C-5: Uses collect:fresh:fast by default.
# - fast profile: 4 high-value queries/filters, low concurrency, daily fit
# - if fast fails (zero sources OK), fallback to old data + WARN
# - does NOT call MiniMax, does NOT generate new media

set -uo pipefail

PROJECT_DIR="/home/ubuntu/.openclaw/workspace/projects/creative-quota-harvester"
LOG_FILE="$PROJECT_DIR/logs/daily-scheduled.log"
TIMESTAMP=$(date '+%Y-%m-%dT%H:%M:%S%z')

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

cd "$PROJECT_DIR"

# Profile selection — default fast for daily 07:30 schedule
# CQA_PROFILE env var can override (e.g. set to "full" for manual deep refresh)
PROFILE="${CQA_PROFILE:-fast}"
COLLECT_CMD="npm run collect:fresh:fast"

if [ "$PROFILE" != "fast" ]; then
    COLLECT_CMD="CQA_PROFILE=$PROFILE npm run collect:fresh"
fi

log "=== Scheduled Daily Digest Run Started ==="
log "Project: creative-quota-harvester"
log "Profile: $PROFILE"
log "Command: $COLLECT_CMD + digest:telegram"

# Step 1: Force fresh collect (allow partial failure)
COLLECT_EXIT=0
if CQA_PROFILE="$PROFILE" npm run collect:fresh >> "$LOG_FILE" 2>&1; then
    log "Collect: SUCCESS (or PARTIAL)"
else
    COLLECT_EXIT=$?
    log "Collect: PARTIAL/FAIL (exit code: $COLLECT_EXIT) — continuing to digest"
fi

# Read source health to determine if at least 3 sources OK or skipped_cooldown
HEALTH_FILE="$PROJECT_DIR/reports/source-health.json"
SOURCES_OK=0
SOURCES_COOLDOWN=0
SOURCES_FAILED=0
if [ -f "$HEALTH_FILE" ]; then
    SOURCES_OK=$(python3 -c "import json; d=json.load(open('$HEALTH_FILE')); print(sum(1 for s in d.get('sources',[]) if s.get('status') in ('success','partial')))" 2>/dev/null || echo 0)
    SOURCES_COOLDOWN=$(python3 -c "import json; d=json.load(open('$HEALTH_FILE')); print(sum(1 for s in d.get('sources',[]) if s.get('status') == 'skipped_cooldown'))" 2>/dev/null || echo 0)
    SOURCES_FAILED=$(python3 -c "import json; d=json.load(open('$HEALTH_FILE')); print(sum(1 for s in d.get('sources',[]) if s.get('status') in ('timeout','failed')))" 2>/dev/null || echo 0)
fi

log "Sources OK=$SOURCES_OK, Cooldown=$SOURCES_COOLDOWN, Failed=$SOURCES_FAILED"

# Step 2: Generate digest regardless of collect result (fallback to old data)
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
log "collect_exit=$COLLECT_EXIT digest_exit=$DIGEST_EXIT sources_ok=$SOURCES_OK cooldown=$SOURCES_COOLDOWN failed=$SOURCES_FAILED"
log ""
