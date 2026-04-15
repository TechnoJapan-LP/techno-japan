#!/bin/bash
# Festival date auto-updater — runs every 2 weeks via cron.
# Searches for updated festival dates and applies changes to
# Google Spreadsheet + data.js.
#
# Cron entry (every other Monday at 10:00 AM):
#   0 10 */14 * * /Users/shibatatatsuya/Documents/GitHub/techno-japan/LP/update_festivals.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$SCRIPT_DIR/update_festivals.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Cron: starting festival update ===" >> "$LOG_FILE"

cd "$SCRIPT_DIR"

# Ensure PATH includes python3
export PATH="/usr/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

python3 update_festivals.py update >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Cron: done ===" >> "$LOG_FILE"
