#!/usr/bin/env bash
set -euo pipefail

# Sends a Control Room delta JSON file to the Delta Inbox API.
#
# Usage:
#   CONTROL_ROOM_TOKEN="..." ./tools/send_delta.sh ./deltas/my-delta.json https://theta-control-room-automation.<your-subdomain>.workers.dev
#
# Or once you attach a custom domain:
#   CONTROL_ROOM_TOKEN="..." ./tools/send_delta.sh ./deltas/my-delta.json https://api-control.theta.audio

DELTA_FILE="${1:-}"
API_BASE="${2:-}"

if [[ -z "$DELTA_FILE" || -z "$API_BASE" ]]; then
  echo "Usage: CONTROL_ROOM_TOKEN=... $0 path/to/delta.json https://api-host"
  exit 1
fi

if [[ -z "${CONTROL_ROOM_TOKEN:-}" ]]; then
  echo "Missing CONTROL_ROOM_TOKEN environment variable."
  exit 1
fi

curl -sS -X POST "$API_BASE/api/delta" \
  -H "Authorization: Bearer $CONTROL_ROOM_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "@$DELTA_FILE"
echo
