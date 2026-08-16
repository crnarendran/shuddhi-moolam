---
type: ticket
id: SM-56
tags: [planning, functions, extraction, quality]
status: in-review
points: 2
depends_on: [SM-54, SM-55]
---
# SM-56 — History-based extraction outlier check

## Problem
The probe (SM-55) proved that dense image-table fields can be misread
non-deterministically (inoculant 308 → 200) with no cheap prompt/budget fix.
These prices barely move week to week, so a sharp deviation is a reliable
signal of a bad extraction — but nothing was catching it.

## Decision (user-approved)
Add a history-based safety net: after each extraction, flag any commodity whose
value deviates sharply from the recent median, log it, record it on the run
doc, and alert — so a misread is surfaced for review/re-extraction instead of
landing silently. See ADR-006.

## Scope
- `functions/src/reporting/outliers.ts`: pure `detectOutliers(record, history,
  thresholdPct = 25, minHistory = 3)` → `Outlier[]`. Registry-driven; uses the
  **median** of recent values (robust to one stray bad row); skips commodities
  with too little history or unparseable values.
- `functions/src/pipeline/process.ts`: after append, fetch the last ~8
  historical records, run `detectOutliers`, and on any hit: `logger.warn`,
  `sendAlert` (dedup `outlier-<docId>`), and include `qualityOutliers` on the
  `appended` run-doc stage. Non-blocking (wrapped in try/catch).
- `functions/src/pipeline/telemetry.ts`: `PipelineRun.qualityOutliers?:
  Outlier[]`.

## Notes
- Threshold 25% avoids false positives on normal moves while catching the
  308→200 (~35%) class. Tunable.
- Backend-only for now; the Monitor could surface `qualityOutliers` later.

## Tests
`outliers.test.ts` (5 cases: flag misread, ignore normal move, median
robustness, too-little-history, unparseable). Functions 75/75 tests pass;
lint + build clean.
