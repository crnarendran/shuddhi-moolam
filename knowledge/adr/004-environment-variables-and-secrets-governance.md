---
type: adr
tags: [adr, governance, environment, secrets, validation, zod, cicd]
status: accepted
date: 2026-08-01
---
# ADR 004 — Environment Variables & Secrets Governance

## Status
Accepted (2026-08-01) — operational governance; commit to fail-fast environment validation.

## Context
Deployments previously suffered from missing or misconfigured runtime environment variables (such as `MASTER_SHEET_ID` and `GEMINI_API_KEY`). Unit tests mocked environment variables, concealing configuration omissions until Cloud Functions executed in production and failed deep inside API execution stacks.

## Decision

1. **Mandatory Runtime Zod Schema Validation (`config.ts`).** All environment variables and secrets must be parsed and validated via a Zod schema upon function startup. Missing or invalid variables must throw an explicit error immediately, preventing silent runtime failures.
2. **Single Source of Truth (`.env.example`).** All required environment keys and secrets across `dev`, `staging`, and `prod` must be documented in `.env.example` with descriptive placeholders and documentation links.
3. **Pre-Deployment Config Audit in Release Manager & CI/CD.**
   - The `Release Manager` agent must perform a pre-deployment check confirming required keys exist in GitHub Secrets and GCP Secret Manager before initiating deploys.
   - CI/CD workflows must enforce pre-flight environment checks to abort deployments early if target configuration is missing.
4. **SDET Fail-Fast Testing.** Test suites created by the SDET must explicitly test application startup behavior when required environment variables are absent, confirming the fail-fast behavior.

## Consequences

- **Positive:** Eliminates silent runtime crashes due to unconfigured environment variables; provides immediate diagnostic feedback during deployment and startup.
- **Trade-offs:** Requires keeping `.env.example`, `config.ts`, and CI secret stores strictly synchronized when adding new configuration keys.

## Related
- `knowledge/archive/retro-2026-08-01.md` — Retrospective identifying environment governance failures.
- `knowledge/adr/003-swarm-role-isolation-and-governance.md` — Swarm role governance.
