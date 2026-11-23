import { describe, it, expect } from 'vitest';
import {
  addMonths,
  forecastSeries,
  MIN_HISTORY_MONTHS,
  Z_80,
} from './forecast';

/**
 * Helper to build a chronological Map from consecutive months starting at
 * `startYm`.
 * @param {string} startYm - Starting "YYYY-MM" key.
 * @param {number[]} values - Monthly cost values.
 * @returns {Map<string, number>} Ordered series map.
 */
function makeSeries(startYm: string, values: number[]): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < values.length; i++) {
    out.set(addMonths(startYm, i), values[i]);
  }
  return out;
}

describe('addMonths', () => {
  it('increments within the same year', () => {
    expect(addMonths('2026-08', 2)).toBe('2026-10');
    expect(addMonths('2026-01', 0)).toBe('2026-01');
  });

  it('rolls over across year boundaries cleanly', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('throws on malformed YYYY-MM strings or non-integer offsets', () => {
    expect(() => addMonths('2026-13', 1)).toThrow();
    expect(() => addMonths('2026-00', 1)).toThrow();
    expect(() => addMonths('invalid', 1)).toThrow();
    expect(() => addMonths('2026-06', 1.5)).toThrow();
  });
});

describe('forecastSeries', () => {
  it('returns null when fewer than 6 valid finite points exist', () => {
    expect(MIN_HISTORY_MONTHS).toBe(6);
    const short = makeSeries('2026-01', [100, 102, 104, 106, 108]);
    expect(forecastSeries(short)).toBeNull();

    const withBadEntries = new Map<string, number>([
      ['2026-01', 100],
      ['2026-02', 102],
      ['2026-03', Number.NaN],
      ['2026-04', Number.POSITIVE_INFINITY],
      ['2026-13', 105],
      ['bad-key', 106],
      ['2026-05', 104],
      ['2026-06', 106],
      ['2026-07', 108],
    ]);
    expect(forecastSeries(withBadEntries)).toBeNull();
  });

  it('returns null when horizon is zero or negative', () => {
    const valid = makeSeries('2026-01', [100, 102, 104, 106, 108, 110]);
    expect(forecastSeries(valid, 0)).toBeNull();
    expect(forecastSeries(valid, -2)).toBeNull();
    expect(forecastSeries(valid, Number.NaN)).toBeNull();
  });

  it('forecasts a constant flat series with zero error and flat direction',
    () => {
      const flat = makeSeries('2026-01', [100, 100, 100, 100, 100, 100]);
      const res = forecastSeries(flat);
      expect(res).not.toBeNull();
      expect(res?.points).toHaveLength(3);
      expect(res?.points.map((p) => p.month)).toEqual([
        '2026-07',
        '2026-08',
        '2026-09',
      ]);
      for (const p of res?.points ?? []) {
        expect(p.point).toBe(100);
        expect(p.lower).toBe(100);
        expect(p.upper).toBe(100);
      }
      expect(res?.accuracy.mae).toBe(0);
      expect(res?.accuracy.mape).toBe(0);
      expect(res?.accuracy.sampleSize).toBe(3);
      expect(res?.accuracy.rating).toBe('high');
      expect(res?.direction).toBe('flat');
      expect(res?.endDeltaPct).toBe(0);
    }
  );

  it('produces damped up-trend and non-decreasing bands on rising data',
    () => {
      const rising = makeSeries('2026-01', [100, 110, 120, 130, 140, 150]);
      const res = forecastSeries(rising);
      expect(res).not.toBeNull();
      const pts = res!.points;
      expect(res!.direction).toBe('up');
      expect(res!.endDeltaPct).toBeGreaterThan(0);

      const step2Delta = pts[1].point - pts[0].point;
      const step3Delta = pts[2].point - pts[1].point;
      expect(step2Delta).toBeGreaterThan(0);
      expect(step3Delta).toBeGreaterThan(0);
      expect(step3Delta).toBeLessThan(step2Delta);

      const widths = pts.map((p) => p.upper - p.lower);
      for (const p of pts) {
        expect(p.lower).toBeLessThanOrEqual(p.point);
        expect(p.point).toBeLessThanOrEqual(p.upper);
      }
      expect(widths[1]).toBeGreaterThanOrEqual(widths[0]);
      expect(widths[2]).toBeGreaterThanOrEqual(widths[1]);
    }
  );

  it('clamps falling forecasts and lower bounds at +0 (no negative or -0)',
    () => {
      const falling = makeSeries('2026-01', [120, 95, 70, 45, 20, 5]);
      const res = forecastSeries(falling);
      expect(res).not.toBeNull();
      expect(res!.direction).toBe('down');
      for (const p of res!.points) {
        expect(p.point).toBeGreaterThanOrEqual(0);
        expect(p.lower).toBeGreaterThanOrEqual(0);
        expect(p.upper).toBeGreaterThanOrEqual(p.point);
        expect(Object.is(p.point, -0)).toBe(false);
        expect(Object.is(p.lower, -0)).toBe(false);
        expect(Object.is(p.upper, -0)).toBe(false);
      }
      expect(res!.points[2].point).toBe(0);
      expect(res!.points[2].lower).toBe(0);
    }
  );

  it('widens intervals by sqrt(h) and rates accuracy by MAPE thresholds',
    () => {
      expect(Z_80).toBeCloseTo(1.2816, 4);

      const lowNoise = makeSeries('2026-01', [
        100, 102, 99, 101, 100, 102, 99, 101,
      ]);
      const highRes = forecastSeries(lowNoise)!;
      expect(highRes.accuracy.mae).toBeGreaterThan(0);
      expect(highRes.accuracy.mape).toBeGreaterThan(0);
      expect(highRes.accuracy.mape).toBeLessThanOrEqual(5);
      expect(highRes.accuracy.rating).toBe('high');

      const [p1, p2, p3] = highRes.points;
      expect(p1.lower).toBeLessThan(p1.point);
      expect(p1.point).toBeLessThan(p1.upper);

      const w1 = p1.upper - p1.lower;
      const w2 = p2.upper - p2.lower;
      const w3 = p3.upper - p3.lower;
      expect(w2 / w1).toBeCloseTo(Math.sqrt(2), 6);
      expect(w3 / w1).toBeCloseTo(Math.sqrt(3), 6);

      const modNoise = makeSeries('2026-01', [
        100, 112, 94, 110, 95, 111, 96, 110,
      ]);
      const modRes = forecastSeries(modNoise)!;
      expect(modRes.accuracy.mape).toBeGreaterThan(5);
      expect(modRes.accuracy.mape).toBeLessThanOrEqual(12);
      expect(modRes.accuracy.rating).toBe('moderate');

      const wildNoise = makeSeries('2026-01', [
        100, 140, 75, 135, 70, 145, 65, 140,
      ]);
      const wildRes = forecastSeries(wildNoise)!;
      expect(wildRes.accuracy.mape).toBeGreaterThan(12);
      expect(wildRes.accuracy.rating).toBe('low');
    }
  );

  it('sorts unsorted Map keys chronologically before forecasting', () => {
    const ordered = new Map<string, number>([
      ['2026-01', 100],
      ['2026-02', 105],
      ['2026-03', 110],
      ['2026-04', 112],
      ['2026-05', 118],
      ['2026-06', 122],
    ]);
    const shuffled = new Map<string, number>([
      ['2026-06', 122],
      ['2026-02', 105],
      ['2026-05', 118],
      ['2026-01', 100],
      ['2026-04', 112],
      ['2026-03', 110],
    ]);
    expect(forecastSeries(shuffled)).toEqual(forecastSeries(ordered));
  });

  it('handles all-zero series cleanly without NaN or -0', () => {
    const zeros = makeSeries('2026-01', [0, -0, 0, 0, 0, 0]);
    const res = forecastSeries(zeros);
    expect(res).not.toBeNull();
    expect(res!.direction).toBe('flat');
    expect(res!.endDeltaPct).toBeNull();
    expect(res!.accuracy.mae).toBe(0);
    expect(res!.accuracy.mape).toBe(0);
    expect(res!.accuracy.rating).toBe('high');
    for (const p of res!.points) {
      expect(Object.is(p.point, 0)).toBe(true);
      expect(Object.is(p.lower, 0)).toBe(true);
      expect(Object.is(p.upper, 0)).toBe(true);
    }
  });

  it('supports custom positive horizons and clamps negative inputs', () => {
    const negInput = makeSeries('2026-01', [-20, 100, 100, 100, 100, 100]);
    const oneStep = forecastSeries(negInput, 1);
    expect(oneStep).not.toBeNull();
    expect(oneStep!.points).toHaveLength(1);
    expect(oneStep!.points[0].month).toBe('2026-07');

    const sixStep = forecastSeries(
      makeSeries('2026-01', [100, 100, 100, 100, 100, 100]),
      6
    );
    expect(sixStep).not.toBeNull();
    expect(sixStep!.points).toHaveLength(6);
    expect(sixStep!.points[5].month).toBe('2026-12');
  });
});
