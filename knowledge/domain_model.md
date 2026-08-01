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
Node/TS implementation it is expressed as a **Zod** schema and validated on the
response before any Sheets write. Treat this table as the source of truth; keep
the Zod schema, the Sheets column headers, and this doc in sync.

| Field | Type | Meaning |
|---|---|---|
| `newsletter_issue_date` | string | Issue date range, e.g. `JULY 27-AUGUST 02, 2026` |
| `year` | integer | 4-digit publication year — routes to the `Data_<year>` tab |
| `crca_bundle_mumbai` | string | Melting Scrap (CRCA – Bundle) LSLP (Mumbai/Pune) |
| `crca_bundle_chennai` | string | Melting Scrap (CRCA – Bundle) LSLP (Chennai) |
| `melting_foundry_scrap_mumbai` | string | Melting Scrap (Mumbai/Pune) (Foundry) |
| `fe_mn_hc_mumbai` | string | Ferro Manganese HC (Ferro Alloys & Minor Metals – Mumbai) |
| `fe_si_70_75_mumbai` | string | Ferro Silicon (70–75%) (Ferro Alloys & Minor Metals – Mumbai) |
| `low_sulp_cal_petro_coke` | string | Low Sulp. (max 1.5%) cal Petro. Coke 98% (Raipur Local Market) |
| `fe_si_mg_mumbai` | string | Ferro Silicon Magnesium (Ferro Alloys – Mumbai) |
| `cu_lme` | string | LME Settlement Rate, Copper Grade A |
| `cu_domestic` | string | Domestic / MMR Landed price for Copper |
| `fe_cr_mumbai` | string | Ferro Chromium (High or Low Carbon), Mumbai market |
| `pig_iron_foundry_gr_pune` | string | Pig Iron Foundry Grade – A (Pune) |

**All 13 fields are required.** If Gemini cannot find a value it must return an
explicit empty string rather than omit the key, so validation stays strict and
missing data is visible in the sheet rather than silently dropped. The exact
prompt wording that targets each source table lives with the extraction code
(ticket SM-05) — not here — so prompt tuning doesn't churn this contract.

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
