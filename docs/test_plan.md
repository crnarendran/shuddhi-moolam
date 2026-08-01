---
title: Test Plan
section: Development
category: Testing
requiresLogin: false
---
# Test Plan

This document outlines the testing strategy, test coverage requirements, automated Jest suite structure, and end-to-end (E2E) scenario specifications for the **Shuddhi-Moolam** pipeline.

---

## Testing Approach & Philosophy

Shuddhi-Moolam strictly enforces **Test-Driven Development (TDD)** as defined in [AGENTS.md](file:///c:/Naren/shuddhi-moolam/AGENTS.md). 

1. **SDET Responsibility**: The SDET writes failing unit, integration, and E2E Jest test suites based on ticket acceptance criteria before implementation begins.
2. **Developer Responsibility**: The Developer implements features to make the tests pass without altering test assertions.
3. **Mocking External Dependencies**: External Google APIs (Google Drive API, Google Sheets API, and Gemini Generative Language API) and Firebase Admin SDK dependencies are mocked in unit/integration tests to ensure isolation, speed, and determinism.

---

## Unit & Integration Test Strategy

The Jest test suite lives in `functions/src/` and is executed via `npm test`.

### 1. Gemini Extraction (`functions/src/gemini/extract.ts`)
- **Schema Validation**:
  - Tests verify that `extractPricesFromPdf` returns all 13 required fields specified in `extractionRecordSchema`.
  - Verifies that price ranges (e.g. `47,500 - 46,500`) and numeric strings are preserved verbatim without numeric coercion.
  - Verifies that missing fields default to explicit empty string `""` rather than `null` or `undefined`.
- **Retry Logic & Backoff**:
  - Simulates API network errors to verify retry behavior up to 3 attempts with exponential backoff.
  - Verifies that `ZodError` validation failures and JSON parse failures fail fast and do not retry.

### 2. Sheets Routing & Append (`functions/src/sheets/`)
- **Tab Management (`routing.ts`)**:
  - Tests verify `ensureYearTab(year)` checks existing tabs on spreadsheet `MASTER_SHEET_ID`.
  - Verifies that if `Data_<year>` exists, no creation call is fired.
  - Verifies that if `Data_<year>` does not exist, `batchUpdate` creates the sheet and `values.update` populates `SHEET_HEADERS` at `Data_<year>!A1`.
- **Row Appending (`append.ts`)**:
  - Verifies `appendRow` maps `ExtractionRecord` fields strictly matching `SHEET_HEADERS` order.
  - Verifies dynamic end column letter calculation (`A` through `M` for 13 fields).
  - Verifies `valueInputOption: 'USER_ENTERED'` is passed to Google Sheets API.

### 3. Drive Ingestion & Webhooks (`functions/src/drive/`)
- **Header Validation & Channel Authorization (`webhook.ts`)**:
  - Verifies 400 Bad Request if `x-goog-channel-id` or `x-goog-resource-id` headers are missing.
  - Verifies 403 Forbidden if channel metadata does not match `_system/watch_state/current`.
  - Verifies 200 OK immediate return for `x-goog-resource-state: sync`.
- **Folder Ancestry Checking (`webhook.ts`)**:
  - Verifies `checkAncestry(fileId)` recursively climbs file parent hierarchy up to depth 10.
  - Returns `true` if root folder `1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb` is in the path; returns `false` otherwise.
- **Deduplication Check**:
  - Verifies that files existing in `_system/processed_pdfs` or `_system/pending_pdfs` are skipped.
- **PDF Download & Validation (`download.ts`)**:
  - Verifies file size limit check (rejects files > 15 MB).
  - Verifies MIME type check (rejects non-PDF files).

### 4. Pipeline Orchestration (`functions/src/pipeline/process.ts`)
- **Lifecycle Execution**:
  - Tests verify full sequence on Firestore document creation in `_system/pending_pdfs/{fileId}`: `downloadPdf` → `extractPricesFromPdf` → `ensureYearTab` → `appendRow` → update `_system/processed_pdfs` → delete `_system/pending_pdfs`.
- **Error Handling & Dead Letter Queue**:
  - Verifies that unhandled exceptions during extraction/routing capture the error message, write a document to `_system/dead_letters/{fileId}`, delete `_system/pending_pdfs/{fileId}`, and invoke `sendAlert`.

---

## End-to-End (E2E) Test Scenarios

E2E scenarios validate full multi-component integration flows:

### Scenario E2E-1: Standard Newsletter Upload (Happy Path)
- **Given**: A valid PDF newsletter (`MMRW27072026.pdf`) for issue date `JULY 27-AUGUST 02, 2026`.
- **When**: The file is added to Drive folder `1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb` and a Drive push webhook arrives.
- **Then**:
  1. `driveWebhook` validates ancestry and creates `_system/pending_pdfs/{fileId}`.
  2. `processPendingPdf` triggers, downloads PDF bytes, and invokes Gemini.
  3. Gemini returns validated 13-field record with `year: 2026`.
  4. `ensureYearTab` confirms `Data_2026` exists (or creates it with headers).
  5. `appendRow` appends the row containing exact pricing strings.
  6. `_system/processed_pdfs/{fileId}` is written with `status: completed` and token count.
  7. `_system/pending_pdfs/{fileId}` is removed.

### Scenario E2E-2: Duplicate Notification Idempotency
- **Given**: A file `fileId_123` already present in `_system/processed_pdfs`.
- **When**: A duplicate Drive push notification for `fileId_123` is received by `driveWebhook`.
- **Then**: `driveWebhook` checks Firestore deduplication lock, logs that file is already processed, and returns 200 OK without creating a pending document or duplicate sheet row.

### Scenario E2E-3: New Year Tab Creation & Rollover
- **Given**: Master sheet containing only `Data_2025` and `Data_2026` tabs.
- **When**: A newsletter for publication year `2027` is processed.
- **Then**: `ensureYearTab(2027)` fires a `batchUpdate` adding tab `Data_2027`, writes canonical headers to `Data_2027!A1`, and appends the 2027 row to `Data_2027`.

### Scenario E2E-4: Extraction Failure & Dead Letter Queueing
- **Given**: A corrupt PDF or PDF with unparseable market tables.
- **When**: `processPendingPdf` executes and Gemini extraction fails Zod validation.
- **Then**:
  1. `processPendingPdf` catches the error.
  2. Document `_system/dead_letters/{fileId}` is created with `status: failed` and detailed error reason.
  3. Pending lock `_system/pending_pdfs/{fileId}` is deleted.
  4. `sendAlert` sends a notification payload to `ALERT_WEBHOOK_URL`.

### Scenario E2E-5: Operational Manual Reprocess
- **Given**: A file ID `fileId_failed` sitting in `_system/dead_letters`.
- **When**: An operator deletes `_system/dead_letters/fileId_failed` and creates `_system/pending_pdfs/fileId_failed`.
- **Then**: `processPendingPdf` triggers immediately, successfully processes the file, and moves the lock to `_system/processed_pdfs/fileId_failed`.

---

## Test Execution Commands

From the `functions/` directory:
```bash
# Run unit and integration tests
npm test

# Run build compilation check
npm run build
```
