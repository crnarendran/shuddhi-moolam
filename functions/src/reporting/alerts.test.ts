import { latestMoMBreaches, breachSummary } from './alerts';
import { PriceRecord } from './aggregate';

describe('latestMoMBreaches', () => {
  const records: PriceRecord[] = [
    { date: '10/05/2026', cu_lme: '100', fe_mn_hc_mumbai: '50' },
    { date: '10/06/2026', cu_lme: '110', fe_mn_hc_mumbai: '51' },
  ];

  it('flags commodities beyond the threshold, sorted by severity', () => {
    const breaches = latestMoMBreaches(records, 5);
    // Cu LME +10% breaches 5%; Fe Mn +2% does not.
    expect(breaches.map((b) => b.key)).toEqual(['cu_lme']);
    expect(breaches[0].pct).toBeCloseTo(10, 6);
  });

  it('returns nothing when no commodity breaches', () => {
    expect(latestMoMBreaches(records, 20)).toEqual([]);
  });

  it('skips commodities with fewer than two months', () => {
    const one: PriceRecord[] = [{ date: '10/06/2026', cu_lme: '110' }];
    expect(latestMoMBreaches(one, 1)).toEqual([]);
  });

  it('formats a summary line', () => {
    const s = breachSummary([{ key: 'cu_lme', label: 'Cu LME', pct: 10 }]);
    expect(s).toBe('Cu LME: +10.0%');
  });
});
