---
id: SM-64
title: Outcome email — price trend + change vs previous issue columns
type: feature
status: done
points: 2
depends_on: [SM-62, SM-40, SM-50]
tags: [backlog, pipeline, email, notifications, reporting]
---
# SM-64 — Outcome email: price trend + change vs previous issue

## Goal
In the SM-62 success email, the **Core Commodity Prices (₹/kg)** table
(`functions/src/pipeline/outcomeEmail.ts`) shows only the current price. Add two
columns so the reader sees at a glance whether each price went up or down since
the previous newsletter issue, and by how much:

| Commodity | Market | Price (₹/kg) | **Trend** | **Change vs prev** |
|---|---|---|---|---|
| Copper Cathode | Mumbai | 1392.00 | ▲ Up | +12.40 (+0.9%) |
| Tin Ingot | Mumbai | 4994.60 | ▼ Down | −30.00 (−0.6%) |
| Melting Scrap | Mumbai/Pune | 51 | ▬ Flat | 0.00 (0.0%) |
| Lam Coke | — | 12.3 | — | — (no previous) |

## Decisions / assumptions (documented per human-escalation-policy; none are
escalation-class)
1. **"Previous" = the closest earlier issue** in the env's historical
   collection (`HISTORICAL_COLLECTION`, doc id `yyyy-MM-dd`): the latest doc with
   id **strictly less than** the current `docId`. Not "the last doc written" —
   so reprocessing an older PDF still compares against *its* predecessor, never a
   later issue.
2. **Unit:** both values are already ₹/kg in storage (`toKgRecord`), so the
   delta is ₹/kg and needs no conversion. Compare numerically; values are
   strings (ranges/blank possible) — parse with the same numeric parsing the
   dashboard uses; if either side is not a finite number, or previous is 0/blank,
   show `—` for Trend and Change (never `NaN`, never divide by zero).
3. **Flat** = `|delta| < 0.005` (rounds to 0.00): show `▬ Flat`, `0.00 (0.0%)`.
4. **Formatting:** delta to 2 dp with explicit sign (`+`/`−`), percent to 1 dp.
   Colour: ▲ red, ▼ green (these are purchase *costs*: a rise is the unfavourable
   direction), flat/unknown grey. Colour is decoration only — the arrow glyph
   and the signed number carry the meaning (email clients strip colour; dark
   mode, colour-blind readers).
5. **First-ever issue / no earlier doc / lookup error:** show `—` in both new
   columns; the email still sends. A failed history read must never fail the
   pipeline or block the email (log `logger.warn`, continue).
6. **Header context:** add a line under the table title
   `Change vs previous issue <dd/MM/yyyy>` (the previous doc's `date`), or
   `No previous issue found` when none.
7. **Scope:** success email's core table only. Failure email, Sheet, Firestore
   and dashboard are unchanged. Extended/archived components are not in the
   email, so unchanged.

## Design

### 1. Pure helper — `functions/src/pipeline/priceChange.ts` (+ test)
```ts
export type Trend = 'up' | 'down' | 'flat' | 'unknown';
export interface PriceChange {
  trend: Trend;
  delta: number | null;     // current - previous, ₹/kg
  pct: number | null;       // delta / previous * 100
}
/** Compares one commodity's current vs previous string price. */
export function computePriceChange(cur: unknown, prev: unknown): PriceChange;
/** Builds key -> PriceChange for the given component keys. */
export function computeChanges(
  current: Record<string, unknown>,
  previous: Record<string, unknown> | null,
  keys: string[]
): Record<string, PriceChange>;
```
Pure, no Firestore, no I/O (80-char lines, JSDoc, no `any`).

### 2. Fetch previous issue — `process.ts`
After the historical write succeeds (so the current doc exists), query
`HISTORICAL_COLLECTION` `orderBy(FieldPath.documentId(), 'desc')`
`.where(FieldPath.documentId(), '<', docId).limit(1)`. Wrap in try/catch →
`null` on failure. Reuse the existing outlier-check history read if it can be
shared without changing its semantics (it currently takes the 9 latest
excluding current regardless of direction — do **not** repurpose it as-is;
decision 1 needs strictly-earlier). Pass `previousRecord` into
`sendPipelineSuccessEmail` via a new optional option
`previousRecord?: Record<string, unknown> | null`.
Also cover the `manualOverrideKept` path: it sends the email too, so fetch
the previous issue there as well (or extract a small `getPreviousIssue(docId)`
helper used by both).

### 3. Render — `outcomeEmail.ts`
Add the two `<th>` and two `<td>` per row; extend the `PipelineSuccessEmailOptions`
interface; keep existing columns/styles unchanged. Table must stay readable at
mobile width (the reporter reads it in Gmail on a phone): short cell text,
`white-space:nowrap` on the Trend and Change cells.

## Acceptance Criteria / TDD (write failing Jest tests first)
- `priceChange.test.ts`: up, down, flat (|Δ|<0.005), previous blank/`""`,
  previous `"0"`, non-numeric (`"n/a"`, range text), current blank, both blank,
  string numbers with decimals, negative-direction rounding (e.g. −0.004 → flat),
  `previous === null` ⇒ all `unknown`.
- `outcomeEmail.test.ts`: with a `previousRecord`, HTML contains `▲`, `▼`, `▬`,
  signed deltas and percents for known fixtures; shows `—`/`—` for a commodity
  missing in previous; shows `No previous issue found` when
  `previousRecord` is null/undefined; "Change vs previous issue 20/07/2026"
  line uses the previous doc's date; existing SM-62 assertions still pass.
- `process.test.ts`: previous-issue lookup uses strictly-earlier doc id (mock
  returns the right doc; a *later* doc present in the collection is ignored);
  a throwing lookup does not fail processing and the email still sends with
  `—` columns; both normal and `manualOverrideKept` paths pass
  `previousRecord`.
- `npm test`, `npm run lint` (80-char limit, JSDoc) and `npm run build` in
  `functions/` pass with 0 errors.
- Manual check on dev: drop/reprocess two consecutive issues; confirm the email
  arrives with the new columns and the arithmetic matches the master Sheet.
