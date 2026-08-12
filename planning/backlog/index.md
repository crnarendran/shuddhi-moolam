---
type: index
tags: [planning, backlog]
status: active
---
# Backlog — Shuddhi-Moolam

Points-based OKF tickets for building the PDF→Sheets pipeline. The **Architect**
owns this file; **Developers** pull the top unblocked ticket, build it via TDD,
then hand off to the **Reviewer**. Completed tickets move to `planning/archive/`.

Story points use a Fibonacci-ish scale (1, 2, 3, 5, 8). Per the
architect-planning-workflow, keep any single execution batch at **≤ 5 points** —
these are sequenced, not one batch.

## Sequence

```
SM-01 (foundation)
  └─ SM-02, SM-03, SM-04 (ingestion)
        └─ SM-05 (extraction)
              └─ SM-06, SM-07 (routing + append)
                    ├─ SM-08 (observability)
                    │     └─ SM-11 (run telemetry model)
                    │           └─ SM-12 → SM-13 → SM-14 (dashboard)
                    └─ SM-15 (backfill)   ·   SM-16 (analytics, later)
SM-09 (deploy CI)  ·  SM-10 (docs)  — cross-cutting
```

**Pipeline epic:** SM-01 … SM-10 (get PDFs into the sheet).
**Dashboard epic:** SM-11 … SM-14 (monitor every file's progress).
**Also scoped:** SM-15 backfill (catch existing/missed files), SM-16 analytics
(price trends — lower priority).

**Personalization & Guidance epic (SM-30…SM-34):** the tool grows from a
single-owner monitor into a per-user product. SM-30 stands up per-user Firestore
settings + self-scoped security rules (replacing localStorage); SM-31 adds a
global + per-report commodity exclusion cascade for focused views; SM-32 lets a
user model **multiple companies** and their **materials (BOMs)**; SM-33 turns
those BOMs into statistical purchasing **guidance** (seasonal buy-timing,
material/market substitution) reusing the existing reporting engine; SM-34
defers forecasting/alerts/sharing.

**Note on the earlier "no multi-tenant" non-goal:** SM-30+ deliberately
supersedes it — per-user personalization and consultant multi-company modelling
are now in scope. Access stays private-per-user via uid-scoped rules (SM-30);
this is not org-wide multi-tenancy, just per-account data.

## Tickets

| ID | Title | Points | Depends on |
|---|---|---|---|
| [SM-01](SM-01-functions-foundation.md) | Cloud Functions foundation (Node/TS, lint, Jest, firebase.json) | 3 | — |
| [SM-02](SM-02-drive-watch-registration.md) | Drive `changes.watch` registration + channel renewal | 5 | SM-01 |
| [SM-03](SM-03-webhook-endpoint.md) | Webhook endpoint: validate, resolve fileId, filter, dedup | 5 | SM-01, SM-02 |
| [SM-04](SM-04-pdf-retrieval.md) | PDF retrieval from Drive | 2 | SM-01 |
| [SM-05](SM-05-gemini-extraction.md) | Gemini Flash structured extraction (Zod contract) | 5 | SM-04 |
| [SM-06](SM-06-year-tab-routing.md) | Year parsing + `Data_<year>` tab routing | 3 | SM-05 |
| [SM-07](SM-07-row-append.md) | Row mapping + idempotent append | 3 | SM-06 |
| [SM-08](SM-08-observability-resilience.md) | Observability, alerting, dead-letter/reprocess | 3 | SM-05, SM-07 |
| [SM-09](SM-09-deploy-ci.md) | Deploy CI for dev/staging/main (guarded) | 3 | SM-01 |
| [SM-10](SM-10-docs.md) | User/support/test docs + portal-sync verification | 2 | SM-07 |
| [SM-11](SM-11-run-telemetry-model.md) | Pipeline run telemetry / status model (Firestore) | 3 | SM-03 |
| [SM-12](SM-12-dashboard-app-shell.md) | Dashboard — app shell, hosting & auth | 5 | SM-11 |
| [SM-13](SM-13-dashboard-file-monitor.md) | Dashboard — live file monitor & detail | 5 | SM-12 |
| [SM-14](SM-14-dashboard-metrics-actions.md) | Dashboard — metrics & reprocess actions | 3 | SM-13, SM-08 |
| [SM-15](../archive/SM-15-historical-backfill.md) | Historical / bulk backfill — **done** (manual regular ingestion; not built) | 3 | SM-05, SM-07, SM-11 |
| [SM-16](SM-16-data-analytics.md) | Analytics / reporting on extracted data — **superseded by SM-18** | 5 | SM-07, SM-12 |
| [SM-18](SM-18-price-review-insights.md) | Price Review & Insights — reporting views (supersedes SM-16) | 5 | SM-07, SM-12 |
| [SM-19](SM-19-price-alerts-quarterly-report.md) | Price-movement alerts & quarterly review report | 5 | SM-08, SM-18, SM-20 |
| [SM-20](SM-20-historical-seasonal-analysis.md) | Historical & seasonal analysis view (short-history resistant) | 5 | SM-15, SM-18 |
| [SM-21](SM-21-spread-correlation-monitors.md) | Spread & correlation monitors (later) | 3 | SM-18 |
| [SM-22](SM-22-sheet-sort-latest-first.md) | Keep master sheet sorted latest-first | 2 | SM-07 |
| [SM-23](SM-23-responsive-mobile-friendly.md) | Responsive / mobile-friendly UI (all surfaces) | 5 | SM-12 |
| [SM-24](SM-24-latency-cost-metrics.md) | Fix latency & total-cost metrics (telemetry bug) | 3 | SM-11, SM-14, SM-05 |
| [SM-25](SM-25-file-monitor-display-fixes.md) | File monitor display fixes — filename + year→tab label | 2 | SM-11, SM-13, SM-06 |
| [SM-26](SM-26-cost-impact-analysis.md) | Cost-impact analysis — consumption-weighted quarterly view | 5 | SM-18, SM-20 |
| [SM-27](SM-27-chat-cost-tracking.md) | Capture chat cost separately | 2 | SM-24 |
| [SM-28](SM-28-extraction-foundation-revamp.md) | Extraction revamp — 31-component tiered registry + re-extraction | 8 | SM-05, SM-07, SM-18 |
| [SM-29](SM-29-cost-optimized-extraction.md) | Cost-optimized extraction — thinking cap, File API, large-PDF | 8 | SM-05, SM-24, SM-28 |
| [SM-30](SM-30-per-user-settings-foundation.md) | Per-user settings foundation (Firestore + self-scoped rules) | 3 | — |
| [SM-31](SM-31-commodity-personalization.md) | Commodity personalization — global + per-report exclusion cascade | 5 | SM-30 |
| [SM-32](SM-32-companies-and-materials.md) | Companies & Materials (BOM) management | 5 | SM-30 |
| [SM-33](SM-33-material-guidance-report.md) | Material guidance report — seasonal buying + substitution (v1) | 8 | SM-31, SM-32 |
| [SM-34](SM-34-guidance-forecasting-sharing.md) | Guidance enhancements — forecasting, alerts, sharing (later) | 8 | SM-33 |
| [SM-35](SM-35-in-product-documentation.md) | In-product documentation — report intros, how-to-read, term tooltips | 3 | SM-18, SM-31, SM-32, SM-33 |
| [SM-36](SM-36-unified-settings-section.md) | Unified Settings section — one place, two tabs (Preferences + Companies) | 3 | SM-31, SM-32 |
| [SM-37](SM-37-report-print-pdf-export.md) | Print / PDF export for all reports | 3 | SM-18, SM-33, SM-35 |

**Reporting & UX epic (SM-18…SM-24):** Price Review & Insights reporting
(SM-18), quarterly/seasonal alerts (SM-19), historical & seasonal analysis
resistant to ~2yr history (SM-20), spread/correlation monitors (SM-21),
sheet-sorted-latest-first (SM-22), responsive/mobile UI (SM-23), and the
latency/cost telemetry fix (SM-24). SM-18 renames/absorbs SM-16.

**Total: 93 points** (pipeline SM-01…SM-10 = 34, dashboard SM-11…SM-14 = 16,
backfill SM-15 = 3, SM-16 superseded, reporting & UX SM-18…SM-26 = 35, plus
SM-17 schema in archive). Blocked on the human-only prerequisites in
`knowledge/infrastructure.md` → Known Gaps before anything can run live; the
code can still be built and unit-tested (mocked APIs) without them.
