---
id: SM-38
title: Reports nav consolidation — group reports under one section
type: ticket
points: 3
status: in-review
depends_on: [SM-36]
tags: [backlog, ux, navigation, reports, information-architecture]
---
# SM-38 — Reports nav consolidation

## Implemented (dev)
- Top nav is now 3 sections (`SECTIONS`): **Reports · Monitor · Settings** —
  no more horizontal scroll.
- `components/SubTabs.tsx`: generic underline sub-tab bar (icons,
  `aria-current`, `print:hidden`, horizontal-scroll safe) reused for Reports.
- `App.tsx`: hash routing rewritten to `#<section>[/<sub>]`
  (`#reports/seasonal`, `#monitor`, `#settings/commodities`) as the single
  source of truth; `goToSection`/`goToReport`; chat + print resolve from the
  active report sub-tab. Reports render under a `SubTabs` bar.
- tsc + oxlint + vitest (22) + build green.

## Goal
The top nav has 7 items and scrolls horizontally on normal widths (see user
screenshot). Collapse to **3 top-level sections** — **Reports · Monitor ·
Settings** — with the reports nested as sub-tabs. Kills the horizontal scroll
and mirrors the Settings sub-tab pattern (SM-36).

## Target structure
- **Reports** (default section) → sub-tabs, in order:
  Price Review, Seasonal, Cost Impact, Spreads, Guidance.
- **Monitor** → standalone (pipeline file monitor).
- **Settings** → sub-tabs: Companies & Materials (default), Commodities.

## UX / behaviour
- Reuse one generic **`SubTabs`** component (underline row, icons,
  `aria-current`) for both Reports and Settings.
- **Routing:** `#reports/<report>` (default `#reports` → price-review),
  `#monitor`, `#settings[/commodities]`. Base segment selects the section;
  second segment selects the sub-tab. Deep-links + refresh land correctly;
  back/forward works.
- **Chat context:** the AI chat still keys off the active *report* sub-tab
  (chat shown on the four analytics reports; hidden on Guidance, Monitor,
  Settings — unchanged rules, just resolved from the sub-tab).
- **Print (SM-37):** unaffected — the print header's report name resolves from
  the active report sub-tab.
- Responsive: 3 top items never scroll; the Reports sub-tab row may scroll on
  very narrow mobile but that's secondary nav.

## Acceptance
- Top nav shows exactly Reports · Monitor · Settings; no horizontal scroll at
  desktop widths.
- Every report reachable as a Reports sub-tab; deep-link + refresh correct.
- Chat + print continue to work per the active report.
- tsc + oxlint + vitest + build green; theme-correct.

## Out of scope
- Persisting the last-viewed report (that's SM-39's per-report state); this
  ticket only restructures navigation.
