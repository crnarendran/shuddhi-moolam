---
id: SM-29
title: Cost-optimized extraction — kill thinking-token blowup, large-PDF handling
type: ticket
points: 8
status: in-progress
depends_on: [SM-05, SM-24, SM-28]
tags: [backlog, gemini, cost, extraction, large-pdf, telemetry]
---
# SM-29 — Cost-optimized extraction

## Root cause of the ~£8 prod backlog bill
The pipeline model `gemini-3.6-flash` is **thinking-enabled**. Reasoning
("thinking") tokens are billed at the output rate but the API reports them in a
separate `thoughtsTokenCount`, **not** in `candidatesTokenCount`. The SM-24
telemetry summed only `promptTokenCount + candidatesTokenCount`
(831,236 in / 27,022 out across 75 runs — pennies), so the true cost was hidden.
There were **0 duplicate runs and 0 retries**; the whole overage was unbilled
thinking tokens. The 16.7 MB `MMRW29062026.pdf` played no role — it is rejected
by the 15 MB guard before Gemini (£0), though that means it is silently missing
from the data (a separate correctness bug, see Phase 2).

## Phased plan (right-size the fix — don't over-build)

### Phase 1 — DONE (this change, dev)
The single change that removes the cost multiplier + makes it observable:
- **Disable thinking**: `extract.ts` sets `thinkingConfig.thinkingBudget = 0`
  (cast through — the field is absent from `@google/generative-ai@0.24.1` types
  but honoured by the REST API). Model stays `gemini-3.6-flash` for now (do NOT
  drop to flash-lite globally — see Phase 3 note on the grid).
- **Fix the telemetry blindspot**: capture `thoughtsTokenCount` +
  `totalTokenCount`; `cost.ts` bills thinking tokens at the output rate;
  `process.ts` stores `thinkingTokens` + `totalTokens` in `pipeline_runs.gemini`.
  A recurrence can never hide again.
- Tests: cost (thinking billing), extract (captures thoughtsTokenCount),
  telemetry type extended. functions tsc + suites green.
- **Verify on deploy**: re-run ONE file in dev and confirm `thoughtsTokenCount`
  ≈ 0 and per-file cost drops ~8x. This alone likely resolves the bill.

### Phase 2 — Large-PDF handling (correctness) — DONE (dev)
Oversized issues (e.g. 16.7 MB) previously dead-lettered and were missing from
the data. Fixed:
- `extract.ts` now uploads via the **Gemini File API**
  (`GoogleAIFileManager` from `@google/generative-ai/server` — already in the
  installed SDK, no migration needed): upload buffer → poll `FileState` until
  ACTIVE → `generateContent` with a `fileData` part → delete the uploaded file
  in a `finally`. This removes the ~20 MB inline-request cap.
- `download.ts` `MAX_PDF_SIZE_BYTES` raised to **50 MB** (env-overridable via
  `MAX_PDF_SIZE_MB`) — the Drive-download guard, distinct from the Gemini
  upload path.
- Tests mock the File API (upload/poll/FAILED/cleanup). functions tsc + suites
  green.
- A size-aware compression pre-step remains optional (not needed once slicing
  lands, Phase 3).

### Phase 3 — Token minimization + QA gate — DEFERRED (decided 2026-08-09)
**Not implemented, by decision.** Phase 1 removed the thinking tokens, so the
per-file cost is already ~$0.0004 (≈ $0.03 for the whole 75-file backlog);
slicing would save pennies. It also carries downsides in the CF Node-20 runtime:
- The `pdftotext -layout` hybrid + QA-diff **cannot run in Cloud Functions**
  (`pdftotext` is a native poppler binary, not in the runtime; Ghostscript
  compression has the same problem).
- Page-slicing needs a fragile `pdfjs-dist` dependency in CF just to locate the
  price pages, and a missed header would **silently drop a price** — a
  correctness risk for negligible savings.
- Phase 2 (File API) already solved the large-file problem independently.

**Revisit only if** the post-deploy per-file cost measurement (see Phase 1
verify step) shows cost is still meaningful. If revived, build page-slicing
conservatively: detect price pages, and **fall back to the full PDF whenever
detection is not confident** so it can never drop data. The pdftotext hybrid
would require a pure-JS text oracle (`pdfjs`) or bundling poppler.

## Review notes (carry into Phase 2/3)
- **Model choice for the grid**: the 2D Domestic Prices grid (Al/Cu/Tin/Zn/Pb/Ni
  + LME) has **no pdftotext oracle**, so the QA cross-check can't protect it —
  accuracy rests on the model. Use **flash (not flash-lite)** for that one page;
  cost is trivial for a single page. flash-lite is fine for anything with a
  deterministic oracle.
- **Two size limits are distinct**: Drive-download guard vs Gemini upload limit —
  slice/File-API addresses the upload side; the download guard must still allow
  the big original in.
- **Confirm the diagnosis directly** before deep work: pull the GCP Billing SKU
  breakdown and/or log full `usageMetadata` on one run to see total ≫ in+out.

## Acceptance
- Phase 1: per-file cost drops ~8x in dev; `pipeline_runs.gemini` records
  thinking + total tokens; dashboards reflect true cost.
- Phase 2: a >15 MB issue extracts successfully instead of dead-lettering.
- Phase 3 (if pursued): LLM touches ≤1 page/issue; QA mismatches flagged.
