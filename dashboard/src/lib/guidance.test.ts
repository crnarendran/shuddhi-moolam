import { describe, it, expect } from 'vitest';
import {
  blendedCostSeries, blendedCostQuarterSeries, cheapestMonths,
  substitutionSuggestions, costVsBaseline,
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
  it('is the monthly cost of 1 kg of product: Σ(g × avg) ÷ 1000', () => {
    const s = blendedCostSeries(comp, recs);
    // Jun: (2*200 + 0.1*50000) / 1000
    expect(s.get('2026-06')).toBeCloseTo(5.4, 9);
    // Aug: (2*180 + 0.1*46000) / 1000
    expect(s.get('2026-08')).toBeCloseTo(4.96, 9);
  });

  it('imputes a commodity missing that month at the priced average', () => {
    const gap: PriceRecord[] = [
      { date: '10/09/2026', fe_si_mg_mumbai: '170' }, // crca missing
    ];
    // priced avg 170 over 2.1 g total -> 170 * 2.1 / 1000
    expect(blendedCostSeries(comp, gap).get('2026-09'))
      .toBeCloseTo(0.357, 9);
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

  it('defaults to the single prior period (quarter-over-quarter)', () => {
    const s = new Map([
      ['2025-Q4', 50], ['2026-Q1', 100], ['2026-Q2', 200], ['2026-Q3', 220],
    ]);
    const r = costVsBaseline(s); // default window = 1
    expect(r.latestKey).toBe('2026-Q3');
    expect(r.latest).toBe(220);
    expect(r.baseline).toBe(200); // Q2 only, not an average of earlier Qs
    expect(r.baselineKeys).toEqual(['2026-Q2']);
    expect(r.pct).toBeCloseTo(10, 6);
  });

  it('reports the latest with no baseline when there is no prior quarter',
    () => {
      const r = costVsBaseline(new Map([['2026-Q3', 220]]));
      expect(r.latest).toBe(220);
      expect(r.latestKey).toBe('2026-Q3');
      expect(r.baseline).toBeNull();
      expect(r.pct).toBeNull();
      expect(r.baselineKeys).toEqual([]);
    });
});

describe('blendedCostQuarterSeries', () => {
  it('aggregates the blended cost into calendar quarters', () => {
    const comp = [{ commodityKey: 'fe_si_mg_mumbai', ratio: 1 }];
    const recs = [
      { date: '10/04/2026', fe_si_mg_mumbai: '100' }, // Q2
      { date: '20/05/2026', fe_si_mg_mumbai: '200' }, // Q2
      { date: '10/07/2026', fe_si_mg_mumbai: '300' }, // Q3
    ];
    const s = blendedCostQuarterSeries(comp, recs);
    expect([...s.keys()]).toEqual(['2026-Q2', '2026-Q3']);
    // 1 g per kg: Q2 avg (100+200)/2 = 150 -> 150 / 1000
    expect(s.get('2026-Q2')).toBeCloseTo(0.15, 9);
    expect(s.get('2026-Q3')).toBeCloseTo(0.3, 9);
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
    // (120 - 108) * 3 g / 1000 = Rs 0.036 per kg of finished product
    expect(s[0].saving).toBeCloseTo(0.036, 9);
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
