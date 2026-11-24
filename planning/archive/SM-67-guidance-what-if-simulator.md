---
id: SM-67
title: Guidance Scenario / What-If Simulator
type: ticket
status: shipped
points: 3
assigned_to: sm-orchestrator
depends_on: [SM-33, SM-61]
created_at: 2026-11-21
tags: [dashboard, guidance, scenario, simulation]
---

# SM-67: Guidance Scenario / What-If Simulator

## Why This Matters
Purchasing teams using the Guidance tab currently see static historical seasonality, current-quarter blended cost, and current substitution swaps. Before committing to a supplier mix change or negotiating around an expected raw-material price swing, buyers need to test "what if Commodity X rises 10% or we adjust grams of Y?" without mutating their saved company bill of materials in Firestore.

Carving Scenario / What-If simulation out of `SM-34` gives immediate interactive value on existing material BOMs with zero backend/Firestore schema changes and full client-side determinism under `SM-61` (`Σ(g × p) ÷ 1000`).

## Scope
1. **Pure Scenario Engine (`dashboard/src/lib/scenario.ts`)**:
   - `applyScenarioComposition(comp, overrides)` — applies per-commodity gram overrides (clamped at `>= 0`).
   - `applyScenarioPrices(latest, comp, overrides)` — computes effective unit prices (`priceOverride` if finite `>= 0`, else `basePrice * (1 + priceDeltaPct / 100)` clamped at `>= 0`).
   - `simulateScenario(comp, latest, overrides, groups, commodities)` — reuses `blendedCost`, `totalGrams`, `GRAMS_PER_KG`, `normalizePrice`, and `substitutionSuggestions` to compute base vs. simulated cost per kg, absolute & percentage delta, recipe mass, per-commodity breakdown, and updated cheaper alternatives.
2. **Interactive Simulator UI (`dashboard/src/components/WhatIfSimulator.tsx` & `GuidancePage.tsx`)**:
   - Collapsible `What-if scenario` panel inside each `MaterialCard`, resetting cleanly when `material.id` changes.
   - Displays Base Cost, Simulated Cost, Impact (`±₹/kg` and `±%`), and Recipe Mass (`baseGrams g → scenarioGrams g`).
   - Per-commodity editable grams (`min=0, step=5`) and price move `%` (`step=1`) with live unit price preview and contribution delta.
   - Surfaces updated substitution suggestions when `hasChanges` is true.
   - Purely ephemeral local state — never modifies saved BOMs.

## Acceptance Criteria
- [x] Unit tests in `dashboard/src/lib/scenario.test.ts` cover identity, `%` price moves, floor clamping at `0`, explicit `priceOverride`, ratio changes (including `> 1000 g` recipes), null/unpriced `latest` safety, and updated substitution swaps.
- [x] `WhatIfSimulator` renders per-material inside `GuidancePage` and resets cleanly on demand or material change.
- [x] `cd dashboard && npm test`, `npm run lint`, and `npm run build` pass with zero errors.
