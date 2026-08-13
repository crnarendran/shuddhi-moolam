---
type: ticket
id: SM-50
tags: [planning, dashboard, ux, reporting]
status: in-review
points: 1
depends_on: [SM-18, SM-45]
---
# SM-50 — 1-decimal price precision across reports

## Problem
The Guidance report rounded prices to whole rupees — the blended-cost tiles
(`fmt` used `maximumFractionDigits: 0`) and the cost-over-time chart line +
baseline marker (`toFixed(0)`). On the ₹/kg scale (~63.2) that loses real
precision. Other reports already showed 1 decimal, but each page defined its
own `fmt`, so precision could (and did) drift per page.

## Decision (user-approved)
Show prices to **1 decimal place everywhere applicable**, and consolidate so it
can't drift again. Percentages and σ keep their existing decimals (not prices).

## Scope
- New `dashboard/src/lib/format.ts`: single `fmtNum(n, digits = 1)` — 1 decimal
  by default, locale grouping, null → em dash.
- PriceReview, Spreads, CostImpact, Guidance, Companies: drop the per-page `fmt`
  and import `{ fmtNum as fmt }` (call sites unchanged; CostImpact keeps its
  2-decimal calls via the `digits` arg).
- Guidance chart: line data + baseline markLine `toFixed(0)` → `toFixed(1)`;
  add a tooltip `valueFormatter` so hovering shows e.g. `63.2`.

## Notes
- Net behaviour change is Guidance only (0 → 1 dp); the other pages were already
  1 dp and are now just sourced from the shared helper.
- Seasonal's YoY overlay already carried decimals — untouched.

## Tests
Dashboard tsc + oxlint clean; 26/26 vitest pass. Manual: Guidance tiles, line,
baseline, and tooltip show 1 decimal.
