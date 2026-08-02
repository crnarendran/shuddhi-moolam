---
id: SM-13
title: Monitoring dashboard — live file monitor & detail
type: ticket
points: 5
status: in-review
depends_on: [SM-12]
tags: [backlog, dashboard, frontend]
---
# SM-13 — Monitoring dashboard: live file monitor & detail

## Goal
The core view: a live, per-file table of everything dropped into the Drive
folder and exactly where each file is in the pipeline, plus a drill-in detail.

## Scope & UX

### Live file table (default view)
- Real-time (`onSnapshot`) list of `pipeline_runs`, newest first.
- Columns: **File** (`fileName`), **Detected** (relative time, e.g. "3m ago"),
  **Status** (badge), **Year → Tab** (`2026 → Data_2026`), **Duration**,
  **Attempts**.
- **Status badges** (label + color): `Detected` (grey) · `Extracting` (blue,
  animated) · `Validating` (blue) · `Routing` (blue) · `Appended` (green) ·
  `Failed` (red) · `Dead-letter` (amber). In-progress statuses pulse so a stuck
  file is visible.
- **Filters:** status (multi), year, and a date range; a text search on
  `fileName`. Filter state in the URL so a view is shareable.
- **Empty state:** "No files processed yet — drop a PDF into the watched Drive
  folder and it'll appear here." (link the folder).
- **Failed-first affordance:** a top strip "N files need attention" when any are
  `failed`/`dead_letter`, linking to that filter.

### Per-file detail (row click → drawer/route)
- **Stage timeline** from `stages`: Detected → Downloaded → Extracted →
  Validated → Routed → Appended, each with timestamp + ✓/✗/⏳.
- **Extracted preview:** the `extractSummary` key fields, and the
  `appendedRange` as a deep link into the master sheet when `appended`.
- **On failure:** the failing stage, `error.message`/`code`, and `attempts`,
  in a red callout. (The reprocess button lands in SM-14.)
- **Cost line:** Gemini tokens + est. cost for the run.

## Acceptance criteria
- Dropping a file causes a row to appear and advance through statuses live
  (against seeded `pipeline_runs` in tests).
- Filters and search narrow the list; empty and failed states render correctly.
- Detail view renders the full stage timeline and, on failure, the error.

## Notes
Reads only — no mutations here (reprocess/actions are SM-14). All data comes
from `pipeline_runs` (SM-11); do not re-derive status client-side.
