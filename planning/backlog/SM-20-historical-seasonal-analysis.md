---
id: SM-20
title: Historical & seasonal analysis view
type: ticket
points: 5
status: todo
depends_on: [SM-15, SM-18]
tags: [backlog, analytics, reporting, seasonal, frontend]
---
# SM-20 — Historical & seasonal analysis view

## Goal
Tell whether a price move is **seasonal noise or a structural shift**, and
support supply-side timing (when to procure) — the key value-add for
manufacturing/procurement.

## Scope & UX
- **Multi-year overlay** — each commodity's monthly average charted Jan–Dec with
  one line per year plus a **seasonal-range band**, so seasonality is visible.
- **Seasonal index** — average MoM % change per calendar month; drives the
  "typical pattern" and the seasonal-aware thresholds in SM-18/SM-19.
- **Seasonal-vs-structural classification** — compare the current move to the
  seasonal norm (e.g. "June −5.2% vs norm −4.8%, z ≈ −0.3σ → seasonal").
- **Supply signal** — buy / hold / defer from trend + seasonality + position in
  the historical range (near floor + seasonally weak + Q4 recovery ahead → buy
  window).
- **Position-in-range** meter (current vs 2-yr floor/ceiling).

## Graceful degradation — resistant to short history (CRITICAL)
We currently have only ~2 years of data. The view MUST be useful and honest with
limited history:
- Works with **n ≥ 1 year**; norms computed from whatever years exist, never
  assumed.
- With **< 3 years**: label norms **"based on N years — low confidence,"** widen
  the seasonal band, and treat the z-score as a *directional hint*, not a hard
  trigger; the buy/hold/defer badge carries a matching confidence level.
- **Threshold fallback ladder:** a month with **< 2 historical observations**
  uses the plain fixed % threshold (SM-18/19); seasonal logic switches on
  per-commodity/per-month automatically as history accrues.
- Show **coverage** ("N years / M weeks"); never render missing months as 0.
- **SM-15 backfill** deepens history and confidence but does **not gate** the
  view — it's useful from day one with 2 years.

## Acceptance (TDD)
- YoY overlay, seasonal index, and classification compute correctly from seeded
  multi-year data.
- With 1–2 years seeded: low-confidence labels + band widening + fixed-threshold
  fallback all engage; no false precision, no crash.
- Responsive per SM-23.
