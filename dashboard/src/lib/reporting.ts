// Pure reporting computation for the dashboard, ported from the backend
// engine (functions/src/reporting). No I/O — operates on plain price
// records read from Firestore `historical_prices`.

export interface PriceRecord {
  date: string; // dd/MM/yyyy
  [field: string]: unknown;
}

export interface Commodity {
  key: string;
  label: string;
}

// The commodities tracked in the MMR sheet, in display order.
export const COMMODITIES: Commodity[] = [
  { key: 'crca_bundle_mumbai', label: 'CRCA Bundle Mumbai' },
  { key: 'crca_bundle_chennai', label: 'CRCA Bundle Chennai' },
  { key: 'melting_foundry_scrap_mumbai', label: 'Melting Foundry scrap' },
  { key: 'fe_mn_hc_mumbai', label: 'Fe Mn HC' },
  { key: 'fe_si_70_75_mumbai', label: 'Fe Si 70-75%' },
  { key: 'low_sulp_cal_petro_coke', label: 'Low Sulp Cal Petro Coke' },
  { key: 'fe_si_mg_mumbai', label: 'FeSiMg' },
  { key: 'cu_lme', label: 'Cu LME' },
  { key: 'cu_domestic', label: 'Cu (domestic)' },
  { key: 'fe_cr_mumbai', label: 'Fe Cr' },
  { key: 'pig_iron_foundry_gr_pune', label: 'Pig Iron Foundry Pune' },
];

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
