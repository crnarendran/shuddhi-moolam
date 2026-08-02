import { PriceRecord, monthlyAverages, pctChange } from './aggregate';

// Seasonal + rolling-baseline computation for SM-20/SM-26. Pure, I/O-free.
// Designed to degrade gracefully with limited history (see confidenceLabel).

/**
 * The typical seasonal pattern: the average month-over-month % change for
 * each calendar month (1-12), across all years present. Only consecutive
 * calendar months contribute (gaps are skipped, never treated as 0).
 * @param {PriceRecord[]} records - The price records.
 * @param {string} field - The field to analyse.
 * @returns {Map<number, number>} Calendar month (1-12) to average MoM %.
 */
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

/**
 * Rolling baseline: for each period, the average of the trailing `window`
 * periods (excluding the period itself). Periods with no prior history are
 * omitted. Keys are the caller's period keys (e.g. "2026-Q2"), sorted
 * ascending chronologically.
 * @param {Map<string, number>} periodAvgs - Period key to average value.
 * @param {number} window - Number of trailing periods (default 4).
 * @returns {Map<string, number>} Period key to its trailing baseline.
 */
export function rollingBaseline(
  periodAvgs: Map<string, number>,
  window = 4
): Map<string, number> {
  const keys = [...periodAvgs.keys()].sort();
  const out = new Map<string, number>();
  for (let i = 0; i < keys.length; i++) {
    const priorKeys = keys.slice(Math.max(0, i - window), i);
    if (priorKeys.length === 0) continue;
    const sum = priorKeys.reduce((a, k) => a + (periodAvgs.get(k) ?? 0), 0);
    out.set(keys[i], sum / priorKeys.length);
  }
  return out;
}

/**
 * Confidence label for seasonal figures given how many distinct years of
 * history exist. < 3 years is flagged low-confidence per the SM-20 rule.
 * @param {number} yearsOfData - Distinct years present in the data.
 * @returns {string} A short confidence label.
 */
export function confidenceLabel(yearsOfData: number): string {
  if (yearsOfData >= 3) return 'ok';
  if (yearsOfData >= 1) return `low (based on ${yearsOfData} year(s))`;
  return 'insufficient';
}
