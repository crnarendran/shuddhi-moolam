---
id: SM-09
title: Deploy CI for dev/staging/main (guarded)
type: ticket
points: 3
status: todo
depends_on: [SM-01]
tags: [backlog, ci, deploy]
---
# SM-09 — Deploy CI for dev/staging/main

## Goal
Deploy the Cloud Functions automatically on push, following the
`dev → staging → main` promotion flow.

## Scope
- GitHub Actions workflow(s) that, on push to each branch, deploy `functions/`
  to that environment's Firebase project.
- **Guard on secret presence** (same pattern as `sync-docs.yml`) so the job
  skips green until the deploy service-account secret exists, rather than
  failing on every push.
- Resolve the target project per branch from the topology decided in
  `infrastructure.md` (own projects per env vs one project + per-env config).

## Acceptance criteria
- Push to `dev`/`staging`/`main` targets the matching project.
- With no secret, the job skips and stays green.
- With the secret, a deploy runs and the Release Manager watches it to a real
  pass/fail (not just triggered).

## Notes / escalation
- Needs a CI deploy service account + GitHub secret and the env-topology
  decision — human prerequisites (`infrastructure.md` → Known Gaps).
