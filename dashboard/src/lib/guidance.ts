// Statistical purchasing guidance for a material (SM-33). All pure, reusing
// the reporting engine (monthly averages, seasonal index) + the material
// cost math. No ML — explainable by construction.

import {
  monthlyAverages, seasonalIndex, normalizePrice, MONTHS,
  type Commodity, type PriceRecord,
} from './reporting';
import { contributions, totalGrams, type Composition } from './materials';

export interface SubstitutionGroup {
  name: string;
  members: string[];
}

// Predefined, domain-sensible substitution groups (user-editable later).
export const DEFAULT_SUB_GROUPS: SubstitutionGroup[] = [
  { name: 'Metallic charge', members: [
    'pig_iron_sg_grade_a_pune', 'pig_iron_foundry_gr_pune',
    'pig_iron_foundry_grade_b_punjab', 'sponge_iron_mg_punjab',
    'melting_foundry_scrap_mumbai', 'crca_bundle_mumbai',
    'cast_iron_scrap_bhavnagar', 'heavy_melting_scrap_mumbai_pune',
  ] },
  { name: 'Ferro Silicon (market)', members: [
    'fe_si_70_75_mumbai', 'fe_si_70_75_raipur',
  ] },
  { name: 'Ferro Manganese', members: [
    'fe_mn_hc_mumbai', 'fe_mn_mc_mumbai', 'fe_mn_70_75_raipur',
    'high_fe_mn_78_raipur',
  ] },
  { name: 'Recarburiser / coke', members: [
    'low_sulp_cal_petro_coke', 'calcinated_petroleum_coke_9_4mm',
    'graphite_petroleum_coke_mumbai', 'lam_coke',
  ] },
];

/**
 * Blended material cost per month, keyed "YYYY-MM", as Rs per kg of finished
 * material — the mass-weighted average price Σ(grams × price) ÷ Σ(grams) over
 * the priced rows that month. Same basis as materials.blendedCost (SM-45), so
 * this chart's magnitude matches the Companies editor. Dividing by a constant
 * total mass leaves month-over-month trends and baseline % unchanged.
 * @param {Composition[]} comp - The material composition (grams per kg).
 * @param {PriceRecord[]} records - All price records.
 * @returns {Map<string, number>} Rs/kg keyed "YYYY-MM".
 */
export function blendedCostSeries(
  comp: Composition[], records: PriceRecord[]
): Map<string, number> {
  const perC = new Map<string, Map<string, number>>();
  const months = new Set<string>();
  for (const { commodityKey } of comp) {
    const m = monthlyAverages(records, commodityKey);
    perC.set(commodityKey, m);
    for (const k of m.keys()) months.add(k);
  }
  const out = new Map<string, number>();
  for (const month of [...months].sort()) {
    let sum = 0;
    let grams = 0;
    for (const { commodityKey, ratio } of comp) {
      const price = perC.get(commodityKey)?.get(month);
      if (price === undefined || !Number.isFinite(ratio)) continue;
      sum += ratio * price;
      grams += ratio;
    }
    if (grams > 0) out.set(month, sum / grams);
  }
  return out;
}

/**
 * Material seasonal index: each commodity's seasonal MoM% (by calendar
 * month) weighted by its share of the material's cost at `latest`.
 */
export function materialSeasonalIndex(
  comp: Composition[], records: PriceRecord[], latest: PriceRecord | null
): Map<number, number> {
  const shares = new Map(
    contributions(comp, latest).map((c) => [c.key, c.pct / 100])
  );
  const byMonth = new Map<number, number>();
  for (const { commodityKey } of comp) {
    const w = shares.get(commodityKey) ?? 0;
    if (w === 0) continue;
    for (const [month, pct] of seasonalIndex(records, commodityKey)) {
      byMonth.set(month, (byMonth.get(month) ?? 0) + pct * w);
    }
  }
  return byMonth;
}

/** The n months with the biggest typical price drop (most-negative MoM%). */
export function cheapestMonths(
  idx: Map<number, number>, n = 3
): { month: number; label: string; pct: number }[] {
  return [...idx.entries()]
    .map(([month, pct]) => ({ month, label: MONTHS[month - 1], pct }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, n);
}

export interface SwapSuggestion {
  from: Commodity;
  to: Commodity;
  saving: number;
  groupName: string;
}

/**
 * For each composition member in a substitution group, the cheapest
 * same-unit alternative and its saving per kg of finished material (positive
 * only), ranked. The saving scales the price delta by the commodity's mass
 * share (ratio ÷ total grams) so it is expressed in the same Rs/kg-of-blend
 * units as the blended cost (SM-45).
 * @param {Composition[]} comp - The material composition (grams per kg).
 * @param {SubstitutionGroup[]} groups - Interchangeable commodity groups.
 * @param {Commodity[]} commodities - The commodity registry (for units).
 * @param {PriceRecord | null} latest - The latest price record.
 * @returns {SwapSuggestion[]} Ranked swaps with per-kg savings.
 */
export function substitutionSuggestions(
  comp: Composition[],
  groups: SubstitutionGroup[],
  commodities: Commodity[],
  latest: PriceRecord | null
): SwapSuggestion[] {
  const byKey = new Map(commodities.map((c) => [c.key, c]));
  const grams = totalGrams(comp);
  const out: SwapSuggestion[] = [];
  for (const { commodityKey, ratio } of comp) {
    const cur = byKey.get(commodityKey);
    const group = groups.find((g) => g.members.includes(commodityKey));
    if (!cur || !group || !latest) continue;
    const curPrice = normalizePrice(latest[commodityKey]);
    if (curPrice === null) continue;
    let best: { c: Commodity; price: number } | null = null;
    for (const k of group.members) {
      const c = byKey.get(k);
      if (!c || c.unit !== cur.unit) continue; // same unit only
      const price = normalizePrice(latest[k]);
      if (price === null) continue;
      if (!best || price < best.price) best = { c, price };
    }
    if (!best || best.c.key === commodityKey) continue;
    const saving = grams > 0
      ? ((curPrice - best.price) * ratio) / grams
      : 0;
    if (saving <= 0) continue;
    out.push({ from: cur, to: best.c, saving, groupName: group.name });
  }
  return out.sort((a, b) => b.saving - a.saving);
}

/**
 * Latest blended cost vs a trailing rolling baseline (mean of the prior
 * `window` months, excluding the latest). Nulls when history is short.
 */
export function costVsBaseline(
  series: Map<string, number>, window = 6
): { latest: number | null; baseline: number | null; pct: number | null } {
  const keys = [...series.keys()].sort();
  if (keys.length === 0) return { latest: null, baseline: null, pct: null };
  const latest = series.get(keys[keys.length - 1])!;
  const prior = keys.slice(-1 - window, -1).map((k) => series.get(k)!);
  if (prior.length === 0) return { latest, baseline: null, pct: null };
  const baseline = prior.reduce((a, b) => a + b, 0) / prior.length;
  const pct = baseline > 0 ? ((latest - baseline) / baseline) * 100 : null;
  return { latest, baseline, pct };
}
