// Pure computation engine for the reporting views (SM-18/19/20/26).
// No I/O — operates on plain price records so it is fully unit-tested
// and reused by monthly/quarterly/seasonal/cost-impact features.

export interface PriceRecord {
  date: string; // dd/MM/yyyy
  [field: string]: unknown;
}

/**
 * Normalizes a raw price cell to a number. Handles thousands commas and
 * ranges like "47,500 - 46,500" (returns the midpoint). Blank or
 * unparseable input returns null (a gap), never 0.
 * @param {unknown} raw - The raw price value from a record.
 * @returns {number | null} The numeric value, or null if unparseable.
 */
export function normalizePrice(raw: unknown): number | null {
  if (typeof raw !== 'string') {
    return typeof raw === 'number' && isFinite(raw) ? raw : null;
  }
  const parts = raw
    .split(/\s*(?:-|–|—|to)\s*/i)
    .map((p) => parseFloat(p.replace(/,/g, '').trim()))
    .filter((n) => !isNaN(n));
  if (parts.length === 0) return null;
  const sum = parts.reduce((a, b) => a + b, 0);
  return sum / parts.length;
}

/**
 * Parses a dd/MM/yyyy string into its year and month numbers.
 * @param {string} dateStr - The date string.
 * @returns {{year: number, month: number} | null} Parsed parts or null.
 */
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

/**
 * Averages a field across records grouped by a period key. Records
 * whose value or date is unparseable are skipped (not counted as 0).
 * @param {PriceRecord[]} records - The price records.
 * @param {string} field - The field to average.
 * @param {(y: number, m: number) => string} keyFn - Period key builder.
 * @returns {Map<string, number>} Period key to average value.
 */
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
  for (const [key, { total, count }] of sums) {
    out.set(key, total / count);
  }
  return out;
}

/**
 * Monthly averages of a field, keyed "YYYY-MM".
 * @param {PriceRecord[]} records - The price records.
 * @param {string} field - The field to average.
 * @returns {Map<string, number>} Month key to average.
 */
export function monthlyAverages(
  records: PriceRecord[],
  field: string
): Map<string, number> {
  return averageBy(records, field, (y, m) =>
    `${y}-${String(m).padStart(2, '0')}`
  );
}

/**
 * Quarterly averages of a field, keyed "YYYY-Q#".
 * @param {PriceRecord[]} records - The price records.
 * @param {string} field - The field to average.
 * @returns {Map<string, number>} Quarter key to average.
 */
export function quarterlyAverages(
  records: PriceRecord[],
  field: string
): Map<string, number> {
  return averageBy(records, field, (y, m) =>
    `${y}-Q${Math.ceil(m / 3)}`
  );
}

/**
 * Percent change from a previous value to a current value. Returns null
 * when the previous value is 0 or either input is null (undefined %).
 * @param {number | null} prev - The earlier value.
 * @param {number | null} curr - The later value.
 * @returns {number | null} Percent change, or null if undefined.
 */
export function pctChange(
  prev: number | null,
  curr: number | null
): number | null {
  if (prev === null || curr === null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}
