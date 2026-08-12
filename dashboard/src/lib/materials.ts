// Company + material (bill-of-materials) model and pure cost math (SM-32).
// A material is a mix of commodities in given ratios (amount per unit of
// product). Blended cost = Σ(ratio × latest commodity price). The math is
// pure and registry-free so it is unit-tested in isolation.

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
}

export interface Contribution {
  key: string;
  cost: number;
  pct: number;
}

/**
 * Blended cost of a composition at the given price record:
 * Σ(ratio × price). Commodities with no price or a bad ratio are skipped;
 * returns null when nothing could be priced.
 * @param {Composition[]} comp - The material composition.
 * @param {PriceRecord | null} record - A price record (e.g. the latest).
 * @returns {number | null} The blended cost, or null.
 */
export function blendedCost(
  comp: Composition[],
  record: PriceRecord | null
): number | null {
  if (!record) return null;
  let sum = 0;
  let any = false;
  for (const { commodityKey, ratio } of comp) {
    const price = normalizePrice(record[commodityKey]);
    if (price === null || !Number.isFinite(ratio)) continue;
    sum += ratio * price;
    any = true;
  }
  return any ? sum : null;
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
