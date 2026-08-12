---
id: SM-35
title: In-product documentation — report intros, how-to-read, term tooltips
type: ticket
points: 3
status: in-review
depends_on: [SM-18, SM-20, SM-21, SM-26, SM-31, SM-32, SM-33]
tags: [backlog, docs, ux, onboarding, self-explanatory, tooltips]
---
# SM-35 — In-product documentation (self-explanatory reports)

## Implemented (dev)
- **Help content registry** (`lib/help.ts`) — single source of truth:
  - `REPORT_HELP` per report (`price-review`, `seasonal`, `cost-impact`,
    `spreads`, `companies`, `guidance`, `settings`): `title`, a comprehensive
    plain-language `description`, and a `howToRead` bullet list.
  - `GLOSSARY` of jargon terms (MoM %, rolling baseline, seasonal index,
    spread, deviation σ, blended cost, consumption weight, tier, substitution
    group) reused verbatim by tooltips so a term reads identically everywhere.
- **Reusable components:**
  - `Tooltip.tsx` — lightweight, dependency-free; hover / keyboard-focus / tap
    to open, leave / blur / Escape to dismiss; theme-aware, viewport-clamped.
  - `InfoTip.tsx` — an (i) icon that reveals a `Tooltip`; takes `content` or a
    glossary `term`.
  - `ReportIntro.tsx` — always-visible page intro: title + description
    paragraph + a bordered "How to read this" bullet box. Inline (not a
    tooltip) so every report is self-explanatory on load.
- **Wired into every report page:** `ReportIntro` at the top of Price Review,
  Seasonal, Cost Impact, Spreads, Companies, Guidance, Settings (existing
  dynamic captions like "Aug vs Jul · month-over-month" retained beneath it).
- **Term-level `InfoTip`s** on the jargon-heavy tiles/headers: Cost Impact
  ("Sum of impact / kg", Baseline, Weight), Spreads (Latest spread, Deviation
  σ), Guidance (Blended cost, vs-baseline).
- oxlint + tsc + vitest (22) + production build green.

## Goal
Make every tool self-explanatory in-product — a first-time user should
understand what each report is, how to read it, and what each term means
without leaving the app or reading external docs. Fulfils the user request:
"every tool self-explanatory using tooltip text and a description of what the
report does / how to read it", and specifically "comprehensive inline
description of reports within the page".

## Approach
1. Centralise all copy in `lib/help.ts` (no strings scattered across pages) so
   docs stay consistent and are cheap to edit / later sync to docs-portal.
2. Inline `ReportIntro` (description + how-to-read) — always visible, not
   hidden behind a hover — because comprehension shouldn't require discovery.
3. `InfoTip` reserved for term-level definitions on individual metrics, pulling
   from the shared `GLOSSARY`.

## Decisions
- **Custom Tooltip** (not a library) — keeps the bundle lean and avoids a new
  dependency for a trivial component.
- **Intro depth = comprehensive** — full description paragraph + explicit
  "how to read this", per user preference for thorough inline docs.
- **docs-portal sync deferred** — `help.ts` is structured so its content can
  later feed the portal; not wired this ticket.

## Acceptance
- Each report renders a visible intro (what it is + how to read it) above the
  controls/data on load, no interaction required.
- Key jargon terms expose a definition via an (i) tooltip that is
  keyboard-accessible and dismissible.
- All copy sourced from `lib/help.ts`; no duplicated definitions.
- Lint, typecheck, unit tests, and build pass.

## Out of scope
- Syncing `help.ts` content into the docs-portal Firestore.
- A dedicated in-app "Help / glossary" page or guided tour.
- Localisation of the copy.
