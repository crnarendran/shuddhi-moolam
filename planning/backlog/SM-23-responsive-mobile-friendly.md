---
id: SM-23
title: Responsive / mobile-friendly UI (all surfaces)
type: ticket
points: 5
status: in-review
depends_on: [SM-12]
tags: [backlog, dashboard, frontend, ux, responsive]
---
# SM-23 — Responsive / mobile-friendly UI (all surfaces)

> **Cross-cutting + partly a retrofit** of the in-progress dashboard
> (SM-12/13/14). Fold into the other session's `dashboard/` components.

## Goal
Every dashboard surface works from ~360px phones through tablet to desktop — no
horizontal page scroll, nothing clipped, touch-friendly. Applies to the
monitoring dashboard (SM-12/13/14) and the reporting/seasonal views
(SM-18/SM-20/SM-21).

## Current gaps (found in `dashboard/`)
- Viewport meta is set, but only ~5 responsive classes app-wide — largely
  desktop-fixed.
- `FileMonitor.tsx` table uses `whitespace-nowrap` with no scroll wrapper →
  horizontal overflow.
- `AIChatPanel.tsx` `fixed w-[400px]` → wider than a phone.
- `FileMonitor` detail drawer `w-[33%]` → unusable on mobile.
- `ReprocessButton.tsx` hover-only error tooltip → no hover on touch.

## Standard
- **Mobile-first** (design at ~375px, enhance up).
- **No fixed widths wider than a phone** — panels/drawers become **full-screen
  sheets** on mobile (`w-full sm:w-[400px]`, `w-full md:w-[33%]`).
- **Tables → responsive:** file-monitor and quarterly-comparison tables
  **collapse to stacked label:value cards below `md`**, or scroll horizontally
  with a **sticky first column** (file/commodity) + prioritized columns.
- **Charts:** Chart.js `responsive` with min-heights; per-commodity horizontal
  bars get taller/scrollable containers so labels stay legible.
- **Touch:** targets ≥ 44px; every hover affordance has a **tap equivalent** —
  no hover-only.
- **Nav/controls** collapse to a hamburger/bottom bar; env/quarter/threshold
  pills wrap. No horizontal body scroll; `canvas`/media `max-width:100%`.

## Definition of Done on every UI ticket
Add "verified responsive at mobile/tablet/desktop" to SM-12/13/14, SM-18, SM-20,
SM-21.

## Acceptance (verification)
- At **360 / 390 / 430px**, **768px**, **1280px**: no horizontal page scroll; all
  controls reachable; tables usable (cards or sticky-scroll); charts legible.
- Playwright viewport tests at those sizes (per the repo E2E TDD rule) + a
  Lighthouse mobile pass; touch targets ≥ 44px.
