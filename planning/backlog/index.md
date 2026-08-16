---
type: index
tags: [planning, backlog]
status: active
---
# Backlog — Shuddhi-Moolam

Points-based OKF tickets. The **Architect** owns this file; **Developers** pull
the top unblocked ticket, build it via TDD, then hand off to the **Reviewer**.
Shipped tickets move to `planning/archive/`. Story points use a Fibonacci-ish
scale (1, 2, 3, 5, 8); keep any single execution batch ≤ 5 points.

## Open

| ID | Title | Points | Depends on |
|---|---|---|---|
| [SM-54](SM-54-extraction-no-round-tonne.md) | Stop rounding Rs/tonne values at extraction (restore kg decimals) — **in review on `dev`** | 1 | SM-28, SM-40 |
| [SM-55](SM-55-extraction-probe-function.md) | Admin extraction-probe function (A/B configs, no writes) — **in review on `dev`** | 2 | SM-28, SM-54 |
| [SM-56](SM-56-extraction-outlier-check.md) | History-based extraction outlier check (alert on misreads) — **in review on `dev`** | 2 | SM-54, SM-55 |
| [SM-58](SM-58-consensus-extraction.md) | Consensus extraction (best-of-3) + date-based column selection — **in review on `dev`** | 3 | SM-54, SM-55 |
| [SM-59] Sortable Monitor columns (asc/desc on all columns) — **in review on `dev`** | 1 | SM-13 |
| [SM-43](SM-43-tonne-to-kg-storage-migration.md) | Store prices in kg everywhere (import + Firestore + master Sheet) | 5 | SM-40 |
| [SM-57](SM-57-manual-price-entry.md) | Manual price entry ("break glass") + data-editor role (mvsaikishore) | 5 | SM-42, SM-56 |
| [SM-15](SM-15-environment-isolation.md) | Environment isolation — dedicated projects/resources per env (currently one project, env-suffixed) | 3 | SM-09 |
| [SM-34](SM-34-guidance-forecasting-sharing.md) | Guidance enhancements — forecasting, scheduled alerts, editable substitution groups, sharing | 8 | SM-33 |

> **SM-43** (tonne→kg storage migration) is Antigravity's; status unconfirmed.
> Note the double-division risk: if prices are stored in kg, SM-40's
> `toCanonicalPriceRecord` (÷1000 for tonne items) must be removed in the same
> release or the dashboard divides already-kg values again.

New tweaks/features get the next free id (SM-40+). Add a row here and a ticket
file, then implement dev → staging → main.

## Shipped (in production)

Everything below is live and archived in `planning/archive/` — see there for
the full ticket + implementation notes. Do **not** re-plan these.

- **Pipeline** SM-01…SM-11: Drive watch → webhook → PDF retrieval → Gemini
  extraction → year-tab routing → append; run telemetry; deploy CI; docs.
- **Dashboard** SM-12…SM-14, SM-25: app shell + auth, live file monitor,
  metrics & reprocess actions, monitor display fixes.
- **Reporting & UX** SM-18…SM-24, SM-26, SM-27: Price Review, alerts +
  quarterly report, historical/seasonal, spreads, sheet-sort, responsive UI,
  latency/cost telemetry, cost-impact, chat-cost tracking. (SM-16 superseded
  by SM-18; SM-17 schema.)
- **Extraction revamp** SM-28, SM-29: 31-component tiered registry +
  re-extraction; cost-optimized extraction (thinking cap, File API, large PDF).
- **Personalization & Guidance** SM-30…SM-33, SM-35: per-user Firestore
  settings + self-scoped rules, commodity personalization cascade,
  companies/materials (BOM), material guidance report, in-product docs.
- **Product polish** SM-36…SM-39: unified Settings section, print/PDF export,
  Reports nav consolidation, multi-select overlays + persisted (cross-device)
  per-report view state.
- **Sharing, premium & precision** SM-40…SM-42, SM-45…SM-51: ₹/kg price
  normalization; read-only company sharing (invite/accept/expiry) + premium
  entitlement gate + founder-only admin panel; grams-per-kg BOM with
  mass-weighted blended cost; collapsible in-report docs; mobile left slide-in
  nav; reusable prod→staging/dev seed function; Firestore-rules coverage for
  env-partitioned companies (SM-44 regression fix); 1-decimal price precision
  (shared `fmtNum`); persisted shared read-only view.
- **Per-context selections** SM-52, SM-53: report selections (Seasonal keys,
  Spreads reference/compare, Guidance materials) are namespaced by view context
  (`viewState[contextId][report]`) so each workspace/company keeps its own, with
  a per-context in-memory cache for race-free instant restore on switch.

**Backfill (SM-15 historical):** handled by regular manual ingestion — see
`planning/archive/SM-15-historical-backfill.md`.
