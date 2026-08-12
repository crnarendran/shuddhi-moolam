---
id: SM-24
title: Fix latency & total-cost metrics (telemetry not populating)
type: ticket
points: 3
status: in-review
depends_on: [SM-11, SM-14, SM-05]
tags: [backlog, bug, dashboard, telemetry, observability]
---
# SM-24 — Fix latency & total-cost metrics

> **Bug in already-built SM-11/SM-14.** The dashboard's **avg latency** and
> **Gemini cost** tiles aren't working (empty/zero). Fold the fix into the other
> session's pipeline + `SummaryMetrics`.

## Symptom (confirmed on staging 2026-08-01)
On `sai-shuddhi-moolam-staging.web.app` with 16 processed runs (100% appended):
- **Avg Latency tile shows `-`** AND the per-file **`DURATION` column is `-` on
  every row** → duration is never recorded, so there is nothing to average.
- **Total Cost tile shows `$0.0000`** → the aggregation runs and formats a
  number, but every run's cost is 0 → Gemini usage is never captured.

So these are two **write-side** gaps in the pipeline, not a dashboard-only bug.

## Root causes (confirmed / to fix)
1. **Latency (confirmed):** the pipeline isn't recording per-stage
   `startedAt`/`endedAt` (or `detectedAt`/`completedAt`) on `pipeline_runs`, so
   no total duration exists — hence both the `DURATION` column and the Avg
   Latency tile are `-`.
2. **Cost (confirmed):** the Gemini call (SM-05) isn't capturing usage metadata
   (`usageMetadata.promptTokenCount` / `candidatesTokenCount`), so
   `gemini.{tokensIn,tokensOut,estCostUsd}` is 0 → Total Cost sums to `$0.0000`.
3. **Aggregation (mostly OK):** cost already sums/formats (shows `$0.0000`);
   latency shows `-` for an empty set. Once (1) and (2) write real data, verify
   the tiles + `DURATION` column render and format it (and exclude older runs
   that predate the fields).

## Scope
- **Pipeline (functions):** on each stage transition write `stages.<name>.{startedAt,endedAt}`
  and set `completedAt`; compute total latency = `completedAt − detectedAt`.
  Capture Gemini token usage and compute `estCostUsd` from a configured per-1K-token
  price for the Flash model; persist under `gemini`.
- **Dashboard:** `SummaryMetrics` computes **avg latency** (mean total duration
  over completed runs, filtered by the active range) and **cost** (sum
  `estCostUsd`); **older runs missing these fields are excluded, not NaN**.

## Acceptance (TDD)
- Seeded runs with stage timestamps → avg latency computed correctly (and
  formatted, e.g. `s`/`ms`).
- Seeded Gemini usage → cost summed and formatted as currency.
- Runs missing latency/cost fields don't break the tiles (excluded / show `—`).
- Round every displayed number.
