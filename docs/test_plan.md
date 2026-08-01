---
title: Test Plan
section: Development
category: Testing
requiresLogin: false
---
# Test Plan (English)

> **Status: stub.** The Docs-first English test plan the SDET turns into Jest
> tests before the Developer implements each ticket. Filled per ticket.

## Testing approach
TDD is enforced (see `AGENTS.md`). For each ticket the SDET writes failing
**Jest** tests from the scenarios below, then the Developer implements until
green. External Google APIs (Drive, Sheets, Gemini) are mocked in unit tests.

## Scenarios by ticket

### SM-05 — Extraction contract
- Given a sample newsletter PDF, Gemini returns all 13 required fields.
- A price printed as a range (`47,500 - 46,500`) is preserved verbatim as a
  string, not coerced to a number.
- A response missing a required field fails Zod validation and raises an alert
  rather than writing a partial row.

### SM-06 / SM-07 — Routing & append
- A record for a year with no tab creates `Data_<year>` with the correct headers
  before appending.
- A record for an existing year appends to that tab.
- Re-processing the same issue date / `fileId` does **not** create a duplicate
  row (idempotency).

### SM-02 / SM-03 — Ingestion
- A push webhook with valid `X-Goog-*` headers for a file inside the target
  folder tree is accepted; one outside it is ignored.
- A duplicate Drive notification for an already-processed file is a no-op.

_Additional scenarios added as tickets are refined._
