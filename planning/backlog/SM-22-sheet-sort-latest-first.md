---
id: SM-22
title: Keep master sheet sorted latest-first
type: ticket
points: 2
status: todo
depends_on: [SM-07]
tags: [backlog, sheets, pipeline]
---
# SM-22 — Keep master sheet sorted latest-first

> **Changes SM-07's "append at bottom" behaviour** (already built by the other
> session). Fold into `functions/src/sheets/` — don't build in parallel.

## Goal
After any update to a `Data_<year>` tab, the newest issue sits at the **top**
(row 2, under the header) instead of the bottom.

## Scope
- After each append (and after backfill inserts, SM-15), **re-sort the data
  range** (rows 2…N, header row 1 excluded) **descending by the `date` column
  (col B)**, newest first.
- **Chronological, not lexicographic** — the `date` is stored as `d/m/yyyy`
  (e.g. `6/4/2026`); parse to a real date key before sorting (reuse the date
  parsing the pipeline already added). A raw string sort would misorder.
- Prefer the Sheets API **`SortRangeRequest`** (server-side, atomic) over
  read-sort-write.
- **Preserve** the header row and all cell/format styling; sort each year tab
  independently.
- **Order-safe & idempotent:** a late / out-of-order / backfilled older file
  lands in its correct chronological slot after the sort, not pinned to the top.
- **Unparseable date** → keep the row, sort it to the bottom, and flag it (feeds
  SM-08); never crash the append.

## Acceptance (TDD)
- Appending an older-dated record leaves the tab sorted newest-first (mocked
  Sheets).
- Header stays row 1; formatting preserved.
- A backfill run (SM-15) of historical rows yields correct chronological order
  end-to-end.
- Bad/unparseable date handled gracefully.
