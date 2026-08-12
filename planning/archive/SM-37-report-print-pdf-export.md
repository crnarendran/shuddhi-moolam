---
id: SM-37
title: Print / PDF export for all reports
type: ticket
points: 3
status: in-review
depends_on: [SM-18, SM-20, SM-21, SM-26, SM-33, SM-35]
tags: [backlog, ux, reports, print, pdf, export]
---
# SM-37 — Print / PDF export for reports

## Implemented (dev)
- `components/PrintButton.tsx`: "Print / PDF" action (printer icon) that
  temporarily drops dark mode (ink-friendly), calls `window.print()`, and
  restores the theme on `afterprint`. Self-hidden in print (`print:hidden`).
- Button added to every in-scope report header: Price Review, Seasonal, Cost
  Impact, Spreads, Guidance.
- `index.css` `@media print`: white background, full-width `main`,
  `break-inside: avoid` on charts/tables.
- `App.tsx`: `print:hidden` on the top nav header, Ask-AI button, and chat
  panel; a **print-only document header** (app name + report name + generated
  timestamp) so the PDF is self-describing; `viewName` extended to all tabs.
- ECharts switched to the **SVG renderer** (`opts={{ renderer: 'svg' }}`) on
  every report chart so charts print crisply (not blank canvas).
- Report control `<select>`s are left visible so the printed page shows the
  active selection.
- tsc + oxlint + vitest (22) + build green.

**Verification note:** the authenticated report views sit behind Google
sign-in, so the print dialog wasn't exercisable in the sandbox; verify the
actual print/save-as-PDF output on the deployed dev site.

## Goal
Let a user print or save any report as a PDF — for sharing with stakeholders
who don't use the dashboard. v1 uses the browser's native print-to-PDF
(dependency-free), styled by a print stylesheet so the output is clean.

## Scope
All report pages: Price Review, Seasonal, Cost Impact, Spreads, Guidance.
(Monitor and Settings are operational/config — excluded.)

## Target UX
- **Button:** a "Print / PDF" action (printer icon, `lucide-react` `Printer`)
  in each report's header control row, right-aligned near existing controls.
  Tooltip: "Print or save this report as a PDF".
- **Action:** calls `window.print()`. No new dependency for v1.
- **Print stylesheet (`@media print`):**
  - Hide: top nav, sub-tabs, AI chat panel, theme toggle, the Print button
    itself, and interactive controls (selectors, threshold input, filter
    dropdowns) — show the *current selection* as static text instead.
  - Show full-width, single-column, black-on-white; force light palette
    regardless of screen theme.
  - Keep: the `ReportIntro` (title + description + how-to-read), the chart,
    the data table, and metric tiles.
  - Page breaks: avoid breaking inside a chart or a table row
    (`break-inside: avoid`).
  - **Print header/footer band** (print-only DOM): report title, the active
    selection (e.g. commodity / company + material / spread pair), the
    date/period shown, and a generated-on timestamp + "Shuddhi-Moolam".
- **Charts (main technical risk):** ECharts renders to `<canvas>` by default,
  which can print blank or low-res. Mitigation options (pick during build):
  (a) switch ECharts to the **SVG renderer** (`{ renderer: 'svg' }`) so charts
  print crisply, either globally or via a print-triggered re-render on
  `beforeprint`; or (b) on `beforeprint`, export the chart to a PNG dataURL
  (`getDataURL`) and swap it in, restoring on `afterprint`. Prefer (a) if it
  has no visual regression on screen.
- **Selection as text:** because controls are hidden in print, each report
  renders a print-only line stating the current selection so the PDF is
  self-describing.

## Acceptance
- Every in-scope report has a working Print button that opens the print dialog.
- Printed output (or "Save as PDF") shows: title + description + how-to-read,
  the chart (not blank), the data, and the active selection — with nav/chat/
  controls hidden and a light palette.
- No horizontal clipping; sensible page breaks.
- No new runtime dependency for v1; oxlint + tsc + build green.

## Out of scope (→ future)
- Server-generated or pixel-perfect branded PDFs (jsPDF/puppeteer).
- Multi-report "export all" bundle; scheduled/emailed PDFs (SM-19/SM-34
  territory).
- CSV/XLSX data export (separate ticket if wanted).
