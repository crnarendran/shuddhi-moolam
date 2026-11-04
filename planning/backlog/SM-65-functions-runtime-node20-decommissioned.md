---
id: SM-65
title: Upgrade Cloud Functions runtime off decommissioned Node.js 20 (unblocks all deploys)
type: ticket
status: pending
points: 2
priority: blocker
depends_on: []
scope: environment-topology
tags: [backlog, infra, ci, functions, runtime, blocker]
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

## Plan
1. **Choose the target runtime from what Firebase currently supports** (check the
   firebase-tools / Cloud Functions supported-runtimes docs; do not guess).
   Default to the newest *supported* LTS that our dependencies run on —
   expected **Node 22**. Record the choice and the evidence in this ticket.
2. `functions/package.json`: set `engines.node` to the target; bump
   `@types/node` to the matching major.
3. CI: set `node-version` to the target in `deploy.yml`, and align
   `sync-docs.yml` and `copy-historical.yml`.
4. Dependency compatibility: run `npm install`, `npm run lint`, `npm run build`,
   `npm test` under the new Node. If `firebase-functions@^5` /
   `firebase-admin@^12` / `googleapis` / `@google-cloud/*` need a bump to
   support the new runtime, bump the **minimum** needed and note why. Do not
   do unrelated upgrades.
5. **Local runtime check:** run the full functions test suite on the target Node
   major (`node -v` in the transcript).
6. **Promotion note:** `deploy.yml` MUST be byte-identical across
   `dev`/`staging`/`main` (release-manager rule 11), so this ships to all three
   in one promotion. Tag `scope: environment-topology` handling applies:
   dev → staging → main, each deploy watched to completion.

## Acceptance
- `Deploy Cloud Functions` on `dev` succeeds end to end (functions + firestore +
  hosting), watched to a terminal status.
- After the dev deploy, SM-64 is observable: the outcome email shows the Trend
  and Change vs prev columns and the "Change vs previous issue" line (user
  verifies by reprocessing a PDF on dev).
- Existing functions keep working after the runtime change (spot check: Drive
  webhook still enqueues, `processPendingPdf` completes, a callable such as
  `reprocessPendingPdf_dev` responds).
- `npm test`, `npm run lint`, `npm run build` pass on the new Node major.
- Report in the handoff: chosen runtime + why, any dependency bumps, and what
  was observed about the state of already-deployed functions on staging/main.

## Escalation
None of this is credentials/billing/IAM. If a deploy then fails for a reason in
those categories (e.g. a runtime requiring a billing or IAM change), stop and
report; do not work around it.
