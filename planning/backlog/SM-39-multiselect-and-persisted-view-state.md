---
id: SM-39
title: Multi-select line overlays + persisted per-report view state
type: ticket
points: 8
status: planned
depends_on: [SM-20, SM-21, SM-31, SM-33, SM-38]
tags: [backlog, ux, charts, multi-select, persistence, continuity]
---
# SM-39 — Multi-select line overlays + persisted view state

## Part A — Persisted per-report view state (cross-device)
Today each report's picks are local `useState` and reset on refresh. Persist
them to `user_settings/{uid}` (Firestore, cross-device — consistent with
existing personalization) so every report reopens where the user left it.

- Extend `UserSettings` with a `viewState` blob:
  ```ts
  viewState?: {
    priceReview?: { threshold?: number };
    seasonal?: { keys?: string[]; metric?: string };
    spreads?: { reference?: string; compare?: string[] };
    guidance?: { companyId?: string; materialIds?: string[] };
  }
  ```
- Each report reads its slice on mount (falling back to current defaults) and
  writes on change through `useUserSettings.update`, **debounced ~500ms** to
  avoid chatty Firestore writes on slider/select drags. Reuse `mergeSettings`
  (already strips `undefined`).
- Cost Impact weights already persist (`costImpact.weights`) — leave as is.

## Part B — Multi-select line overlays
Let users overlay several series on the line charts. Selected commodities/
materials persist via Part A.

### Seasonal (decision: normalized seasonal-pattern lines)
- Commodity picker becomes **multi-select**. The **"typical seasonal pattern"**
  chart draws **one line per commodity** (avg month-over-month %). Because all
  series are percentages they share one axis and compare cleanly across price
  scales.
- The **year-over-year overlay** chart stays **single-commodity** — it renders
  for the *primary* (first) selected commodity, with a caption saying so.
- Legend lists the selected commodities; per-line colours from a stable
  palette.

### Spreads (reference + multi-compare)
- Keep a single **reference** commodity (B) + a **multi-select** of commodities
  to compare (Aᵢ). Plot each **Aᵢ − B** as its own line.
- When exactly one compare item is selected, keep the current **mean ±1σ band
  + deviation tile**. With multiple lines, hide the band (it's per-pair) and
  show a legend instead.

### Guidance (multi-material blended cost)
- **Material** selector becomes multi-select. The **"blended cost over time"**
  chart overlays one line per selected material.
- The single-material sections (cost-vs-baseline tiles, seasonal buy-timing,
  substitution suggestions) operate on the **primary** selected material, with
  a note; a future ticket can make them comparative.

## Shared
- A small reusable **multi-select control** (checklist dropdown / chips) with a
  sensible cap (e.g. warn/limit beyond ~6 lines for readability) and a stable
  colour palette shared across charts.
- Empty/one/many states all render sensibly; short-history guards preserved.

## Acceptance
- Selections on Seasonal, Spreads, Guidance persist across refresh **and across
  devices** (Firestore), restored on load.
- Seasonal shows one normalized %-pattern line per selected commodity; YoY
  overlay stays single-commodity.
- Spreads overlays each Aᵢ−B; band/deviation only in the single-compare case.
- Guidance overlays blended cost per material; sections use the primary.
- Debounced writes (no write storm); tsc + oxlint + vitest + build green.

## Out of scope (→ future)
- Comparative tiles/guidance for multiple materials at once.
- Multi-select on bar charts (Price Review, Cost Impact contribution).
- Per-line axis scaling toggles beyond the normalized defaults above.
