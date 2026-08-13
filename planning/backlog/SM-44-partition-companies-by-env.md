---
title: Partition companies and materials by environment
status: todo
points: 3
---

## Context
Currently, all environments (`dev`, `staging`, and `main`/`prod`) point to the exact same Firebase project (`sai-shuddhi-moolam`). For the pipeline data, we isolate environments using different collections (e.g., `historical_prices_dev`, `pipeline_runs_staging`). However, the dashboard's user-generated data (specifically the `companies` and `materials` collections) is not partitioned. This means test companies created in `dev` show up for users when they log into `staging` or `prod`.

## Requirements
1. Partition the `companies` and `materials` collections by environment so that `dev`, `staging`, and `prod` each have their own isolated silos (e.g. `companies_dev`, `companies_staging`, `companies_prod`).
2. Update the frontend (`dashboard/src/hooks/useCompanies.ts`, `useSharing.ts`, etc.):
   - The Vite dashboard is built via `.github/workflows/deploy.yml` with `npm run build -- --mode ${{ github.ref_name }}`.
   - Use `import.meta.env.MODE` (which will be `dev`, `staging`, or `main`/`production`) to dynamically construct the collection names, similar to how the backend uses `APP_ENV`.
3. Update the backend (`functions/src/sharing/`, etc.):
   - Any Cloud Functions that interact with `companies` or `materials` (like `createInvitation`, `acceptInvitation`) must also use `APP_ENV` to target the correct environment-specific collection.
4. **Migration (Optional but recommended):**
   - Write a short migration script to copy the existing production `companies` and `materials` into `companies_main` (or whatever naming convention is chosen) so users don't lose their existing setups when this goes live.

## Acceptance Criteria
- [ ] Creating a company in `https://sai-shuddhi-moolam-dev.web.app` does NOT make it visible in `https://sai-shuddhi-moolam.web.app` (prod).
- [ ] Cloud Functions handling sharing/invitations work correctly within the scoped environment.
