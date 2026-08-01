---
title: Support & Operations Runbook
section: Documentation
category: Guides
requiresLogin: true
isInternal: true
---
# Support & Operations Runbook

> **Status: stub.** Internal operator doc. Filled as tickets land; sections
> below name what each will cover.

## Prerequisites (human-provisioned)
See `knowledge/infrastructure.md` → **Known Gaps**. A live run needs: Blaze
billing on the Firebase project; Drive, Sheets, and Generative Language APIs
enabled; a service account with Editor on the Drive folder + master Sheet; and
the `GEMINI_API_KEY` / SA-JSON secrets.

## Deploying
_To be documented with deploy CI (SM-09)._ How `dev → staging → main` promotes
and what each push deploys.

## Drive watch channel renewal
_To be documented with SM-02._ Channels expire (~7 days); the scheduled renewal
function must run, or notifications silently stop. How to confirm the channel is
live and re-register it manually if needed.

## Reprocessing a file
_To be documented with SM-08._ How to clear a file from the dedup store and
re-trigger extraction.

## Common failures
_To be documented with SM-05 / SM-08._ Gemini validation failures, Sheets API
quota/permission errors, and where their logs/alerts appear.
