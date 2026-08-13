---
type: ticket
id: SM-47
tags: [planning, dashboard, ux, mobile]
status: in-review
points: 2
depends_on: [SM-38]
---
# SM-47 — Mobile-friendly top navigation (hamburger)

## Problem
On a narrow screen the top bar overlaps badly: the primary tabs (Reports ·
Monitor · Settings) collide with the right-side `ContextSwitcher`
("My workspace") and the actions, making the header unusable on mobile.

## Decision (user-approved)
Below the `sm` breakpoint, collapse the primary nav into a **hamburger menu**.
The bar keeps only the burger + logo (left) and theme toggle + logout (right).
Tapping the burger opens a stacked drawer with the section tabs and the view
switcher. Desktop (`sm`+) is unchanged.

## Scope
- `App.tsx`: `menuOpen` state + `Menu`/`X` icons; desktop `<nav>` gets
  `hidden sm:flex`; `ContextSwitcher` wrapped `hidden sm:block`; a `sm:hidden`
  hamburger button toggles a drawer `<nav>` (section buttons + ContextSwitcher)
  rendered under the header row. `goToSection` closes the drawer on navigate.

## Tests
Responsive/presentational; verified via tsc + oxlint. Visual check on a mobile
viewport recommended at user acceptance.
