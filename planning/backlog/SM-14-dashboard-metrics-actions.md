---
id: SM-14
title: Monitoring dashboard — metrics & reprocess actions
type: ticket
points: 3
status: todo
depends_on: [SM-13, SM-08]
tags: [backlog, dashboard, frontend, ops]
---
# SM-14 — Monitoring dashboard: metrics & reprocess actions

## Goal
Add the at-a-glance health summary and the one operational action operators
actually need — reprocess a file — on top of the live monitor (SM-13).

## Scope & UX

### Summary metrics (top of dashboard)
A row of stat tiles computed from `pipeline_runs` (respecting the active
filters/date range):
- **Processed** (count) · **Success rate** (% appended) · **Needs attention**
  (failed + dead-letter, red when > 0) · **Avg. latency** (detected→appended) ·
  **Gemini cost** (sum est. USD) · **This week** (files).
- A tiny 7-day sparkline of files/day is a nice-to-have, not required.

### Reprocess action
- On a `failed`/`dead_letter` file's detail view: a **Reprocess** button that
  calls a callable Cloud Function (from SM-08) to clear the run and re-trigger
  extraction for that `fileId`.
- **Confirm dialog** microcopy: "Reprocess MMRW27072026.pdf? This re-runs
  extraction and may append a row if it now succeeds." Buttons: *Reprocess* /
  *Cancel*.
- **States:** button shows a spinner + "Reprocessing…" while in flight; on
  success the row re-enters `detected` and advances live; on error, an inline
  toast with the reason. Guard against double-submit.

### Alerts surface
- Reflect SM-08's alerting: a dismissible banner when any run is `dead_letter`,
  linking to the failed filter. (Notifications themselves are SM-08; this just
  surfaces them.)

## Acceptance criteria
- Metric tiles compute correctly from seeded runs and update with filters.
- Reprocess calls the callable with the right `fileId`, is confirm-gated, shows
  in-flight/success/error states, and can't be double-fired.
- "Needs attention" tile + banner appear only when failures exist.

## Notes / escalation
Reprocess mutates via a callable Function (admin SDK) — the dashboard never
writes `pipeline_runs` directly (security rules forbid client writes). Access to
the callable is gated to allowlisted admins.
