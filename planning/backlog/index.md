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
| [SM-43](SM-43-tonne-to-kg-storage-migration.md) | Store prices in kg everywhere (import + Firestore + master Sheet) | 5 | SM-40 |
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
- **Extraction accuracy** SM-54…SM-56, SM-58, SM-59: exact Rs/tonne figures (no
  rounding) + **temperature 0** (deterministic reads — the root fix), date-based
  two-column selection, consensus (best-of-3), configurable model, admin probe
  (A/B), history-based outlier alerts + Monitor ⚠ badge, and sortable Monitor
  columns. Text PDFs now extract deterministically + correctly; 16 MB scanned
  copies stay unreliable (feed normal-size files). See ADR-006. Also: reprocess
  now deploys (FUNCS fix) + works on appended runs + bulk-select; run-detail
  crash fixed. Consensus defaulted to 1 pass (temp 0 makes it deterministic).
- **Sheet decimal fix + manual entry** SM-57: root-caused the master Sheet
  losing tonne→kg decimals to `sortTabByDateDesc` round-tripping through
  FORMATTED_VALUE (not the model — see ADR-006 update); sort now reads
  UNFORMATTED, plus a one-time `backfillSheetFromHistory` to repair history
  from Firestore. Manual price entry ("break glass") + data-editor role
  (mvsaikishore): data-editor-gated `manualUpsert` writes both stores with a
  sticky `source:'manual'` guard in `process.ts` (auto won't overwrite; flags
  disagreements), Settings ▸ Manual entry UI, Monitor ✎ badge. Also: Manual
  entry lists existing overrides (click a row to edit).
- **Global Company·Product selector** SM-60: one header control (Company —
  My workspace / own / shared → Product) drives every report through
  `ViewContext` (`scopeKeys` + `productWeights`). Material-driven Cost Impact
  (weights read-only from the product's BOM; Custom when "All products");
  Price Review / Seasonal / Spreads auto-filter via `scopeKeys`; Guidance
  reads it as a **multi-select** (the header control is single-select
  elsewhere, multi on Guidance) and its own in-page pickers were removed.
  Subsumed an interim per-page Cost-Impact picker. Guidance baseline also
  changed 6-mo → 1-quarter. NOTE: the commits for this were mislabeled
  SM-58/59 (a numbering slip — the real SM-58/59 are the extraction
  consensus / sortable-columns items above); code comments still say 58/59.

**Backfill (SM-15 historical):** handled by regular manual ingestion — see
`planning/archive/SM-15-historical-backfill.md`.
