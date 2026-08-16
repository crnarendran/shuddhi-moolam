---
type: ticket
id: SM-57
tags: [planning, functions, dashboard, ops, roles]
status: planned
points: 5
depends_on: [SM-42, SM-56]
---
# SM-57 — Manual price entry ("break glass") + data-editor role

## Problem / goal
When automated extraction fails or is wrong (e.g. a bad scan the SM-56 outlier
net flags), there is no way to put correct prices into the master Sheet +
Firestore by hand. Add a manual entry/correction tool, and give mvsaikishore
access to it **without** making them a full admin.

## Decisions (user-approved)
1. **Sticky = keep manual, but flag.** A later automated re-extraction of a
   date that has a manual override does NOT overwrite it; it still runs, detects
   the override, and **flags the disagreement** (alert + Monitor badge) so a
   human notices auto and manual differ. The tool can **clear** the override to
   re-enable auto.
2. **Scope = correct existing + add new dates.** Edit a date the pipeline
   already produced AND create a brand-new date from scratch.
3. **Access = new data-editor role, this tool only.**
   `DATA_EDITOR_EMAILS = [crnarendran, mvsaikishore]` gates ONLY this tool. Full
   admin (Monitor, plans, seed, probe) stays crnarendran-only.

## Design
### Roles
- `usePlan.ts` (client) + a shared constant (functions): add
  `DATA_EDITOR_EMAILS` and `useIsDataEditor()`. Distinct from `ADMIN_EMAILS`.

### Backend
- `functions/src/admin/manualUpsert.ts`: data-editor-gated `onCall`
  `{ date, values, clearOverride? }`.
  - Validates `date` (dd/MM/yyyy) and that keys ∈ the component registry.
  - `ensureYearTab(date)`, then `upsertRow` + `historical_prices/<YYYY-MM-DD>`
    set, stamping `source: 'manual'`, `manualBy`, `manualAt`. Values are the
    FINAL kg figures as they should appear (no tonne→kg conversion on this path).
  - `clearOverride: true` removes the manual marker (auto may overwrite next
    run) — leaves the last values in place.
- **Sticky-flag in `process.ts`:** before writing, read
  `historical_prices/<docId>`; if `source === 'manual'`, do NOT overwrite —
  instead diff auto-extracted vs manual values and, on any material difference,
  `sendAlert` + record `manualOverrideKept: true` + `autoVsManualDiffs` on the
  run doc. Manual value stays.

### Frontend
- `useIsDataEditor()` hook.
- New **Settings ▸ "Manual entry"** sub-tab, shown when `useIsDataEditor()`:
  date field + a grid of the core (Sheet) commodities prefilled from
  `historical_prices` for that date (blank for a new date), editable, Save /
  Clear-override. Confirms before save.
- `SettingsSection` sub-tab gating updated to include the data-editor tab.
- Monitor: show the `manualOverrideKept` flag (reuse the SM-56 badge pattern).

## Edge cases
- New date with no year tab → `ensureYearTab` creates it.
- Partial entry (only some commodities) → only provided keys are written; others
  keep prior values (upsert-merge), not blanked.
- Env-scoped: writes to the active env's Sheet + `historical_prices` collection.

## Tests
- Jest: date validation, key-whitelist, override diff detection (pure helper).
- The manual value survives a subsequent extraction run (sticky) in a unit test
  of the process guard (extracted around the override check).

## Out of scope
- Bulk import/CSV; audit history UI of manual edits (the `manualBy/At` stamps
  are captured for later).
