---
id: SM-03
title: Webhook endpoint — validate, resolve fileId, filter, dedup
type: ticket
points: 5
status: todo
depends_on: [SM-01, SM-02]
tags: [backlog, ingestion, webhook, firestore]
---
# SM-03 — Webhook endpoint

## Goal
Receive Drive push notifications, safely resolve which new PDF(s) they refer to,
and hand each one off for processing exactly once.

## Scope
- HTTP Cloud Function receiving Drive's POST. Validate `X-Goog-*` headers
  (`X-Goog-Channel-ID`, `X-Goog-Resource-State`, `X-Goog-Resource-ID`) against
  the stored channel state from SM-02; reject/ignore anything else.
- Use the changes API (page token) to resolve the changed `fileId`(s); ignore
  `sync` pings and non-PDF / trashed files.
- **Filter to the target folder tree** (ancestry check) so files elsewhere in
  the drive are ignored.
- **Dedup**: consult a Firestore processed-files store; skip files already
  handled (guards against Drive re-notifications). Mark in-progress → done.
- On a new, in-scope PDF, invoke the extraction path (SM-04/SM-05).

## Acceptance criteria (TDD)
- Valid header + in-scope new file → enqueued once; processed store updated.
- Sync ping, out-of-folder file, or already-processed file → no-op.
- Invalid/unknown channel headers → rejected without side effects.

## Notes
- Keep the handler fast; do heavy work (download + Gemini) async so Drive gets a
  prompt 200. Idempotency is the load-bearing invariant — see
  `knowledge/domain_model.md`.
