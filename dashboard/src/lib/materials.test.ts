import { describe, it, expect } from 'vitest';
import {
  blendedCost, contributions, massShares, totalGrams, costImpactWeights,
} from './materials';
import { type PriceRecord } from './reporting';

const rec: PriceRecord = {
  date: '03/08/2026',
  fe_si_mg_mumbai: '190',
  crca_bundle_mumbai: '47,400', // thousands comma
  pig_iron_foundry_gr_pune: '48,000 - 49,000', // range -> midpoint 48,500
};

describe('blendedCost', () => {
  it('is the cost of 1 kg of finished product: Σ(g × price) ÷ 1000', () => {
    const comp = [
      { commodityKey: 'fe_si_mg_mumbai', ratio: 2 },
      { commodityKey: 'crca_bundle_mumbai', ratio: 0.5 },
    ];
    // (2*190 + 0.5*47400) / 1000 = 24080 / 1000
    expect(blendedCost(comp, rec)).toBeCloseTo(24.08, 9);
  });

  it('charges a recipe over 1000 g (melting loss) above its avg price', () => {
    // 1050 g of a Rs 190 input to make 1 kg -> Rs 199.50, not Rs 190
    const comp = [{ commodityKey: 'fe_si_mg_mumbai', ratio: 1050 }];
    expect(blendedCost(comp, rec)).toBeCloseTo(199.5, 9);
  });

  it('normalizes ranges to the midpoint', () => {
    const comp = [{ commodityKey: 'pig_iron_foundry_gr_pune', ratio: 1000 }];
    // 1000 g of the 48,500 midpoint
    expect(blendedCost(comp, rec)).toBeCloseTo(48500, 9);
  });

  it('imputes unpriced rows at the priced average, not as free', () => {
    const comp = [
      { commodityKey: 'fe_si_mg_mumbai', ratio: 1 }, // 190
      { commodityKey: 'missing', ratio: 9 }, // no price -> priced at 190
    ];
    // 10 g at Rs 190 average / 1000
    expect(blendedCost(comp, rec)).toBeCloseTo(1.9, 9);
  });

  it('returns null when nothing could be priced', () => {
    expect(blendedCost([{ commodityKey: 'missing', ratio: 1 }], rec)).toBeNull();
    expect(blendedCost([], rec)).toBeNull();
    expect(blendedCost([{ commodityKey: 'fe_si_mg_mumbai', ratio: 1 }], null))
      .toBeNull();
  });
});

describe('massShares', () => {
  it('is grams ÷ 1000, independent of the other rows', () => {
    const rows = massShares([
      { commodityKey: 'crca_bundle_mumbai', ratio: 75 },
      { commodityKey: 'pig_iron_foundry_gr_pune', ratio: 25 },
    ]);
    expect(rows[0]).toEqual({
      key: 'crca_bundle_mumbai', grams: 75, pct: 7.5,
    });
    expect(rows[1].pct).toBe(2.5);
  });

  it('treats a non-finite ratio as 0 grams', () => {
    const rows = massShares([{ commodityKey: 'x', ratio: NaN }]);
    expect(rows[0]).toEqual({ key: 'x', grams: 0, pct: 0 });
  });
});

describe('totalGrams', () => {
  it('sums the ratios; under 1000 means the kg is not filled', () => {
    expect(totalGrams([
      { commodityKey: 'a', ratio: 75 },
      { commodityKey: 'b', ratio: 25 },
    ])).toBe(100);
  });
});

describe('costImpactWeights', () => {
  it('derives kg-per-kg weights (grams ÷ 1000) from the BOM', () => {
    const w = costImpactWeights([
      { commodityKey: 'fe_si_mg_mumbai', ratio: 20 }, // 20 g → 0.02 kg
      { commodityKey: 'crca_bundle_mumbai', ratio: 950 }, // 0.95 kg
    ]);
    expect(w.fe_si_mg_mumbai).toBeCloseTo(0.02, 9);
    expect(w.crca_bundle_mumbai).toBeCloseTo(0.95, 9);
  });
  it('treats a non-finite ratio as 0', () => {
    expect(costImpactWeights([{ commodityKey: 'x', ratio: NaN }]).x).toBe(0);
  });
});

describe('contributions', () => {
  it('computes cost and % that sum to 100', () => {
    const comp = [
      { commodityKey: 'fe_si_mg_mumbai', ratio: 2 }, // 380
      { commodityKey: 'crca_bundle_mumbai', ratio: 0.5 }, // 23700
    ];
    const rows = contributions(comp, rec);
    expect(rows.map((r) => r.key)).toEqual([
      'fe_si_mg_mumbai', 'crca_bundle_mumbai',
    ]);
    expect(rows[0].cost).toBe(380);
    expect(rows[1].cost).toBe(23700);
    expect(rows[0].pct + rows[1].pct).toBeCloseTo(100, 6);
  });
});
