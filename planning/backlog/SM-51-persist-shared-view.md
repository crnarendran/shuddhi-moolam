---
type: ticket
id: SM-51
tags: [planning, dashboard, ux, sharing]
status: in-review
points: 1
depends_on: [SM-41]
---
# SM-51 — Persist the shared (read-only) view across refresh

## Problem
When viewing a company shared read-only and refreshing the page, the app
snapped back to "My workspace". The active shared view lived only in
`ViewContext`'s in-memory `useState`, so a reload reset it to null. (Free users
were re-landed by an effect; premium users were not.)

## Fix
Persist the selected `SharedView` in `localStorage` (`sm.sharedView`) and
restore it on load. `setShared` writes/removes the key; the provider seeds its
initial state from it. Clear it on logout so a different user on the same
browser doesn't inherit the previous view.

## Scope
- `context/ViewContext.tsx`: seed `shared` from `localStorage`; wrap `setShared`
  (via `useCallback`) to persist/remove.
- `App.tsx`: logout button clears the shared view (`setShared(null)`) before
  signing out.

## Notes
- If the persisted company is later un-shared, the read-only view shows empty
  and the "Back to my workspace" control clears it — acceptable escape hatch.

## Tests
Dashboard tsc + oxlint clean. Manual: open a shared company, refresh → stays on
it; log out → next session starts on My workspace.
