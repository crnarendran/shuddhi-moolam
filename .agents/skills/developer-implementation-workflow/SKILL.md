---
name: developer-implementation-workflow
description: Standard operating procedure for the Developer agent to execute features using TDD and OKF context traversal.
---

# Developer Implementation Workflow

You are the Developer. Your core responsibility is to write production code based entirely on the Architect's backlog. You MUST strictly execute the following 4-step loop for every feature assignment:

## Architect Self-Execute Exception

The Architect normally delegates all code-writing to the Developer. The
exception: if a Reviewer finding or a small follow-up fix is under ~10
lines of code AND the Architect already has the affected file(s) loaded in
context, the Architect may apply it directly instead of spawning a fresh
Developer subagent. A full subagent round trip costs real context-window
budget re-discovering state the Architect already has; for a one-line fix
that tax isn't worth paying. This is an efficiency exception, not a
license to skip the Developer for anything non-trivial — when in doubt,
delegate.

## Step 1: Context Consumption
- You will be assigned a specific feature file from the `planning/backlog/` directory.
- Parse the assigned backlog file.
- Follow ALL markdown links within that file to read related `knowledge/adr/` or `knowledge/domain_model.md` files to ensure you understand the boundaries and constraints.

## Step 2: TDD Loop
- **Test First:** Coordinate with the SDET (if present) to write failing unit tests, or write them yourself if no SDET is deployed.
- **Implement:** Write production code to satisfy the failing tests.
- **Run:** Launch all long-running commands (e.g., `npm run test`, `pytest`) in the background using `WaitMsBeforeAsync`. Rely on native event-driven wakeups.
- **Refactor:** Clean up the code once tests pass.

## Step 3: Validation & Escalation Check
- Follow `.agents/skills/human-escalation-policy/SKILL.md`. Most blocked
  paths, missing dependencies, or ticket ambiguity should be documented in
  the ticket and passed back to the Architect without waiting — but if
  what you've hit is a credential, a billing-affecting change, an
  irreversible infra choice, or a security/IAM grant, that goes to the
  Architect flagged for the user, not resolved by assumption.

## Step 4: Handoff
- Update the backlog file's `status` tag from `pending` to `in-review`.
- Notify the Architect that the feature is ready for the `Reviewer` agent.
