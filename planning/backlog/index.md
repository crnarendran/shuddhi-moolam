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
                    └─ SM-08 (observability)
SM-09 (deploy CI)  ·  SM-10 (docs)  — cross-cutting
```

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

**Total: 34 points.** Blocked on the human-only prerequisites in
`knowledge/infrastructure.md` → Known Gaps before anything can run live; the
code can still be built and unit-tested (mocked APIs) without them.
