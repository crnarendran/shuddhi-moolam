---
type: concept
tags: [shuddhi-moolam, core-domain, architecture, extraction]
status: filled
section: Specs
category: Specifications
---
# Shuddhi-Moolam Domain Model

This is an **Open Knowledge Format (OKF)** file (Markdown + YAML frontmatter):
a vendor-neutral description of the domain that any agent can parse before
touching code. Read it before starting any backlog ticket.

## What this project is

Shuddhi-Moolam automates a previously manual data-entry chore: every week a
table-heavy PDF newsletter (e.g. *Minerals & Metals Review*, filenames like
`MMRW27072026.pdf`) is published with dozens of commodity prices across several
regional market tables. A human used to read the PDF and copy a fixed set of
prices into a master Google Sheet.

The pipeline replaces that with an event-driven, serverless flow:

```
Drive upload → push webhook → Cloud Function → Gemini (structured output)
             → parse year → ensure Data_<year> tab → append row
```

It is deliberately **AI-driven at the extraction step** rather than
template/regex-based, so it tolerates layout, pagination, and formatting
changes in the source PDFs without code changes.

## Core entities

- **Newsletter (source PDF):** one weekly issue. Identified by its Drive
  `fileId`; carries an **issue date range** (e.g. `JULY 27-AUGUST 02, 2026`)
  from which the routing **year** is derived.
- **Extraction record:** the structured object Gemini returns for one
  newsletter — a flat set of named price fields (see the contract below). Prices
  are captured as **strings**, not numbers, because the newsletter often prints
  ranges (e.g. `47,500 - 46,500`); preserving the exact source text is more
  faithful than lossily parsing to a single number.
- **Master sheet:** one Google Spreadsheet with one **tab per year**
  (`Data_2025`, `Data_2026`, …). Each extraction record becomes one appended
  row on the tab matching its year.

## The extraction contract (canonical)

The Gemini call MUST use structured outputs
(`response_mime_type: "application/json"`) constrained by this schema. In the
Node/TS implementation the field set lives in a single **component registry**
(`functions/src/gemini/components.ts`); the Zod schema, the Sheets headers, the
Gemini prompt, and the dashboard commodity list are all **derived** from it, so
they cannot drift. `components.test.ts` and `schema.test.ts` guard this.
Update the registry (and its dashboard mirror,
`dashboard/src/lib/components.ts`) — not the individual consumers.

**Two-tier visibility.** Every component has a `tier`:

- **`core`** — written to the master Sheet **and** Firestore **and** the
  dashboards. Required string in the schema (explicit `""` when absent, so
  missing data is visible, never silently dropped).
- **`extended`** — written to Firestore and the dashboards **only**; kept out
  of the master Sheet. Optional in the schema, so one missing supplementary
  value never fails the whole extraction.

Extraction **always captures every component** (core + extended) into
Firestore. Promoting an extended component into the Sheet later is a one-line
`tier` change in the registry (plus an optional Sheet backfill from data we
already hold) — **never** a re-extraction.

Metadata fields: `date` (issue date, `dd/MM/yyyy` — routes to the
`<year>` tab), `source_pages` (field→page map), `filename`, `last_modified_date`.

### Core components (16 — Sheet + Firestore + dashboards)

| Key | Source (page) | Unit |
|---|---|---|
| `aluminium_ingot` | Domestic Prices, Mumbai (6) | Rs/kg |
| `copper_cathode` | Domestic Prices, Mumbai (6) | Rs/kg |
| `tin_ingot` | Domestic Prices, Mumbai (6) | Rs/kg |
| `melting_foundry_scrap_mumbai` | Melting Scrap (Mumbai/Pune) Foundry (7) | Rs/tonne |
| `crca_bundle_mumbai` | Melting Scrap CRCA-Bundle LSLP (Mumbai/Pune) (7) | Rs/tonne |
| `crca_bundle_chennai` | Melting Scrap CRCA-Bundle LSLP (Chennai) (7) | Rs/tonne |
| `pig_iron_sg_grade_a_pune` | Raw Material, Pig Iron SG Grade-A (Pune) (7) | Rs/tonne |
| `pig_iron_foundry_gr_pune` | Raw Material, Pig Iron Foundry Grade-A (Pune) (7) | Rs/tonne |
| `fe_si_70_75_mumbai` | Ferro Alloys, Mumbai (8) | Rs/kg |
| `fe_mn_hc_mumbai` | Ferro Alloys, Mumbai (8) | Rs/kg |
| `inoculant_2_6mm_mumbai` | Ferro Alloys, Mumbai (8) | Rs/kg |
| `fe_cr_mumbai` | Ferro Chromium HC 60-65%, Mumbai (8) | Rs/kg |
| `fe_si_mg_mumbai` | Ferro Alloys, Mumbai (8) | Rs/kg |
| `low_sulp_cal_petro_coke` | Raipur Local, Import Low-Sulphur CPC 98% (8) | Rs/kg |
| `calcinated_petroleum_coke_9_4mm` | Raipur Local, CPC 9-4mm Indian (8) | Rs/kg |
| `lam_coke` | Coke Ex-Plant (8) | Rs/tonne |

### Extended components (6 — Firestore + dashboards only)

| Key | Source (page) | Unit |
|---|---|---|
| `sponge_iron_mg_punjab` | Raw Material, Sponge Iron (MG-Punjab) (7) | Rs/tonne |
| `fe_si_70_75_raipur` | Raipur Local, Ferro Silicon 70/75 (8) | Rs/kg |
| `fe_mn_70_75_raipur` | Raipur Local, Ferro Manganese 70/75 (8) | Rs/kg |
| `silico_manganese_mumbai` | Ferro Alloys, Mumbai (8) | Rs/kg |
| `high_fe_mn_78_raipur` | Raipur Local, High Ferro Manganese 78% (8) | Rs/kg |
| `graphite_petroleum_coke_mumbai` | Ferro Alloys, Mumbai (8) | Rs/kg |

### Archived components (9 — Firestore only; not in Sheet or dashboards)

Captured passively for possible future use (macro/global comparison,
specialty grades) so they never require a backlog re-run to add later:
`cu_lme` (Copper LME, USD/tonne global benchmark), `cast_iron_scrap_bhavnagar`,
`heavy_melting_scrap_mumbai_pune`, `pig_iron_foundry_grade_b_punjab`,
`steel_shots_mumbai`, `fe_mn_mc_mumbai` (page 7-8), and the domestic
non-ferrous benchmarks `zinc_ingot`, `lead_ingot`, `nickel_ingot` (page 6).

Prices are captured as **strings** (ranges preserved; a range yields the
upper-bound value per the prompt). The exact prompt wording is generated from
the registry's per-component `promptDesc`, so prompt tuning doesn't churn this
doc. **Note:** `cu_lme` moved core→archived (a USD/international benchmark, not
a domestic cost); domestic `copper_cathode` replaces it in the reports.

## Invariants & edge cases (for the SDET / Reviewer)

- **Idempotency:** the same `fileId` (a Drive re-notification) or the same
  `newsletter_issue_date` must not produce duplicate rows. Processed files are
  tracked in Firestore.
- **Year rollover:** a January issue may still belong to the prior year's issue
  range; routing is by the schema's `year` field, not "today".
- **New year:** the first record of a new year creates the `Data_<year>` tab
  with the column headers before appending.
- **Prices are strings:** never coerce to number; ranges and units must survive
  verbatim.

## Related knowledge

- [`knowledge/infrastructure.md`](infrastructure.md) — projects, APIs, secrets,
  and the human-only gaps that block a first live run.
- [`knowledge/adr/001-event-driven-architecture.md`](adr/001-event-driven-architecture.md)
  — why serverless + structured-output extraction.
- [`planning/backlog/`](../planning/backlog/) — the sequenced tickets that build
  this domain model into working code.
