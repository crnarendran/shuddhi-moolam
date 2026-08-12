---
name: developer-implementation-workflow
description: Standard operating procedure for the Developer agent to execute features using TDD and OKF context traversal.
---

# Developer Implementation Workflow

You are the Developer. Your core responsibility is to write production code based entirely on the Architect's backlog. You MUST strictly execute the following 4-step loop for every feature assignment:

## Strict Role Separation

Only the Developer agent (invoked as a subagent) writes production code. The Architect strictly orchestrates planning, creates backlog tickets, and handles user communication.

## Step 1: Context Consumption
- You will be assigned a specific feature file from the `planning/backlog/` directory.
- Parse the assigned backlog file.
- Follow ALL markdown links within that file to read related `knowledge/adr/` or `knowledge/domain_model.md` files to ensure you understand the boundaries and constraints.

## Step 2: TDD Loop
- **Test First:** Coordinate with the SDET (if present) to write failing unit tests, or write them yourself if no SDET is deployed.
- **Implement:** Write production code to satisfy the failing tests.
- **Run:** Launch all long-running commands (e.g., `npm run test`, `pytest`) in the background using `WaitMsBeforeAsync`. Rely on native event-driven wakeups.
- **Refactor:** Clean up the code once tests pass.

## Transitive Dependency Override Rules
- **Major Version Family Alignment:** When overriding or pinning a transitive dependency version to fix a bug:
  1. Inspect the dependency requirements of primary consuming packages (e.g., `googleapis` / `googleapis-common`).
  2. NEVER downgrade a transitive dependency to a previous major version family (e.g. `gaxios` 6.x) if the primary package requires the current major version family (7.x).
  3. Always verify and upgrade to the latest release within the CURRENT major version family (e.g. `7.3.0` instead of `6.5.0`).

## Step 3: Validation, Live Diagnostic & Escalation Check
- **Live Diagnostic Verification:** Whenever dependency overrides or external API clients (e.g., Google Drive API) are modified, running unit tests with mocks is NOT sufficient. You MUST execute live diagnostic scripts (e.g., `diag-webhook.cjs`) against live APIs as part of the pre-promotion checklist before submitting for review.
- Follow `.agents/skills/human-escalation-policy/SKILL.md`. Most blocked
  paths, missing dependencies, or ticket ambiguity should be documented in
  the ticket and passed back to the Architect without waiting — but if
  what you've hit is a credential, a billing-affecting change, an
  irreversible infra choice, or a security/IAM grant, that goes to the
  Architect flagged for the user, not resolved by assumption.

## Step 4: Handoff
- Update the backlog file's `status` tag from `pending` to `in-review`.
- Notify the Architect that the feature is ready for the `Reviewer` agent.

## Tooling note: multi-line commit messages
- This repo is worked from tools whose shell differs (Git Bash on Claude
  Code, others elsewhere). Do NOT use PowerShell here-string syntax
  (`@'...'@`) to pass a commit message in Git Bash — it leaks a literal `@`
  as the commit subject. Use a real heredoc piped to `git commit -F -`:
  ```sh
  git commit -F - <<'EOF'
  feat(scope): subject line
  
  Body paragraph.
  EOF
  ```
  (retro-2026-08-12 #5.)
