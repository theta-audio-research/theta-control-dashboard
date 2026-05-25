# THETA Control Room v3.0 — Delta Inbox Automation

## Goal

Make Control Room update multiple times per day without manual ZIP replacement.

## Automated after setup

1. Plugin/build scripts can POST delta JSON to `/api/delta`.
2. Worker updates `data/projects.json` in GitHub.
3. Worker archives the delta into `deltas/`.
4. Worker writes a markdown report into `reports/`.
5. GitHub commit triggers Cloudflare redeploy.
6. Worker scheduled checkpoints run at the configured local times.

## Schedule

Requested local times:

- 6 AM
- 9 AM
- 12 PM
- 2 PM
- 4 PM
- 11 PM

The Worker runs an hourly Cloudflare Cron Trigger and checks local time in `America/Los_Angeles`.
This avoids hardcoding UTC offsets and handles daylight-saving-time changes more safely.

Cloudflare Workers support Cron Triggers through a `scheduled()` handler, and Wrangler secrets are stored with `wrangler secret put`. GitHub file updates are performed through the repository contents API.

## Endpoint

```text
POST /api/delta
Authorization: Bearer <CONTROL_ROOM_TOKEN>
Content-Type: application/json
```

## Health check

```text
GET /api/health
```

## Manual checkpoint

```text
POST /api/checkpoint
Authorization: Bearer <CONTROL_ROOM_TOKEN>
```

## Required Cloudflare Worker secrets

```bash
cd control-room-worker
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put CONTROL_ROOM_TOKEN
```

## GitHub token

Use a fine-grained GitHub personal access token restricted to:

```text
Repository: theta-audio-research/theta-control-dashboard
Permissions:
  Contents: Read and write
  Metadata: Read
```

Do not put the token in source code or in the browser.

## Deploy Worker

```bash
cd control-room-worker
npm install
npx wrangler deploy
```

## Test API

```bash
export CONTROL_ROOM_TOKEN="your-token"
export CONTROL_ROOM_API="https://theta-control-room-automation.<your-subdomain>.workers.dev"

curl "$CONTROL_ROOM_API/api/health"

./tools/send_delta.sh control-room-worker/examples/example-delta.json "$CONTROL_ROOM_API"
```

## Add to plugin builds later

Add a build hook that emits:

- project id
- version
- formats
- artifact
- status
- blocker
- next action
- ship readiness

See:

```text
tools/control_room_build_hook_snippet.sh
```

## Important limitation

This does not magically read ChatGPT/Claude/Gemini consumer chats.
Those systems must emit structured delta JSON or the build tools must emit events.
