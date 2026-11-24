---
id: SM-34
title: Guidance enhancements — forecasting, alerts, sharing (later)
type: ticket
points: 8
status: shipped
depends_on: [SM-33]
tags: [backlog, guidance, forecasting, alerts, sharing, later]
---
# SM-34 — Guidance enhancements (later phase)

## Goal
Extend the statistical guidance (SM-33) once it's proven. Deliberately deferred
so v1 ships explainable and fast. Pick items up individually.

## Candidate scope
- **Forecasting:** move beyond seasonal-index heuristics to a proper
  short-horizon forecast of each commodity (and the blended material cost) —
  e.g. seasonal-naive / Holt-Winters / a light model — with confidence bands.
  Decide build-vs-buy and where it runs (client vs a Cloud Function/BigQuery).
  Must stay explainable enough to trust for purchasing decisions.
- **Scheduled guidance alerts:** weekly per-material email/notification ("buy
  window opening for X"), reusing SM-19's scheduled-alert pattern, scoped per
  user/company. Requires a backend job + per-user contact prefs.
- **Sharing:** let an owner share a company's guidance (read-only) with a
  named colleague (add a `sharedWith: [uid|email]` on the company + rules).
  Careful with the security-rules model (currently owner-scoped).
- **Scenario / what-if:** adjust a ratio or assume a price move and see the
  impact on blended cost and recommendations.

## Notes
All epic deliverables have shipped via focused tickets: Sharing (`SM-39`–`SM-41`), Scenario / What-If simulator (`SM-67`), Short-horizon 3-month forecasting (`SM-69`), and Weekly scheduled guidance buy-window alerts (`SM-70`).
