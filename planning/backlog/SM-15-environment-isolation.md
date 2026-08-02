---
title: "SM-15: Backend Environment Isolation"
status: "in-progress"
points: 5
assigned_to: "Developer"
---

# SM-15: Backend Environment Isolation (Dev/Staging/Prod)

## Context
Currently, all deployed backend environments run on the same Firebase project but listen to the exact same Drive Folder and exact same Firestore Collection (`pipeline_runs`). This causes duplication and data corruption across environments. We must implement isolated environment contexts.

## Requirements

1. **Configuration Map (`functions/src/config.ts`)**:
   Create a central config that reads `process.env.APP_ENV` (defaults to 'dev') and exports:
   - `DRIVE_ROOT_FOLDER_ID`
   - `MASTER_SHEET_ID`
   - `FIRESTORE_COLLECTION` (`pipeline_runs_dev`, `pipeline_runs_staging`, or `pipeline_runs`)

   Use these explicit mapping IDs provided by the user:
   - **Dev**: Drive `1rvSE-rAW2mf1krmCepYM9va9oHoFEDNN`, Sheet `1XgYRTqWmiFoHmSrN-sWAxzDzxEl_YeKGeUk-XqMtpgE`
   - **Staging**: Drive `19Dbuq7mq94oRninpgRmDLj7EGNmCqamb`, Sheet `15xWbByMNZ8nyK9CObZfbQ-_YxGrUJEe8uwnIN4CpYcY`
   - **Prod**: Drive `1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb`, Sheet `1DNB8wkqGiVZ1fED4tSVI43PdNY6cY9NdYO6HsZJ-hoY`

2. **Backend Services (`functions/src/`)**:
   - `drive/webhook.ts`: Refactor to use the config `DRIVE_ROOT_FOLDER_ID` instead of hardcoding or raw `process.env`.
   - `pipeline/process.ts`: Refactor `onDocumentWritten` to trigger on `${FIRESTORE_COLLECTION}/{fileId}` instead of `pipeline_runs/{fileId}`. (You may need to export a factory or use a dynamic trigger path string if v2 supports it). Note: v2 `onDocumentWritten` takes a string. If the trigger path is evaluated at deployment time, `require('./config').FIRESTORE_COLLECTION` works perfectly.
   - `telemetry.ts`: Write to `config.FIRESTORE_COLLECTION`.
   - `sheets/append.ts` & `routing.ts`: Use `config.MASTER_SHEET_ID`.
   - `.github/workflows/deploy.yml`: REMOVE the line that echoes `MASTER_SHEET_ID` into `functions/.env` because the code will now handle it via `config.ts` mapping.

3. **Frontend Dashboard (`dashboard/`)**:
   - Append `VITE_FIRESTORE_COLLECTION=pipeline_runs_dev` to `dashboard/.env.dev`
   - Append `VITE_FIRESTORE_COLLECTION=pipeline_runs_staging` to `dashboard/.env.staging`
   - Append `VITE_FIRESTORE_COLLECTION=pipeline_runs` to `dashboard/.env.main`
   - Update `FileMonitor.tsx`, `SummaryMetrics.tsx`, and `FileDetailPanel.tsx` to read the collection name from `import.meta.env.VITE_FIRESTORE_COLLECTION || 'pipeline_runs'` instead of hardcoded strings.

4. **Security Rules (`firestore.rules`)**:
   - Update `match /pipeline_runs/{document=**}` to `match /pipeline_runs{env}/{document=**}` (e.g. `match /{collection}/{document=**} { allow read: if collection.matches('pipeline_runs.*') ... }` or explicit matches for the three collections) to allow the frontend to read them.

## Acceptance Criteria
- Running `npm run lint` and `npm test` in `functions` and `dashboard` succeed.
- There are no hardcoded string overlaps for external resources between dev and prod.
