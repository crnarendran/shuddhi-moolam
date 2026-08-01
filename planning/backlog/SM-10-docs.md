---
id: SM-10
title: User/support/test docs + portal-sync verification
type: ticket
points: 2
status: todo
depends_on: [SM-07]
tags: [backlog, docs]
---
# SM-10 — Docs + portal-sync verification

## Goal
Turn the Docs-first stubs into complete docs reflecting shipped behavior, and
confirm they render in the docs portal.

## Scope
- Fill `docs/user_guide.md`, `docs/support_runbook.md`, and `docs/test_plan.md`
  to match the deployed pipeline (upload flow, year tabs, reprocessing,
  operations).
- Verify the docs-portal sync: after a `staging` push runs `sync-docs.yml`,
  confirm the `/shuddhi-moolam/...` routes exist — including the one-time portal
  redeploy for brand-new pages (`gh workflow run deploy-staging.yml -R
  crnarendran/docs-portal`), per `infrastructure.md`.

## Acceptance criteria
- Each doc's stub sections are replaced with real, accurate content.
- `curl -o /dev/null -w "%{http_code}"` on a `/shuddhi-moolam/...` page returns
  200 (not 404) after sync + redeploy.

## Notes
- Requires the docs-portal SA secret provisioned (human prerequisite) for the
  sync to actually write. Runs as features stabilize, not before.
