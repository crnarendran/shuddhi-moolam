---
id: SM-43
title: Normalize tonne→kg at import + migrate storage & master Sheet to kg
type: ticket
points: 5
status: planned
depends_on: [SM-40, SM-05, SM-07]
tags: [backlog, data, units, migration, pipeline, sheets, careful]
---
# SM-43 — Store prices in kg everywhere (not just display)

## Why
SM-40 normalizes the 10 `Rs/tonne` commodities to ₹/kg **only in the dashboard
at load** (`toCanonicalPriceRecord`); Firestore `historical_prices*` and the
master Google Sheet still store **₹/tonne**. The user wants a **single unit
(₹/kg) everywhere**, including storage + the Sheet, so nothing needs to know
about mixed units.

Tonne-priced keys (registry `unit === 'Rs/tonne'`): melting_foundry_scrap_mumbai,
crca_bundle_mumbai, crca_bundle_chennai, pig_iron_sg_grade_a_pune,
pig_iron_foundry_gr_pune, lam_coke, sponge_iron_mg_punjab,
cast_iron_scrap_bhavnagar, heavy_melting_scrap_mumbai_pune,
pig_iron_foundry_grade_b_punjab.

## ⚠️ The critical gotcha — do NOT double-divide
Gemini must keep extracting the newsletter's **native tonne** numbers (the PDF
is in ₹/tonne) — so **do not change the extraction prompt/units**. Normalize
AFTER extraction. And SM-40's dashboard-side `toCanonicalPriceRecord` **MUST be
removed in the same release** as the storage migration — otherwise the
dashboard divides already-kg values by 1000 again (shows 1000× too small).

## Plan
### 1. Import-time normalization (new data)
- Add a pure `toKgRecord(extracted)` in the pipeline (functions/): for each
  key whose registry unit is `Rs/tonne`, divide the numeric value by 1000.
  Apply it in `functions/src/pipeline/process.ts` **after** extraction and
  **before** BOTH writes — the Firestore `historical_prices*` write AND the
  Sheets append (`sheets/routing.ts`). New imports then store ₹/kg.
- Keep the registry `unit: 'Rs/tonne'` as the *source* marker (drives which
  keys to divide); add a comment that stored values are ₹/kg.

### 2. Backfill existing data (one-off, per env)
- **Firestore:** a one-off admin script/callable that reads every doc in
  `historical_prices{,_staging,_dev}`, divides the tonne-keyed fields by 1000,
  writes back. **Idempotency:** write a marker `migrations/tonne_to_kg_v1`
  (per env) and skip if present; the script must be safe to re-run.
- **Master Sheet:** per env (MASTER_SHEET_ID differs by env in config.ts), read
  each year tab, and for the tonne commodities' columns (match by
  SHEET_HEADERS_FRIENDLY label) divide each cell by 1000 and write back. Guard
  idempotency (e.g. a marker cell / Audit_Log note).

### 3. Remove the dashboard load-normalization (same release)
- Delete `toCanonicalPriceRecord` + `TONNE_KEYS` usage from
  `dashboard/src/lib/reporting.ts`, its call in `App.tsx`, and the
  `reporting.canonical.test.ts` test. After migration the dashboard reads
  ₹/kg straight from storage. (`commoditiesForView`, blendedCost, etc. are
  unaffected — they just see kg.)

### 4. Sequencing (per env: dev → staging → prod)
Because the dashboard flip (step 3) and the data (steps 1–2) must agree:
1. Deploy the branch with import-normalization (1) + dashboard-normalization
   removed (3).
2. **Immediately** run the Firestore + Sheet backfill (2) for that env.
There is a brief window between deploy and backfill where old (not-yet-migrated)
tonne rows read too large; keep it short. Verify a known value (e.g. Melting
Scrap ≈ 46–48 in ₹/kg, not 46,000) after each env.

## Acceptance
- New extractions store ₹/kg in Firestore AND the master Sheet.
- Existing Firestore + Sheet data migrated to ₹/kg; re-running the backfill is
  a no-op (idempotent).
- Dashboard shows correct ₹/kg with the SM-40 load-normalization **removed**
  (no double division). Spot-check Melting Scrap / CRCA / Pig Iron.
- Backend `%`-based alerts unaffected (scale-invariant).

## Note
The master Sheet will then read ₹/kg for these rows, which **differs from the
newsletter** (still quoted in ₹/tonne). That is the intended trade-off (uniform
kg everywhere). Consider a header note on the Sheet ("all prices ₹/kg").
