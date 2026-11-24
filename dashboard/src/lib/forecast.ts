// Pure short-horizon forecasting engine using damped Holt linear trend
// smoothing with rolling-origin backtest error bands (SM-69). Zero I/O.

export const MIN_HISTORY_MONTHS = 6;
export const ALPHA = 0.4;
export const BETA = 0.2;
export const PHI = 0.85;
export const Z_80 = 1.2816;

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const FORECAST_METHOD = 'Damped Holt linear trend (80% interval)';

export interface ForecastPoint {
  month: string;
  point: number;
  lower: number;
  upper: number;
}

export interface ForecastAccuracy {
  mae: number;
  mape: number;
  sampleSize: number;
  rating: 'high' | 'moderate' | 'low';
}

export interface ForecastResult {
  points: ForecastPoint[];
  accuracy: ForecastAccuracy;
  method: string;
  direction: 'up' | 'down' | 'flat';
  endDeltaPct: number | null;
}

/**
 * Normalizes a finite value to be non-negative and free of negative zero.
 * @param {number} value - Numeric input.
 * @returns {number} Value clamped at +0.
 */
function clampNonNeg(value: number): number {
  return value <= 0 ? 0 : value;
}

/**
 * Adds an integer month offset to a "YYYY-MM" key using pure integer
 * arithmetic so timezone shifts never alter the month.
 * @param {string} ym - Base month key in "YYYY-MM" format.
 * @param {number} offset - Signed integer number of months to shift.
 * @returns {string} Shifted "YYYY-MM" key.
 */
export function addMonths(ym: string, offset: number): string {
  if (!YM_RE.test(ym)) {
    throw new Error(`Invalid YYYY-MM key: ${ym}`);
  }
  if (!Number.isInteger(offset)) {
    throw new Error(`Month offset must be an integer: ${offset}`);
  }
  const [yStr, mStr] = ym.split('-');
  const total = Number(yStr) * 12 + (Number(mStr) - 1) + offset;
  const year = Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Generates a short-horizon forecast with 80% prediction bands using
 * damped Holt linear trend smoothing and rolling-origin 1-step backtest
 * residuals (after a 3-month warm-up).
 * @param {Map<string, number>} series - Cost series keyed "YYYY-MM".
 * @param {number} horizon - Number of future months to predict (default 3).
 * @returns {ForecastResult | null} Forecast points, accuracy, and trend, or
 *   null when fewer than MIN_HISTORY_MONTHS valid points exist or horizon < 1.
 */
export function forecastSeries(
  series: Map<string, number>,
  horizon = 3
): ForecastResult | null {
  if (!Number.isFinite(horizon) || horizon < 1) return null;
  const steps = Math.floor(horizon);

  const entries: [string, number][] = [];
  for (const [key, val] of series) {
    if (!YM_RE.test(key)) continue;
    if (typeof val !== 'number' || !Number.isFinite(val)) continue;
    entries.push([key, clampNonNeg(val)]);
  }
  if (entries.length < MIN_HISTORY_MONTHS) return null;

  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const n = entries.length;
  const values = entries.map(([, v]) => v);

  let level = values[0];
  let trend = values[1] - values[0];
  let sumSqErr = 0;
  let sumAbsErr = 0;
  let sampleSize = 0;
  let sumApe = 0;
  let mapeCount = 0;

  for (let t = 1; t < n; t++) {
    const pred = level + PHI * trend;
    if (t >= 3) {
      const err = values[t] - pred;
      const absErr = Math.abs(err);
      sumSqErr += err * err;
      sumAbsErr += absErr;
      sampleSize += 1;
      if (values[t] > 0) {
        sumApe += (absErr / values[t]) * 100;
        mapeCount += 1;
      }
    }
    const prevLevel = level;
    level = ALPHA * values[t] + (1 - ALPHA) * pred;
    trend = BETA * (level - prevLevel) + (1 - BETA) * PHI * trend;
  }

  const sigma = sampleSize > 0 ? Math.sqrt(sumSqErr / sampleSize) : 0;
  const mae = sampleSize > 0 ? sumAbsErr / sampleSize : 0;
  const mape = mapeCount > 0 ? sumApe / mapeCount : 0;
  const rating: ForecastAccuracy['rating'] =
    mape <= 5 ? 'high' : mape <= 12 ? 'moderate' : 'low';

  const lastMonth = entries[n - 1][0];
  const points: ForecastPoint[] = [];
  let dampedSum = 0;

  for (let h = 1; h <= steps; h++) {
    dampedSum += PHI ** h;
    const rawPoint = level + dampedSum * trend;
    const point = clampNonNeg(rawPoint);
    const halfWidth = Z_80 * sigma * Math.sqrt(h);
    const lower = clampNonNeg(point - halfWidth);
    const upper = clampNonNeg(point + halfWidth);
    points.push({
      month: addMonths(lastMonth, h),
      point,
      lower,
      upper,
    });
  }

  const lastActual = values[n - 1];
  const endPoint = points[points.length - 1].point;
  const rawDelta =
    lastActual > 0 ? ((endPoint - lastActual) / lastActual) * 100 : null;
  const endDeltaPct = rawDelta !== null && rawDelta === 0 ? 0 : rawDelta;
  const direction: ForecastResult['direction'] =
    endDeltaPct === null || Math.abs(endDeltaPct) < 0.5
      ? 'flat'
      : endDeltaPct > 0
        ? 'up'
        : 'down';

  return {
    points,
    accuracy: { mae, mape, sampleSize, rating },
    method: FORECAST_METHOD,
    direction,
    endDeltaPct,
  };
}
