---
id: SM-21
title: Spread & correlation monitors
type: ticket
points: 3
status: in-review
priority: later
depends_on: [SM-18]
tags: [backlog, analytics, reporting, later]
---
# SM-21 — Spread & correlation monitors

> **Priority: later.** Build after the core reporting (SM-18) and seasonal
> (SM-20) views are stable.

## Goal
Surface relationships between commodities that signal substitution, arbitrage,
or import-parity opportunities on the supply side.

## Scope & UX
- **Spread monitors** — track and chart key spreads over time:
  - **CU_LME vs domestic Cu** (import parity / lead indicator; LME often leads).
  - **Melting scrap vs Pig Iron** (substitution signal for foundries).
- **Deviation flag** — alert when a spread deviates from its own historical norm
  (reuse SM-20's norm/z-score machinery).
- **Lead/lag hint** — show the LME→domestic relationship so a move in the leading
  series previews the domestic one.

## Acceptance (TDD)
- Spreads compute correctly from seeded data; deviation flag fires beyond the
  configured band; charts render with gaps handled.
- Responsive per SM-23.

## Notes
Read-only; adds no new pipeline dependency beyond the data source chosen in
SM-18.
