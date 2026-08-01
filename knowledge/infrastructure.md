---
type: reference
tags: [infrastructure, deployment, reference, gcp, firebase, docs-portal]
status: partial
---
# Infrastructure Map

Every project, API, secret, and known gap for Shuddhi-Moolam. The **Docs** role
owns keeping this current; every other role should read it before provisioning
anything, wiring CI, or debugging a deploy — rather than re-discovering state
live via `firebase projects:list` / `gcloud`.

## Environments

Promotion flow is `dev → staging → main`. Only the production Firebase project
exists today; the staging/dev topology is an **open decision** (see Known Gaps).

| Environment | Branch | Firebase / GCP project | Status |
|---|---|---|---|
| Production | `main` | `sai-shuddhi-moolam` | Created (Spark plan; needs Blaze — see gaps) |
| Staging | `staging` | *TBD* | Not provisioned |
| Development | `dev` | *TBD* | Not provisioned |

## Services (target architecture)

Once provisioned, each environment's Firebase project runs:
- **Cloud Functions** (Node.js + TypeScript) — the Drive webhook handler, the
  extraction/routing logic, and a scheduled Drive-channel renewal function.
- **Firestore** — channel/watch state (`channelId`, `resourceId`, expiry) and a
  processed-file dedup store.
- **No hosting / no end-user auth** — the pipeline runs as a service identity,
  not a signed-in user.

External Google APIs (enabled per project):
- **Google Drive API** — `changes.watch` push notifications + file retrieval.
- **Google Sheets API** — tab management + row append on the master sheet.
- **Generative Language API** — Gemini (Flash) structured extraction.

## Secrets & credentials (target)

| Secret name | Store | Authenticates / grants | Used by |
|---|---|---|---|
| `GEMINI_API_KEY` | Firebase Functions secret / GitHub secret | Generative Language API | Extraction (SM-05) |
| Service account JSON | Functions runtime identity / GitHub secret | Drive folder + master Sheet (Editor) | Ingestion + routing (SM-02..SM-07) |
| `FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_STAGING` | GitHub repo secret | `docs-portal-staging` (Firestore write) | `.github/workflows/sync-docs.yml` |
| `FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_PROD` | GitHub repo secret | `docs-portal-prod` (Firestore write) | `sync-docs.yml` (`workflow_dispatch`, target=prod) |

None of these are provisioned yet — all are human-only actions (see gaps).

## Docs-portal integration (write-only)

This repo publishes its own docs (`README.md`, `AGENTS.md`, `docs/`,
`knowledge/`, `.agents/skills/*/SKILL.md`) into the **shared** `docs-portal`
Firestore, tagged `project: 'shuddhi-moolam'`, via `scripts/syncDocs.ts` and
`.github/workflows/sync-docs.yml`:
- Push to `staging` → collection `portal_docs` (project `docs-portal-staging`).
- Push to `dev` → collection `portal_docs_dev` (project `docs-portal-staging`).

The portal itself is a separate app (`crnarendran/docs-portal`) and does not
need to know this repo exists. **Gotcha:** a brand-new doc *page* only gets a
live URL after (a) its slug reaches `portal_docs` (i.e. a `staging` sync ran)
**and** (b) the portal app is redeployed so its static route regenerates
(`gh workflow run deploy-staging.yml -R crnarendran/docs-portal`). Edits to an
existing page appear without a redeploy; new pages 404 until both steps.

## Known gaps (human-only — see `.agents/skills/human-escalation-policy`)

These block a first live run and are credentials/billing/IAM decisions an agent
must not perform:

1. **Billing:** upgrade `sai-shuddhi-moolam` to the **Blaze** plan (required for
   outbound API calls from Functions).
2. **APIs:** enable **Google Drive API**, **Google Sheets API**, and
   **Generative Language API** on the project(s).
3. **Service account + IAM:** create a dedicated service account and grant it
   **Editor** access to the target Drive folder and the master Google Sheet;
   store its key as the Functions runtime identity / GitHub secret.
4. **Secrets:** add `GEMINI_API_KEY`, the SA JSON, and the two docs-portal
   `FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_*` secrets to the GitHub repo. (The
   docs-portal secrets are copies of the docs-portal service-account keys also
   held by `sanjeev-ai` — GitHub has no cross-repo secret sharing for
   personal-account repos. Docs-portal secrets provisioned 2026-08-01.)
5. **Env topology decision:** decide whether `staging`/`dev` get their own
   Firebase projects (recommended for isolation) or all three branches deploy to
   `sai-shuddhi-moolam` with per-env config. Fill the Environments table once
   decided.
6. **Docs-portal first-run redeploy:** after the first `staging` docs sync,
   redeploy the portal once so `/shuddhi-moolam/...` routes generate.
