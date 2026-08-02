---
id: SM-19
title: Price-movement alerts & quarterly review report
type: ticket
points: 5
status: todo
depends_on: [SM-08, SM-18, SM-20]
tags: [backlog, alerts, reporting, ops, scheduled]
---
# SM-19 — Price-movement alerts & quarterly review report

## Goal
Turn the insights into a proactive nudge for the pricing decision — flag
significant moves and compile a quarter-close review.

## Scope
- **Threshold alerts:** flag commodities whose MoM/QoQ move exceeds the
  configured threshold/severity bands from SM-18 (default **±5% MoM / ±10% QoQ**,
  per-commodity overrides).
- **Seasonal-aware / anomaly alerts:** when SM-20's seasonal history is
  sufficient, classify a move as **seasonal vs structural** and alert on the
  z-score vs the seasonal norm (an *unusual* move), not just a flat %. When
  history is thin, fall back to the fixed threshold (see SM-20 rule).
- **Quarterly review report:** a **scheduled** job (Cloud Scheduler) at quarter
  close compiles the comparison + flagged commodities and **sends an alert**
  (reuse SM-08's alert util) titled e.g. *"Q2 2026 price review: 2 commodities
  moved >5% — consider adjustment."*
- **In-dashboard alerts panel:** dismissible "N commodities need review this
  quarter" banner linking to the flagged rows.

## Acceptance (TDD)
- Scheduled run produces the report + one alert with the correct flagged set.
- Threshold + per-commodity overrides honored; no alert when nothing crosses.
- Seasonal classification correct when history ≥ required; clean fallback when not.

## Notes / escalation
- **Alert cadence & transport** (quarterly + optional monthly; email vs chat
  webhook) is a business decision — propose email to a configured recipient,
  confirm before wiring a new integration.
