import { COMPONENTS } from '../gemini/components';

// Registry-driven so the set of checked commodities can never drift from the
// extraction contract.
const KEYS = COMPONENTS.map((c) => c.key);
const LABELS = new Map(COMPONENTS.map((c) => [c.key, c.label]));

export interface Outlier {
  key: string;
  label: string;
  value: number;
  baseline: number;
  deviationPct: number;
}

/**
 * Parses a raw price cell (string with commas, or number) to a number, or
 * null when it can't be parsed.
 * @param {unknown} raw - The raw cell value.
 * @returns {number | null} The numeric value, or null.
 */
function toNum(raw: unknown): number | null {
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const n = parseFloat(raw.replace(/,/g, '').trim());
  return isNaN(n) ? null : n;
}

/**
 * The median of a non-empty numeric array (robust to a stray bad value in
 * history, unlike a mean).
 * @param {number[]} nums - The values.
 * @returns {number} The median.
 */
function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Flags commodities in `record` whose value deviates more than `thresholdPct`
 * from the median of that commodity across recent `history` records — a
 * safety net for extraction misreads (e.g. inoculant 308 read as 200). Uses
 * the median so one bad historical row doesn't mask a real outlier, and skips
 * any commodity with fewer than `minHistory` parseable prior values. Pure and
 * registry-driven (SM-56).
 * @param {Record<string, unknown>} record - The newly extracted record.
 * @param {Record<string, unknown>[]} history - Recent prior records.
 * @param {number} thresholdPct - Deviation % that counts as an outlier.
 * @param {number} minHistory - Minimum prior values required to judge.
 * @returns {Outlier[]} The flagged commodities.
 */
export function detectOutliers(
  record: Record<string, unknown>,
  history: Record<string, unknown>[],
  thresholdPct = 25,
  minHistory = 3
): Outlier[] {
  const out: Outlier[] = [];
  for (const key of KEYS) {
    const value = toNum(record[key]);
    if (value === null) continue;
    const prior = history
      .map((h) => toNum(h[key]))
      .filter((n): n is number => n !== null);
    if (prior.length < minHistory) continue;
    const baseline = median(prior);
    if (baseline === 0) continue;
    const deviationPct = ((value - baseline) / baseline) * 100;
    if (Math.abs(deviationPct) > thresholdPct) {
      out.push({
        key,
        label: LABELS.get(key) ?? key,
        value,
        baseline,
        deviationPct: Math.round(deviationPct * 10) / 10,
      });
    }
  }
  return out;
}
