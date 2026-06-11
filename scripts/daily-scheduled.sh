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

log "=== Scheduled Daily Digest Run Complete ==="
log ""
