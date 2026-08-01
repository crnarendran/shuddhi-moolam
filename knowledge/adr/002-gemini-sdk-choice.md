---
status: accepted
date: 2026-08-01
decision-makers: Architect
---
# 002. Gemini SDK Choice

## Context
We need to call Gemini 1.5 Flash to extract structured data from PDFs. We could use Vertex AI or the Google AI Studio SDK.

## Decision
We will use the Google AI Studio SDK (`@google/generative-ai`) via the `GEMINI_API_KEY` rather than the Vertex AI SDK.

## Consequences
- **Pros:** Avoids region-specific 404 errors that happen with newer models on Vertex if the region doesn't support them yet. Simpler authentication (just an API key).
- **Cons:** Bypasses GCP IAM for this specific call (relies on a secret key).
