import { monthlyAverages, pctChange, PriceRecord } from './aggregate';

// The commodities monitored for price-movement alerts (SM-19).
export const ALERT_COMMODITIES: { key: string; label: string }[] = [
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
