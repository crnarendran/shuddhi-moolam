import { describe, it, expect } from 'vitest';
import { fmtChartValue, fmtNum } from './format';

describe('fmtNum', () => {
  it('defaults to 1 decimal and renders null as an em dash', () => {
    expect(fmtNum(47.25)).toBe((47.3).toLocaleString());
    expect(fmtNum(null)).toBe('—');
  });
});

describe('fmtChartValue', () => {
  it('caps chart values at 2 decimals, hiding float artifacts', () => {
    // 46.81999999999999 is what the Seasonal tooltip used to print
    expect(fmtChartValue(46.81999999999999))
      .toBe((46.82).toLocaleString());
    expect(fmtChartValue(45.66)).toBe((45.66).toLocaleString());
  });

  it('does not pad whole or 1-decimal values with zeros', () => {
    expect(fmtChartValue(877.6)).toBe((877.6).toLocaleString());
    expect(fmtChartValue(1300)).toBe((1300).toLocaleString());
  });

  it('renders gaps (null, undefined, "-" or NaN) as an em dash', () => {
    expect(fmtChartValue(null)).toBe('—');
    expect(fmtChartValue(undefined)).toBe('—');
    expect(fmtChartValue('-')).toBe('—');
    expect(fmtChartValue(NaN)).toBe('—');
  });
});
