---
id: SM-33
title: Material guidance report — seasonal buying + substitution (v1)
type: ticket
points: 8
status: in-review
depends_on: [SM-31, SM-32]
tags: [backlog, guidance, prediction, seasonality, substitution, reports]
---
# SM-33 — Material guidance report (statistical v1)

## Implemented (dev)
- **Guidance engine** (`guidance.ts`, pure, vitest-tested — 5 cases):
  `blendedCostSeries` (monthly Σ ratio×price), `materialSeasonalIndex`
  (cost-share-weighted seasonal MoM%), `cheapestMonths`,
  `substitutionSuggestions` (cheapest **same-unit** member of a group + saving),
  `costVsBaseline` (latest vs trailing 6-mo mean). `DEFAULT_SUB_GROUPS`
  predefined (metallic charge, FeSi market, FeMn family, coke). `reporting.ts`
  gains `ALL_COMMODITIES` (incl. archived) so substitution can price hidden
  commodities.
- **Guidance tab** (`GuidancePage`): company + material selectors; cost tiles
  (blended cost, vs-baseline with up/down tone); blended-cost-over-time chart
  with a baseline mark-line; seasonal buy-timing (cheapest months, grounded in
  the weighted %); "cheaper alternatives right now" substitution list with the
  per-unit saving. Empty states (sign-in / no company+material), short-history
  guards. No AI chat on this tab.
- vitest (21 total) + oxlint + tsc + production build green.

**Follow-up (not built):** editable substitution groups (currently the
predefined defaults) and the SM-19-style scheduled buy alert — both are SM-34
territory. Substitution compares same-unit only (Rs/kg vs Rs/tonne never mixed).

## Goal
For a selected company + material (SM-32), generate actionable purchasing
guidance: when to buy (seasonality), what to swap (cheaper substitutes /
markets), and cost trend vs baseline. **v1 is statistical / rules-based**,
built entirely on the existing reporting engine (`seasonalIndex`,
`rollingBaseline`, `monthlySpread`, cost-impact math) — no ML. It is
explainable ("why") by construction.

## Inputs
- A material's `composition` (SM-32) → per-commodity weight (ratio × latest
  price share).
- `historical_prices` time series per commodity (already fetched).
- Substitution groups (see below).

## Report sections
### 1. Blended cost over time
- Time series of `Σ(ratio × commodity price)` per month/quarter for the
  material; overlay a rolling baseline (reuse SM-20/26). Headline: current
  blended cost, Δ vs baseline, MoM/QoQ. Low-confidence label when history is
  short (SM-20 rule).

### 2. Seasonal buying guidance
- Per commodity, reuse `seasonalIndex` (avg MoM % by calendar month). Weight
  each commodity's seasonal curve by its **share of the material's cost** →
  the material's blended seasonal index.
- Output: ranked "cheapest months to buy" for the material, and per high-weight
  commodity ("FeSiMg is seasonally ~8% cheaper in Nov–Jan and is 22% of this
  material's cost → consider forward-buying then"). Microcopy states the % and
  the cost share so the advice is grounded.
- Confidence gating: only surface a seasonal claim with ≥ N years of history;
  otherwise show "not enough history for a seasonal read".

### 3. Material swapping / market arbitrage
- **Substitution groups** = sets of commodities that can stand in for each
  other. Predefined domain defaults (editable per SM decision), e.g.:
  - Metallic charge: pig_iron_sg_grade_a_pune, pig_iron_foundry_gr_pune,
    pig_iron_foundry_grade_b_punjab, sponge_iron_mg_punjab,
    melting_foundry_scrap_mumbai, crca_bundle_mumbai,
    cast_iron_scrap_bhavnagar, heavy_melting_scrap_mumbai_pune
  - Ferro Silicon (market): fe_si_70_75_mumbai, fe_si_70_75_raipur
  - Ferro Manganese: fe_mn_hc_mumbai, fe_mn_mc_mumbai, fe_mn_70_75_raipur,
    high_fe_mn_78_raipur
  - Recarburiser/coke: low_sulp_cal_petro_coke,
    calcinated_petroleum_coke_9_4mm, graphite_petroleum_coke_mumbai, lam_coke
- Stored as an editable config in `user_settings/{uid}.substitutionGroups`
  (defaults seeded; user can add/remove members or whole groups).
- For each group that a material uses, recommend the currently-cheapest member
  and the saving vs the one in the BOM ("Ferro Silicon is 3.8% cheaper in
  Raipur this month; at this material's ratio that's ~₹X/unit"). Flag unit
  mismatches (Rs/kg vs Rs/tonne) — only compare within the same unit.

### 4. Cost alerts (in-report)
- Flag when the material's blended cost is trending above its rolling baseline
  by > threshold → a "buy-now / lock price" nudge. Reuse the SM-19 breach
  logic on the blended series.

## UX
- New **Guidance** tab (or a mode within a Company view). Header: company
  selector + material selector. Sections above as cards. Every recommendation
  shows its basis (the numbers), never a bare assertion. Respect SM-31
  personalization for any commodity-level breakdowns.
- Empty/short-history states; responsive; theme-correct.

## Acceptance / TDD
- Blended cost, weighted seasonal index, and substitution comparisons are pure
  functions with unit tests over seeded data (deterministic).
- Substitution recommendations only compare same-unit commodities and pick the
  true minimum; saving = (current − cheapest) × ratio.
- Seasonal claims gated by history length; low-confidence labelled.
- Editing substitution groups changes recommendations; defaults seed on first
  load.
- No ML/external calls; all math client-side in the reporting lib.

## Out of scope (→ SM-34)
True time-series forecasting / ML, scheduled email guidance, sharing a
company's guidance with a colleague. This ticket is explainable statistics
only.
