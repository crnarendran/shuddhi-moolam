---
id: SM-25
title: File monitor display fixes — filename + year→tab label
type: ticket
points: 2
status: in-review
depends_on: [SM-11, SM-13, SM-06]
tags: [backlog, bug, dashboard, ux]
---
# SM-25 — File monitor display fixes

## Resolution (2026-08-02)
- **Filename:** fixed — `process.ts` now sets `fileName` on the run at the
  `extracting` stage (from `downloadPdf`), which the FileMonitor `FILE` column
  reads. It was never written before (webhook wrote only fileId/status).
- **Year → Tab:** NOT a bug — the pipeline names year tabs just `<year>`
  (e.g. `2026`), so `FileMonitor`'s `year → targetTab` correctly renders
  `2026 → 2026`. Left as-is.

> Small display bugs in the live file monitor (SM-13). Fold into the other
> session's `FileMonitor` + pipeline telemetry.

## Symptom (observed on staging 2026-08-01)
- **`FILE` column is blank** — every row shows only a generic doc icon, no
  filename.
- **`YEAR → TAB` reads "2026 → 2026"** — it should show the actual destination
  tab name, e.g. **"2026 → Data_2026"**.

## Root causes (to confirm)
1. **Filename:** the Drive `fileName` isn't stored on `pipeline_runs` (schema has
   `filename` optional) and/or the `FileMonitor` row doesn't render it.
2. **Tab label:** the cell renders `year → year` instead of `year → targetTab`;
   the routing tab name (`Data_<year>`, SM-06) isn't persisted or isn't used in
   the cell.

## Scope
- **Pipeline:** persist `fileName` (from the Drive metadata) and `targetTab`
  (e.g. `Data_2026`, from SM-06 routing) on `pipeline_runs`.
- **Dashboard (`FileMonitor`):** render `fileName` in the `FILE` column; render
  the real tab name in `YEAR → TAB` (`2026 → Data_2026`).
- **Fallbacks:** if `fileName` is missing, show the `fileId` (or `—`), not a
  blank cell.

## Acceptance (TDD)
- A seeded run with `fileName` + `targetTab` renders the filename in `FILE` and
  `2026 → Data_2026` in `YEAR → TAB`.
- A run missing `fileName` falls back to `fileId`/`—` without a blank cell.
- Responsive per SM-23.
