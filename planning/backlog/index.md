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
| [SM-40](SM-40-price-unit-normalization.md) | Price unit normalization — canonical ₹/kg for charts & math | 3 | SM-18, SM-26, SM-33 |
| [SM-41](SM-41-readonly-company-sharing.md) | Read-only company sharing — invite viewers, tracked expiring invites (epic) | 13 | SM-30, SM-32, SM-33 |
| [SM-42](SM-42-premium-entitlement-gate.md) | Premium entitlement gate — creating companies/materials is paid | 3 | SM-32, SM-41 |
| [SM-43](SM-43-tonne-to-kg-storage-migration.md) | Store prices in kg everywhere (import + Firestore + master Sheet) | 5 | SM-40 |
| [SM-45](SM-45-grams-per-kg-composition.md) | Grams-per-kg material composition + mass-weighted blended cost | 3 | SM-32, SM-40 |
| [SM-46](SM-46-collapsible-report-docs.md) | Collapsible inline report documentation (collapsed by default) | 1 | SM-35 |
| [SM-47](SM-47-mobile-nav-hamburger.md) | Mobile-friendly top navigation (left slide-in drawer) | 2 | SM-38 |
| [SM-48](SM-48-seed-env-data-function.md) | Reusable admin function to seed staging/dev companies from prod | 2 | SM-42, SM-44 |
| [SM-49](SM-49-companies-rules-env-coverage.md) | Fix: Firestore rules didn't cover companies_dev/_staging (SM-44 regression) | 1 | SM-44 |
| [SM-50](SM-50-price-decimal-precision.md) | 1-decimal price precision across reports (shared fmtNum helper) | 1 | SM-18, SM-45 |
| [SM-51](SM-51-persist-shared-view.md) | Persist the shared read-only view across refresh | 1 | SM-41 |

> **SM-40, SM-41, SM-42 are built + on `dev`** (in-review), pending promotion.
> See `planning/handover-2026-08-13.md` for the Antigravity handover.
> **SM-45, SM-46, SM-47, SM-48 are built + on `dev`** (in-review): grams-per-kg
> composition, collapsible docs, mobile slide-in nav, and the prod→staging/dev
> seed function (Admin panel button).
| [SM-15](SM-15-environment-isolation.md) | Environment isolation — dedicated projects/resources per env (currently one project, env-suffixed) | 3 | SM-09 |
| [SM-34](SM-34-guidance-forecasting-sharing.md) | Guidance enhancements — forecasting, scheduled alerts, editable substitution groups, sharing | 8 | SM-33 |

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

**Backfill (SM-15 historical):** handled by regular manual ingestion — see
`planning/archive/SM-15-historical-backfill.md`.
