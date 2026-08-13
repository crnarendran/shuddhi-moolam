---
type: ticket
id: SM-53
tags: [planning, dashboard, ux, sharing, bugfix]
status: in-review
points: 1
depends_on: [SM-52]
---
# SM-53 — Race-free context switching for report selections

## Problem (follow-up to SM-52)
Even with per-context view state (SM-52), Guidance (and other reports) could
still appear to lose the selection when switching companies quickly: the save
is debounced ~500ms, so a fast switch-away-and-back re-hydrates from Firestore
before the previous selection has round-tripped, and the per-context guard then
suppresses the late snapshot echo — leaving the report on its default. Most
visible on Guidance (the landing report you switch on).

## Fix
Add a per-context in-memory cache (`cacheRef`) in `useViewState`: `setValue`
records the latest value under the active context, and re-hydration prefers the
cached value over the Firestore-stored one. Switching back restores instantly,
independent of the debounced write. Firestore remains the source of truth across
full reloads (cache is per session; empty cache falls back to stored).

## Scope
- `hooks/useViewState.ts`: `cacheRef: Record<ctx, T>`; write it in `setValue`;
  read it first in the re-hydration effect.

## Tests
Dashboard tsc + oxlint clean; 27/27 vitest pass. Manual: select materials in
shared company A, switch to B and back rapidly → A's selection is retained.
