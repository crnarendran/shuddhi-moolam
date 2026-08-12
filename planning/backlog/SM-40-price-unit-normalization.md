---
id: SM-40
title: Price unit normalization — one canonical unit (₹/kg) for charts & math
type: ticket
points: 3
status: planned
depends_on: [SM-18, SM-26, SM-33]
tags: [backlog, data, units, charts, correctness]
---
# SM-40 — Price unit normalization

## Problem
The newsletter quotes some commodities in **₹/tonne** and others in **₹/kg**.
We extract faithfully, so `historical_prices` mixes scales — e.g. Melting
Scrap ~47,000 (₹/tonne) next to Aluminium ~340 (₹/kg). Consequences:
- **Charts** (Price Review, Spreads, Seasonal, Guidance) are dominated by the
  ₹/tonne series; ₹/kg series look flat. Wide, confusing deviation.
- **`blendedCost`** (`materials.ts`) sums `ratio × record[key]` directly, so a
  material mixing a ₹/tonne and a ₹/kg commodity computes a **wrong** blend —
  not just a visual issue.

The 10 tonne-priced keys are already flagged in the registry via
`unit: 'Rs/tonne'` (the rest are `'Rs/kg'`): melting_foundry_scrap_mumbai,
crca_bundle_mumbai, crca_bundle_chennai, pig_iron_sg_grade_a_pune,
pig_iron_foundry_gr_pune, lam_coke, sponge_iron_mg_punjab,
cast_iron_scrap_bhavnagar, heavy_melting_scrap_mumbai_pune,
pig_iron_foundry_grade_b_punjab.

## Recommended approach — normalize at the data-load boundary (₹/kg canonical)
Convert every tonne-priced value to **₹/kg (÷1000)** once, where the dashboard
loads `historical_prices` records (App.tsx `onSnapshot`), keyed off the
registry `unit`. After that single pass, **all** downstream code (reporting
aggregations, spreads, seasonal, cost-impact, blended cost, guidance) sees a
uniform ₹/kg world with no per-consumer changes.

- New pure helper `toCanonicalPriceRecord(record)` (dashboard `lib/`): for each
  commodity key whose registry `unit` is `Rs/tonne`, divide the numeric value
  by 1000; pass metadata fields through untouched. Unit-tested.
- Apply it in App.tsx when mapping snapshot docs → `PriceRecord[]`, so every
  page receives canonical records.
- Display: show **₹/kg** consistently; where a unit label is rendered, use the
  canonical unit (and, on the tonne-origin commodities, an InfoTip note
  "converted from ₹/tonne").
- **Storage stays faithful:** Firestore `historical_prices` and the master
  Google Sheet remain exactly as extracted (₹/tonne where the newsletter says
  so), so cross-checking against the source still works. No re-extraction, no
  data migration.

### Why this over normalizing at storage
Storage-normalization (÷1000 at extraction + migrate all historical docs +
re-label the Sheet) would make the Sheet diverge from the newsletter and
requires a data migration / partial re-extraction (cost the user wants to
avoid). Load-boundary normalization is O(records) at load, needs no migration,
and keeps one source of truth (the registry `unit`).

**Trade-off to confirm:** charts/tables show ₹/kg while the master Sheet still
shows ₹/tonne for those rows (matching the newsletter). If the Sheet must also
read ₹/kg, that's the storage path (with migration) — see decision below.

## Acceptance
- A tonne-priced commodity and a kg-priced commodity plot on comparable scales
  in every chart; no series dwarfs the others purely due to units.
- `blendedCost` / cost-impact / guidance use canonical ₹/kg → correct blends
  across mixed-unit materials.
- `toCanonicalPriceRecord` is pure + unit-tested (tonne ÷1000, kg unchanged,
  metadata untouched, missing/invalid values safe).
- Unit labels read ₹/kg; tonne-origin commodities note the conversion.
- No change to Firestore/Sheet stored values; no re-extraction. tsc + oxlint +
  vitest + build green.

## Decision (needs sign-off)
1. **Normalize at load (recommended)** vs **at storage** (migrate history +
   re-label Sheet).
2. If load: leave the master Sheet in ₹/tonne (faithful to newsletter) — yes/no.

## Out of scope
- Currency conversion (₹ only); per-user unit preferences.
