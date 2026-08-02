---
id: SM-15
title: Historical / bulk backfill of existing PDFs
type: ticket
points: 3
status: done
depends_on: [SM-05, SM-07, SM-11]
tags: [backlog, ingestion, resilience, backfill]
---
# SM-15 — Historical / bulk backfill of existing PDFs

## Resolution (2026-08-02 — DONE, no code)
Resolved operationally: the user ingested **all** historical newsletters through
the **regular ingestion path** (Drive drop → pipeline), so `historical_prices`
now holds the full history and the seasonal/cost-impact views (SM-20/SM-26) have
their data. The dedicated automated backfill tool was therefore **not built**.
Re-open only if a **watch-gap recovery** tool (catch files missed while a Drive
channel was expired) is later wanted — that was the ticket's secondary purpose.

## Goal
Process PDFs that the event trigger won't catch on its own: files already sitting
in the folder tree before the watch was set up, and any dropped during a watch
outage (an expired/un-renewed channel — see SM-02). Without this, those files are
silently never ingested.

## Scope
- An **admin-triggered** entry point (callable/HTTP function, gated to admins;
  or a one-off script) that recursively lists every PDF under the target folder
  tree (`DRIVE_ROOT_FOLDER_ID`) via the Drive API.
- For each file, consult the `pipeline_runs` store (SM-11): **skip** anything
  already `appended`/in-progress; run the rest through the *same* extraction →
  routing path (SM-04/05/06/07) — no separate code path, so behavior matches
  live ingestion exactly.
- **Rate-limit / batch** the run so a large backlog doesn't burst past Gemini
  quota or Sheets write limits (configurable concurrency + delay).
- Optional filters: only files newer than a given date, or a specific subfolder.
- Every backfilled file writes `pipeline_runs` like any other, so it shows up in
  the dashboard (with a `source: backfill` marker for clarity).

## Acceptance criteria (TDD)
- Recursively enumerates all PDFs under the folder tree (mocked Drive), skips
  already-processed files, and runs the remainder exactly once.
- A second backfill run is a no-op (idempotent — no duplicate rows).
- Honors the batch/concurrency limit and the optional date/subfolder filter.

## Notes
Doubles as the **recovery tool** after a Drive-channel gap: run it to catch up on
anything missed while notifications were down. Requires the same Drive/Sheets/
Gemini prerequisites as the live pipeline (`infrastructure.md` → Known Gaps).
