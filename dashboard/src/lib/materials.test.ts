import { describe, it, expect } from 'vitest';
import { blendedCost, contributions } from './materials';
import { type PriceRecord } from './reporting';

const rec: PriceRecord = {
  date: '03/08/2026',
  fe_si_mg_mumbai: '190',
  crca_bundle_mumbai: '47,400', // thousands comma
  pig_iron_foundry_gr_pune: '48,000 - 49,000', // range -> midpoint 48,500
};

describe('blendedCost', () => {
  it('sums ratio × price', () => {
    const comp = [
      { commodityKey: 'fe_si_mg_mumbai', ratio: 2 },
      { commodityKey: 'crca_bundle_mumbai', ratio: 0.5 },
    ];
    // 2*190 + 0.5*47400 = 380 + 23700 = 24080
    expect(blendedCost(comp, rec)).toBe(24080);
  });

  it('normalizes ranges to the midpoint', () => {
    const comp = [{ commodityKey: 'pig_iron_foundry_gr_pune', ratio: 1 }];
    expect(blendedCost(comp, rec)).toBe(48500);
  });

  it('skips unpriced commodities, returns null when none priced', () => {
    expect(blendedCost([{ commodityKey: 'missing', ratio: 1 }], rec)).toBeNull();
    expect(blendedCost([], rec)).toBeNull();
    expect(blendedCost([{ commodityKey: 'fe_si_mg_mumbai', ratio: 1 }], null))
      .toBeNull();
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
