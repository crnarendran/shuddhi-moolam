---
type: ticket
id: SM-54
tags: [planning, functions, extraction, accuracy, bugfix]
status: in-review
points: 1
depends_on: [SM-28, SM-40]
---
# SM-54 — Stop rounding Rs/tonne values at extraction (restore kg decimals)

## Problem
Rs/tonne commodities (melting scrap, CRCA bundles, pig iron, lam coke) landed in
the master Sheet as whole numbers (49, 47, 46) with no decimals, while Rs/kg
base metals kept full precision (347.2, 1,363.20). Verified against the source
newsletter: **Pig Iron SG Grade-A prints 48,500 in both columns, but the Sheet
stored 49** (→ 48.5 lost). The tonne→kg conversion (`units.ts`, `String(n/1000)`)
does NOT round — the model was **rounding the Rs/tonne figure to the nearest
thousand while OCR-reading page 7** (a rasterized image page), so 48,500 →
49,000 → 49 instead of 48.5.

Not a conversion bug and not a migration bug; a Gemini extraction-accuracy bug on
image-based table pages.

## Decision (user-confirmed)
- The two weekly-average columns on the page-7 melting-scrap table are dated
  **19-06 (left, older) / 26-06 (right, latest)** — the **right/latest** column
  is correct, so the existing "right-most" rule stays.
- Fix the rounding via prompt hardening (zero cost first).

## Scope
- `functions/src/gemini/extract.ts` prompt: read the EXACT printed figure
  including the hundreds digits (e.g. 48,500), never round/approximate to the
  nearest thousand; the two dated columns are NOT a range and must NOT be
  averaged — take the single value under the most-recent-dated (right-most)
  column.

## Notes
- Fixes future extractions + re-runs. Historical rows already carry rounded
  values; restoring their precision requires re-extracting those PDFs.
- If prompt-only doesn't hold on the image pages, next lever is raising the
  Gemini thinking budget (1024 → ~4096) — deferred to keep cost flat.
- Related but out of scope: the ferro-alloy misreads on page 8 (same image-OCR
  root cause), and the range upper-bound rule vs `normalizePrice` midpoint.

## Tests
Functions lint + build clean; extract Jest suite 10/10. Live verify: re-extract
MMRW29062026 and confirm Pig Iron SG Grade-A = 48.5 (not 49).
