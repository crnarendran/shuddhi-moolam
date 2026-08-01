---
id: SM-06
title: Year parsing + Data_<year> tab routing
type: ticket
points: 3
status: todo
depends_on: [SM-05]
tags: [backlog, routing, sheets]
---
# SM-06 — Year parsing + `Data_<year>` tab routing

## Goal
Determine the correct year tab for an extracted record and ensure it exists.

## Scope
- Derive the routing year from the record's `year` field (from the schema, not
  from "today" — a January issue can belong to the prior year's range; see
  domain model edge cases).
- Query the master Google Sheet for a tab named `Data_<year>`.
- If absent, create the worksheet with the canonical column headers (order
  matching the extraction contract) before any append.
- If present, resolve its sheetId for SM-07.

## Acceptance criteria (TDD)
- Missing tab → created once with correct headers (mocked Sheets client).
- Existing tab → reused, no duplicate creation.
- Year is taken from the record, verified against a January-rollover fixture.

## Notes
- Requires Sheets API + SA Editor on the master sheet (human prerequisite).
- Header order is a shared contract with SM-07 and the domain model — keep the
  three in sync.
