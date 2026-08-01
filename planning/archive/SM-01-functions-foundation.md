---
id: SM-01
title: Cloud Functions foundation (Node/TS, lint, Jest, firebase.json)
type: ticket
points: 3
status: todo
depends_on: []
tags: [backlog, foundation, functions, ci]
---
# SM-01 — Cloud Functions foundation

## Goal
Scaffold the `functions/` Firebase Cloud Functions app (Node.js + TypeScript) so
every later ticket has a place to write code and a test harness to write it in.

## Scope
- `functions/` with TypeScript, `package.json`, `tsconfig.json`, build script.
- **ESLint/Prettier** configured to enforce `AGENTS.md` rules: 80-char lines,
  JSDoc on declarations, 2-space indent, no trailing whitespace, no `any`.
- **Jest** (ts-jest) configured; a trivial passing sample test proves the
  harness runs.
- `firebase.json` + `.firebaserc` wiring the `functions` codebase; `zod` added
  as a dependency (used by SM-05's contract).
- Local env conventions (`.env.local` for the `dev` project; secrets via
  Functions config, never committed).

## Acceptance criteria (TDD)
- `npm --prefix functions run build` compiles clean.
- `npm --prefix functions test` runs Jest and the sample test passes.
- `npm --prefix functions run lint` passes on the scaffold.

## Notes / escalation
- Do **not** hardcode project IDs; the staging/dev project topology is an open
  decision (`knowledge/infrastructure.md` → Known Gaps). Wire config so the same
  code deploys to whichever project a branch targets.
