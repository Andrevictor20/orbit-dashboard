#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Orbit Dev Environment Resource Guard
# Prevents OOM freezes, checks available RAM, and cleans orphaned dev processes.
# ==============================================================================

echo "=== [Orbit Resource Guard] Checking System Memory ==="

# 1. Check Available Memory
AVAILABLE_MB=$(free -m | awk '/^Mem:/{print $7}')
TOTAL_MB=$(free -m | awk '/^Mem:/{print $2}')
USED_MB=$(free -m | awk '/^Mem:/{print $3}')

echo "Memory: ${USED_MB}MB used / ${TOTAL_MB}MB total (${AVAILABLE_MB}MB available)"

if [ "$AVAILABLE_MB" -lt 1024 ]; then
  echo "⚠️  WARNING: Available RAM is critically low (< 1024 MB)!"
  echo "Running heavy compilation or testing now might trigger the Linux OOM Killer."
else
  echo "✅ Memory health is adequate for development tasks."
fi

# 2. Check for lingering dev processes consuming high memory
echo ""
echo "=== Top 5 Memory Consuming Processes ==="
ps -eo pid,ppid,%mem,%cpu,comm,args --sort=-%mem | head -n 6

# 3. Optional cleanup flag
if [ "${1:-}" = "--clean-orphans" ]; then
  echo ""
  echo "=== Cleaning orphaned node/oxlint dev processes ==="
  # Kill stalled oxlint or rogue node runners if any
  pkill -9 -f "oxlint" 2>/dev/null || true
  echo "Cleanup finished."
fi
