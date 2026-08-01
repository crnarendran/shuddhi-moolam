---
id: SM-11
title: Pipeline run telemetry / status model (Firestore)
type: ticket
points: 3
status: in-review
depends_on: [SM-03]
tags: [backlog, observability, firestore, dashboard]
---
# SM-11 — Pipeline run telemetry / status model

## Goal
Give every dropped PDF a single, queryable Firestore record that tracks its
whole journey through the pipeline, so the dashboard (SM-12..SM-14) and alerting
(SM-08) have one source of truth. The dashboard is only as good as this record.

## Data model
Collection `pipeline_runs/{fileId}` (supersedes the bare dedup store in SM-03):

| Field | Type | Notes |
|---|---|---|
| `fileId` | string | Drive file id (doc id) |
| `fileName` | string | e.g. `MMRW27072026.pdf` |
| `folderPath` | string | which subfolder it landed in |
| `status` | enum | `detected` → `downloading` → `extracting` → `validating` → `routing` → `appended`; terminal: `failed`, `dead_letter` |
| `stages` | map | per-stage `{ startedAt, endedAt, ok }` for a timeline |
| `detectedAt` / `completedAt` | timestamp | overall bounds |
| `issueDate` / `year` | string / int | once extracted |
| `targetTab` / `appendedRange` | string | e.g. `Data_2026` / `Data_2026!A42` |
| `extractSummary` | map | small preview of a few key extracted fields |
| `error` | map | `{ stage, message, code }` on failure |
| `attempts` | int | retries so far |
| `gemini` | map | `{ tokensIn, tokensOut, estCostUsd }` |

## Scope
- Define the schema + a typed helper (`recordStage(fileId, stage, patch)`) so
  each pipeline stage (SM-03/04/05/06/07/08) updates the run atomically.
- Keep it the **idempotency source** too (a `detected`/terminal record means
  "already seen" — folds in SM-03's dedup).
- Firestore indexes for the dashboard's common queries (by `status`, by
  `detectedAt` desc, by `year`).

## Acceptance criteria (TDD)
- Each stage transition writes the expected fields + timeline entry (mocked).
- A failed stage sets `status=failed` with `error.stage/message`, no further
  progression.
- Re-processing an existing `fileId` is detected via this record (no dup work).

## Notes
Write this model as the pipeline is built (SM-03..SM-08 populate it); the
dashboard tickets only read it. Rows in the sheet remain the system of record
for *data*; `pipeline_runs` is the system of record for *processing status*.
