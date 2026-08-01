---
id: SM-08
title: Observability, alerting, dead-letter / reprocess
type: ticket
points: 3
status: in-review
depends_on: [SM-05, SM-07]
tags: [backlog, ops, observability]
---
# SM-08 — Observability & resilience

## Goal
Make failures visible and recoverable, and keep an eye on cost.

## Scope
- **Structured logging** across ingest → extract → append with a correlation id
  (the `fileId`).
- **Alerting** on: Gemini validation failure, Drive/Sheets API errors, and a
  stale/expired Drive channel. Route to a human channel (email / chat webhook).
- **Dead-letter + reprocess:** record failed files with the reason; provide a
  documented way to clear a file from the dedup store and re-trigger it
  (referenced from the support runbook).
- **Cost logging:** record Gemini token usage per file for a rough running cost.

## Acceptance criteria (TDD)
- A simulated validation failure produces a dead-letter record + one alert.
- Reprocess path re-runs a previously failed/processed file end to end.
- Logs carry the `fileId` correlation id through each stage.

## Notes
- Alert transport (email vs chat webhook) is a small config choice — pick one,
  document it; escalate only if it needs a paid/new integration.
