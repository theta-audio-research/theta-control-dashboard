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


## v2.1 update

- Added ascending/descending sorting to all Tracker table headers.
- Click Project, Version, Status, Next, Blocker, Formats, or Confidence to sort.
- Clicking the same header again toggles direction.
- Updated CREOSOTE to remove Claude CREOSOTE as active source of truth.


## v2.2 update

- Updated HIERARCHY source of truth.
- Claude HIERARCHY is now archived/reference only.
- Active HIERARCHY work moves into the ChatGPT Control Room workflow.
- HIERARCHY remains in decision state until POC scope and branding are confirmed here.


## v2.3 update — corrected Control Room delta sweep

- Corrected the Control Room sweep model to use all visible ChatGPT-side project deltas, not only the current Control Room thread.
- Updated CREOSOTE from pending migration to ChatGPT-side v18.8.6 visual alignment pass.
- Updated HIERARCHY as ChatGPT migration / decision state.
- Updated FOCUSGRID to v0.3.1 sidechain DSP compile fix and test-needed state.
- Updated PRISM FORM to v1.4 baseline / v1.5 Safe Playable Engine Pass requested.
- Updated SCENEMATCH to v0.1.4 signing/install fix and verification-needed state.
- Updated FOLEY ENGINE from host-visibility blocker to sound-realism/reference-calibration blocker.


## v2.4 update — confidence split

- Fixed misleading Confidence column.
- Previous Confidence value represented tracker evidence/source certainty, not product trust/readiness.
- Added `productConfidence` for actual confidence/readiness in the plugin itself.
- Added `sourceCertainty` for evidence quality / how reliable the tracker row is.
- Added `stage` to show whether a project is active product, early prototype, wireframe, pre-POC, historical, etc.
- Tracker table now sorts by Stage, Product Confidence, and Evidence separately.


## v2.5 update — Ship Readiness

- Replaced user-facing Product Confidence column with Ship Readiness.
- Ship Readiness is a 0–100 progress score:
  - 0–19: Just begun / buggy / unproven
  - 20–39: Prototype
  - 40–64: Active build
  - 65–84: Beta / close
  - 85–100: Shippable
- Tracker table now displays a visual progress bar and sorts by Ship Readiness.
- Evidence remains separate and still means how reliable the tracker row/source data is.


## v2.6 update — End-of-night 2026-05-24

- Added end-of-night delta report at `reports/end-of-night-2026-05-24.md`.
- Updated tomorrow Focus Mode priorities to CREOSOTE, FOCUSGRID, and PRISM FORM.
- Recorded changed projects: CREOSOTE, HIERARCHY, FOCUSGRID, PRISM FORM, SCENEMATCH, FOLEY ENGINE.
- Left unchanged projects alone.
- Added `lastControlRoomSweep` metadata to `data/projects.json`.
