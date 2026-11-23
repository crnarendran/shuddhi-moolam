---
id: SM-69
title: Guidance 3-Month Forecasting with Confidence Bands
type: ticket
status: shipped
points: 3
assigned_to: sm-orchestrator
depends_on: [SM-33, SM-61]
created_at: 2026-11-23
tags: [dashboard, guidance, forecasting]
---

# SM-69: Short-Horizon Forecasting with Confidence Bands

## Context & Goal
`SM-33` shipped seasonal buy-timing and baseline comparison on the Guidance page, and `SM-67` added interactive What-If simulation. Buyers also requested a short-horizon (3-month) forecast of blended material cost with explainable confidence bands and an accuracy/backtest check before relying on purchasing advice (`SM-34`).

## Implementation
1. **Pure Forecasting Engine (`dashboard/src/lib/forecast.ts`)**:
   - Implemented damped Holt linear trend (`MIN_HISTORY_MONTHS = 6`, `ALPHA = 0.4`, `BETA = 0.2`, `PHI = 0.85`, `Z_80 = 1.2816`) with chronological `YYYY-MM` sorting and pure integer `addMonths` arithmetic.
   - Computes rolling-origin 1-step-ahead backtest metrics (`t >= 3`): `mae`, `mape`, `sigma`, and `rating` (`high` `<= 5%`, `moderate` `<= 12%`, `low` `> 12%`), generating `sqrt(h)`-widening 80% confidence intervals clamped at `0`.
2. **Guidance Page Integration (`dashboard/src/pages/GuidancePage.tsx`)**:
   - Single-material `Blended cost over time` chart overlays the 3-month dashed forecast bridge and shaded 80% confidence interval band (`stack: 'forecast-band'`, tooltips disabled on band helper series).
   - Added a compact `3-month forecast` section in `MaterialCard` (3-month target + range, signed `%` change vs latest actual month, backtest `±₹ MAE · MAPE% · rating` badge, monthly breakdown, and `< 6` months fallback notice) plus updated chart disclaimer.
3. **Tests (`dashboard/src/lib/forecast.test.ts`)**:
   - 12 Vitest specs covering `addMonths`, `< 6` points / non-finite / malformed key handling, `horizon <= 0`, flat/rising/falling clamping (`+0`), noisy `sqrt(h)` bands & MAPE tiers, unsorted keys, and all-zero series.

## Acceptance Criteria
- [x] Rolling-origin backtest computes explainable MAE, MAPE, and confidence rating before projecting 3 months ahead.
- [x] Confidence bands widen with horizon (`sqrt(h)`), clamp at `0`, and render cleanly on the single-material Guidance chart.
- [x] Local gates pass (`dashboard`: `7/7` files, `84/84` tests, `oxlint` 0 errors, `tsc -b && vite build` exit 0) and Reviewer (`pro`) returned `VERDICT: PASS`.
