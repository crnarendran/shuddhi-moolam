---
id: SM-31
title: Commodity personalization — global + per-report exclusion cascade
type: ticket
points: 5
status: in-review
depends_on: [SM-30]
tags: [backlog, personalization, settings, reports, ux]
---
# SM-31 — Commodity personalization (global + per-report)

## Implemented (dev)
- **Model** (`userSettings.ts`): `Personalization { globalExcluded,
  reports.{id}.excluded }` + pure `effectiveKeys` (the cascade) and
  `globallyAllowedKeys` — vitest-tested (order preserved, no double-count,
  report can't re-show a globally-hidden key).
- `reporting.ts`: `effectiveCommodities(reportId, personalization)`; `costImpact`
  now accepts a commodity list.
- **All four reports wired** (Price Review, Seasonal, Cost-Impact, Spreads) to
  the effective list; selections (Seasonal metric, Spreads A/B) self-clamp when
  the effective set changes; tile counts reflect the effective count.
- **Settings tab** (`SettingsPage`): global commodity show/hide grouped by
  category with tier badges + bulk "Show all / Hide all / Core only"; per-report
  section that only lists globally-allowed commodities with per-report toggles
  and a "showing N of M" count; signed-out empty state. No AI chat on Settings.
- vitest (12) + oxlint + tsc + production build green.

**Follow-up (not built):** the *inline* per-report "Filter ▾" popover in each
report header (the Settings page covers global + per-report; the inline control
is a convenience). Track as a small enhancement.

## Goal
Let each user focus the dashboard on the commodities they care about, with a
two-level **opt-out cascade**: hide a commodity globally (from everything), and
optionally hide more within a single report. A commodity appears in a report
only if it is globally allowed AND not hidden in that report.

## Model (stored in `user_settings/{uid}`, SM-30)
```
personalization: {
  globalExcluded: string[],                 // hidden from ALL reports
  reports: {
    'price-review': { excluded: string[] }, // additional hides, this report
    'seasonal':     { excluded: string[] },
    'spreads':      { excluded: string[] },
    'cost-impact':  { excluded: string[] },
  }
}
```
- Default: both lists empty → all 22 visible commodities everywhere (today's
  behaviour). Opt-out only; nothing to configure to get started.
- **Effective visible in report R** =
  `VISIBLE_COMMODITIES − globalExcluded − reports[R].excluded`.
- **Invariant:** report-level UI only lists globally-allowed commodities; a
  report can never re-show a globally-excluded one (enforce in the selector and
  in the effective-list helper).

## Shared helper (dashboard + mirror in reporting lib)
`effectiveCommodities(reportId, settings): Commodity[]` — filters the registry
COMMODITIES by the cascade above. Every report page calls this instead of
importing COMMODITIES directly. Add a unit test for the cascade + invariant.

## UX
### New "Settings" tab (added to the nav, after Monitor)
- **Global commodities** section: the full commodity list grouped by category
  (Domestic Prices / Melting Scrap / Raw Material / Ferro Alloys / Raipur /
  Coke) with a tier badge (core/extended). Each row is a visible/hidden toggle.
  Bulk actions: "Show all", "Hide all", "Core only". Hidden = added to
  `globalExcluded`. Live count: "18 of 22 shown".
- **Per-report** section: one collapsible card per report. Each lists only the
  globally-allowed commodities, each with a show/hide toggle for that report.
  A globally-hidden commodity appears greyed with "hidden globally" and is not
  toggleable here. Header control summarises: "Price Review: showing 12 of 18".
- Saved via `useUserSettings().update(...)`, debounced, with a subtle "Saved"
  toast. "Reset to defaults" per section.

### Inline filter on each report page
- A "Filter ▾" control in each report header opens a compact popover of the
  report's globally-allowed commodities with checkboxes → writes to
  `reports[R].excluded`. So users adjust in-context without leaving the report.
- When a report is filtered, show a small chip "12 of 18 · Edit filters" that
  links to that report's Settings card.

### States
- Signed out: personalization disabled; all commodities shown; a hint to sign
  in to customise.
- Everything hidden in a report: friendly empty state "All commodities hidden
  for this report — adjust filters."
- Loading: skeleton, no jarring reflow.

## Reports to wire
Price Review, Seasonal, Spreads, Cost-Impact all consume
`effectiveCommodities(reportId, settings)`. Monitor is unaffected (not
commodity-scoped). Charts, tables, and summary tiles all respect the effective
list (e.g. the "Commodities: N" tile shows the effective count).

## Acceptance / TDD
- `effectiveCommodities` unit tests: empty settings → all; globalExcluded
  removes everywhere; report.excluded removes only in that report; a
  report-excluded key that is also globally-excluded is not double-counted; a
  report cannot re-include a globally-excluded key.
- Toggling a global hide removes the commodity from every report incl. its tile
  counts; a per-report hide affects only that report.
- Settings persist across reload (Firestore) and across devices.
- Responsive per SM-23; theme-correct per the dark/light rules.

## Notes
Read `docs/specs/frontend-guidelines.md` + `docs/specs/ui-components.md` before
building UI. Keep the reporting-lib copy of the helper in sync with the
dashboard (mirror pattern from `components.ts`).
