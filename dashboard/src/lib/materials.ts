// Company + material (bill-of-materials) model and pure cost math (SM-32,
// SM-45, SM-61). A material is a mix of commodities measured in GRAMS PER KG
// of the finished product (a recipe may exceed 1000 g to cover melting loss).
// Blended cost is the cost of making 1 kg of finished product:
// Σ(grams × price) ÷ 1000.
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

/** Grams in the kilogram of finished product a recipe is written for. */
export const GRAMS_PER_KG = 1000;

/**
 * Cost of making 1 kg of finished product from priced inputs (SM-61):
 * Σ(grams × price) ÷ 1000. A recipe above 1000 g — e.g. extra charge to cover
 * melting loss — therefore costs more than its average input price, which is
 * the point. Priced mass is scaled up to the full recipe mass, so a
 * commodity with no price in the period is charged at the average of the
 * priced ones rather than treated as free (a missing weekly price must not
 * cheapen the product). With every row priced this is exactly Σ(g × p) ÷ 1000.
 * @param {number} weighted - Σ(grams × price) over the priced rows.
 * @param {number} pricedGrams - Σ grams over the priced rows.
 * @param {number} recipeGrams - Σ grams over the whole recipe.
 * @returns {number | null} Rs per kg of finished product, or null.
 */
export function costPerKg(
  weighted: number, pricedGrams: number, recipeGrams: number
): number | null {
  if (pricedGrams <= 0) return null;
  return (weighted / pricedGrams) * recipeGrams / GRAMS_PER_KG;
}

/**
 * Blended cost of a composition at the given price record: the cost of 1 kg
 * of finished product (see costPerKg). Returns null when nothing could be
 * priced.
 * @param {Composition[]} comp - The material composition (grams per kg).
 * @param {PriceRecord | null} record - A price record (e.g. the latest).
 * @returns {number | null} Rs per kg of finished product, or null.
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
  return costPerKg(weighted, grams, totalGrams(comp));
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
 * Cost-Impact consumption weights derived from a material's BOM (SM-60): kg of
 * each commodity per kg of finished product = grams ÷ 1000. This is exactly
 * the weight the Cost-Impact report multiplies price moves by, so a material's
 * recipe can drive the report instead of hand-entered weights. Later commodity
 * entries win if a key repeats.
 * @param {Composition[]} comp - The material composition (grams per kg).
 * @returns {Record<string, number>} commodityKey → kg per kg of product.
 */
export function costImpactWeights(
  comp: Composition[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { commodityKey, ratio } of comp) {
    out[commodityKey] = (Number.isFinite(ratio) ? ratio : 0) / 1000;
  }
  return out;
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
