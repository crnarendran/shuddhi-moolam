---
name: e2e-testing-gotchas
description: Recurring E2E test flakiness patterns (locators, race conditions, backend-emulator timing) that show up across projects regardless of stack. Read before writing or modifying browser-driven tests.
---

# E2E Testing Gotchas

These aren't project-specific bugs — they're patterns that recur across
different codebases whenever E2E tests drive a real browser against a
backend with async state (a database listener, a background function, an
emulator). Read this before writing or debugging a flaky test; it's
usually faster than re-discovering the same fix again.

## Locator selection

- **Accessible-name matching breaks on emoji-containing labels.** A button
  labeled `✏️ Edit` may not match `getByRole('button', {name: /Edit/})`
  reliably across browsers/frameworks. Prefer a text-content locator over
  accessible-name matching when the label contains an emoji or other
  non-standard glyph.
- **Disambiguate before asserting, don't rely on tests running to be the
  only match.** If a locator could plausibly match more than one element
  (a repeated component, a toolbar duplicate of a main-view control),
  disambiguate explicitly (`.first()`, a more specific selector, a
  `data-testid` scoped to the right container) rather than hoping strict
  mode never trips.
- **`toBeVisible()` fails behind overlays even when the element is
  functionally there.** If a backdrop, modal, or z-indexed sibling can sit
  on top of the element under test, assert `toBeAttached()` (DOM presence)
  or read text via a raw DOM query instead of a visibility-dependent
  assertion — otherwise the test fails on layout, not on the thing it's
  actually checking.

## Mock and seed data integrity

- **Include every foreign key the app's own queries filter on.** If the
  app queries `where("parentId", "==", x)`, a seeded document missing
  `parentId` doesn't error — it just returns empty, and the test proceeds
  silently against null data. A test that "passes" against empty state is
  worse than one that fails loudly; double check seeded fixtures match
  every filter the code under test actually applies.
- **Order of seed vs. navigate matters when the page itself writes
  defaults on load.** If the page being tested writes an initial/default
  value to the same record you're about to seed, seeding *before*
  navigation gets silently overwritten. Navigate first, let the page's own
  initial writes settle, then seed the state you actually want to assert
  against.
- **A background trigger can race a manual state override.** If a write
  triggers a backend function (a database trigger, a queue consumer) and
  the test then immediately tries to override child state, the trigger
  may fire *after* the test's override and clobber it. Give triggered
  side effects a moment to settle before layering a manual override on
  top.

## Timing and assertions

- **A write-then-render cycle needs a moment even in "fast" backends.** A
  database write that drives a live listener (`onSnapshot`-style) still
  has to propagate through listener → state update → re-render. Don't
  assert immediately after the write; give the UI a beat to catch up.
- **Emulated/local backends can process faster than the test can observe
  an intermediate state.** If a backend transitions `queued → running →
  done` and the emulator does this near-instantly, asserting on `queued`
  specifically will flake — by the time the assertion runs, it may already
  be `done`. Accept the full set of plausible downstream states rather
  than pinning to one you assume will still be current.
- **Never assert on something that was already true before the action you
  just triggered.** After clicking a button that kicks off an async
  operation, asserting on an element that was visible *before* the click
  proves nothing happened. Assert on something that only becomes true
  *because* the operation completed — the triggering element disappearing,
  a new element appearing, a value changing.
- **A mid-render click can hit a detached element.** If a component might
  be mid-re-render when a test tries to click it, a forced click (bypass
  Playwright's actionability wait) can be the pragmatic fix — but only
  after confirming the flake is genuinely a render race, not a real bug.

## Environment and execution

- **Match the emulator/test-runner project id exactly.** A mismatch
  between the project ID the emulator was started with and the one the
  app under test expects routes writes to a namespace nothing is watching
  — the test fails with no obvious cause because the data silently went
  nowhere useful.
- **Gate heavy/write-driven tests behind an explicit environment check**
  rather than letting them run unconditionally in every environment,
  especially any environment that isn't a disposable sandbox.
- **Widen timeouts for tests that share a machine with many parallel
  workers.** CPU contention under a full parallel run can make a test that
  passes in isolation time out under load — this is a resourcing problem,
  not a logic bug, and the fix is a longer timeout for that specific test,
  not chasing a race condition that isn't there.
