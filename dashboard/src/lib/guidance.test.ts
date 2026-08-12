import { describe, it, expect } from 'vitest';
import {
  blendedCostSeries, cheapestMonths, substitutionSuggestions, costVsBaseline,
  type SubstitutionGroup,
} from './guidance';
import { type Commodity, type PriceRecord } from './reporting';

const recs: PriceRecord[] = [
  { date: '10/06/2026', fe_si_mg_mumbai: '200', crca_bundle_mumbai: '50,000' },
  { date: '10/07/2026', fe_si_mg_mumbai: '190', crca_bundle_mumbai: '47,000' },
  { date: '10/08/2026', fe_si_mg_mumbai: '180', crca_bundle_mumbai: '46,000' },
];
const comp = [
  { commodityKey: 'fe_si_mg_mumbai', ratio: 2 },
  { commodityKey: 'crca_bundle_mumbai', ratio: 0.1 },
];

describe('blendedCostSeries', () => {
  it('sums ratio × monthly price per month', () => {
    const s = blendedCostSeries(comp, recs);
    // Jun: 2*200 + 0.1*50000 = 400 + 5000 = 5400
    expect(s.get('2026-06')).toBe(5400);
    // Aug: 2*180 + 0.1*46000 = 360 + 4600 = 4960
    expect(s.get('2026-08')).toBe(4960);
  });
});

describe('cheapestMonths', () => {
  it('ranks most-negative months first', () => {
    const idx = new Map([[1, 2], [11, -5], [7, -1]]);
    expect(cheapestMonths(idx, 2).map((m) => m.month)).toEqual([11, 7]);
  });
});

describe('costVsBaseline', () => {
  it('compares latest to the prior-window mean', () => {
    const s = new Map([['2026-06', 100], ['2026-07', 120], ['2026-08', 80]]);
    const r = costVsBaseline(s, 6);
    expect(r.latest).toBe(80);
    expect(r.baseline).toBe(110); // mean of 100,120
    expect(r.pct).toBeCloseTo(((80 - 110) / 110) * 100, 6);
  });
});

describe('substitutionSuggestions', () => {
  const commodities: Commodity[] = [
    { key: 'fe_si_70_75_mumbai', label: 'FeSi Mumbai', category: 'Ferro Alloys',
      unit: 'Rs/kg', tier: 'core' },
    { key: 'fe_si_70_75_raipur', label: 'FeSi Raipur', category: 'Raipur Local',
      unit: 'Rs/kg', tier: 'extended' },
    { key: 'lam_coke', label: 'Lam Coke', category: 'Coke', unit: 'Rs/tonne',
      tier: 'core' },
  ];
  const groups: SubstitutionGroup[] = [
    { name: 'Ferro Silicon', members: ['fe_si_70_75_mumbai',
      'fe_si_70_75_raipur'] },
  ];

  it('suggests the cheaper same-unit alternative with the saving', () => {
    const latest: PriceRecord = {
      date: '10/08/2026', fe_si_70_75_mumbai: '120', fe_si_70_75_raipur: '108',
    };
    const s = substitutionSuggestions(
      [{ commodityKey: 'fe_si_70_75_mumbai', ratio: 3 }],
      groups, commodities, latest
    );
    expect(s).toHaveLength(1);
    expect(s[0].to.key).toBe('fe_si_70_75_raipur');
    expect(s[0].saving).toBe((120 - 108) * 3); // 36
  });

  it('does not suggest when the current is already cheapest', () => {
    const latest: PriceRecord = {
      date: '10/08/2026', fe_si_70_75_mumbai: '100', fe_si_70_75_raipur: '108',
    };
    expect(substitutionSuggestions(
      [{ commodityKey: 'fe_si_70_75_mumbai', ratio: 1 }],
      groups, commodities, latest
    )).toEqual([]);
  });
});
