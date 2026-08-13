---
id: SM-41
title: Read-only company sharing — invite viewers with tracked, expiring invites
type: epic
points: 13
status: planned
depends_on: [SM-30, SM-32, SM-33]
tags: [backlog, sharing, invitations, security, auth, email, multi-user]
---
# SM-41 — Read-only company sharing (epic)

## Goal
Let a company owner **invite another user to view one company** — its materials
and the related charts/guidance — in **read-only** mode. The viewer cannot
create companies or edit anything, and sees **only the commodities linked to
the shared company**. Invitations are **tracked** (pending / accepted+logged-in
/ expired), **expire after 7 days**, and can be **resent / re-invited**.

## Current model (context)
- `companies/{companyId}` `{ ownerUid, name, notes, ... }`; materials in
  `companies/{companyId}/materials/{materialId}`. Rules are **owner-scoped**
  (`ownerUid == uid`).
- `historical_prices*` is readable only by a **hard-coded 2-email allowlist**
  (`firestore.rules`). A viewer needs to read it to see charts — see the
  security decision below.

## Data model
- **Company gains** `viewerUids: string[]` (accepted viewers). Optionally
  `viewerEmails` for display.
- **`invitations/{inviteId}`**: `companyId`, `companyName`, `ownerUid`,
  `ownerEmail`, `inviteeEmail` (lower-cased), `token` (random, unguessable),
  `status` (`pending|accepted|revoked`), `createdAt`, `expiresAt`
  (createdAt + 7d), `acceptedAt?`, `acceptedUid?`, `lastSeenAt?`.
  *Expired* is derived at read time (`status==pending && now>expiresAt`) — no
  separate stored state needed.

## Flows
### Invite (owner)
Owner opens a company → "Share" → enters an email → creates an invitation
(pending, 7-day expiry) and an email is sent with an accept link
(`<app>/?invite=<token>`). Owner sees a list of that company's invites with
status.

### Accept (invitee) — via a backend callable
Invitee clicks the link, signs in with Google. The app calls a **Cloud
Function `acceptInvitation({ token })`** (admin-privileged) which validates:
token exists, `inviteeEmail === request.auth.token.email`, not expired, not
revoked — then adds the caller's uid to `company.viewerUids`, sets
`status=accepted`, `acceptedUid`, `acceptedAt`. (A viewer can't self-grant via
rules; the function is the trusted writer.)

**The invitee may already be a Shuddhi-Moolam user** — this is the common
case, not a special one. Accept works identically (same Google sign-in, same
callable); there is **no second account**. The shared company simply appears
in that user's **context switcher** (below). So a person can simultaneously
own their own companies AND be a read-only viewer of others' — the invite just
adds a uid to the shared company's `viewerUids`.

### Track status (owner)
Per invite: **Waiting** (pending, not expired) · **Accepted** (shows
acceptedAt + last-seen) · **Expired** (pending past expiry). "Accepted &
logged in" = `acceptedUid` set and `lastSeenAt` recent.

### Resend / re-invite (owner)
- **Resend email**: re-send the same pending invite's email.
- **Re-invite**: for an expired invite, issue a fresh token + reset
  `createdAt/expiresAt` (or create a new invite, supersede the old).
- **Revoke**: set `status=revoked` and remove the uid from `viewerUids`.

## Access control (security-critical — audit with the
firebase-security-rules-auditor skill)
- `companies/{id}` and `.../materials`: `allow read` if `uid == ownerUid` **or**
  `uid in resource.data.viewerUids`. Writes stay owner-only.
- `invitations`: owner can read/create/update **their** company's invites; the
  invitee reads via the callable (or a token-scoped read). No public listing.
- **`historical_prices` access — DECIDED: broaden read to any authenticated
  user.** Commodity prices are the same public newsletter for everyone, so
  they are not per-user-private. Replace the hard-coded 2-email allowlist on
  `historical_prices*` with `request.auth != null`. (`pipeline_runs*` /
  monitor can stay allowlisted — that's operational, not shared.)
- **"Only linked commodities viewable" — DECIDED: UX-only, no hard rule.** The
  restriction is about not *displaying* other commodities to the viewer, not a
  security boundary. The viewer's effective commodity list is the union of the
  shared company's materials' commodities, enforced in the UI. (Firestore
  can't hide fields within a price doc anyway; a hard field-level API is
  explicitly not wanted.)

## Read-only viewer UX

### Context switcher ("view as") — for existing users
A **workspace/context switcher** (in the header or the company picker) lets a
user flip between:
- **My workspace** — their own companies/materials, full edit (unchanged).
- **Shared: `<company>` · by `<owner email>`** — one entry per accepted share,
  read-only.

Switching is client-side context only (no re-login): it changes which
company/commodity scope the dashboard renders and toggles read-only. The
switcher is the "switch view as other user" ability — an existing user never
logs into a second account; they just change context and switch back anytime.
A user with no shares sees no switcher (just their own workspace, as today).

### While in a shared context
- Shows the shared company's materials + Guidance + the report charts, but the
  **commodity set is restricted** to the company's linked commodities; global
  "create company / add material / edit" actions are **hidden**, and writes are
  denied by rules as defence-in-depth.
- The viewer's own commodity personalization/exclusions do **not** apply here —
  they see the owner's linked commodity scope.
- Persisted per-report view state (SM-39) is namespaced per context so a
  shared view doesn't clobber the viewer's own-workspace selections.
- Clear "Read-only — viewing `<company>` shared by `<owner email>`" banner with
  a "Back to my workspace" affordance.

## Email — DECIDED: send directly from the Cloud Function (no extension)
**Firebase Extensions are being retired (installs/edits end 31 Mar 2027), so we
do NOT use the "Trigger Email" extension.** Instead the `createInvitation` /
`resendInvitation` callables send the email **directly** by calling a
transactional-email provider's API (the extension did exactly this internally;
we just own the ~30 lines). Provider-agnostic; the API key lives in **Secret
Manager**, not in code. The provider's API response → delivery status stored on
the invitation doc. No `mail` collection needed.

**Provider:** ✅ **Resend** (`resend` SDK), behind a thin swappable
`sendEmail()` helper. **Sending domain: `narensportal.com`** (verified in Resend); **FROM
`Shuddhi-Moolam <sai-shuddhi-moolam-no-reply@narensportal.com>`**. API key
stored as the `RESEND_API_KEY` Firebase secret (Blaze confirmed).

**User-provisioned prerequisites (billing/credentials — ESCALATION, not the
agent's to do):**
1. Confirm the project is on **Blaze** — required for a Function to make
   outbound calls to a non-Google API. Functions are already deployed, so
   likely already Blaze.
2. Create the provider account, **verify a sending domain/sender**, and mint an
   **API key**.
3. Store it as a secret: `firebase functions:secrets:set RESEND_API_KEY`
   (or `SENDGRID_API_KEY`). One secret covers all envs (shared project).

The agent adds the provider SDK to `functions/` deps and the `sendEmail()`
helper. Until the key is provisioned, invites still create + track and show a
copyable accept link (degraded mode); email lights up once the secret exists.

## Suggested phasing (≤5-pt batches)
- **SM-41a (5):** data model + security rules (`viewerUids`, `invitations`,
  read grants, `historical_prices` decision) + rules tests.
- **SM-41b (5):** backend callables — `createInvitation`, `acceptInvitation`,
  `resendInvitation`, `revokeInvitation`, expiry handling + email hook.
- **SM-41c (3):** UX — owner share/manage panel (status, resend, revoke) +
  read-only viewer experience: **context switcher** (my workspace ↔ each
  shared company), restricted commodities, hidden writes, read-only banner,
  context-namespaced view state.

## Acceptance
- Owner invites by email; invite is pending with a 7-day expiry; email sent
  (or link shown in degraded mode).
- Invitee accepts via the callable; owner sees Accepted + last-seen; viewer
  sees only that company, its materials, and its linked commodities, read-only.
- An **existing user** who accepts gets the shared company in a **context
  switcher** (no second account) and can flip between their own workspace
  (editable) and the shared company (read-only), without re-login.
- Expired invites show as expired and can be re-invited/resent; revoke removes
  access.
- Rules verified (auditor): a viewer can read the shared company/materials but
  cannot write or read other owners' companies; a random user can't accept
  someone else's invite.

## Decisions
1. **Email** — ✅ DECIDED: send directly from the Cloud Function via a
   transactional-email API (NOT the deprecated Trigger Email extension).
   Remaining user action: provision Blaze + a provider (Resend/SendGrid) +
   set the API-key secret (see Email section).
2. **`historical_prices` read** — ✅ DECIDED: any authenticated user.
3. **"Only linked commodities"** — ✅ DECIDED: UX-only (no hard isolation).

## Out of scope (v1)
- Editable/co-owner sharing; org-wide multi-tenancy; per-material (vs
  per-company) sharing; hard field-level price isolation; in-app notifications.
