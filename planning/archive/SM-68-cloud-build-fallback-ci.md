---
id: SM-68
title: Cloud Build Fallback CI Pipeline & Provider-Neutral Wrappers
type: ticket
status: shipped
points: 1
assigned_to: sm-orchestrator
created_at: 2026-11-22
tags: [ci, cloud-build, github-actions, devops]
---

# SM-68: Cloud Build Fallback CI Pipeline & Provider-Neutral Wrappers

## Context & Goal
`crnarendran/shuddhi-moolam` is a public repository and keeps GitHub Actions as its primary CI provider (`provider: github`, `fallback: cloudbuild`). Adding Cloud Build as a fallback-only pipeline on project `sai-shuddhi-moolam` (its own billing account, switched off by default) ensures deploys and docs sync keep running seamlessly if GitHub Actions is ever throttled or unavailable.

## Implementation
1. **Provider-Neutral Pipeline Runner (`scripts/ci/run.mjs`)**:
   - Unifies `deploy <dev|staging|main>` (functions lint, fail-closed `APP_ENV` rewrite in `src/index.ts` & `src/config.ts`, build, test, dashboard Vite `--mode` build, and Firebase deploy across all 19 Cloud Functions + Firestore + branch hosting) and `sync-docs` (temp key-file cleanup via `try...finally` on both success and failure, native `fetch()` docs-portal dispatch).
   - Uses Cloud Build ADC (`sm-ci-builder@sai-shuddhi-moolam.iam.gserviceaccount.com`) with zero key files when `CI_PROVIDER=cloudbuild` / `BUILD_ID` is present.
2. **Cloud Build & Trigger Manifests (`cloudbuild.yaml`, `infra/cloudbuild/triggers.yaml`, `scripts/ci/create-triggers.mjs`)**:
   - Configures `swarm-ci:latest`, `logging: CLOUD_LOGGING_ONLY`, and secret `FIREBASE_SERVICE_ACCOUNT_DOCS_PORTAL_STAGING`.
   - Defines 4 triggers (`disabled: true` by default): `shuddhi-moolam-deploy-dev`, `shuddhi-moolam-deploy-staging`, `shuddhi-moolam-deploy-prod`, `shuddhi-moolam-sync-docs`.
3. **Thin GitHub Workflow Wrappers (`.github/workflows/deploy.yml`, `.github/workflows/sync-docs.yml`)**:
   - Guarded by `if: vars.CI_PROVIDER != 'cloudbuild'` so GitHub Actions continues running unchanged while `CI_PROVIDER` is unset; `.github/workflows/copy-historical.yml` unchanged.
4. **Tests (`functions/src/ci/ciWrappers.test.ts`)**:
   - Verifies workflow guards, trigger parity (`disabled: true`, branches, `sync-docs` paths), `cloudbuild.yaml` settings, `run.mjs --dry-run` plans, `withTempKeyFile` cleanup on failures, fail-closed `rewriteAppEnv`, native `fetch()` portal dispatch, and `create-triggers.mjs` dry-run + stubbed `--apply`.

## Acceptance Criteria
- [x] Provider-neutral `scripts/ci/run.mjs` covers both `deploy` and `sync-docs` across GitHub Actions and Cloud Build.
- [x] Both `.github/workflows/deploy.yml` and `.github/workflows/sync-docs.yml` use `if: vars.CI_PROVIDER != 'cloudbuild'`; `copy-historical.yml` untouched.
- [x] All 4 Cloud Build triggers are declared `disabled: true`; triggers await user completion of Section E IAM/connection setup before creation.
- [x] Local gates pass (`functions`: `npm run lint`, `npm run build`, `25/25` suites / `149/149` tests; `dashboard`: `6/6` files / `72/72` tests) and Reviewer (`pro`) returned `VERDICT: PASS`.
