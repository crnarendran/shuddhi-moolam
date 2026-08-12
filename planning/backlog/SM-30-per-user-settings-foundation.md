---
id: SM-30
title: Per-user settings foundation (Firestore + self-scoped rules)
type: ticket
points: 3
status: in-review
depends_on: []
tags: [backlog, personalization, firestore, auth, security-rules, foundation]
---
# SM-30 — Per-user settings foundation

## Implemented (dev)
- `firestore.rules`: self-scoped `user_settings/{uid}` (read/write iff
  `auth.uid == uid`) + `companies/{id}` (+ `materials` subcollection) scoped to
  `ownerUid`. Reporting/monitor collections unchanged (allowlist read only).
- `dashboard/src/lib/userSettings.ts`: `UserSettings` type, `DEFAULT_SETTINGS`,
  pure `mergeSettings` + `shouldMigrateWeights` (vitest-tested, 6 cases).
- `dashboard/src/hooks/useUserSettings.ts`: self-contained hook (tracks auth,
  `onSnapshot` on `user_settings/{uid}`, optimistic debounced `update`, no-op
  when signed out).
- `CostImpactPage`: weights now read/write the account (Firestore) with a
  one-off localStorage migration + signed-out localStorage fallback.
- **vitest** added to the dashboard (`npm run test`) — first FE test harness,
  reused by SM-31/32/33.
- lint (oxlint) + tsc + vitest green.

**Test gap (follow-up):** rules-unit-testing needs the Firestore emulator,
which isn't configured yet. The only rule exercised now is the trivial
`user_settings` uid-scope; the `companies` rules are forward-looking for SM-32
and should get emulator tests when that lands.

## Goal
Give each signed-in user private, cross-device settings stored in Firestore
(not browser localStorage). This is the foundation for commodity
personalization (SM-31) and per-company materials/guidance (SM-32/33). No
report behaviour changes in this ticket — it only stands up storage, rules,
and a read/write hook, plus migrates the existing Cost-Impact weights.

## Why (localStorage → Firestore)
Cost-Impact weights currently live in browser `localStorage` (device-only,
unsynced, lost on cache clear). Real per-user/company data must be
server-side and private to the account. The dashboard already uses Firebase
Auth (Google sign-in), so `request.auth.uid` scopes ownership.

## Data model
- `user_settings/{uid}` — one doc per user. Shape grows across tickets; this
  ticket seeds it as `{ uid, updatedAt }` and holds the migrated Cost-Impact
  weights under `costImpact.weights` (map of commodityKey → number).
- `companies/{companyId}` — created in SM-32; carries `ownerUid`. Rules for it
  are added here so SM-32 is unblocked.

## Firestore rules (change)
Current rules are an owner allowlist (crnarendran, mvsaikishore) for reads of
`pipeline_runs*` / `historical_prices*`; writes are backend-only. Add
**self-scoped** access so any authenticated user can manage only their own
personalization data:
- `match /user_settings/{uid}` — allow read, write if
  `request.auth != null && request.auth.uid == uid`.
- `match /companies/{companyId}` (+ `/materials/{materialId}` subcollection) —
  allow read, write if `request.auth != null &&
  request.auth.uid == resource.data.ownerUid` (and on create,
  `request.resource.data.ownerUid == request.auth.uid`).
- Everything else unchanged; historical_prices / pipeline_runs stay read-only
  to the allowlist. Add a rules-unit test (SM security-rules skill).

## Dashboard: read/write hook
- `useUserSettings()` hook: subscribes to `user_settings/{uid}`, exposes the
  settings object + an `update(patch)` that merges + sets `updatedAt`. Debounce
  writes. Handles signed-out (returns defaults, no write) and loading states.
- Central `defaults` so a missing doc behaves as "nothing customised".

## Migration (one-off, client-side)
On first authenticated load, if `localStorage['cost_weights_v1']` exists and
`user_settings/{uid}.costImpact.weights` is unset, copy it up, then mark
migrated. Never overwrite existing Firestore values. Keep reading localStorage
as a fallback for one release, then remove.

## Acceptance / TDD
- Rules unit tests: a user can read/write their own `user_settings/{uid}` and
  `companies` where they are `ownerUid`; cannot read/write another uid's docs;
  cannot write `historical_prices`.
- `useUserSettings` returns defaults when signed out; persists an update and
  reflects it on reload (emulator or mocked Firestore).
- Cost-Impact weights migrate once and are not clobbered on subsequent loads.
- No visible report change; Cost-Impact keeps working, now backed by Firestore.

## Notes
Follow `.agents/skills/firebase-security-rules-auditor` for the rules change
and `docs/specs/architecture_and_billing_specs.md`. Deploy path: dev →
staging → main via the Release Manager (rules deploy with the functions
pipeline).
