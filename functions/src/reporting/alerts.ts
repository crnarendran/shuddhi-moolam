import { monthlyAverages, pctChange, PriceRecord } from './aggregate';
import { COMPONENTS } from '../gemini/components';

// The commodities monitored for price-movement alerts (SM-19). Derived
// from the core-tier components in the shared registry so it tracks the
// master Sheet and never drifts (cu_lme dropped, new core items added).
export const ALERT_COMMODITIES: { key: string; label: string }[] =
  COMPONENTS.filter((c) => c.tier === 'core').map((c) => ({
    key: c.key,
    label: c.label,
  }));

export interface Breach {
  key: string;
  label: string;
  pct: number;
}

/**
 * Finds commodities whose latest month-over-month % change is at or beyond
 * the threshold (absolute). Commodities with fewer than two months of data
 * are skipped.
 * @param {PriceRecord[]} records - The historical price records.
 * @param {number} thresholdPct - The absolute % threshold.
 * @returns {Breach[]} The breaching commodities, most-severe first.
 */
export function latestMoMBreaches(
  records: PriceRecord[],
  thresholdPct: number
): Breach[] {
  const out: Breach[] = [];
  for (const c of ALERT_COMMODITIES) {
    const monthly = monthlyAverages(records, c.key);
    const keys = [...monthly.keys()].sort();
    if (keys.length < 2) continue;
    const prev = monthly.get(keys[keys.length - 2]) ?? null;
    const cur = monthly.get(keys[keys.length - 1]) ?? null;
    const pct = pctChange(prev, cur);
    if (pct !== null && Math.abs(pct) >= thresholdPct) {
      out.push({ key: c.key, label: c.label, pct });
    }
  }
  return out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

/**
 * Formats a breach list into a short alert summary line.
 * @param {Breach[]} breaches - The breaching commodities.
 * @returns {string} A comma-separated summary.
 */
export function breachSummary(breaches: Breach[]): string {
  return breaches
    .map((b) => `${b.label}: ${b.pct > 0 ? '+' : ''}${b.pct.toFixed(1)}%`)
    .join(', ');
}
