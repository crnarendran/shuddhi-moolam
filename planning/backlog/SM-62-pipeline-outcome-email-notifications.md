---
id: SM-62
title: Pipeline outcome email notifications (success + failure via Resend)
type: feature
status: pending
points: 3
depends_on: [SM-05, SM-07, SM-11, SM-41, SM-56, SM-57]
tags: [backlog, pipeline, email, notifications, telemetry, drive]
---
# SM-62 — Pipeline outcome email notifications (success + failure)

## Goal
Send an outcome email whenever a newsletter PDF dropped into the watched Google
Drive folder finishes processing (`status: 'appended'`) or fails at any stage
(`status: 'failed'`), so the uploader and founders get immediate visibility into
what happened without manually checking the dashboard Monitor tab.

## Why
Currently (`functions/src/pipeline/process.ts`), `processPendingPdf` silently
updates Firestore `pipeline_runs/{fileId}` on success and only fires a generic
webhook alert (`sendAlert`) on failure. Users who drop a newsletter PDF into the
Drive folder (or whose email rule drops it there) receive zero email feedback on
whether extraction succeeded or failed.

## Architecture & Design
Reuses the existing **Resend** email infrastructure introduced in
[SM-41](../archive/SM-41-readonly-company-sharing.md) (`functions/src/sharing/email.ts`,
`RESEND_API_KEY` secret, `FROM = 'Shuddhi-Moolam <sai-shuddhi-moolam-no-reply@narensportal.com>'`)
and aligns with [ADR-001](../../knowledge/adr/001-event-driven-architecture.md).

### 1. Capture Drive Uploader Email (`functions/src/drive/download.ts`, `telemetry.ts`)
- In `downloadPdf(fileId)` (`functions/src/drive/download.ts`), expand
  `drive.files.get` fields to `'mimeType, size, name, lastModifyingUser(emailAddress), owners(emailAddress)'`
  and return `uploaderEmail?: string` (`lastModifyingUser?.emailAddress || owners?.[0]?.emailAddress`).
- Persist `uploaderEmail` when recording the `'extracting'` stage in
  `processPendingPdf` (`recordStage(fileId, 'extracting', { fileName: filename, ...(uploaderEmail ? { uploaderEmail } : {}) })`).
- Add `uploaderEmail?: string` and
  `notification?: { emailSent: boolean; recipients: string[]; sentAt: number }`
  to `PipelineRun` in `functions/src/pipeline/telemetry.ts`.

### 2. Recipient Resolution (`functions/src/pipeline/outcomeEmail.ts`)
- Every outcome email (success or failure) is sent to the **deduplicated,
  lowercased union** of:
  1. `uploaderEmail` from Drive metadata (ignoring `*.gserviceaccount.com`
     service account addresses if a bot/SA touched the file), and
  2. `FOUNDER_EMAILS` (`['crnarendran@gmail.com', 'mvsaikishore@gmail.com']`,
     shared with `functions/src/sharing/entitlements.ts`).

### 3. Outcome Email Content & Formatting (`functions/src/pipeline/outcomeEmail.ts`)
- **Degraded mode:** If `RESEND_API_KEY` is unset at runtime, log a warning and
  return `false` without throwing or failing the pipeline run.
- **Success Email (`sendPipelineSuccessEmail`):**
  - **Subject:** `Shuddhi-Moolam: Processed <filename> (Issue <record.date>)`
  - **Summary metadata:**
    - File name (`filename`)
    - Extracted issue date (`record.date`, `dd/MM/yyyy`)
    - Target Google Sheet tab (`tabTitle`) & Action (`APPEND`, `UPDATE`, or
      `MANUAL_OVERRIDE_KEPT` when `SM-57` sticky guard applies)
    - Processing duration (`durationMs` formatted in seconds) & estimated
      Gemini cost (`estCostUsd` + total tokens)
    - If `qualityOutliers` (SM-56) or `autoVsManualDiffs` (SM-57) are non-empty,
      render a compact warning callout summarizing the flagged items.
  - **16 Core Commodities Table:**
    - Iterate `COMPONENTS.filter((c) => c.tier === 'core')` from
      `functions/src/gemini/components.ts` and render a compact HTML table:
      `Commodity | Market | Price (₹/kg)` using the normalized values from
      `record` (showing `—` if empty).
  - **Direct links:**
    - Dashboard Price Review (`${APP_BASE_URL}/#price-review`) and Monitor
      (`${APP_BASE_URL}/#monitor`)
    - Master Google Sheet
      (`https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/edit`)
- **Failure Email (`sendPipelineFailureEmail`):**
  - **Subject:** `Shuddhi-Moolam: Failed to process <filename || fileId>`
  - **Failure details:**
    - File name (from run doc or Drive metadata) & Drive `fileId`
    - Exact failing stage (`downloading`, `extracting`, `routing`, `upserting`)
    - Error reason (`error.message`)
    - Timestamp
  - **Direct link:**
    - Dashboard Monitor tab (`${APP_BASE_URL}/#monitor`) with a call-to-action
      to inspect or click **Reprocess**.

### 4. Wire into `processPendingPdf` (`functions/src/pipeline/process.ts`)
- Bind `RESEND_API_KEY` secret in `processPendingPdf`'s `onDocumentWritten`
  options alongside `GEMINI_API_KEY`.
- Track `currentStage` (`'downloading'`, `'extracting'`, `'routing'`,
  `'upserting'`) across the `try` block so the `catch` handler records the
  actual failing stage in `recordStage(fileId, 'failed', { error: { stage: currentStage, message: error.message } })`.
- After recording `'appended'` (including the `manualOverrideKept` path), call
  `sendPipelineSuccessEmail(...)` and store `notification: { emailSent, recipients, sentAt }`
  on the `pipeline_runs/{fileId}` doc.
- In the `catch` block (after `recordStage(fileId, 'failed', ...)` and
  `sendAlert(...)`), call `sendPipelineFailureEmail(...)` and store
  `notification: { emailSent, recipients, sentAt }` on `pipeline_runs/{fileId}`.

## Acceptance Criteria / TDD
- Unit tests (`functions/src/pipeline/outcomeEmail.test.ts`,
  `functions/src/pipeline/process.test.ts`, `functions/src/drive/download.test.ts`):
  - Recipient resolution deduplicates `uploaderEmail` + `FOUNDER_EMAILS` and
    filters out `*.gserviceaccount.com` emails.
  - Success email HTML includes file name, issue date, target Sheet tab,
    `APPEND`/`UPDATE` action, duration/cost, all 16 core commodity labels +
    values, and links to Dashboard + Master Sheet.
  - Failure email HTML includes file name/`fileId`, the exact failing stage,
    error message, and link to `${APP_BASE_URL}/#monitor`.
  - Missing `RESEND_API_KEY` or Resend API error logs a warning/error and
    returns `false` without throwing or failing `processPendingPdf`.
- All existing and new Jest tests in `functions/` pass (`npm test`), and strict
  80-char line limit + JSDoc lint rules (`npm run lint`) pass with 0 errors.
