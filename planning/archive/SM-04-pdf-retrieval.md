---
id: SM-04
title: PDF retrieval from Drive
type: ticket
points: 2
status: todo
depends_on: [SM-01]
tags: [backlog, ingestion, drive]
---
# SM-04 — PDF retrieval from Drive

## Goal
Given a `fileId`, obtain the PDF content for the extraction step.

## Scope
- Download the PDF bytes into memory via the Drive `files.get` (alt=media) using
  the service account, OR resolve a Drive URI to pass directly to Gemini if that
  path is chosen in SM-05 — decide and document which, one way.
- Enforce sane guards: content-type is PDF, size within a configured cap; on a
  too-large/invalid file, fail loudly (feeds SM-08 alerting) rather than sending
  garbage to Gemini.

## Acceptance criteria (TDD)
- A valid `fileId` yields a Buffer/stream (mocked Drive client).
- Non-PDF or oversize file → typed error, no download of the full payload.

## Notes
- Requires Drive API + SA access (human prerequisite). Unit-test with a mocked
  Drive client.
