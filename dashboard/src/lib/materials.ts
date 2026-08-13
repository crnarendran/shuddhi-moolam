// Company + material (bill-of-materials) model and pure cost math (SM-32,
// SM-45). A material is a mix of commodities measured in GRAMS PER KG of the
// finished product (so a full recipe sums to 1000 g). Blended cost is the
// mass-weighted average commodity price, i.e. Rs per kg of finished material.
// The math is pure and registry-free so it is unit-tested in isolation.

import { normalizePrice, type PriceRecord } from './reporting';

export interface Composition {
  commodityKey: string;
  ratio: number;
}

export interface Material {
  id?: string;
  name: string;
  unit: string;
  composition: Composition[];
  updatedAt?: number;
}

export interface Company {
  id?: string;
  ownerUid: string;
  name: string;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
  /** uids granted read-only access via an accepted invitation (SM-41). */
  viewerUids?: string[];
  /** parallel emails of accepted viewers, for owner display (SM-41). */
  viewerEmails?: string[];
  /** owner's email, denormalized on first share so viewers can see it. */
  ownerEmail?: string;
}

export interface Contribution {
  key: string;
  cost: number;
  pct: number;
}

/**
 * Blended cost of a composition at the given price record, as Rs per kg of
 * finished material: the mass-weighted average price Σ(grams × price) ÷
 * Σ(grams), taken over the priced rows. Commodities with no price or a bad
 * ratio are skipped (they lower neither the numerator nor the denominator);
 * returns null when nothing could be priced.
 * @param {Composition[]} comp - The material composition (grams per kg).
 * @param {PriceRecord | null} record - A price record (e.g. the latest).
 * @returns {number | null} Rs per kg of finished material, or null.
 */
export function blendedCost(
  comp: Composition[],
  record: PriceRecord | null
): number | null {
  if (!record) return null;
  let weighted = 0;
  let grams = 0;
  for (const { commodityKey, ratio } of comp) {
    const price = normalizePrice(record[commodityKey]);
    if (price === null || !Number.isFinite(ratio)) continue;
    weighted += ratio * price;
    grams += ratio;
  }
  return grams > 0 ? weighted / grams : null;
}

/**
 * Per-commodity cost contribution and its % of the blended total. Preserves
 * composition order; unpriced rows contribute 0.
 * @param {Composition[]} comp - The material composition.
 * @param {PriceRecord | null} record - A price record.
 * @returns {Contribution[]} Per-commodity cost + percentage.
 */
export function contributions(
  comp: Composition[],
  record: PriceRecord | null
): Contribution[] {
  const rows: Contribution[] = [];
  let total = 0;
  for (const { commodityKey, ratio } of comp) {
    const price = record ? normalizePrice(record[commodityKey]) : null;
    const cost =
      price !== null && Number.isFinite(ratio) ? ratio * price : 0;
    rows.push({ key: commodityKey, cost, pct: 0 });
    total += cost;
  }
  if (total > 0) for (const r of rows) r.pct = (r.cost / total) * 100;
  return rows;
}

export interface MassShare {
  key: string;
  grams: number;
  pct: number;
}

/**
 * Per-commodity mass share of the finished material: grams of the commodity
 * per kg of product, and that as a percentage of a kilogram (grams ÷ 1000).
 * Independent of price and of the other rows, so a recipe that does not fill a
 * full kg shows shares that sum to under 100% — the difference is unaccounted
 * mass (e.g. yield loss or an incomplete recipe). Preserves composition order.
 * @param {Composition[]} comp - The material composition (grams per kg).
 * @returns {MassShare[]} Per-commodity grams + % of a kilogram.
 */
export function massShares(comp: Composition[]): MassShare[] {
  return comp.map(({ commodityKey, ratio }) => {
    const grams = Number.isFinite(ratio) ? ratio : 0;
    return { key: commodityKey, grams, pct: (grams / 1000) * 100 };
  });
}

/**
 * Total grams specified per kg of finished material (Σ ratios). A total below
 * 1000 g means the recipe does not fill a full kilogram.
 * @param {Composition[]} comp - The material composition (grams per kg).
 * @returns {number} Sum of ratios, treating a non-finite ratio as 0.
 */
export function totalGrams(comp: Composition[]): number {
  return comp.reduce(
    (s, { ratio }) => s + (Number.isFinite(ratio) ? ratio : 0), 0
  );
}
