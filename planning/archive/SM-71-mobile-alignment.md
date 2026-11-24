---
id: SM-71
title: Mobile Drawer & MultiSelect Popover Alignment Fix
type: ticket
status: shipped
points: 2
assigned_to: sm-orchestrator
depends_on: [SM-47, SM-60]
created_at: 2026-11-24
tags: [dashboard, mobile, ui, bugfix]
---

# SM-71: Mobile Alignment & MultiSelect Popover Clipping Fix

## Why this matters
On narrow mobile viewports (~360px), opening `MultiSelect` inside the left-anchored mobile navigation drawer (`ContextSwitcher align="left"`) caused the `w-64` (`256px`) dropdown popover (`right-0`) to overflow past the left edge of the screen (`x < 0`), clipping action buttons (`Select all`, `Clear`) and commodity names. Left-aligned report toolbars (`SpreadsPage`, `SeasonalPage`), `FileMonitor`'s search/filter bar, and `GuidancePage` KPI tiles also crowded or risked clipping on 360px phones.

## Root Cause
1. `ContextSwitcher.tsx` accepted `align?: 'left' | 'right'` and rendered `align="left"` in `App.tsx`'s mobile drawer, but never passed `align` or width props to `<MultiSelect />`, leaving `MultiSelect` hardcoded to `absolute right-0 w-64`.
2. `FileMonitor.tsx` placed its `Filters` menu popover at `right-0` even when wrapping flush left onto row 2 on `< 640px` viewports inside `overflow-hidden` cards.
3. Non-wrapping inner flex toolbars and fixed widths (`w-72`, unpadded `grid-cols-2` KPI cards) squeezed or overflowed narrow mobile viewports.

## Implementation
1. **Viewport-Safe `MultiSelect` Layout (`dashboard/src/components/MultiSelect.tsx`, `MultiSelect.test.ts`)**:
   - Exported `multiSelectLayoutClasses({ align, fullWidth, mobileFullWidth })` with Vitest unit tests (`6/6`).
   - Supports `left-0` anchoring (`align="left"`), full drawer width (`fullWidth`), responsive mobile full-width (`mobileFullWidth`, restoring `sm:left-auto sm:right-0 sm:w-64` on desktop), `max-w-[calc(100vw-2rem)]` viewport clamping, `type="button"` on all buttons, and wrapping long option labels (`break-words`).
2. **Mobile Drawer & Toolbar Alignment**:
   - `ContextSwitcher.tsx`: Stacks full-width (`flex-1 min-w-0 w-full` company select, `fullWidth` `MultiSelect` with `align="left"`) in the mobile drawer while keeping desktop header alignment (`align="right"`, `max-w-[11rem]`) intact.
   - `SeasonalPage.tsx` & `SpreadsPage.tsx`: Wrapping mobile toolbars with `mobileFullWidth` on `MultiSelect`, unconstrained mobile `<select>`, and desktop `sm:order-last` print alignment.
   - `FileMonitor.tsx`: Wrapped search/filter row (`w-full sm:w-72`), anchored filter popover `left-0 sm:left-auto sm:right-0`, and wrapped bulk action banner.
   - `GuidancePage.tsx`: Tightened KPI tile mobile padding/type (`p-3 sm:p-4`, `text-xl sm:text-2xl`).

## Verification
- `cd dashboard; npm test` (`vitest run`): `8/8` test files, `92/92` tests passed (including `MultiSelect.test.ts` `6/6`).
- `cd dashboard; npm run lint` (`oxlint`): `0` errors.
- `cd dashboard; npm run build` (`tsc -b && vite build`): exit `0`; verified CSS media-query cascade order.
- Adversarial Reviewer (`pro`) audited full diff and verification output -> `VERDICT: PASS`.
