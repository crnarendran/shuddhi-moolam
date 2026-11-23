---
id: SM-70
title: Scheduled Guidance Buy-Window Alerts
type: ticket
status: shipped
points: 4
assigned_to: sm-orchestrator
depends_on: [SM-33, SM-61, SM-62, SM-66]
created_at: 2026-11-23
tags: [functions, dashboard, guidance, alerts, email, scheduled]
---

# SM-70: Scheduled Guidance Alerts

## Context & Goal
Final story from the `SM-34` guidance-enhancements epic. Premium users who configure material BOMs in Settings want automated Monday morning email alerts when a material's quarterly blended cost (`SM-61`) or upcoming calendar month's cost-weighted seasonal index dips by at least their configured threshold.

## Implementation
1. **Per-User Alert Settings (`dashboard/src/lib/userSettings.ts`, `hooks/useUserSettings.ts`, `pages/SettingsPage.tsx`)**:
   - Added `GuidanceAlertPrefs` (`enabled`, `email`, `dipThresholdPct` 1–50%) on `UserSettings` and preserved/cleaned sibling fields inside `mergeSettings`.
   - `useUserSettings().update()` returns `Promise<boolean>`, rolling back optimistic state on Firestore write errors; `SettingsPage` validates non-service-account emails before saving and renders `role="alert"` on validation/save failures rather than false `"Saved"` state.
2. **Pure Buy-Window Alert Engine (`functions/src/reporting/guidanceAlerts.ts`)**:
   - `computeBlendedCost` matches SM-61 `Σ(g × p) ÷ 1000` with priced-average imputation and non-negative finite clamping.
   - `evaluateBuyWindows` filters malformed records cleanly and evaluates both quarter-to-date vs prior calendar quarter cost change and next-month cost-weighted seasonal dip (`<= -threshold`), sorting strongest signals first.
   - `resolveGuidanceAlertRecipient` pins ALL non-production environments (`!isProduction(env)`) to `crnarendran@gmail.com` to prevent `dev`/`staging` cron jobs from emailing production users.
   - `buildGuidanceAlertHtml` & `sendGuidanceAlertEmail` XSS-escape table cells, validate HTTP(S) base URLs, and deliver consolidated weekly HTML summaries via Resend (`RESEND_API_KEY`).
3. **Scheduled Function & CI Wiring (`functions/src/reporting/guidanceAlertsJob.ts`, `functions/src/index.ts`, `scripts/ci/run.mjs`)**:
   - Exported `guidanceAlert${suffix}` (`0 9 * * 1`, `secrets: ['RESEND_API_KEY']`), verifying premium entitlement via `entitlements/{uid}` or verified Auth founder email (`FOUNDER_EMAILS` from `config/roles.ts`) before scanning owned companies and sending at most one weekly digest per user.
   - Added `guidanceAlert` to `CLOUD_FUNCTIONS` in `scripts/ci/run.mjs` and verified parity in `functions/src/ci/ciWrappers.test.ts`.

## Acceptance Criteria
- [x] Premium users can opt into weekly buy-window alerts, customize email + threshold (`>= 1%`), and receive accurate save/validation feedback.
- [x] Weekly cron evaluates SM-61 quarterly cost dips and seasonal buy windows per company material and strictly isolates non-prod emails to `crnarendran@gmail.com`.
- [x] Entitlement check blocks downgraded `free` users and ignores user-spoofed contact emails.
- [x] Local gates pass (`functions`: `npm run lint`, `tsc`, `26/26` suites / `175/175` tests; `dashboard`: `7/7` files / `86/86` tests, `oxlint` 0 errors, `vite build` exit 0) and Reviewer (`pro`) returned `VERDICT: PASS`.
