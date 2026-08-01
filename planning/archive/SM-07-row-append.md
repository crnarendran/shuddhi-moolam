---
id: SM-07
title: Row mapping + idempotent append
type: ticket
points: 3
status: in-review
depends_on: [SM-06]
tags: [backlog, routing, sheets, idempotency]
---
# SM-07 — Row mapping + idempotent append

## Goal
Append an extracted record as a new row on the correct year tab, exactly once.

## Scope
- Map the validated record → a row array in the canonical column order (shared
  with SM-06 headers and the domain contract).
- Append to the bottom of the `Data_<year>` tab via the Sheets API.
- **Idempotency:** do not append a row for a `newsletter_issue_date` /`fileId`
  that already has one. Enforce via the Firestore processed store (SM-03) and/or
  a check against existing rows; document which is authoritative.

## Acceptance criteria (TDD)
- A new record appends exactly one correctly-ordered row (mocked Sheets client).
- Re-processing the same issue/file appends **no** additional row.
- Field order in the appended row matches the tab headers.

## Notes
- This closes the happy path end to end (Drive → Gemini → Sheet). Failures here
  feed SM-08.
