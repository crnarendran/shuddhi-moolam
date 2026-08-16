---
type: adr
id: 006
tags: [adr, extraction, gemini, accuracy]
status: accepted
date: 2026-08-16
---
# ADR-006 — Extraction accuracy: large high-res PDFs, tonne rounding, and the quality safety net

## Context
Two extraction defects surfaced on the master Sheet:

1. **Rs/tonne values lost their kg decimals.** Pig Iron SG Grade-A prints
   `48,500` in the newsletter but stored as `49` (→ 48.5 lost). The tonne→kg
   conversion (`units.ts`, `String(n/1000)`) is exact and innocent — the
   **model was rounding the Rs/tonne figure to the nearest thousand** while
   reading the page.
2. **Dense ferro-alloy rows were misread.** On one issue, `inoculant_2_6mm`
   (source 308) came out as 200 — the value of *Ferro Silicon Magnesium*, a
   different row. `fe_mn_hc` (95) came out as 70 (*Steel Shots*). Three fields
   wrong on that one file; correct on every other week.

Key structural facts:
- **~half the newsletter pages are rasterized images** (pdftotext yields ~0
  chars on pages 5, 7–15), so the ferro-alloys / metallics tables must be
  **OCR-read** by Gemini. The base-metals pages are real text and extract
  perfectly.
- The one bad file was a **16 MB high-res copy** ("Copy of …"); normal issues
  are ~1.3 MB. Files > 14 MB take the **Gemini File API** path
  (`extract.ts` `inlineMaxBytes`); smaller files go **inline** (the proven
  path). A 16 MB file cannot go inline (base64 ≈ 21 MB > ~20 MB cap).

## Investigation (the probe, SM-55)
We added an admin-only, side-effect-free `probeExtraction` Cloud Function (runs
the extractor N times on a Drive PDF with a chosen thinking budget / route, no
writes) and ran a matrix on the 16 MB `MMRW29062026` vs a 1.3 MB control.

Results (raw pre-÷1000 values; want inoculant=308, fe_mn_hc=95, fe_si_mg=200):

| File / budget | route | inoculant (×2 runs) | fe_mn_hc | pig iron SG |
|---|---|---|---|---|
| 16 MB / 1024 | file-api | 225, 175 | 88, 95 | 48,500 ✓ |
| 16 MB / 4096 | file-api | 200, 200 | 95, 95 | 48,500 ✓ |
| 16 MB / 8192 | file-api | 225, 300 | 85, 95 | 48,500 ✓ |
| 1.3 MB / 1024 | inline | **308** ✓ | 95 ✓ | 49,000 ✓ |

## Findings
1. **The tonne-rounding fix (SM-54) works** — the exact figures (`48,500`,
   `45,700`) are read consistently on *every* run, including the File-API path.
2. **Thinking budget does NOT fix the dense-table OCR.** 1024/4096/8192 are all
   wrong AND non-deterministic (inoculant never 308). Raising it only burns
   tokens.
3. **The 16 MB File-API path is the culprit** for the dense ferro-alloys table;
   the ~1.3 MB inline path reads it correctly first try. High resolution does
   not help — Gemini downsamples for vision anyway.

## Decisions
- **Prefer normal-size (~1.3 MB) source PDFs.** The 16 MB high-res copy adds no
  accuracy and forces the fragile File-API path. Re-extract the standard-size
  file to fix a bad run.
- **Do NOT raise the Gemini thinking budget** for extraction — empirically
  ineffective here; keep the 1024 floor (cost control, ADR-linked to SM-29).
- **Keep the SM-54 prompt rule** (read exact figures, never round to
  thousands).
- **Add a history-based quality safety net (SM-56):** `detectOutliers` flags any
  commodity whose value deviates > 25% from the median of recent weeks; the
  pipeline logs it, records `qualityOutliers` on the run doc, and sends an
  alert. Catches this class of misread regardless of path.
- **Keep the probe (SM-55)** as the standing tool for future extraction
  diagnosis.

## Consequences
- Extraction quality is now observable (alerts + run-doc field) rather than
  silently wrong.
- Do not "fix" future dense-table misreads by turning up thinking budget or
  sending higher-res scans; both are proven dead ends. Feed normal-size PDFs
  and rely on the outlier net + re-extraction.
