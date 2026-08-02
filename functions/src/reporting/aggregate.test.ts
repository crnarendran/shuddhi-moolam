import {
  normalizePrice,
  parseIssueDate,
  monthlyAverages,
  quarterlyAverages,
  pctChange,
  PriceRecord,
} from './aggregate';

describe('normalizePrice', () => {
  it('parses a comma-grouped number', () => {
    expect(normalizePrice('47,500')).toBe(47500);
  });

  it('returns the midpoint of a range', () => {
    expect(normalizePrice('47,500 - 46,500')).toBe(47000);
  });

  it('returns null for blank or non-numeric input', () => {
    expect(normalizePrice('')).toBeNull();
    expect(normalizePrice('N/A')).toBeNull();
    expect(normalizePrice(undefined)).toBeNull();
  });

  it('passes through a finite number', () => {
    expect(normalizePrice(42)).toBe(42);
  });
});

describe('parseIssueDate', () => {
  it('parses dd/MM/yyyy', () => {
    expect(parseIssueDate('27/07/2026')).toEqual({ year: 2026, month: 7 });
  });

  it('rejects malformed dates', () => {
    expect(parseIssueDate('2026-07-27')).toBeNull();
    expect(parseIssueDate('27/13/2026')).toBeNull();
  });
});

describe('monthly & quarterly averages', () => {
  const records: PriceRecord[] = [
    { date: '06/04/2026', cu: '100' },
    { date: '20/04/2026', cu: '200' },
    { date: '11/05/2026', cu: '300' },
    { date: '08/07/2026', cu: 'N/A' },
    { date: 'bad', cu: '999' },
  ];

  it('averages by month, skipping unparseable rows', () => {
    const m = monthlyAverages(records, 'cu');
    expect(m.get('2026-04')).toBe(150);
    expect(m.get('2026-05')).toBe(300);
    expect(m.has('2026-07')).toBe(false); // value N/A skipped
  });

  it('averages by quarter', () => {
    const q = quarterlyAverages(records, 'cu');
    // Q2 = Apr(150-avg from 100,200) + May 300 => (100+200+300)/3 = 200
    expect(q.get('2026-Q2')).toBe(200);
  });
});

describe('pctChange', () => {
  it('computes percent change', () => {
    expect(pctChange(100, 95)).toBeCloseTo(-5, 6);
    expect(pctChange(200, 210)).toBeCloseTo(5, 6);
  });

  it('returns null on zero or null inputs', () => {
    expect(pctChange(0, 100)).toBeNull();
    expect(pctChange(null, 100)).toBeNull();
    expect(pctChange(100, null)).toBeNull();
  });
});
