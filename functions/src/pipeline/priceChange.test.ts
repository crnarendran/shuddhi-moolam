import {
  computePriceChange,
  computeChanges,
  formatPriceChange,
} from './priceChange';

describe('priceChange helper (SM-64)', () => {
  describe('computePriceChange', () => {
    it('detects price increase with delta and percentage', () => {
      const res = computePriceChange('1392.00', '1379.60');
      expect(res.trend).toBe('up');
      expect(res.delta).toBeCloseTo(12.4, 4);
      expect(res.pct).toBeCloseTo((12.4 / 1379.6) * 100, 4);
    });

    it('detects price decrease with delta and percentage', () => {
      const res = computePriceChange('4994.60', '5024.60');
      expect(res.trend).toBe('down');
      expect(res.delta).toBeCloseTo(-30.0, 4);
      expect(res.pct).toBeCloseTo((-30.0 / 5024.6) * 100, 4);
    });

    it('identifies exact flat prices', () => {
      const res = computePriceChange('51', '51');
      expect(res.trend).toBe('flat');
      expect(res.delta).toBe(0);
      expect(res.pct).toBe(0);
    });

    it('rounds small positive differences < 0.005 to flat', () => {
      const res = computePriceChange('100.004', '100');
      expect(res.trend).toBe('flat');
      expect(res.delta).toBe(0);
      expect(res.pct).toBe(0);
    });

    it('rounds small negative differences < 0.005 to flat', () => {
      const res = computePriceChange('100', '100.004');
      expect(res.trend).toBe('flat');
      expect(res.delta).toBe(0);
      expect(res.pct).toBe(0);
    });

    it('returns unknown when previous is blank or empty string', () => {
      expect(computePriceChange('100', '')).toEqual({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
      expect(computePriceChange('100', '   ')).toEqual({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
    });

    it('returns unknown when previous is zero (avoids div by zero)', () => {
      expect(computePriceChange('100', '0')).toEqual({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
      expect(computePriceChange('100', 0)).toEqual({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
    });

    it('returns unknown when values are non-numeric or ranges', () => {
      expect(computePriceChange('n/a', '100')).toEqual({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
      expect(computePriceChange('10-20', '15')).toEqual({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
      expect(computePriceChange('100', 'invalid')).toEqual({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
    });

    it('returns unknown when current is blank or both are blank', () => {
      expect(computePriceChange('', '100')).toEqual({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
      expect(computePriceChange('', '')).toEqual({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
      expect(computePriceChange(null, undefined)).toEqual({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
    });

    it('parses numbers and handles comma-separated strings', () => {
      const res = computePriceChange('1,392.00', '1,379.60');
      expect(res.trend).toBe('up');
      expect(res.delta).toBeCloseTo(12.4, 4);
    });
  });

  describe('computeChanges', () => {
    it('returns unknown for all keys when previous is null', () => {
      const current = { copper: '100', tin: '200' };
      const changes = computeChanges(current, null, ['copper', 'tin']);
      expect(changes.copper).toEqual({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
      expect(changes.tin).toEqual({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
    });

    it('computes changes across specified keys against previous', () => {
      const current = {
        copper: '1392.00',
        tin: '4994.60',
        scrap: '51',
        missing_in_prev: '12.3',
      };
      const previous = {
        copper: '1379.60',
        tin: '5024.60',
        scrap: '51',
      };
      const keys = ['copper', 'tin', 'scrap', 'missing_in_prev'];
      const changes = computeChanges(current, previous, keys);

      expect(changes.copper.trend).toBe('up');
      expect(changes.tin.trend).toBe('down');
      expect(changes.scrap.trend).toBe('flat');
      expect(changes.missing_in_prev.trend).toBe('unknown');
    });
  });

  describe('formatPriceChange', () => {
    it('formats up trend with red color and signed delta and pct', () => {
      const formatted = formatPriceChange({
        trend: 'up',
        delta: 12.4,
        pct: 0.8988,
      });
      expect(formatted.trendText).toBe('▲ Up');
      expect(formatted.trendColor).toBe('#dc2626');
      expect(formatted.changeText).toBe('+12.40 (+0.9%)');
    });

    it('formats down trend with green color and minus glyph', () => {
      const formatted = formatPriceChange({
        trend: 'down',
        delta: -30.0,
        pct: -0.597,
      });
      expect(formatted.trendText).toBe('▼ Down');
      expect(formatted.trendColor).toBe('#16a34a');
      expect(formatted.changeText).toBe('−30.00 (−0.6%)');
    });

    it('formats flat trend with grey color and 0.00 (0.0%)', () => {
      const formatted = formatPriceChange({
        trend: 'flat',
        delta: 0,
        pct: 0,
      });
      expect(formatted.trendText).toBe('▬ Flat');
      expect(formatted.trendColor).toBe('#4b5563');
      expect(formatted.changeText).toBe('0.00 (0.0%)');
    });

    it('formats unknown trend with em-dash and grey color', () => {
      const formatted = formatPriceChange({
        trend: 'unknown',
        delta: null,
        pct: null,
      });
      expect(formatted.trendText).toBe('—');
      expect(formatted.trendColor).toBe('#9ca3af');
      expect(formatted.changeText).toBe('—');
    });
  });
});
