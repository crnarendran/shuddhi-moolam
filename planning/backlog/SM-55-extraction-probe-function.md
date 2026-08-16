---
type: ticket
id: SM-55
tags: [planning, functions, admin, extraction, tooling]
status: in-review
points: 2
depends_on: [SM-28, SM-54]
---
# SM-55 — Admin extraction-probe Cloud Function (side-effect-free)

## Problem
To decide how to fix the large-file (16 MB → File-API) extraction errors
(inoculant misread as 200; SM-54 rounding) we need to A/B extraction configs on
real PDFs — but the Gemini key is a prod secret (not available locally), and we
must NOT write test runs into the master Sheet.

## Decision (user-requested)
A Cloud Function runs the tests with the deployed `GEMINI_API_KEY` secret, reads
a Drive PDF, re-runs the extractor with a chosen thinking budget / route N
times, and returns only the watched fields — **no writes** to Sheet or
Firestore.

## Scope
- `functions/src/gemini/extract.ts`: `extractPricesFromPdf(buffer, options?)`
  where options = `{ thinkingBudget?, forceInline? }`; also returns
  `route: 'inline' | 'file-api'`. Backward compatible (pipeline call unchanged).
- `functions/src/admin/probeExtraction.ts`: admin-only `onCall`
  (`secrets: [GEMINI_API_KEY]`, 540s, 1GiB). Input `{ fileId, thinkingBudget?,
  forceInline?, runs? }`. Downloads via `downloadPdf`, extracts `runs` times,
  returns per-run `route` + watched ferro-alloy/pig-iron fields + tokens. No
  side effects.
- `index.ts` export + `deploy.yml` FUNCS.
- `AdminPage.tsx`: an "Extraction probe" card (file dropdown of the test PDFs,
  thinking-budget select, runs, run button, results table). Client callable
  timeout raised to 540s.

## Test matrix (to run once deployed)
| File | Route | Budget | Q |
|---|---|---|---|
| MMRW29062026 (16.7 MB) | File-API | 1024 ×2 | reproduce + determinism |
| MMRW29062026 (16.7 MB) | File-API | 4096 ×2 | does thinking budget fix it? |
| MMRW25052026 (1.4 MB) | inline | 1024 | control (should be correct) |

## Notes
- The Drive service account (functions ADC, `drive.readonly`) must be able to
  read the test folder — share it with the same SA the watched pipeline folder
  uses. A Drive 403 means it isn't shared.
- Extract tests updated for the new `route` field; 10/10 pass; lint/build clean.
