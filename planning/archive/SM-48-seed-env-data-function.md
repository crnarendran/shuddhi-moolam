---
type: ticket
id: SM-48
tags: [planning, functions, admin, ops, tooling]
status: in-review
points: 2
depends_on: [SM-42, SM-44]
---
# SM-48 — Reusable "seed staging/dev from prod" admin function

## Problem
Testing the dashboard on staging/dev is hard without realistic company +
material data. Copying it from prod via a local `firebase-admin` script needs
Admin SDK credentials (a service-account key / ADC) that aren't set up on
dev machines. A reusable, credential-free mechanism is wanted — the same
approach a throwaway cloud function took before, but left in place to re-run.

## Decision (user-approved)
An **admin-only callable** deployed with the rest of the functions. Because it
is one Firebase project / one Firestore, any deployed instance can read prod
`companies` and write `companies_staging` + `companies_dev` — no cross-project
or local credentials needed, and no `main`/prod-deploy involvement. Left
deployed so it can be re-run to refresh test data anytime.

## Scope
- `functions/src/admin/seedEnvData.ts`: `onCall`, gated to `ADMIN_EMAILS`
  (crnarendran). Copies each company + its `materials` subcollection from
  `companies` into `companies_staging` and `companies_dev`, upserting by id
  (idempotent, safe to re-run). For companies the caller does NOT own, adds the
  caller to `viewerUids`/`viewerEmails` (and denormalizes `ownerEmail` via an
  Auth lookup) so every seeded company is reachable from the "view as" switcher
  in the test env — independent of whatever sharing exists in prod. Hard guard:
  only `*_staging`/`*_dev` targets may be written — prod `companies` is never a
  destination. Returns per-target counts. Batched writes (flush at 400 ops).
- `functions/src/index.ts`: export `seedEnvData${suffix}`.
- `.github/workflows/deploy.yml`: add `functions:seedEnvData${SUFFIX}` to
  `FUNCS` (or it won't deploy).
- `dashboard/src/pages/AdminPage.tsx`: a "Copy prod → staging & dev" button
  (founder/admin panel) with a confirm and a per-target result line.

## Notes
- Copies **real prod data** into more freely-testable partitions — acceptable
  (owner's data, same project) but noted for data governance.
- Prod materials were entered under the old "parts" semantics; on dev they
  render under the SM-45 grams-per-kg model, which is the intended test state.
- Superseded the local-credentials approach in `scripts/copyCompanies.mjs`
  (kept as a CLI fallback for anyone who does have a SA key + GAC set).

## Tests
Admin gate + guard mirror the existing `entitlements` callables; functions
`npm run lint` + `npm run build` clean. Live copy verified by invoking from the
Admin panel and checking staging/dev report data at user acceptance.
