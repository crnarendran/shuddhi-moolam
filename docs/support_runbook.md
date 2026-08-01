---
title: Support & Operations Runbook
section: Support
category: General Support
requiresLogin: true
isInternal: true
---
# Support & Operations Runbook

This internal runbook details operational procedures, infrastructure components, debugging strategies, error handling, and file reprocessing steps for the **Shuddhi-Moolam** pipeline.

---

## System Overview & Architecture

The Shuddhi-Moolam pipeline is an event-driven serverless system running on Firebase Cloud Functions (v2) and Google Cloud Platform.

```
[Drive Folder] ──> driveWebhook (HTTP) ──> Firestore (_system/pending_pdfs)
                                                   │
                                            processPendingPdf
                                                   │
                                     ┌─────────────┴─────────────┐
                                     ▼                           ▼
                           extractPricesFromPdf        ensureYearTab & appendRow
                           (Gemini 1.5 Flash API)        (Google Sheets API)
                                     │                           │
                                     └─────────────┬─────────────┘
                                                   ▼
                                       Firestore (_system/processed_pdfs)
                                        or (_system/dead_letters + Alert)
```

### Core Cloud Functions (`functions/src/index.ts`)
- **`driveWebhook`**: Receives push notifications from Google Drive (`changes.watch`), filters for PDFs within folder `1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb`, performs deduplication checks, and enqueues work items.
- **`processPendingPdf`**: Triggered by `onDocumentCreated` on `_system/pending_pdfs/{fileId}`. Downloads the PDF, invokes Gemini extraction, routes to the appropriate year tab, appends the row to Google Sheets, and updates status in Firestore.
- **`renewWatch`**: Scheduled function running every 24 hours (`onSchedule`) to automatically renew Google Drive watch channels before they expire.
- **`registerWatch`**: Admin callable function (`onCall`) to manually start/register a Google Drive watch channel.

### Firestore Collections
- **`_system/watch_state`**: Stores the active Google Drive watch channel ID, resource ID, page token, expiration timestamp, and webhook URL.
- **`_system/pending_pdfs/{fileId}`**: Transient documents representing files currently queued for processing.
- **`_system/processed_pdfs/{fileId}`**: Execution record for successfully processed files containing completion status and token usage costs (`costTokens`).
- **`_system/dead_letters/{fileId}`**: Audit record for failed pipeline runs containing failure reason and timestamp.

---

## Prerequisites (Human-Provisioned)

Before the pipeline can run live in any environment:
1. **Firebase Billing**: Project `sai-shuddhi-moolam` must be on the **Blaze** plan (required for outbound network calls to Google APIs).
2. **GCP APIs Enabled**: Google Drive API, Google Sheets API, and Generative Language API.
3. **IAM & Service Account**: A dedicated service account with **Editor** permissions granted on:
   - Source Drive Folder: `1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb`
   - Master Spreadsheet: `1DNB8wkqGiVZ1fED4tSVI43PdNY6cY9NdYO6HsZJ-hoY`
4. **Environment Variables & Secrets**:
   - `GEMINI_API_KEY`: API key for Gemini Generative Language API.
   - `DRIVE_ROOT_FOLDER_ID`: `1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb`
   - `MASTER_SHEET_ID`: `1DNB8wkqGiVZ1fED4tSVI43PdNY6cY9NdYO6HsZJ-hoY`
   - `ALERT_WEBHOOK_URL`: Webhook URL for failure notifications.

---

## Deploying & Environment Promotion

The promotion flow is **`dev` → `staging` → `main`**. All environments target the single `sai-shuddhi-moolam` Firebase project, with environment isolation managed via function suffixing (`_dev`, `_staging`, or no suffix for production).

Deploys are triggered automatically via GitHub Actions on push to each respective branch:
- Push to `dev` branch deploys `driveWebhook_dev`, `processPendingPdf_dev`, etc.
- Push to `staging` branch deploys `driveWebhook_staging`, `processPendingPdf_staging`, etc.
- Push to `main` branch deploys `driveWebhook`, `processPendingPdf`, etc.

---

## Drive Watch Channel Management

Google Drive `changes.watch` notification channels expire after ~7 days. 

### Automated Renewal
The `renewWatch` function runs daily every 24 hours. If the active channel expires within 48 hours, it registers a new watch channel and stops the old one.

### Manual Channel Registration
If notifications stop or a new webhook URL needs to be registered manually:
1. Trigger the `registerWatch` callable Cloud Function via Firebase Console or Firebase CLI:
   ```bash
   firebase functions:call registerWatch --data '{"webhookUrl":"https://<region>-sai-shuddhi-moolam.cloudfunctions.net/driveWebhook"}'
   ```
2. Verify in Firestore under collection `_system/watch_state` document `current` that `channelId`, `resourceId`, and a valid future `expiration` timestamp are saved.

---

## Debugging Failures & Observability

### 1. Check `dead_letters` Collection
When `processPendingPdf` fails, it writes a failure audit document to Firestore at `_system/dead_letters/{fileId}`:
```json
{
  "status": "failed",
  "reason": "ZodError: Required field 'newsletter_issue_date' missing",
  "timestamp": "2026-08-01T15:00:00.000Z"
}
```

### 2. Failure Webhook Alerts
When processing fails, `sendAlert` posts a payload to `ALERT_WEBHOOK_URL`:
```json
{
  "title": "Pipeline Extraction Failed",
  "message": "File ID 1abc123XYZ failed to process: Extraction failed: ...",
  "fileId": "1abc123XYZ"
}
```

### 3. Cloud Logging Diagnostics
Search GCP / Firebase Cloud Logging with queries such as:
- `resource.type="cloud_function" severity>=ERROR`
- `textPayload:"Failed to process PDF"`
- `textPayload:"Data validation failed"`

---

## Reprocessing a File

To reprocess a file that failed (or to force re-extraction after updating prompt/schema logic):

1. **Locate the File ID**: Obtain the Google Drive `fileId` of the target newsletter PDF.
2. **Clear Deduplication Locks in Firestore**:
   - Open Firebase Console → Firestore Database.
   - If the file previously failed, go to `_system/dead_letters` and **delete** document `{fileId}`.
   - If the file was previously completed but needs forced re-extraction, go to `_system/processed_pdfs` and **delete** document `{fileId}`.
3. **Trigger Pending Pipeline Queue**:
   - Navigate to collection `_system/pending_pdfs`.
   - Create a new document with Document ID equal to `{fileId}`.
   - Add fields:
     - `fileId`: string (`"{fileId}"`)
     - `enqueuedAt`: number (current timestamp in ms, e.g. `1785596400000`)
4. **Verify Execution**:
   - `processPendingPdf` will automatically trigger on document creation.
   - Verify that the `_system/pending_pdfs/{fileId}` document is automatically deleted upon completion.
   - Check `_system/processed_pdfs/{fileId}` to confirm completion status and token cost.
   - Confirm row was appended to the appropriate `Data_<year>` tab in Google Sheets.

---

## Common Failures & Resolutions

| Issue / Error | Root Cause | Resolution |
|---|---|---|
| `ZodError` or `Failed to parse Gemini response` | Gemini model response failed structural validation against `extractionRecordSchema`. | Inspect log output in Cloud Logging for raw LLM response. Tune prompt in `functions/src/gemini/extract.ts` if table structure changed. |
| `File too large: X bytes exceeds limit` | Source PDF file size exceeds 15 MB cap (`MAX_PDF_SIZE_BYTES`). | Optimize/compress PDF size or raise `MAX_PDF_SIZE_BYTES` limit if legitimate. |
| `Invalid mimeType` | Uploaded file is not `application/pdf`. | Ensure only PDF documents are uploaded to watched Drive folder. |
| `MASTER_SHEET_ID environment variable not set` | Missing environment configuration in Cloud Function runtime. | Deploy environment variables via Firebase configuration / GCP secrets. |
| `Google API 403 / 404 Error` | Service Account lacks Editor permission on Drive folder or Master Sheet. | Re-share Drive folder `1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb` and Sheet `1DNB8wkqGiVZ1fED4tSVI43PdNY6cY9NdYO6HsZJ-hoY` with Service Account email. |
