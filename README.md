# THETA Control Dashboard v2 — Focus Mode

Static dashboard for THETA Audio Research project tracking.

## Files

- `index.html` — dashboard UI
- `data/projects.json` — project tracker data

## Deploy

Upload/commit these files to the root of the Vercel-connected GitHub repo.

Expected repo shape:

```text
theta-control-dashboard/
  index.html
  data/
    projects.json
  README.md
```

Then push to `main`. Vercel should redeploy automatically.

## Daily update rule

Only touched projects need end-of-day updates.

The dashboard is intentionally designed to show:
- Top 3 priorities
- Blocked/waiting items
- Decisions needed
- Ignore-today projects
- Full tracker only when requested
