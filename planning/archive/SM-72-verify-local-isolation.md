---
id: SM-72
title: Isolate Analytics Unit Tests & Add Root verify:local Gate
type: ticket
status: shipped
points: 1
assigned_to: sm-orchestrator
depends_on: [SM-63]
created_at: 2026-11-28
tags: [dashboard, functions, testing, ci, swarm-ops]
---

# SM-72: Self-Contained Unit Tests & Root `verify:local` Script

## Why this matters
Hand-off verification (`verify-handoff.mjs`) runs tests in a clean detached worktree without copying gitignored `dashboard/.env` files. Previously, `dashboard/src/lib/analytics.test.ts` mocked `firebase/analytics` without mocking `../firebase`, causing `src/firebase.ts` (`getAuth(app)`) to throw `FirebaseError: auth/invalid-api-key` unless `.env` was manually copied. In addition, root `package.json` lacked a `verify:local` script running both subpackage test suites (`functions` Jest and `dashboard` Vitest) cleanly and failing if either fails.

## Implementation
1. **Isolate `dashboard/src/lib/analytics.test.ts`**:
   - Added `vi.mock('../firebase', () => ({ app: {} }));` alongside the existing `firebase/analytics` mock so `analytics.ts` tests execute cleanly without gitignored `.env` files.
2. **Add Root `verify:local` Script (`package.json`)**:
   - Added `"verify:local": "npm --prefix functions test && npm --prefix dashboard test"` so `verify-handoff.mjs` (and local pre-push checks) execute both `functions` Jest and `dashboard` Vitest in order and fail non-zero if either suite fails.

## Verification
- **TDD Red (`dashboard/.env` absent):** `npx --prefix dashboard vitest run src/lib/analytics.test.ts` failed with `FirebaseError: Firebase: Error (auth/invalid-api-key)`.
- **TDD Green & Reviewer Audit (`dashboard/.env` absent, `TZ=UTC`, `CI=1`):**
  - `npm run verify:local`: exit `0` — `functions` Jest `26/26` suites (`175/175` tests passed) + `dashboard` Vitest `8/8` files (`92/92` tests passed, including `analytics.test.ts` `14/14`).
  - `npm --prefix dashboard run lint` (`oxlint`): `0` errors; `npm --prefix dashboard run build`: exit `0`.
  - `npm --prefix functions run lint` (`eslint`): exit `0`; `npm --prefix functions run build` (`tsc`): exit `0`.
  - Adversarial Reviewer (`pro`) returned `VERDICT: PASS`.
