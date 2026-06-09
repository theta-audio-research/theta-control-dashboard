#!/bin/bash
# Stable CATHODE Control Room reporter. Per-version stub delegates here.
# Usage: cathode_build_report.sh <build_tree_root> [build|install|package|manual-hook-test]
set +e
TREE="${1:-$PWD}"
EVENT="${2:-build}"
DASH="$HOME/Documents/theta-control-dashboard"

[ -f "$HOME/.theta/control_room.env" ] && . "$HOME/.theta/control_room.env" 2>/dev/null
export CONTROL_ROOM_API="https://theta-control-room-automation.steveneal.workers.dev"
[ -n "${CONTROL_ROOM_TOKEN:-}" ] || { echo "Control Room report skipped: no token."; exit 0; }
[ -x "$DASH/tools/control_room_build_hook_snippet.sh" ] || { echo "Control Room report skipped: hook missing."; exit 0; }

VERSION=""
[ -f "$TREE/CMakeLists.txt" ] && VERSION="$(sed -n 's/.*project(CATHODE VERSION \([0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' "$TREE/CMakeLists.txt" 2>/dev/null | head -1)"
VERSION="${VERSION:-unknown}"

[ -f "$DASH/tools/projects/cathode.sh" ] && . "$DASH/tools/projects/cathode.sh"
export PROJECT_NAME="${PROJECT_NAME:-CATHODE}"
export PROJECT_ID="${PROJECT_ID:-cathode}"
export PROJECT_VERSION="v${VERSION}"
export PROJECT_STATUS="active"
export PROJECT_SHIP_READINESS="${CONTROL_ROOM_SHIP_READINESS:-80}"
export PROJECT_BLOCKER="${CONTROL_ROOM_BLOCKER:-none}"
case "$EVENT" in
  install) export PROJECT_NEXT_ACTION="Verify host visibility, version string, preset and session recall, audio stability." ;;
  package) export PROJECT_NEXT_ACTION="Install the DMG, verify branding, then run smoke and Deep QA tickets." ;;
  *)       export PROJECT_NEXT_ACTION="Run CATHODE smoke tests and Deep QA ticket folders." ;;
esac

( cd "$DASH" && ./tools/control_room_build_hook_snippet.sh ) || echo "Control Room reporting failed; continuing build."
exit 0
