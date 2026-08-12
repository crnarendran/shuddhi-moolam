---
id: SM-42
title: Premium entitlement gate — creating companies/materials is paid
type: ticket
points: 3
status: in-review
depends_on: [SM-32, SM-41]
tags: [backlog, monetization, entitlements, security, plans]
---
# SM-42 — Premium entitlement gate

## Goal
Creating your **own** companies/materials (and generating guidance from them)
is a **premium** capability. **Free** users can only **view** companies shared
with them (read-only, via SM-41). This gates the read-only-viewer regression
where an invited free user could also create their own workspace.

Pricing model (license vs subscription) is undecided; the entitlement is a
simple per-user `plan` flag so either model can drive it later without rework.

## Implemented (dev)
- **Model:** `entitlements/{uid}` = `{ plan: 'free' | 'premium', email,
  updatedAt }`. User reads their own; **backend/admin-write only**. Founders
  (crnarendran, mvsaikishore) are grandfathered premium.
- **Rules (firestore.rules):** `isPremium()` = founder email OR
  `entitlements/{uid}.plan == 'premium'`. `companies` **create** now requires
  `isPremium()` (materials follow, since they need company ownership).
  `entitlements` is user-read / backend-write.
- **Backend:** `setUserPlan({ email, plan })` callable — **admin-only** —
  resolves the user by email and writes their entitlement. This is the interim
  **license grant**; a subscription/billing webhook can later write the same
  doc.
- **Frontend:** `usePlan()` hook (mirrors the rule, founders → premium).
  CompaniesPage shows an **upsell** for free users instead of the create UI,
  and points them to the view switcher if companies are shared with them. The
  shared read-only view and reports are unaffected.

## Granting premium (interim)
Admin calls `setUserPlan` (e.g. from a small admin action or the Functions
shell) with the user's email + `premium`. The user must have signed in once so
a Firebase Auth account exists.

## Acceptance
- A free (non-founder) user cannot create a company — blocked by rules AND the
  UI shows the upsell.
- A free user can still accept a share and view that company read-only + its
  charts.
- An admin can grant premium via `setUserPlan`; the user can then create.
- Founders remain premium without an entitlement doc.

## Out of scope (future)
- Actual billing integration (Stripe/subscription webhook writing the
  entitlement), self-serve checkout, plan tiers beyond free/premium, seat
  limits, an in-app admin console for granting plans.
