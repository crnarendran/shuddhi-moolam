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

**Backfill (SM-15 historical):** handled by regular manual ingestion — see
`planning/archive/SM-15-historical-backfill.md`.
