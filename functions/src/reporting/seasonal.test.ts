import {
  seasonalIndex,
  rollingBaseline,
  confidenceLabel,
} from './seasonal';
import { PriceRecord } from './aggregate';

describe('seasonalIndex', () => {
  it('averages month-over-month % by calendar month across years', () => {
    const records: PriceRecord[] = [
      { date: '15/01/2025', v: '100' },
      { date: '15/02/2025', v: '110' }, // +10% into Feb
      { date: '15/01/2026', v: '200' },
      { date: '15/02/2026', v: '240' }, // +20% into Feb
    ];
    const idx = seasonalIndex(records, 'v');
    expect(idx.get(2)).toBeCloseTo(15, 6); // (10 + 20) / 2
    expect(idx.has(1)).toBe(false); // no MoM into January here
  });

  it('skips non-consecutive months (gaps)', () => {
    const records: PriceRecord[] = [
      { date: '15/01/2025', v: '100' },
      { date: '15/04/2025', v: '150' }, // Jan -> Apr gap, skipped
    ];
    expect(seasonalIndex(records, 'v').size).toBe(0);
  });
});

describe('rollingBaseline', () => {
  it('averages the trailing window, excluding the current period', () => {
    const q = new Map<string, number>([
      ['2026-Q1', 10],
      ['2026-Q2', 20],
      ['2026-Q3', 30],
      ['2026-Q4', 40],
    ]);
    const base = rollingBaseline(q, 2);
    expect(base.has('2026-Q1')).toBe(false); // no prior
    expect(base.get('2026-Q2')).toBe(10); // avg of [Q1]
    expect(base.get('2026-Q3')).toBe(15); // avg of [Q1, Q2]
    expect(base.get('2026-Q4')).toBe(25); // avg of [Q2, Q3]
  });
});

describe('confidenceLabel', () => {
  it('flags short history as low confidence', () => {
    expect(confidenceLabel(3)).toBe('ok');
    expect(confidenceLabel(2)).toContain('low');
    expect(confidenceLabel(0)).toBe('insufficient');
  });
});
