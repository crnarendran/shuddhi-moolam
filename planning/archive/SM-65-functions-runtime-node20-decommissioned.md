---
id: SM-65
title: Upgrade Cloud Functions runtime off decommissioned Node.js 20 (unblocks all deploys)
type: ticket
status: done
points: 2
priority: blocker
depends_on: []
scope: environment-topology
tags: [archive, infra, ci, functions, runtime, blocker]
---
# SM-65 — Upgrade Cloud Functions runtime off Node.js 20

## Why (found 2026-11-04, while verifying SM-64 on dev)
Every `Deploy Cloud Functions` run on `dev` since 2026-11-04 fails at the same
step, **even for a docs-only commit** (`a231bf5`, run `41846816360`; and the
SM-64 feature commit `9fdbbbb`, run `41849342361`). The log:

```
Error: Runtime Node.js 20 was decommissioned on 2026-10-30.
To deploy you must first upgrade your runtime version.
```

Lint, `tsc` and the Firestore rules compile all pass; it is rejected at the
Cloud Functions API. Consequences:

- **SM-64 is not live on dev.** The email the user received from dev is still
  the SM-62 build (no Trend / Change columns, no "Change vs previous issue"
  line). The code is correct and tested; it simply was never deployed.
- **No environment can deploy anything** until this lands — dev, staging and
  main all share the same `deploy.yml` and `functions/package.json`. That
  includes hotfixes and the dashboard (hosting is in the same `firebase deploy`).
- Functions already deployed on the old runtime are *not* known to have stopped;
  that has not been checked and must not be assumed either way. The developer
  should look at the live functions' health/runtime (read-only) and report it.

## Current state (verified by orchestrator)
- `functions/package.json` → `"engines": { "node": "20" }`,
  `"@types/node": "^20.14.9"`, `firebase-functions ^5.0.0`,
  `firebase-admin ^12.0.0`.
- `.github/workflows/deploy.yml` → `actions/setup-node` `node-version: '20'`.
- `.github/workflows/sync-docs.yml` and `copy-historical.yml` also pin `'20'`
  (not deploy-blocking; align them so CI and runtime agree).
- `firebase.json` declares no explicit `runtime`; the runtime comes from
  `engines.node`.

## Resolution & Evidence
1. **Target Runtime Selected:** Node.js 22 (`nodejs22`).
   - Evidence: Google Cloud Functions documentation specifies `nodejs22` as
     the current active LTS execution environment (deprecation date: 2027-04-30,
     decommission date: 2027-10-31), whereas `nodejs20` was decommissioned on
     2026-10-30. Firebase CLI (firebase-tools 15.16.0) and firebase-functions
     natively support `engines.node: "22"`.
2. **Package and Dependencies:**
   - Updated `functions/package.json` `engines.node` to `"22"`.
   - Bumped `@types/node` to `^22.0.0` (resolves `22.20.5`).
   - All runtime dependencies (`firebase-functions ^5.0.0`, `firebase-admin ^12.0.0`,
     `@google/generative-ai ^0.24.1`, `@google-cloud/bigquery ^9.0.2`, `googleapis ^144.0.0`,
     `resend ^6.19.0`, `zod ^3.23.8`) tested and compatible under Node 22. No further
     dependency bumps required.
3. **CI Workflows Aligned:**
   - `.github/workflows/deploy.yml`: `node-version: '22'`
   - `.github/workflows/sync-docs.yml`: `node-version: '22'`
   - `.github/workflows/copy-historical.yml`: `node-version: '22'`
4. **Live Inspection of Staging/Main:**
   - Inspection via `gcloud functions list --project sai-shuddhi-moolam` confirmed all 57
     functions (across prod, staging, dev) are in `ACTIVE` state.
   - Live functions describe (e.g. `helloWorld`, `helloWorld_staging`) report
     `buildConfig.runtime: nodejs20` and `state: ACTIVE`. Deployed functions continue
     serving traffic normally per Cloud Functions decommission lifecycle; new deployments
     require the `nodejs22` upgrade.
5. **Local Verification:**
   - `npm --prefix functions test`: 24/24 test suites passed, 136/136 tests passed under Node 22.
   - `npm --prefix functions run lint`: 0 errors.
   - `npm --prefix functions run build`: 0 errors.
   - `npm --prefix dashboard test`: 5/5 test suites passed, 52/52 tests passed.
   - `npm --prefix dashboard run lint`: 0 errors.
