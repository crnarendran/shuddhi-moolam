---
id: SM-63
title: Google Analytics 4 (GA4) initialization + SPA user journey & feature intelligence tracking
type: feature
status: done
points: 3
depends_on: [SM-12, SM-36, SM-38, SM-60]
tags: [backlog, dashboard, analytics, ga4, telemetry, ux]
---
# SM-63 — Google Analytics 4 initialization + SPA user journey & feature intelligence tracking

## Goal
1. Initialize **Google Analytics 4 (GA4)** via the Firebase Web SDK so the existing
   per-environment Measurement IDs (`G-X9226NL08R` on `main`, `G-P52Z2RN2F0` on
   `staging`, `G-FPBT2XCNBF` on `dev`) actually load `gtag.js` and report data.
2. Track the **complete user journey** across hash-based SPA routes (`#reports/...`,
   `#settings/...`, `#monitor`) and capture **feature/dropdown intelligence** so
   we know which reports, company/product filters, commodity selections, and
   actions are used most.

## Root Cause (Why GA4 Currently Receives Zero Data)
1. `dashboard/src/firebase.ts` passes `measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID`
   into `initializeApp(firebaseConfig)`, **but never calls `getAnalytics(app)`**
   from `"firebase/analytics"`, and `dashboard/index.html` has no `gtag.js` tag.
   In Firebase v9+ modular SDK, `initializeApp()` alone never loads GA4 or sends
   any beacons until `getAnalytics(app)` is initialized.
2. The dashboard is a Single-Page Application (SPA) that routes via URL hashes
   (`#reports/guidance`, `#reports/price-review`, `#reports/seasonal`,
   `#reports/cost-impact`, `#reports/spreads`, `#monitor`, `#settings/companies`,
   `#settings/commodities`, `#settings/manual`, `#settings/admin`). Standard GA4
   pageviews ignore URL `#fragments` and record every view as `/` unless explicit
   virtual `page_view` events are fired on `hashchange`.

## Architecture & Design

### 1. Test-Safe Analytics Module (`dashboard/src/lib/analytics.ts`)
Create a centralized, test-safe analytics wrapper around `"firebase/analytics"`
(`getAnalytics`, `isSupported`, `logEvent`, `setUserId`, `setUserProperties`):
- Lazily initializes `Analytics` only when `typeof window !== 'undefined'`,
  `import.meta.env.VITE_FIREBASE_MEASUREMENT_ID` is non-empty, and
  `await isSupported()` resolves to `true` (so Vitest / SSR / headless environments
  never throw or make network calls).
- Exposes pure/testable helpers:
  - `parseVirtualRoute(hash: string): { pagePath: string; pageTitle: string; section: string; subTab: string }`
    - Maps `#reports/guidance` (or empty `#`) → `{ pagePath: '/reports/guidance', pageTitle: 'Purchasing guidance', section: 'reports', subTab: 'guidance' }`
    - Maps `#reports/price-review` → `{ pagePath: '/reports/price-review', pageTitle: 'Price Review', section: 'reports', subTab: 'price-review' }`
    - Maps `#reports/seasonal` → `{ pagePath: '/reports/seasonal', pageTitle: 'Seasonal analysis', section: 'reports', subTab: 'seasonal' }`
    - Maps `#reports/cost-impact` → `{ pagePath: '/reports/cost-impact', pageTitle: 'Cost impact analysis', section: 'reports', subTab: 'cost-impact' }`
    - Maps `#reports/spreads` → `{ pagePath: '/reports/spreads', pageTitle: 'Spread monitor', section: 'reports', subTab: 'spreads' }`
    - Maps `#monitor` → `{ pagePath: '/monitor', pageTitle: 'Pipeline monitor', section: 'monitor', subTab: 'monitor' }`
    - Maps `#settings` / `#settings/companies` → `{ pagePath: '/settings/companies', pageTitle: 'Settings — Companies & Materials', section: 'settings', subTab: 'companies' }`
    - Maps `#settings/commodities` → `{ pagePath: '/settings/commodities', pageTitle: 'Settings — Commodities', section: 'settings', subTab: 'commodities' }`
    - Maps `#settings/manual` → `{ pagePath: '/settings/manual', pageTitle: 'Settings — Manual entry', section: 'settings', subTab: 'manual' }`
    - Maps `#settings/admin` → `{ pagePath: '/settings/admin', pageTitle: 'Settings — Admin', section: 'settings', subTab: 'admin' }`
  - `trackPageView(hash: string): void` — logs GA4 `page_view` with
    `page_path`, `page_title`, `page_location`, `section`, and `sub_tab`
    (deduplicating consecutive identical `pagePath` calls so React strict-mode
    double effects don't double-count).
  - `identifyAnalyticsUser(opts: { uid: string | null; plan: 'premium' | 'free'; isAdmin: boolean; isDataEditor: boolean; workspaceMode: 'own' | 'shared' }): void`
    — sets `setUserId(analytics, uid)` and `setUserProperties(analytics, { user_plan, user_role, workspace_mode })`.
  - `trackEvent(name: string, params?: Record<string, string | number | boolean>): void`
    — safe wrapper around `logEvent`.

### 2. Virtual Pageviews & User Context (`dashboard/src/App.tsx`, `dashboard/index.html`)
- Update `<title>` in `dashboard/index.html` from generic `dashboard` to
  `Shuddhi-Moolam — Metals Price Dashboard`, and update `document.title` on
  route changes (`Shuddhi-Moolam — ${pageTitle}`).
- In `App.tsx`:
  - Call `trackPageView(window.location.hash)` on initial authenticated render
    and on `hashchange`.
  - Call `identifyAnalyticsUser(...)` when auth/plan/role/shared-context state
    settles.
  - Track `theme_toggled` (`{ theme: 'dark' | 'light' }`) when the user clicks
    the theme toggle button.

### 3. Dropdown & Feature Intelligence Events
Instrument key user interactions across the dashboard using `trackEvent`:
1. **Header Company & Product Selector (`dashboard/src/components/ContextSwitcher.tsx`):**
   - `select_company_context`: `{ context_type: 'workspace' | 'owned' | 'shared', company_id: id || 'workspace' }`
   - `select_product_filter`: `{ mode: 'single' | 'multi', selected_count: number, has_selection: boolean }`
2. **Report Controls & Dropdowns:**
   - **Seasonal (`dashboard/src/pages/SeasonalPage.tsx`):**
     `select_seasonal_commodities` with `{ commodity_keys: next.slice(0, 5).join(','), selected_count: next.length }`
   - **Spreads (`dashboard/src/pages/SpreadsPage.tsx`):**
     `select_spread_reference` with `{ reference_key: k }` and
     `select_spread_compare` with `{ compare_keys: next.slice(0, 5).join(','), selected_count: next.length }`
   - **Price Review (`dashboard/src/pages/PriceReviewPage.tsx`):**
     `change_price_review_threshold` with `{ threshold_pct: n }`
   - **Cost Impact (`dashboard/src/pages/CostImpactPage.tsx`):**
     `update_cost_impact_weight` with `{ commodity_key }` (or reset/preset action)
3. **High-Value Feature Engagement:**
   - **AI Chat (`dashboard/src/components/AIChatPanel.tsx` & `App.tsx`):**
     `ai_chat_open` (`{ report }`) and `ai_chat_question_sent` (`{ prompt_length }`)
   - **Print / Export PDF (`dashboard/src/components/PrintButton.tsx`):**
     `export_report_pdf` (`{ page_path: window.location.hash || '#reports/guidance' }`)
   - **In-Report Guide Toggle (`dashboard/src/components/ReportIntro.tsx`):**
     `toggle_report_guide` (`{ title, expanded: boolean }`)
   - **Companies, Materials & Sharing (`dashboard/src/pages/CompaniesPage.tsx`, `SettingsPage.tsx`):**
     `company_saved`, `material_saved`, `share_invite_sent`, `commodity_preference_toggled`

## Acceptance Criteria / TDD
- Write unit tests in `dashboard/src/lib/analytics.test.ts` (Vitest) covering:
  - `parseVirtualRoute` for all `#reports/*`, `#settings/*`, `#monitor`, and empty/default hashes.
  - `trackPageView` deduplication of consecutive identical routes and forwarding to `logEvent`.
  - `trackEvent` and `identifyAnalyticsUser` calling `logEvent` / `setUserId` / `setUserProperties` when supported, and no-opping cleanly when `isSupported()` resolves to `false`.
- `npm test`, `npm run lint` (`oxlint`), `npx tsc --noEmit`, and `npm run build` in `dashboard/` all pass with 0 errors.
