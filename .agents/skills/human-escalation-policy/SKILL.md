---
name: human-escalation-policy
description: When an agent must pause for human input versus when it should document an assumption and keep moving. Referenced by every role's Non-Stalling Policy.
---

# Human Escalation Policy

Every agent in this swarm operates under a **Non-Stalling Policy**: don't sit
idle waiting for a human reply when the ambiguity is cheap to resolve
yourself. That default is right for most day-to-day ambiguity — a missing
docstring convention, an unclear variable name, a minor scoping choice. Assume
the reasonable interpretation, document it in the OKF ticket/ADR, and keep
moving.

**That default breaks down for a specific, narrow class of decisions where
the cost of guessing wrong is high and hard to undo.** Real swarm operation
has shown that agents which never pause end up either stalling anyway (an
assumption becomes an expensive round trip to unwind) or, worse, taking an
action a human would not have wanted — sometimes on infrastructure that
outlives the current task entirely. This is the pillar of the framework most
likely to bite silently, so treat it as a hard rule, not a suggestion.

## Always escalate to the human, even if it "blocks" you

- **Credentials & secrets:** creating, rotating, or reading service account
  keys, API tokens, or any credential — even when the agent is technically
  capable of scripting around it (e.g. extracting a stored OAuth refresh
  token to make an authenticated call). If the agent can do something a
  human would consider a security-sensitive action, that's the signal to
  stop, not proceed quietly because it's possible.
- **Billing / cost-incurring infrastructure changes:** enabling a paid API,
  provisioning a resource that bills per-use, upgrading a project's billing
  plan, or anything that starts a meter running.
- **Irreversible or hard-to-reverse choices:** a database's physical region
  (can't be changed after creation), deleting data, force-pushing shared
  branches, or picking a name/identifier that many other systems will come
  to depend on.
- **Security/IAM grants:** adding a role or permission to any principal,
  even a CI service account that "obviously" needs it to do its job.
- **Scope reversals:** if new information contradicts a decision the human
  already made (e.g. "actually keep it in the project we agreed to move away
  from"), confirm the new direction explicitly rather than silently
  reinterpreting past instructions.
- **Anything the agent notices is inconsistent with what it was told** —
  e.g. a secret's name implies one target but its actual scope is another.
  Report the inconsistency; don't pick a side of it on your own.

## Escalate by asking a specific, answerable question

A good escalation names the concrete options and their consequences ("use
region A or region B — A is closer to your compute, B is closer to your
users, and this can't be changed later") rather than a vague "what should
I do?". This keeps escalation cheap for the human even though it's not
fully autonomous.

## Everything else: assume, document, keep moving

If it doesn't match one of the categories above, don't stall. Pick the
reasonable interpretation, write down *why* in the ticket/ADR so a reviewer
can catch it if it was wrong, and continue. The whole point of this policy
is to make escalation rare enough that it's still trustworthy when it
happens — an agent that asks about everything is as unhelpful as one that
asks about nothing.
