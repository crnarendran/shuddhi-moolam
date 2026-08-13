---
type: ticket
id: SM-45
tags: [planning, dashboard, ux, materials]
status: in-review
points: 3
depends_on: [SM-32, SM-40]
---
# SM-45 — Grams-per-kg material composition + mass-weighted blended cost

## Problem
Stakeholders were confused by the material editor. The composition value was a
unitless `ratio`, and the right-hand % was the **cost** contribution
(`ratio × price ÷ blended total`), not a mass share. A commodity that is a tiny
part of the mix but expensive (e.g. Copper Cathode, 0.7 units → 13% of cost)
looked like a broken calculation. The `per kg` unit was a free-text box.

## Decision (user-approved)
- Composition values are **grams per 1 kg** of finished material (a full recipe
  totals 1000 g).
- Right-hand **% = grams ÷ 1000** (share of a kilogram). Independent of price
  and of the other rows, so an under-filled recipe shows shares summing to
  < 100% — a "Total: X g / 1000 g" readout surfaces the unaccounted mass.
- **Blended cost = mass-weighted average price** `Σ(grams × price) ÷ Σ(grams)`
  → honest ₹ per kg of finished material (the old ₹7,265 batch-total became
  ≈ ₹63/kg).
- The `unit` field becomes a fixed **`per kg`** label (no free text); saves
  coerce `unit: 'per kg'`.

## Scope
- `lib/materials.ts`: `blendedCost` redefined (mass-weighted avg); add
  `massShares` + `totalGrams`; `contributions` (cost share) retained for
  Guidance seasonality weighting.
- `lib/guidance.ts`: `blendedCostSeries` rescaled to ₹/kg (÷ Σgrams; trends &
  baseline % unchanged); `substitutionSuggestions` saving expressed per kg of
  blend (× ratio ÷ Σgrams).
- `pages/CompaniesPage.tsx`: grams column header + `g` hint, mass %, total-grams
  readout with over/under-kg warning, fixed `per kg` label, list/read-only
  displays show `Ng` and `/ kg`.
- `pages/GuidancePage.tsx`: labels `/ kg`.
- `lib/help.ts`: companies intro + `Blended cost` glossary rewritten.

## Not touched
Cost-Impact "consumption weight" (a different, per-commodity basket feature).
No Firestore migration — existing `ratio` values are reinterpreted as grams.

## Tests
`materials.test.ts` (blendedCost avg, massShares, totalGrams) and
`guidance.test.ts` (series avg, per-kg saving) updated. 26/26 dashboard tests
pass; tsc + oxlint clean.
