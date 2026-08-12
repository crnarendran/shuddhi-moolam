---
id: SM-27
title: Capture chat cost separately
type: ticket
points: 2
status: in-review
depends_on: [SM-24]
tags: [backlog, observability, chat, cost]
---
# SM-27 — Capture chat cost separately

## Goal
Track the AI chat's cost distinctly from the pipeline's Gemini extraction cost
(SM-24), so the two never mix.

## Implemented (2026-08-03)
- `functions/src/analytics/chatUsage.ts`: `estimateTokens`, `estimateChatCostUsd`,
  and `recordChatUsage()`, which writes one doc per chat turn to an env-suffixed
  **`chat_usage`** collection (`chat_usage_dev` / `_staging` / `chat_usage`):
  `{ at, messageChars, tokensIn, estCostUsd }`.
- `chatEndpoint` calls it fire-and-forget (`void recordChatUsage(...)`) so
  logging can never break the chat.

## Caveat
The Gemini **Data Analytics** API (`DataChatServiceClient`) does not return
token counts, so input tokens are **estimated** from the message + history text
(~4 chars/token) and output tokens are recorded as 0 — an input-dominated
estimate. If exact usage is needed, switch the chat to an SDK that exposes
`usageMetadata`, or price per query/data-scanned instead.

## Follow-up (not done)
- A dashboard **"Chat cost"** tile (its own read of `chat_usage*`, gated by a
  Firestore rule allowing the dashboard owner to read `chat_usage.*`).
