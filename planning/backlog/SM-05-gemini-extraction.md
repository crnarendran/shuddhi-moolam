---
id: SM-05
title: Gemini Flash structured extraction (Zod contract)
type: ticket
points: 5
status: todo
depends_on: [SM-04]
tags: [backlog, extraction, gemini, zod]
---
# SM-05 — Gemini Flash structured extraction

## Goal
Turn a newsletter PDF into a validated structured record matching the canonical
extraction contract.

## Scope
- Define the extraction schema as **Zod**, mirroring the 13-field contract in
  `knowledge/domain_model.md` exactly (all fields required; prices are strings).
- Call Gemini (Flash tier) with the PDF, a prompt that targets each source table
  precisely, and `response_mime_type: "application/json"` + the schema.
- **Validate** the response with Zod; on failure, do not proceed to Sheets —
  raise a typed error for SM-08 to alert on.
- Retry with backoff on transient/5xx/quota errors; cap attempts; log token/cost
  usage.
- The exact prompt wording lives here (not in the domain doc) so prompt tuning
  doesn't churn the contract.

## Acceptance criteria (TDD)
- A fixture "Gemini response" with all 13 fields validates and returns a typed
  object; ranges preserved verbatim as strings.
- A response missing a required field fails validation → typed error, no write.
- Transient error path retries then surfaces a typed failure after the cap.

## Notes / escalation
- Requires the Generative Language API + `GEMINI_API_KEY` (human prerequisite).
- **SDK gotcha to verify for this stack:** newest Gemini models may need the AI
  Studio SDK (`GoogleGenerativeAI` / `@genkit-ai/googleai`) rather than Vertex
  to avoid region `404`s — confirm and record the choice in an ADR.
