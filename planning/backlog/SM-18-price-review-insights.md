---
id: SM-18
title: Price Review & Insights — reporting views
type: ticket
points: 5
status: todo
depends_on: [SM-07, SM-12]
supersedes: SM-16
tags: [backlog, dashboard, analytics, reporting, frontend]
---
# SM-18 — Price Review & Insights (reporting views)

> **Supersedes SM-16** ("analytics with a new name"). The other session already
> started `dashboard/src/pages/AnalyticsPage.tsx` + `AIChatPanel` — fold this
> scope into that surface, don't build a parallel one. Rename it **Price Review
> & Insights**.

## Goal
Automate the quarterly comparison currently done by hand in the MMR sheet:
weekly prices → period averages → period-over-period deltas → % change with
color-coding and a bar chart → flags where a **price adjustment** may be
warranted.

## Aggregation layer (foundation)
- Roll weekly records up to **monthly** and **quarterly** averages per commodity.
- Compute period-over-period **MoM** and **QoQ** absolute Δ and **% change**.
- **String normalization:** prices are stored as text (often ranges like
  `47,500 - 46,500`) — parse to a numeric midpoint for math/display, keep the
  raw string as source of truth; a missing week is a **gap**, never a 0.

## Views / UX (mirror the sheet)
- **Quarterly review table** — rows = the 11 commodities (CRCA Bundle
  Mumbai/Chennai, Melting Foundry scrap, Fe Mn HC, Fe Si 70/75, Low Sulp Cal
  Petro Coke, FeSiMg, CU_LME, Cu, Fe Cr, Pig Iron Foundry Pune); columns = each
  month's average, Δ, and **% change**, color-coded, with a **"No Diff"** marker.
- **% change bar chart** (MoM) per commodity; per-commodity **trend** on row click.
- **Summary tiles:** commodities, flagged, watch, biggest mover.
- **Config + severity bands** (shared with SM-19): a global default threshold +
  **per-commodity overrides**, stored in a Firestore `review_config` (admin-
  editable). Bands e.g. `Watch 3–5%`, `Review 5–8%`, `Urgent >8%`.
- **Seasonal-aware flag** (uses SM-20's seasonal index when available; falls
  back to fixed % when history is thin — see SM-20's graceful-degradation rule).
- **States:** empty, loading (skeleton), partial (gaps as breaks, not zeros).

## Acceptance (TDD)
- Monthly/quarterly averages and % change compute correctly from seeded weekly
  data; range values normalized per rule; missing weeks render as gaps.
- Threshold/severity flagging correct; per-commodity overrides honored.
- Responsive per SM-23 (mobile/tablet/desktop).

## Notes
Read-only over pipeline output + `review_config`. Data source decision (read
sheet on demand vs a Firestore mirror written at append time) is shared with
SM-20 — pick one, document it.
