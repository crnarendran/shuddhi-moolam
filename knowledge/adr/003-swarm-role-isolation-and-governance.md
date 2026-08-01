---
type: adr
tags: [adr, governance, swarm, roles, workflow]
status: accepted
date: 2026-08-01
---
# ADR 003 — Swarm Role Isolation & Non-Bypass Protocol

## Status
Accepted (2026-08-01) — operational governance; supersedes informal Architect self-execution exceptions.

## Context
During initial development iterations, the Architect agent performed direct production code edits and triggered deployments without creating backlog tickets or delegating to specialized subagents (`Developer`, `Release Manager`). This "self-execution exception" led to role drift, lack of TDD test coverage, and skipped pre-flight/deployment verification.

## Decision

1. **Strict Zero-Code Rule for Architect.** The Architect agent is strictly prohibited from editing or writing production code files (e.g. under `functions/`). All feature code, bug fixes, and refactoring MUST be defined as OKF tickets in `planning/backlog/` and assigned to a `Developer` subagent.
2. **Mandatory Subagent Handoffs.** 
   - **Architect:** Scopes work, creates `planning/backlog/` tickets, coordinates subagents, and handles user communication.
   - **Developer:** Implements feature tickets using TDD (`Test First -> Implement -> Refactor`).
   - **Reviewer:** Performs independent code reviews against ADRs and security/quality standards.
   - **SDET:** Writes automated test suites and validates runtime contract behaviors.
   - **Release Manager:** Executes CI/CD deployments and conducts pre-deployment environment audits.
3. **Removal of Self-Execute Exception.** No fix or code modification is exempt from the ticket-creation and Developer delegation workflow regardless of size or complexity.

## Consequences

- **Positive:** Preserves clean role boundaries; guarantees test-driven development for all production changes; prevents unvetted code deployment.
- **Trade-offs:** Adds minor context switching overhead for small 1-2 line fixes, prioritized in favor of system safety and auditability.

## Related
- `AGENTS.md` — Swarm role definitions and model routing matrix.
- `knowledge/archive/retro-2026-08-01.md` — Retrospective identifying role drift root causes.
