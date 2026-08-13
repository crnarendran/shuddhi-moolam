---
type: ticket
id: SM-49
tags: [planning, security, firestore, bugfix]
status: in-review
points: 1
depends_on: [SM-44]
---
# SM-49 — Firestore rules coverage for env-partitioned companies

## Problem (regression from SM-44)
SM-44 partitioned the companies collection by environment
(`companies_staging`, `companies_dev`) and pointed the staging/dev dashboards
at the suffixed names — but `firestore.rules` still only declared
`match /companies/{companyId}`. The suffixed collections fell through to the
catch-all `match /{collection}/{document=**}`, which only permits
`historical_prices*` / `pipeline_runs*`. Net effect: the **browser was
permission-denied on every read/write of `companies_dev` / `companies_staging`**,
so on dev/staging the owner's "My workspace" was empty, shared companies never
appeared (switcher stayed hidden), and creating a company was denied — even
though the Admin-SDK seed (SM-48) wrote the data fine (it bypasses rules).

Symptom that surfaced it: after seeding prod → dev, `crnarendran` saw "No
companies yet" and no view switcher, despite owning Company A/B in prod.

## Fix
Parameterize the companies match over the three env partitions with an
`isCompaniesCol(c)` guard (`companies` | `companies_staging` | `companies_dev`),
preserving the exact owner/viewer/premium logic. Prod behaviour is unchanged;
the guard prevents the broadened `match /{companiesCol}/{companyId}` from
affecting any other collection (additive rule semantics). The `materials`
subcollection helper resolves its parent via the captured collection segment.

## Notes
- `firestore.rules` deploys to the shared project on every branch push
  (last-writer-wins), so this fix reaches prod as soon as it lands on any
  branch — verified prod `companies` access is functionally identical.
- Unblocks SM-45/48 testing on dev.

## Tests
Rules validated on deploy by firebase-tools. Manual: on dev, owner sees own
companies under My workspace and seeded shares in the switcher after the rules
deploy goes green.
