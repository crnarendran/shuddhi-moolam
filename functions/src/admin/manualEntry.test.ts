import {
  isValidManualDate, dateToDocId, parseNum, sanitizeManualValues,
  diffAutoVsManual, CORE_KEYS,
} from './manualEntry';

// A key that exists in the component registry (Rs/tonne pig iron).
const K = 'pig_iron_foundry_gr_pune';

describe('isValidManualDate', () => {
  it('accepts a real dd/MM/yyyy date', () => {
    expect(isValidManualDate('18/05/2026')).toBe(true);
    expect(isValidManualDate('29/02/2024')).toBe(true); // leap year
  });
  it('rejects wrong shape / non-strings', () => {
    expect(isValidManualDate('2026-05-18')).toBe(false);
    expect(isValidManualDate('18-05-2026')).toBe(false);
    expect(isValidManualDate(20260518)).toBe(false);
    expect(isValidManualDate(undefined)).toBe(false);
  });
  it('rejects impossible calendar dates', () => {
    expect(isValidManualDate('31/02/2026')).toBe(false);
    expect(isValidManualDate('29/02/2026')).toBe(false); // not a leap year
    expect(isValidManualDate('00/05/2026')).toBe(false);
    expect(isValidManualDate('18/13/2026')).toBe(false);
    expect(isValidManualDate('18/05/1999')).toBe(false);
  });
});

describe('dateToDocId', () => {
  it('maps dd/MM/yyyy to YYYY-MM-DD', () => {
    expect(dateToDocId('18/05/2026')).toBe('2026-05-18');
  });
});

describe('parseNum', () => {
  it('parses numbers and comma strings, rejects junk', () => {
    expect(parseNum('47,500')).toBe(47500);
    expect(parseNum('47.5')).toBe(47.5);
    expect(parseNum(48)).toBe(48);
    expect(parseNum('')).toBeNull();
    expect(parseNum('abc')).toBeNull();
    expect(parseNum(undefined)).toBeNull();
  });
});

describe('sanitizeManualValues', () => {
  it('keeps registry keys, coerces to string, drops the rest', () => {
    const { clean, rejected } = sanitizeManualValues({
      [K]: '47.5',
      aluminium_ingot: 385.8,
      not_a_commodity: '5',
      crca_bundle_chennai: '',
    });
    expect(clean[K]).toBe('47.5');
    expect(clean.aluminium_ingot).toBe('385.8');
    expect(rejected).toEqual(
      expect.arrayContaining(['not_a_commodity', 'crca_bundle_chennai'])
    );
    expect(clean.not_a_commodity).toBeUndefined();
  });
  it('all core keys are real registry keys', () => {
    expect(CORE_KEYS.has(K)).toBe(true);
    expect(CORE_KEYS.has('date')).toBe(false);
  });
});

describe('diffAutoVsManual', () => {
  it('flags a material difference', () => {
    const diffs = diffAutoVsManual({ [K]: '48' }, { [K]: '47.5' });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({ key: K, auto: '48', manual: '47.5' });
  });
  it('ignores identical / within-tolerance values', () => {
    expect(diffAutoVsManual({ [K]: '47.5' }, { [K]: '47.5' })).toHaveLength(0);
    // 47.5 vs 47.504 → < 1% and < 0.05 abs → not material
    expect(diffAutoVsManual({ [K]: '47.504' }, { [K]: '47.5' }))
      .toHaveLength(0);
  });
  it('skips fields missing on either side', () => {
    expect(diffAutoVsManual({ [K]: '48' }, {})).toHaveLength(0);
    expect(diffAutoVsManual({}, { [K]: '47.5' })).toHaveLength(0);
  });
});
