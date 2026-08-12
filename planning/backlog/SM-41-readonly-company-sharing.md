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
- **`historical_prices` access**: a viewer must read price data. Options:
  (a) broaden read to **any authenticated user** (price data is the same public
  newsletter for everyone — simplest); (b) keep the allowlist and have a
  backend function serve filtered data. **Recommend (a)** with a note that
  commodity prices are not per-user-private.
- **"Only linked commodities viewable" is a UI constraint, not a hard rule:**
  Firestore can't hide fields within a `historical_prices` doc (each doc holds
  all commodities for a date). The viewer's effective commodity list is the
  union of the shared company's materials' commodities, enforced in the UI. If
  hard field-level isolation is required, that needs a backend read API
  (bigger; out of scope for v1).

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

## Email (infra — ESCALATION per human-escalation-policy)
Sending invite emails needs a provider. Recommended: the Firebase **"Trigger
Email" extension** (writes to a `mail` collection → SendGrid/SMTP), or a
function calling an email API. **Provisioning the provider + its API key/SMTP
creds is a billing/credentials step the agent must NOT self-serve** — flag and
hand to the user. Until wired, invites can be created and the link shown to
copy manually (degraded mode).

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

## Decisions (need sign-off)
1. **Email provider** (Trigger Email extension vs email API) — and OK to
   provision it (billing/credentials = your action).
2. **`historical_prices` read**: broaden to any authenticated user
   (recommended) vs keep allowlist + backend-served data.
3. **"Only linked commodities"**: UI-enforced (recommended for v1) vs hard
   backend-enforced isolation (bigger).

## Out of scope (v1)
- Editable/co-owner sharing; org-wide multi-tenancy; per-material (vs
  per-company) sharing; hard field-level price isolation; in-app notifications.
