---
id: SM-12
title: Fix Schema Refactor Build Failures in Tests
status: in-review
points: 1
---

# Fix Schema Refactor Build Failures in Tests

## Problem
In the previous sprint, we renamed `newsletter_issue_date` to `newsletter_issue` in the `ExtractionRecord` schema, and modified `downloadPdf` to return `{buffer, filename}`. However, we forgot to update the corresponding mock objects in the unit tests (`functions/src/sheets/append.test.ts` and `functions/src/drive/download.test.ts`). This is causing `tsc` compilation to fail during `npm run build`, which blocks our CI/CD pipeline from deploying the changes to staging/production.

## Acceptance Criteria
- [x] Update `functions/src/sheets/append.test.ts` to use `newsletter_issue` instead of `newsletter_issue_date`.
- [x] Update `functions/src/drive/download.test.ts` to handle the new `{buffer, filename}` signature from `downloadPdf`.
- [x] `npm run build` must pass without TypeScript errors.
- [x] `npm test` must pass all test cases.
