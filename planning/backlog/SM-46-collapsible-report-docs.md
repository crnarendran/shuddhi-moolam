---
type: ticket
id: SM-46
tags: [planning, dashboard, ux, docs]
status: in-review
points: 1
depends_on: [SM-35]
---
# SM-46 — Collapsible inline report documentation

## Problem
The `ReportIntro` block (description + "How to read this") is always expanded at
the top of every report, forcing advanced users to scroll past it each visit.

## Decision (user-approved)
Make the inline docs a **collapsible panel, collapsed by default**. The report
title stays visible with a "Show help / Hide help" toggle. The open/closed
choice is remembered (one shared `localStorage` key `sm.reportHelp.expanded`)
so a user who collapses it keeps it collapsed across reports and reloads.

## Scope
- `components/ReportIntro.tsx`: add expand/collapse state + persistence; title
  row gains a chevron toggle; description + "How to read this" render only when
  expanded. No changes needed at call sites (same props).

## Tests
Covered by existing report render tests + tsc/lint (pure presentational toggle).
