#!/usr/bin/env bash
# THETA Control Room build hook snippet.
# Source or call this at the end of a plugin build script once CONTROL_ROOM_TOKEN and CONTROL_ROOM_API are set.
#
# Required env:
#   CONTROL_ROOM_TOKEN
#   CONTROL_ROOM_API
#
# Example:
#   export CONTROL_ROOM_API="https://api-control.theta.audio"
#   export CONTROL_ROOM_TOKEN="..."
#   ./tools/send_delta.sh ./control-room-delta.json "$CONTROL_ROOM_API"

set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-UNKNOWN}"
PROJECT_ID="${PROJECT_ID:-$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' _' '--')}"
PROJECT_VERSION="${PROJECT_VERSION:-Needs confirmation}"
PROJECT_STATUS="${PROJECT_STATUS:-blocked}"
PROJECT_ARTIFACT="${PROJECT_ARTIFACT:-}"
PROJECT_FORMATS_JSON="${PROJECT_FORMATS_JSON:-[\"VST3\",\"AU\"]}"
PROJECT_SHIP_READINESS="${PROJECT_SHIP_READINESS:-10}"
PROJECT_BLOCKER="${PROJECT_BLOCKER:-Needs test result.}"
PROJECT_NEXT_ACTION="${PROJECT_NEXT_ACTION:-Test latest build.}"

TMP_DELTA="$(mktemp /tmp/theta-control-delta.XXXXXX.json)"

cat > "$TMP_DELTA" <<JSON
{
  "schemaVersion": "1.0",
  "type": "build_hook_delta",
  "date": "$(date +%F)",
  "title": "THETA Control Room — Build Hook Delta",
  "mode": "Automated build-script update.",
  "allowNewProjects": false,
  "changedProjects": [
    {
      "id": "$PROJECT_ID",
      "changeType": "Build hook update",
      "status": "$PROJECT_STATUS",
      "latestVersion": "$PROJECT_VERSION",
      "shipReadiness": $PROJECT_SHIP_READINESS,
      "sourceCertainty": "high",
      "formatsNow": $PROJECT_FORMATS_JSON,
      "artifact": "$PROJECT_ARTIFACT",
      "lastKnownStatus": "Build hook reported latest project state.",
      "blocker": "$PROJECT_BLOCKER",
      "nextAction": "$PROJECT_NEXT_ACTION",
      "tomorrowFirstAction": "$PROJECT_NEXT_ACTION",
      "endStatus": "Build hook reported $PROJECT_NAME $PROJECT_VERSION."
    }
  ],
  "dashboardUpdateDecision": {
    "dashboardDataChanged": true,
    "tomorrowFirstControlRoomAction": "Review build-hook update for $PROJECT_NAME."
  }
}
JSON

# v3.8: attach optional ticketPacket if PROJECT_TICKETS_FILE is set (never fails the build)
if [[ -n "${PROJECT_TICKETS_FILE:-}" && -f "${PROJECT_TICKETS_FILE}" ]]; then
  python3 "$(dirname "$0")/_attach_ticketpacket.py" "$TMP_DELTA" "$PROJECT_TICKETS_FILE" "${PROJECT_VERSION:-}" || true
fi

./tools/send_delta.sh "$TMP_DELTA" "$CONTROL_ROOM_API"
rm -f "$TMP_DELTA"
