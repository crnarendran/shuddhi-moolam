---
id: SM-26
title: Cost-impact analysis — consumption-weighted quarterly view
type: ticket
points: 5
status: in-review
depends_on: [SM-18, SM-20]
tags: [backlog, analytics, reporting, cost-impact, frontend]
---
# SM-26 — Cost-impact analysis (consumption-weighted)

## Goal
Translate quarterly commodity price movements into the **actual cost impact on
the manufactured product** — "prices moved X, so our product cost changes by Y
per kg" — so a sell-price adjustment is grounded in margin, not just price %.
This is a **separate view** from the Price Review dashboard (SM-18): it needs a
new input (consumption weights) and produces a different output (cost impact).

## What it reproduces (from the MMR analysis sheet)
- **Q1–Q4 averages** per commodity, each compared to a **rolling baseline**
  (decided 2026-08-01 — see below), giving a **difference** per quarter.
- **Nett difference across the 4 quarters** (annual net price change) per
  commodity.
- **Impact Per Kg** = annual net change × the commodity's **consumption weight**
  (kg of that commodity per kg/unit of product).
- **Sum of Impact** = Σ Impact Per Kg across commodities (the headline: total
  product cost impact, e.g. −5.85).

## Baseline: ROLLING (decided 2026-08-01)
Use a **rolling baseline**, not the fixed prior-year quarter the sample sheet
used. Default = the **trailing 4-quarter (TTM) moving average**, recomputed each
period, so each quarter's difference is measured against the recent trend
(smooths seasonality). The window is **configurable** (e.g. trailing 4 vs prior
quarter) in the same config as the weights. Confirm the exact window with the
user if TTM isn't what's meant.

## New input required (business data — escalate)
- A **consumption model / bill-of-materials**: per-commodity kg factor (how much
  of each commodity goes into a unit/kg of the product). **Not in the
  newsletter** — the user provides it. Store in an admin-editable Firestore
  `consumption_weights` config, plus the **rolling-baseline window** (default
  trailing 4 quarters — see Baseline above).
- The sheet tracks a **subset** of commodities (CRCA Scrap Mumbai, FeSiMg, FeSi
  70–75%, Fe Mn, Pig iron, Coke) — the view must let the user pick which
  commodities and weights are in the impact model.

## Scope & UX
- **Config editor** for weights + baseline.
- **Impact table** mirroring the sheet: baseline row, Q1–Q4 + differences, nett
  annual difference, Impact Per Kg, and the **Sum of Impact** total.
- **Headline tile:** "annual product cost impact: −X per kg" (green if favourable
  / red if adverse).
- **Per-commodity contribution** bar (which commodities drive the impact most).
- Reuse SM-18's aggregation + string normalization; reuse SM-20 for the baseline
  and short-history handling.

## Acceptance (TDD)
- Quarterly averages + differences + nett annual change compute correctly from
  seeded data.
- Impact Per Kg = nett change × weight; Sum of Impact = Σ across commodities.
- Missing weight for a commodity → excluded from the sum and flagged (not 0
  silently).
- Rolling baseline computes over the trailing window; with < a full window of
  history it uses whatever quarters exist and labels it low-confidence (SM-20
  rule), never a fixed prior-year point.
- Responsive per SM-23.

## Notes
This is likely the **highest-value** view for the business (it's the actual $
impact) and feeds SM-19's "consider a price adjustment" recommendation. Confirm
the exact impact formula + weights with the user before implementing.
