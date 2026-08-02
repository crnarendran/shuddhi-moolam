---
type: adr
tags: [adr, governance, environment, triggers, firestore, deployment, release-management]
status: accepted
date: 2026-08-02
---
# ADR 005 — Multi-Environment Trigger Isolation & Release Synchronization

## Status
Accepted (2026-08-02) — operational architecture & deployment policy; mandatory for all environment topology changes.

## Context
In Sprint SM-17, testing an event trigger on the `dev` environment caused active Cloud Functions in `staging` and `prod` environments to intercept the event and process it using outdated business logic. This occurred because Sprint SM-15 had introduced environment-scoped collection/folder configurations on `dev` (e.g., `pipeline_runs_dev`), but SM-15 was not promoted to `staging` or `main` branches prior to beginning SM-17 testing. As a result, active Staging and Prod functions were still configured to listen to un-scoped/dev resources, resulting in event stealing and cross-environment state corruption.

## Decision

1. **Strict Environment Trigger & Resource Scoping.**
   - All Cloud Function triggers, Firestore collection names, Google Drive folders, and Pub/Sub topics MUST be explicitly scoped by environment suffixes (e.g. `_dev`, `_staging`, `_prod`).
   - Shared cloud projects must never allow a function running in environment $E_A$ to listen to or process events emitted from environment $E_B$.

2. **Mandatory Synchronized Branch Promotion for Topology Updates.**
   - Any ticket altering environment topology, event triggers, storage locations, or collection schemas (tagged as `scope: environment-topology`) MUST be synchronously promoted across all Git branches (`dev` -> `staging` -> `main`) and redeployed immediately.
   - Downstream feature tickets that depend on environment changes cannot begin testing on `dev` until the topology ticket has been fully promoted and downstream functions updated across all environments.

3. **Pre-Deployment & Integration Audits.**
   - **Release Manager Audit:** The `Release Manager` must conduct a pre-deployment trigger collision check to confirm downstream environment functions are strictly isolated from `dev` resources before approving deployments.
   - **SDET Test Suite:** The `SDET` agent must include multi-environment trigger isolation tests verifying that `dev` events do not trigger handlers or mutate states in `staging` or `prod`.

## Consequences

- **Positive:** Guarantees complete isolation between dev, staging, and production events in shared cloud infrastructure; eliminates stale function event stealing and cross-environment data corruption.
- **Trade-offs:** Requires strict multi-branch promotion and deployment synchronization whenever infrastructure or trigger configurations are updated.

## Related
- `knowledge/archive/retro-2026-08-02.md` — Retrospective documenting SM-17 environment isolation failure.
- `knowledge/adr/003-swarm-role-isolation-and-governance.md` — Swarm role isolation and governance.
- `knowledge/adr/004-environment-variables-and-secrets-governance.md` — Environment variables & secrets governance.
