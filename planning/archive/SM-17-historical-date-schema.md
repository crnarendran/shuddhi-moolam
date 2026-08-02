---
id: SM-17
title: Unified Date Schema & Historical Master Table
type: ticket
points: 5
status: in-review
depends_on: []
tags: [schema, database, analytical]
---
# SM-17 — Unified Date Schema & Historical Master Table

## Goal
Switch the extraction schema from separate `month`/`year` fields to a single `date` field (dd/MM/yyyy format) based on the newsletter's issue date. Additionally, store all successfully extracted and appended rows in a dedicated, query-friendly Firestore collection (`historical_prices`) to act as a clean master data warehouse. This enables future analytical trends and alerting features.

## Scope
- Update `functions/src/gemini/schema.ts` to replace `month` and `year` with `date: z.string()`.
- Update the Gemini prompt in `extract.ts` to parse the exact issue date (e.g. from the cover) and strictly output `dd/MM/yyyy`.
- Modify `functions/src/sheets/constants.ts` headers to use `date`.
- Refactor `functions/src/sheets/routing.ts` to extract the 4-digit year from the new `date` string so that it continues to route to the correct Google Sheets tab (e.g. `2026`).
- Define `HISTORICAL_COLLECTION` in `functions/src/config.ts` isolated by environment (`historical_prices_dev`, etc.).
- Update `functions/src/pipeline/process.ts` to insert the final `ExtractionRecord` as a document into `HISTORICAL_COLLECTION` (using `yyyy-MM-dd` as the Document ID for chronological sorting and to enforce one canonical record per issue week).
- Update all associated TS tests (`extract.test.ts`, `routing.test.ts`, `append.test.ts`, `process.test.ts`).

## Acceptance criteria
- PDFs are processed and Gemini extracts `date` in `dd/MM/yyyy` format.
- Google Sheets routing correctly parses the year and appends the row with the `date` string.
- Firestore contains a clean master table of historical prices, isolated by environment.
- Tests pass.
