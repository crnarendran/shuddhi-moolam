---
id: SM-66
title: Dev email recipient scoping and indexless previous issue query
status: in_progress
points: 2
assigned_to: sm-orchestrator
created_at: 2026-11-04
tags: [pipeline, email, firestore, bugfix]
---

# SM-66: Dev Email Recipient Scoping & Indexless Previous Issue Query

## Context & Problem
1. When testing PDF extraction in the `dev` environment, outcome emails were being sent to both founders (`crnarendran@gmail.com` and `mvsaikishore@gmail.com`). Dev emails must be restricted solely to `crnarendran@gmail.com`.
2. Outcome emails in `dev` displayed "No previous issue found" and dashes (`—`) for all price trends and changes. Cloud Run / Cloud Functions logs revealed:
   `Error: 9 FAILED_PRECONDITION: The query requires an index. ... collectionGroups/historical_prices_dev/indexes/_ ... Field __name__ DESC`.
   Firestore Admin SDK requires a composite index for inequality + descending sort on `FieldPath.documentId()`. Default single-field index on `__name__` is ascending only.

## Solution
1. **Dev Email Scoping:**
   Update `resolveOutcomeRecipients(uploaderEmail?: string, env: string = APP_ENV)` in `functions/src/pipeline/outcomeEmail.ts`:
   - If `env === 'dev'`, return `['crnarendran@gmail.com']`.
   - If `env !== 'dev'`, retain full deduplicated recipient list (`uploaderEmail` + `FOUNDER_EMAILS`).
2. **Indexless Previous Issue Query:**
   In `functions/src/pipeline/process.ts`, query Firestore using `.where(FieldPath.documentId(), '<', docId).get()` without explicit `.orderBy(FieldPath.documentId(), 'desc')`.
   Firestore naturally returns documents ordered ascending by `__name__` (`yyyy-MM-dd`). The last document in the returned snapshot (`snap.docs[snap.docs.length - 1]`) is the closest earlier issue, eliminating the need for composite indexes.

## Acceptance Criteria
- [x] In `dev`, outcome emails are addressed only to `crnarendran@gmail.com`.
- [x] In `staging` and `prod`, outcome emails include both founders and valid uploaders.
- [x] `getPreviousIssue` does not throw an index error and correctly returns the immediately preceding issue.
- [x] Unit tests in `functions/src/pipeline/outcomeEmail.test.ts` and `functions/src/pipeline/process.test.ts` pass cleanly.
