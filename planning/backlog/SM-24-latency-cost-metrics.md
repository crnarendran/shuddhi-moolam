---
id: SM-24
title: Fix latency & total-cost metrics (telemetry not populating)
type: ticket
points: 3
status: todo
depends_on: [SM-11, SM-14, SM-05]
tags: [backlog, bug, dashboard, telemetry, observability]
---
# SM-24 — Fix latency & total-cost metrics

> **Bug in already-built SM-11/SM-14.** The dashboard's **avg latency** and
> **Gemini cost** tiles aren't working (empty/zero). Fold the fix into the other
> session's pipeline + `SummaryMetrics`.

## Symptom
`SummaryMetrics` "avg latency" and "total/Gemini cost" show nothing — the
underlying telemetry isn't being written and/or aggregated.

## Likely root causes (verify)
1. **Latency:** the pipeline isn't recording per-stage `startedAt`/`endedAt` (or
   `detectedAt`/`completedAt`) on `pipeline_runs`, so a total duration can't be
   computed.
2. **Cost:** the Gemini call (SM-05) isn't capturing usage metadata
   (`usageMetadata.promptTokenCount` / `candidatesTokenCount`), so
   `gemini.{tokensIn,tokensOut,estCostUsd}` stays empty.
3. **Aggregation:** `SummaryMetrics` isn't summing/averaging those fields (or
   chokes on older runs missing them).

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
