// Pure reporting computation for the dashboard, ported from the backend
// engine (functions/src/reporting). No I/O — operates on plain price
// records read from Firestore `historical_prices`.

import {
  COMPONENTS,
  VISIBLE_COMPONENTS,
  CORE_COMPONENTS,
  type ComponentTier,
} from './components';
import {
  effectiveKeys,
  type ReportId,
  type Personalization,
} from './userSettings';

export interface PriceRecord {
  date: string; // dd/MM/yyyy
  [field: string]: unknown;
}

export interface Commodity {
  key: string;
  label: string;
  category: string;
  unit: string;
  tier: ComponentTier;
}

// Dashboard-visible commodities (core + extended; archived hidden), in
// registry display order, derived from the shared component registry
// (./components) so the dashboard, sheet, and extraction schema never
// drift. Carries tier so pages can badge the 'extended' (not-yet-in-Sheet)
// commodities.
export const COMMODITIES: Commodity[] = VISIBLE_COMPONENTS.map((c) => ({
  key: c.key,
  label: c.label,
  category: c.category,
  unit: c.unit,
  tier: c.tier,
}));

// ALL commodities incl. archived (e.g. Copper LME, HMS) — used for
// substitution pricing, which may point to commodities the reports hide.
export const ALL_COMMODITIES: Commodity[] = COMPONENTS.map((c) => ({
  key: c.key,
  label: c.label,
  category: c.category,
  unit: c.unit,
  tier: c.tier,
}));

// Core-only subset (mirrors the master Sheet columns).
export const CORE_COMMODITIES: Commodity[] = CORE_COMPONENTS.map((c) => ({
  key: c.key,
  label: c.label,
  category: c.category,
  unit: c.unit,
  tier: c.tier,
}));

/**
 * The commodities visible in a report after applying the user's exclusion
 * cascade (SM-31): global exclusions minus the report's own exclusions.
 * @param {ReportId} reportId - The report being rendered.
 * @param {Personalization | undefined} personalization - User settings.
 * @returns {Commodity[]} The visible commodities, in registry order.
 */
export function effectiveCommodities(
  reportId: ReportId,
  personalization: Personalization | undefined
): Commodity[] {
  const keys = new Set(
    effectiveKeys(
      COMMODITIES.map((c) => c.key),
      reportId,
      personalization
    )
  );
  return COMMODITIES.filter((c) => keys.has(c.key));
}

/**
 * Commodities to show in a report for the current view (SM-41): in a shared
 * (read-only) context, restrict to the shared company's linked commodities
 * (ignoring the viewer's own personalization); otherwise the normal
 * personalized set. Uses ALL_COMMODITIES for scope so a company that
 * references an archived commodity still shows it.
 * @param {ReportId} reportId - The report being rendered.
 * @param {Personalization | undefined} personalization - User settings.
 * @param {string[] | null} scopeKeys - Shared-company scope, or null.
 * @returns {Commodity[]} The commodities to show, in registry order.
 */
export function commoditiesForView(
  reportId: ReportId,
  personalization: Personalization | undefined,
  scopeKeys: string[] | null
): Commodity[] {
  if (scopeKeys) {
    const set = new Set(scopeKeys);
    return ALL_COMMODITIES.filter((c) => set.has(c.key));
  }
  return effectiveCommodities(reportId, personalization);
}

/** Normalizes a raw price cell to a number (range midpoint), or null. */
export function normalizePrice(raw: unknown): number | null {
  if (typeof raw !== 'string') {
    return typeof raw === 'number' && isFinite(raw) ? raw : null;
  }
  const parts = raw
    .split(/\s*(?:-|–|—|to)\s*/i)
    .map((p) => parseFloat(p.replace(/,/g, '').trim()))
    .filter((n) => !isNaN(n));
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}


/** Parses dd/MM/yyyy into {year, month}, or null. */
export function parseIssueDate(
  dateStr: string
): { year: number; month: number } | null {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) return null;
  return { year, month };
}

function averageBy(
  records: PriceRecord[],
  field: string,
  keyFn: (year: number, month: number) => string
): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const rec of records) {
    const parsed = parseIssueDate(rec.date);
    const value = normalizePrice(rec[field]);
    if (!parsed || value === null) continue;
    const key = keyFn(parsed.year, parsed.month);
    const cur = sums.get(key) || { total: 0, count: 0 };
    cur.total += value;
    cur.count += 1;
    sums.set(key, cur);
  }
  const out = new Map<string, number>();
  for (const [key, { total, count }] of sums) out.set(key, total / count);
  return out;
}

/** Monthly averages keyed "YYYY-MM". */
export function monthlyAverages(
  records: PriceRecord[],
  field: string
): Map<string, number> {
  return averageBy(records, field, (y, m) =>
    `${y}-${String(m).padStart(2, '0')}`
  );
}

/** Quarterly averages keyed "YYYY-Q#". */
export function quarterlyAverages(
  records: PriceRecord[],
  field: string
): Map<string, number> {
  return averageBy(records, field, (y, m) => `${y}-Q${Math.ceil(m / 3)}`);
}

/** Percent change; null when prev is 0 or either input is null. */
export function pctChange(
  prev: number | null,
  curr: number | null
): number | null {
  if (prev === null || curr === null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

/** Average MoM % change per calendar month (1-12) across years. */
export function seasonalIndex(
  records: PriceRecord[],
  field: string
): Map<number, number> {
  const monthly = monthlyAverages(records, field);
  const keys = [...monthly.keys()].sort();
  const byMonth = new Map<number, { total: number; count: number }>();
  for (let i = 1; i < keys.length; i++) {
    const [py, pm] = keys[i - 1].split('-').map(Number);
    const [cy, cm] = keys[i].split('-').map(Number);
    if (cy * 12 + cm - (py * 12 + pm) !== 1) continue;
    const change = pctChange(
      monthly.get(keys[i - 1]) ?? null,
      monthly.get(keys[i]) ?? null
    );
    if (change === null) continue;
    const bucket = byMonth.get(cm) || { total: 0, count: 0 };
    bucket.total += change;
    bucket.count += 1;
    byMonth.set(cm, bucket);
  }
  const out = new Map<number, number>();
  for (const [month, { total, count }] of byMonth) {
    out.set(month, total / count);
  }
  return out;
}

/** Distinct years present in the records. */
export function yearsOfData(records: PriceRecord[]): number {
  const years = new Set<number>();
  for (const rec of records) {
    const parsed = parseIssueDate(rec.date);
    if (parsed) years.add(parsed.year);
  }
  return years.size;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Human label for a "YYYY-MM" key, e.g. "Apr 2026". */
export function monthKeyLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
}

export const MONTHS = MONTH_LABELS;

/**
 * Monthly averages arranged as one 12-slot row per year (Jan..Dec).
 * Missing months are null. Useful for year-over-year overlay charts.
 */
export function monthlyByYear(
  records: PriceRecord[],
  field: string
): Map<number, (number | null)[]> {
  const monthly = monthlyAverages(records, field);
  const byYear = new Map<number, (number | null)[]>();
  for (const [key, val] of monthly) {
    const [y, m] = key.split('-').map(Number);
    if (!byYear.has(y)) byYear.set(y, new Array(12).fill(null));
    byYear.get(y)![m - 1] = val;
  }
  return byYear;
}

/** Confidence label given how many distinct years of history exist. */
export function confidenceLabel(years: number): string {
  if (years >= 3) return 'ok';
  if (years >= 1) return `low · based on ${years} year${years > 1 ? 's' : ''}`;
  return 'insufficient';
}

/** Sorts "YYYY-Q#" quarter keys chronologically. */
function sortQuarterKeys(keys: string[]): string[] {
  return keys.slice().sort();
}

/** Rolling baseline for quarter keys: avg of the trailing `window` quarters. */
export function quarterlyRollingBaseline(
  quarterly: Map<string, number>,
  window = 4
): Map<string, number> {
  const keys = sortQuarterKeys([...quarterly.keys()]);
  const out = new Map<string, number>();
  for (let i = 0; i < keys.length; i++) {
    const prior = keys.slice(Math.max(0, i - window), i);
    if (prior.length === 0) continue;
    const sum = prior.reduce((a, k) => a + (quarterly.get(k) ?? 0), 0);
    out.set(keys[i], sum / prior.length);
  }
  return out;
}

export interface ImpactRow {
  key: string;
  label: string;
  latest: number | null;
  baseline: number | null;
  netChange: number | null;
  weight: number;
  impact: number | null;
}

/**
 * Consumption-weighted cost impact: for the latest quarter, each commodity's
 * change vs its trailing rolling baseline (default 4 quarters) times its
 * per-kg consumption weight, summed into a total product cost impact.
 */
export function costImpact(
  records: PriceRecord[],
  weights: Record<string, number>,
  window = 4,
  commodities: Commodity[] = COMMODITIES
): { rows: ImpactRow[]; sum: number; latestQuarter: string | null } {
  const allQuarters = new Set<string>();
  const perCommodity = new Map<string, Map<string, number>>();
  for (const c of commodities) {
    const q = quarterlyAverages(records, c.key);
    perCommodity.set(c.key, q);
    for (const k of q.keys()) allQuarters.add(k);
  }
  const sorted = sortQuarterKeys([...allQuarters]);
  const latestQuarter = sorted.length ? sorted[sorted.length - 1] : null;

  let sum = 0;
  const rows: ImpactRow[] = commodities.map((c) => {
    const q = perCommodity.get(c.key)!;
    const baseMap = quarterlyRollingBaseline(q, window);
    const latest = latestQuarter ? q.get(latestQuarter) ?? null : null;
    const baseline = latestQuarter ? baseMap.get(latestQuarter) ?? null : null;
    const netChange =
      latest !== null && baseline !== null ? latest - baseline : null;
    const weight = weights[c.key] ?? 0;
    const impact = netChange !== null ? netChange * weight : null;
    if (impact !== null) sum += impact;
    return {
      key: c.key, label: c.label, latest, baseline, netChange, weight, impact,
    };
  });
  return { rows, sum, latestQuarter };
}

/** Human label for a "YYYY-Q#" quarter key, e.g. "Q2 2026". */
export function quarterKeyLabel(key: string): string {
  const [y, q] = key.split('-');
  return `${q} ${y}`;
}

/**
 * Monthly spread (A − B) between two commodities, keyed "YYYY-MM", for the
 * months where both have a value. Used by the spread/correlation monitor.
 */
export function monthlySpread(
  records: PriceRecord[],
  keyA: string,
  keyB: string
): Map<string, number> {
  const a = monthlyAverages(records, keyA);
  const b = monthlyAverages(records, keyB);
  const out = new Map<string, number>();
  for (const [k, av] of a) {
    const bv = b.get(k);
    if (bv !== undefined) out.set(k, av - bv);
  }
  return out;
}

/** Mean and sample standard deviation of a series of numbers. */
export function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (values.length < 2) return { mean, std: 0 };
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return { mean, std: Math.sqrt(variance) };
}
