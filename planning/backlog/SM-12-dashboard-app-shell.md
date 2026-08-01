---
id: SM-12
title: Monitoring dashboard — app shell, hosting & auth
type: ticket
points: 5
status: todo
depends_on: [SM-11]
tags: [backlog, dashboard, frontend, auth, hosting]
---
# SM-12 — Monitoring dashboard: app shell, hosting & auth

## Goal
Stand up the dashboard web app that operators open to watch files being
processed — hosting, sign-in, and access control — before any views are built.

## Recommended approach
A small **standalone** app in the `sai-shuddhi-moolam` Firebase project
(Firebase Hosting), reading `pipeline_runs` **directly via the Firestore client
SDK** with real-time `onSnapshot`. Auth via **Firebase Auth (Google sign-in)**
gated by an **email allowlist** enforced in Firestore security rules — no custom
backend for reads. (Alternative considered: fold it into the existing
docs-portal's RBAC app — rejected for now: couples project ops into the docs
tool and is cross-repo. Revisit if a shared ops console is wanted.)

## Scope
- Vite/Next SPA under `dashboard/` (or `app/`), built + deployed by CI to
  Firebase Hosting on the `dev/staging/main` branches (ties into SM-09).
- Firebase Auth Google sign-in; unauthenticated users see a sign-in screen only.
- Firestore **security rules**: `pipeline_runs` is readable only by allowlisted
  emails (a `dashboard_admins` doc/collection); no client writes (writes come
  only from Functions' admin SDK).
- App shell: header (project name, env badge, signed-in user, sign-out), a main
  content slot for SM-13's views, and a global loading/empty/error scaffold.

## UX / states
- **Signed-out:** centered "Sign in with Google" card; one line explaining it's
  the Shuddhi-Moolam processing monitor.
- **Signed-in, not allowlisted:** "You don't have access to this dashboard —
  ask an admin to add <email>." No data leaks.
- **Loading:** skeleton rows, not a spinner-only blank.
- **Env badge:** `DEV` / `STAGING` / `PROD` pill so operators know which
  environment's runs they're viewing.

## Acceptance criteria
- Deployed URL loads; unauthenticated users cannot read `pipeline_runs`
  (verified against security rules).
- Allowlisted user signs in and reaches an empty dashboard shell; non-allowlisted
  user is cleanly blocked.

## Notes / escalation
- Enabling Firebase Auth + Hosting on the project and seeding the first admin
  email are human/allowlist steps → add to `infrastructure.md` Known Gaps.
