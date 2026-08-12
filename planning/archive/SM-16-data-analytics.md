---
id: SM-16
title: Analytics / reporting on extracted data
type: ticket
points: 5
status: todo
priority: later
depends_on: [SM-07, SM-12]
tags: [backlog, analytics, dashboard, frontend]
---
# SM-16 — Analytics / reporting on extracted data

> **Priority: later.** The immediate operational need (watching files process)
> is covered by the monitoring dashboard (SM-11–SM-14); this is trend reporting
> on the *prices themselves*, a distinct feature. Build after the pipeline +
> dashboard are stable.

## Goal
Let a user see how the tracked commodity prices move over time, without exporting
the sheet by hand — a small reporting view over the accumulated weekly records.

## Scope & UX
- A **reporting view** (a page in the dashboard app from SM-12, or a sibling
  surface) with:
  - a **metric selector** (Cu LME, Ferro Silicon 70–75%, CRCA Bundle Mumbai, …
    — the fields from `knowledge/domain_model.md`),
  - a **date-range / year** filter,
  - a **line chart** of the selected metric across issue dates, plus a
    latest-values snapshot table.
- **Data source:** decide and document one — read the master sheet via the
  Sheets API on demand, or maintain a queryable Firestore mirror written at
  append time (SM-07). A mirror scales better for charting; the sheet stays the
  system of record either way.
- **Value normalization:** prices are stored as strings (often ranges like
  `47,500 - 46,500`) — the chart layer must parse to a numeric (e.g. midpoint or
  low/high band) *for display only*, keeping the raw string as source of truth.
  Document the chosen rule; show a band, not a false single point, where a range
  exists.

## UX / states
- **Empty:** "No data yet for this metric — it appears once issues are
  processed." **Loading:** skeleton chart. **Partial:** gaps in the series shown
  as breaks, not zeros (a missing week is not a price of 0).

## Acceptance criteria
- Renders a correct time series for a chosen metric across processed issues
  (seeded data).
- Range values are normalized per the documented rule; missing weeks render as
  gaps, not zeros.
- Metric/date filters update the chart and snapshot.

## Notes
Read-only over pipeline output; adds no new pipeline dependencies beyond a data
source decision. If hosted in the dashboard app, reuses its auth/allowlist.
