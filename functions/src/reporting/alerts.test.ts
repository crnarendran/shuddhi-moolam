import { latestMoMBreaches, breachSummary } from './alerts';
import { PriceRecord } from './aggregate';

describe('latestMoMBreaches', () => {
  const records: PriceRecord[] = [
    { date: '10/05/2026', copper_cathode: '100', fe_mn_hc_mumbai: '50' },
    { date: '10/06/2026', copper_cathode: '110', fe_mn_hc_mumbai: '51' },
  ];

  it('flags commodities beyond the threshold, sorted by severity', () => {
    const breaches = latestMoMBreaches(records, 5);
    // Copper +10% breaches 5%; Fe Mn +2% does not.
    expect(breaches.map((b) => b.key)).toEqual(['copper_cathode']);
    expect(breaches[0].pct).toBeCloseTo(10, 6);
  });

  it('returns nothing when no commodity breaches', () => {
    expect(latestMoMBreaches(records, 20)).toEqual([]);
  });

  it('skips commodities with fewer than two months', () => {
    const one: PriceRecord[] = [{ date: '10/06/2026', copper_cathode: '110' }];
    expect(latestMoMBreaches(one, 1)).toEqual([]);
  });

  it('formats a summary line', () => {
    const s = breachSummary([
      { key: 'copper_cathode', label: 'Copper Cathode', pct: 10 },
    ]);
    expect(s).toBe('Copper Cathode: +10.0%');
  });
});
