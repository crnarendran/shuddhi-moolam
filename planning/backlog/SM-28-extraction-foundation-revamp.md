---
id: SM-28
title: Extraction foundation revamp — 23-component tiered registry + re-extraction
type: ticket
points: 8
status: in-progress
depends_on: [SM-05, SM-07, SM-18]
tags: [backlog, extraction, schema, gemini, sheets, dashboard, re-extraction]
---
# SM-28 — Extraction foundation revamp (tiered component registry)

## Goal
Expand the weekly MMR extraction from the original 13 flat fields to a curated
**component registry** driven from one source of truth, then **re-extract the
full backlog once** (dev first, then prod) so all history is rebuilt under the
new contract. Adding fields is ~free at the margin; re-running the backlog is
the only real Gemini cost, so we capture generously now to avoid re-running.

## Design (implemented on `dev`)
Single source of truth: `functions/src/gemini/components.ts` (+ hand-kept
dashboard mirror `dashboard/src/lib/components.ts`). The Zod schema, Sheets
headers, Gemini prompt, and dashboard `COMMODITIES` are all **derived** from it;
`components.test.ts` / `schema.test.ts` guard against drift.

Three visibility tiers:
- **core (16)** → master Sheet + Firestore + dashboards (required strings).
- **extended (6)** → Firestore + dashboards only, kept out of the Sheet
  (optional). Pending stakeholder sign-off to promote into the Sheet.
- **archived (9)** → Firestore only, hidden from Sheet **and** dashboards
  (optional). Captured passively for future use: `cu_lme` (Copper LME),
  `cast_iron_scrap_bhavnagar`, `heavy_melting_scrap_mumbai_pune`,
  `pig_iron_foundry_grade_b_punjab`, `steel_shots_mumbai`, `fe_mn_mc_mumbai`,
  `zinc_ingot`, `lead_ingot`, `nickel_ingot`.

Promoting a component up a tier later is a one-line `tier` change (+ optional
Sheet backfill from data already held) — **never** a re-extraction.

### Core (16): aluminium_ingot, copper_cathode, tin_ingot,
melting_foundry_scrap_mumbai, crca_bundle_mumbai, crca_bundle_chennai,
pig_iron_sg_grade_a_pune, pig_iron_foundry_gr_pune, fe_si_70_75_mumbai,
fe_mn_hc_mumbai, inoculant_2_6mm_mumbai, fe_cr_mumbai, fe_si_mg_mumbai,
low_sulp_cal_petro_coke, calcinated_petroleum_coke_9_4mm, lam_coke.
### Extended (6): sponge_iron_mg_punjab, fe_si_70_75_raipur,
fe_mn_70_75_raipur, silico_manganese_mumbai, high_fe_mn_78_raipur,
graphite_petroleum_coke_mumbai.
### Archived (1): cu_lme.

**Dropped from the old 13:** `cu_lme` moved core→archived; `cu_domestic`
renamed to `copper_cathode` (now explicitly the Pg6 domestic cathode).

## Done (this change, all tests green: functions jest + tsc + dashboard tsc)
- Registry + tests; schema rebuilt; page-referenced prompt; tier-aware
  `SHEET_HEADERS` (core-only, 20 cols); dashboard mirror + `COMMODITIES`
  (visible = core+extended); `ALERT_COMMODITIES` derived from core;
  `knowledge/domain_model.md` updated to the new contract.

## Pending (execution — hand-off candidate)
1. **Golden-fixture validation (dev):** run the new extractor against
   `MMRW03082026.pdf` (the Aug 3 2026 issue the user provided); eyeball all 23
   values vs the newsletter; tune `promptDesc` in the registry until correct.
2. **Re-extraction mechanism:** confirm/build a way to reprocess all past PDFs
   in the Drive folder (list Drive files → invoke the pipeline per file). The
   pipeline writes `historical_prices` doc id `YYYY-MM-DD` with `.set()`, so
   re-processing overwrites cleanly (drops the old field shape).
3. **Dev re-extraction:** rebuild `historical_prices_dev`; clear + re-header the
   dev master-Sheet year tabs (headers changed 15→20 cols); verify dashboards.
4. **Promote dev → staging → prod**, then the **one-time prod re-extraction** +
   prod Sheet re-header.

## Open decisions (cheap to fold in BEFORE the prod re-extraction)
- **More archived components?** ✅ Resolved 2026-08-09 — Tier 1 (Cast Iron
  Scrap, Heavy Melting Scrap, Pig Iron Foundry-B Punjab, Steel Shots, Ferro
  Manganese MC) and Tier 2 (Zinc/Lead/Nickel ingot) added to the `archived`
  tier. Registry now 31 components (16 core / 6 extended / 9 archived).
- **Extended → Sheet promotion:** stakeholder to confirm which of the 6 extended
  components graduate into the master Sheet.
- **Page-6 market:** Al/Cu/Tin currently taken as **Mumbai** (page lists Mumbai
  + Delhi).

## Acceptance
- All 23 fields extract correctly from the golden fixture in dev.
- Sheet shows only the 16 core columns; extended + archived land only in
  Firestore; dashboards show core+extended (not archived).
- Backlog fully re-extracted in dev, then prod, with no old-shape docs left.
