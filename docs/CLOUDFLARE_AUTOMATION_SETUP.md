# Cloudflare Setup — THETA Control Room Automation Worker

## 1. Commit v3.0 files

Commit this package to the `theta-control-dashboard` repo.

## 2. Deploy the automation Worker

From your local clone:

```bash
cd control-room-worker
npm install
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put CONTROL_ROOM_TOKEN
npx wrangler deploy
```

## 3. Optional custom domain

Add a custom domain for the automation API, for example:

```text
api-control.theta.audio
```

Do not expose the token. The endpoint still requires the bearer token.

## 4. Verify schedule

The Worker cron runs hourly, but only writes checkpoints at:

```text
6 AM, 9 AM, 12 PM, 2 PM, 4 PM, 11 PM America/Los_Angeles
```

Checkpoint files are written to:

```text
reports/checkpoints/
```

## 5. Verify GitHub redeploy

After a delta is posted, the Worker commits to GitHub.
Cloudflare should redeploy the dashboard automatically from the GitHub commit.
