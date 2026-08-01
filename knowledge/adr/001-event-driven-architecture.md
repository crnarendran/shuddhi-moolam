---
type: adr
tags: [adr, architecture, serverless, gemini, drive, sheets]
status: accepted
date: 2026-08-01
---
# ADR 001 — Serverless event-driven pipeline with structured-output extraction

## Status
Accepted (2026-08-01) — foundational; supersedes nothing.

## Context
We need to convert weekly, table-heavy PDF newsletters into structured rows in
a master Google Sheet with near-zero human involvement. The source PDFs change
layout, pagination, and formatting over time, and prices are frequently printed
as ranges (`47,500 - 46,500`). Volume is low (roughly one file per week) and
bursty (arrives whenever a human uploads it). Cost sensitivity is high — this is
a small back-office automation, not a high-throughput service.

## Decision

1. **Event-driven, serverless compute.** A Google Drive `changes.watch` push
   notification triggers a **Firebase Cloud Function** per uploaded file. No
   polling, no always-on server — cost scales to ~zero at idle, which suits the
   weekly-bursty volume.

2. **AI extraction, not templates.** Gemini (Flash tier for cost/speed) reads
   the PDF directly. This absorbs source-layout changes that would repeatedly
   break a regex/template parser, at a per-file cost that is trivial at this
   volume.

3. **Structured outputs enforced by schema.** The Gemini call uses
   `response_mime_type: "application/json"` constrained by a schema, and the
   response is validated with **Zod** before any write. This turns "LLM might
   return prose" into a hard, testable contract (see `knowledge/domain_model.md`).

4. **Prices captured as strings.** Ranges and units are preserved verbatim
   rather than coerced to numbers, keeping the sheet faithful to the source.

5. **Dynamic year-routing in Sheets.** The publication year (from the schema's
   `year` field) selects the `Data_<year>` tab; the tab is created with headers
   on first use, then rows are appended.

6. **Firestore for state.** Drive channel/watch state and a processed-file dedup
   store live in Firestore, giving idempotency against Drive re-notifications
   and channel renewals.

## Consequences

- **Positive:** minimal idle cost; resilient to source-format drift; a strict,
  unit-testable extraction contract; clean per-year data partitioning.
- **Trade-offs / risks:**
  - Drive push channels expire (~7 days) and must be renewed on a schedule —
    a dedicated scheduled function (ticket SM-02) owns this, or notifications
    silently stop.
  - Gemini extraction is non-deterministic; the Zod contract + idempotency +
    an alert-on-validation-failure path (SM-05, SM-08) are the guardrails.
  - Requires Blaze billing and three enabled Google APIs plus a service account
    with Drive/Sheet access — all human-provisioned prerequisites tracked in
    `knowledge/infrastructure.md` (Known Gaps).

## Related
- `knowledge/domain_model.md` — the extraction contract this ADR commits to.
- `planning/backlog/` — SM-01…SM-10 implement this architecture.
