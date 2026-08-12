---
id: SM-36
title: Unified Settings section — one place, two tabs (Preferences + Companies)
type: ticket
points: 3
status: planned
depends_on: [SM-31, SM-32]
tags: [backlog, ux, settings, navigation, consolidation]
---
# SM-36 — Unified Settings section

## Goal
Today configuration is split across two top-level tabs — **Settings**
(commodity include/exclude, global + per-report) and **Companies** (company /
material CRUD). Consolidate both under a single **Settings** section with two
sub-tabs, so all configuration lives in one place and the top nav is less
cluttered.

## Current state
- `App.tsx` top nav: `... | Companies | Guidance | Monitor | Settings`.
- `SettingsPage.tsx` = commodity preferences (global + per-report cascade,
  SM-31).
- `CompaniesPage.tsx` = company/material CRUD (SM-32).
- `GuidancePage.tsx` = a *report* that consumes companies (stays a top-level
  report — it is not configuration).

## Target UX
- **Top nav:** remove the separate `Companies` and `Settings` items; keep a
  single **Settings** tab (gear icon). Result:
  `Price Review | Seasonal | Cost Impact | Spreads | Guidance | Monitor | Settings`.
- **Inside Settings:** a secondary sub-tab bar with two tabs:
  1. **Commodities** — the existing `SettingsPage` content (global exclusion +
     per-report cascade, tier legend). Default sub-tab.
  2. **Companies & Materials** — the existing `CompaniesPage` content
     (company list, material editor, blended-cost preview).
- **Sub-tab styling:** lighter than the top nav (underline/pill row), visually
  subordinate so the hierarchy reads "Settings › Commodities". Reuse existing
  tab tokens; theme-aware.
- **Routing / deep-links:** URL hash carries the sub-tab, e.g.
  `#settings` (→ default Commodities), `#settings/companies`. Refresh and
  direct links land on the right sub-tab. Back/forward works.
- **Intro:** a single `ReportIntro`-style header for the Settings section
  ("Configure what you see and who you buy for"), plus each sub-tab keeps its
  own short description (reuse `REPORT_HELP['settings']` and a new
  `REPORT_HELP['companies']`-style entry — already exist in `help.ts`).
- **AIChat:** Settings remains chat-excluded (both sub-tabs), matching current
  `hasChat` logic.
- **Responsive:** sub-tab row scrolls/stacks on mobile; no horizontal page
  scroll. Empty states (signed-out, no companies) preserved verbatim.

## Acceptance
- One top-level Settings tab; `Companies` no longer in the top nav.
- Both sub-tabs render their existing pages unchanged in behaviour
  (personalization persistence, company/material CRUD all still work).
- Deep-link to each sub-tab works and survives refresh.
- No regression to Guidance (still top-level, still reads companies).
- oxlint + tsc + vitest + build green; responsive + theme-correct.

## Out of scope
- Any change to *what* the settings do (pure IA/navigation consolidation).
- Merging Guidance into Settings (it is a report, stays separate).
