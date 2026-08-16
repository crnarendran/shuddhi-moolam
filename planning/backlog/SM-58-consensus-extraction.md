---
type: ticket
id: SM-58
tags: [planning, functions, extraction, accuracy]
status: in-review
points: 3
depends_on: [SM-54, SM-55]
---
# SM-58 — Consensus extraction (best-of-N) + date-based column selection

## Problem
Re-extracting the same PDF gives different tonne-item readings run to run (the
SM-55 probe read `47,500`/latest column; a pipeline reprocess read `48,000`/the
older column — same file, same prompt). It's LLM non-determinism on the
two-column metallics table (ADR-006), so a single reprocess is a coin-flip on
pig-iron/scrap accuracy — not good enough for stakeholder trust. Two failure
modes: (a) wrong column (older week) because the prompt anchored on position;
(b) residual round-to-thousand too small (~1%) for the SM-56 outlier net.

## Decision (user-approved)
1. **Consensus extraction:** run the extractor N times (default 3) and take the
   per-field majority; median by value when all differ. Non-determinism is
   outvoted. Extraction is cheap (~20k tokens), so 3× is affordable.
2. **Date-based column rule:** the prompt now tells the model to pick the
   two-column value by comparing the two column DATES and taking the most
   recent — the latest may be left OR right; never decide by position.

## Scope
- `functions/src/gemini/consensus.ts`: pure `consensusValue(values)` (majority,
  median tie-break) + `mergeRecords(records)` (per-field vote; source_pages/
  filename passthrough).
- `functions/src/gemini/extract.ts`: new `extractPricesConsensus(buffer,
  options, runs=3)` (calls `extractPricesFromPdf` N times, merges, sums token
  usage); prompt two-column rule rewritten to date-based.
- `functions/src/pipeline/process.ts`: use `extractPricesConsensus` with
  `CONSENSUS_RUNS` env (default 3); timeout 300→540s (3 passes take longer).

## Notes
- Cost/latency scale ~linearly with `CONSENSUS_RUNS`; set to 1 to disable.
- Consensus reduces but can't guarantee correctness — SM-57 manual entry remains
  the deterministic ground truth; SM-56 outliers still guard gross errors.

## Tests
`consensus.test.ts` (majority, median tie-break, blanks, single-run passthrough,
outvote-a-misread). Functions 93/93 pass; lint + build clean.
