# Shuddhi-Moolam — Agent Instructions

This file is the entry point for any AI coding tool that lands in this
repository, regardless of which one. Read it before doing anything else.

> **Shuddhi-Moolam** ("purifying to the raw source") is an event-driven,
> serverless pipeline that extracts structured line-item data from weekly,
> table-heavy PDF newsletters (Minerals & Metals Review) using Gemini, and
> appends the records to year-specific tabs in a master Google Sheet. See
> `knowledge/domain_model.md` for what it actually is before writing code.

## Resuming work

Before starting any task, read (in this order):
1. `knowledge/domain_model.md` — what this project actually is.
2. `planning/backlog/` — what's in progress / what to build next.
3. `.agents/skills/human-escalation-policy/SKILL.md` — the one rule that
   applies to every role below, all the time.

## The roles

Each role has a config at `.agents/<role>/agent.json` (its system prompt)
and, where relevant, a matching SOP at `.agents/skills/<role>-workflow/SKILL.md`.
Read the role's own files before acting as that role — this file only
gives the map, not the detail.

| Role | Does | Does NOT |
|---|---|---|
| **Architect** | Turns requirements into points-based `planning/backlog/` tickets; the single point of contact with the user | Write production code (except the small-fix exception — see `developer-implementation-workflow`) |
| **Developer** | Implements a backlog ticket via TDD | Decide scope, skip tests, or silently guess on escalation-worthy ambiguity |
| **Reviewer** | Reviews Developer output for correctness/security against the ADR and ticket | Fix what it finds — reports back to the Architect instead |
| **SDET** | Writes unit/integration/E2E tests | Write production features |
| **Docs** | Maintains `knowledge/` and `planning/` as OKF (Markdown + YAML frontmatter) | Invent facts it isn't sure of — asks instead |
| **Release Manager** | Runs CI/CD, watches deploys to actual completion | Consider a deploy "done" just because it was triggered |
| **Retro** | Analyzes what went wrong and proposes concrete fixes to the swarm's own files | Apply those fixes itself — hands off to Forger only after human approval |
| **Forger** | Applies approved changes to `agent.json`/`SKILL.md` files | Act on an unapproved retro, or self-invoke |

## The one cross-cutting rule: when to escalate

Every role's "don't stall" behavior is governed by
`.agents/skills/human-escalation-policy/SKILL.md`. Read it once, in full,
regardless of role — it draws a hard line between the ambiguity you should
resolve yourself (document the assumption, keep moving) and the ambiguity
that must go to a human even if that means pausing (credentials, billing,
irreversible infra choices, security/IAM grants, scope reversals). Getting
this line right is worth more to the swarm's reliability than almost
anything else in this repository.

## Model Routing Matrix (CRITICAL RULE)

To optimize code quality while minimizing token waste, subagents must be invoked with specific AI model tiers (`pro`, `flash`, `flash_lite`) based on their role:
- **`pro` (High Reasoning):** MUST be used for the Architect, Developer, and Reviewer. These roles require deep systemic context and must never compromise on code quality.
- **`flash` (Standard I/O):** MUST be used for Docs, SDET, and Retro. These roles process large amounts of context but execute straightforward tasks (writing English specs, writing tests from a plan, summarizing transcripts).
- **`flash_lite` (Sub-Process Management):** MUST be used for polling, background watchers, log tailers, and environment checks. For example, when the Release Manager spawns a watcher to execute `gh run watch`, it must use `flash_lite`.

**Lowest-Capable-Tier Default:**
Before launching **any** subagent or subprocess, pick the **lowest tier that can do the job**, and escalate only when the task genuinely needs it.
- **`pro` / High:** Only for multi-file systemic reasoning, novel logic, security judgement, or architecture.
- **`flash` / Medium:** The default for "transform what I already have" (docs, tests, refactors).
- **`flash_lite` / Low:** Anything that *observes or relays* rather than reasons — background watchers, pollers, log tailers, and one-shot lookups (does a file exist, what's the current branch, is a port open).

**Never attach a `pro`/`flash` model to a long-lived background watcher.**
It burns the expensive model idling on I/O. A subprocess whose whole job is
"wait for a condition and report it" is always `flash_lite` — spawn it there,
let it wake you on the event, then do the reasoning yourself on the tier the
*next* step warrants. Spending `pro`-tier tokens on watch/poll/summarize work
is the single most common source of waste in a swarm.

**Fallback Escalation:**
If a `flash` or `flash_lite` subagent repeatedly fails its task, terminate it,
respawn it with the next higher tier, and trigger the Retro → Forger loop to
update that task's SKILL file so its model tier is permanently escalated. The
matrix is a floor-first default, not a ceiling — self-correct when a task
proves it needs more.

**Cross-tool tier mapping:**
Whichever tool is running, map the tier to its own model family when spawning:
- **Antigravity (Gemini):** `pro` → Gemini 3.1 Pro, `flash` → Gemini 3.6 Flash, `flash_lite` → Gemini 3.6 Flash-Lite.
- **Claude Code (Claude):** `pro` → Opus, `flash` → Sonnet, `flash_lite` → Haiku.

## Subagent Naming Convention

When invoking any subagent, you MUST format the `Role` parameter to visibly indicate its type and the specific model version/tier (High/Medium/Low) for the user's awareness.
Format: `[Descriptive Role] ([Agent|Sub-Process] - [Model Version] ([Tier]))`
Use your runtime's own model names (see the cross-tool tier mapping above):
- Example (pro, Gemini): `Release Manager (Agent - Gemini 3.1 Pro (High))`
- Example (pro, Claude): `Reviewer (Agent - Opus (High))`
- Example (flash): `Docs Writer (Agent - Gemini 3.6 Flash (Medium))`
- Example (flash_lite): `GH Run Watcher (Sub-Process - Haiku (Low))`

## Portability: tool names in `agent.json` are placeholders

The system prompts reference tool names like `ask_question`,
`invoke_subagent`, and `WaitMsBeforeAsync`. These describe **capabilities**
(pause and ask the user; delegate a scoped subtask; run something in the
background and get notified) — not a specific product's API. If your
agent runtime doesn't literally have a tool with that name, map the intent
to whatever your runtime actually provides (a plan-mode approval gate, a
subagent-spawning tool, a background task + notification mechanism) rather
than skipping the rule because the exact name doesn't match.

## Knowledge, not memory

Nothing here persists in any single agent's private memory — the only
thing every agent, tool, and session shares is what's written into this
repo: `.agents/`, `knowledge/`, `planning/`. Treat writing to these as part
of finishing a task, not an optional extra step.

---

# Project-specific: Shuddhi-Moolam

The sections above are the portable swarm rulebook (seeded from `swarmkit`).
Everything below is specific to *this* project. When a project-specific rule
here conflicts with the portable text above, this section wins.

## Runtime & coding standards

Backend is **Node.js + TypeScript** (Firebase Cloud Functions). When writing or
modifying TS/JS under `functions/`:
1. **80-char line limit.** Wrap at ~70 to be safe. Break long strings,
   template literals, and argument lists across lines.
2. **JSDoc required** on every function declaration (`@param`, `@return`).
3. **No trailing whitespace**; **2-space indentation**.
4. **Avoid `any`.** Use `unknown` + a cast, or a defined interface. The Gemini
   extraction contract is validated with **Zod** (see `knowledge/domain_model.md`).
5. **TDD is enforced** (§ Developer / SDET roles): write the failing **Jest**
   test first, watch it fail, implement the minimum to pass, then verify.

## Environments & project IDs

| Environment | Firebase / GCP project | Branch |
|---|---|---|
| Production (prod) | `sai-shuddhi-moolam` | `main` |
| Staging | `sai-shuddhi-moolam` | `staging` |
| Development | `sai-shuddhi-moolam` | `dev` |

All branches (`dev`, `staging`, `main`) target the single `sai-shuddhi-moolam`
project. Environment isolation is handled via config/prefixing.

## Branching & promotion

Promotion flow: **`dev` → `staging` → `main`**, each promoted by
merging/pushing into the next branch. Deploys are triggered by GitHub Actions
on push to that branch, not by a manual deploy step. Do day-to-day work on
`dev`; never treat `staging`/`main` as scratch branches. `main` is the default
/ PR-target branch.

## Planning discipline

Active and upcoming work lives in `planning/backlog/` as points-based OKF
tickets; completed/deprecated tickets move to `planning/archive/`. When you
start a feature, ensure it has a backlog ticket; when it lands, archive it.
Never let "done" items accumulate in `backlog/`.

## Docs → docs-portal

User-facing docs live in `docs/` and project knowledge in `knowledge/`. Both
are pushed into the shared `docs-portal` Firestore by `scripts/syncDocs.ts`
(tagged `project: 'shuddhi-moolam'`), triggered by `.github/workflows/sync-docs.yml`
on push to `staging`/`dev`. A brand-new doc **page** only gets a live portal
URL after (a) it reaches the `portal_docs` collection via a `staging` sync and
(b) the `docs-portal` app is redeployed so its static route regenerates — see
`knowledge/infrastructure.md`.
