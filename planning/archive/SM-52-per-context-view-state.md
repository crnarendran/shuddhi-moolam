---
type: ticket
id: SM-52
tags: [planning, dashboard, ux, sharing]
status: in-review
points: 2
depends_on: [SM-39, SM-41]
---
# SM-52 — Per-context report selections (retain across company switch)

## Problem
Report selections (Seasonal keys, Spreads reference/compare, Guidance
materials) were persisted in a single slot per report — `viewState[report]` —
shared across the user's workspace and every shared company. Switching context
filtered the saved selection to the new company's commodities (often empty) and,
worse, editing in one company overwrote the one slot, wiping another company's
selection. Net effect: selections were not retained when switching between
companies or workspace.

## Decision (user-approved)
Namespace persisted view state by the active context, and re-hydrate on switch,
so each workspace/company keeps its own selections. One-time reset of existing
selections is acceptable (no migration shim).

## Scope
- `lib/userSettings.ts`: `viewState` becomes `Record<string, ViewState>` keyed
  by contextId (`'own'` | companyId); `mergeSettings` deep-merges three levels
  (context → report → slice).
- `hooks/useViewState.ts`: read the active context from `useView()`
  (`shared?.companyId ?? 'own'`), hydrate/save under it, and re-hydrate when the
  context changes (per-ctx guard replaces the one-shot hydrate flag). The
  post-save snapshot echo still can't clobber local edits.
- Report pages: unchanged — context-awareness lives in the hook.
- Cost-Impact weights (`settings.costImpact`, a separate top-level field, keyed
  by commodity) stay global — intentionally not per-context.

## Notes
- One-time reset: existing flat `viewState` is not migrated, so selections start
  fresh per context on first use, then persist.

## Tests
Added a `mergeSettings` 3-level deep-merge test. Dashboard tsc + oxlint clean;
27/27 vitest pass.
