export type Trend = 'up' | 'down' | 'flat' | 'unknown';

export interface PriceChange {
  trend: Trend;
  delta: number | null;
  pct: number | null;
}

export interface FormattedPriceChange {
  trendText: string;
  trendColor: string;
  changeText: string;
}

/**
 * Parses an unknown value into a finite number. Returns null if invalid,
 * non-numeric, or a string range (e.g. '10-20').
 * @param {unknown} val Value to parse.
 * @returns {number | null} Numeric value or null.
 */
function parseNumericPrice(val: unknown): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const cleaned = trimmed.replace(/,/g, '');
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(cleaned)) {
      return null;
    }
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

/**
 * Compares one commodity's current vs previous string price (SM-64).
 * Returns 'unknown' if either value is non-numeric, missing, or if previous
 * is zero. Differences with absolute value < 0.005 are classified as flat.
 * @param {unknown} cur Current price value.
 * @param {unknown} prev Previous price value.
 * @returns {PriceChange} Trend, delta (₹/kg), and percentage change.
 */
export function computePriceChange(cur: unknown, prev: unknown): PriceChange {
  const curNum = parseNumericPrice(cur);
  const prevNum = parseNumericPrice(prev);

  if (curNum === null || prevNum === null || prevNum === 0) {
    return { trend: 'unknown', delta: null, pct: null };
  }

  const rawDelta = curNum - prevNum;
  if (Math.abs(rawDelta) < 0.005) {
    return { trend: 'flat', delta: 0, pct: 0 };
  }

  const pct = (rawDelta / prevNum) * 100;
  if (rawDelta > 0) {
    return { trend: 'up', delta: rawDelta, pct };
  }
  return { trend: 'down', delta: rawDelta, pct };
}

/**
 * Builds key -> PriceChange for the given component keys (SM-64).
 * @param {Record<string, unknown>} current Current record document.
 * @param {Record<string, unknown> | null} previous Previous issue record.
 * @param {string[]} keys List of component keys to compare.
 * @returns {Record<string, PriceChange>} Map of key to PriceChange.
 */
export function computeChanges(
  current: Record<string, unknown>,
  previous: Record<string, unknown> | null,
  keys: string[]
): Record<string, PriceChange> {
  const result: Record<string, PriceChange> = {};
  for (const k of keys) {
    if (!previous) {
      result[k] = { trend: 'unknown', delta: null, pct: null };
    } else {
      result[k] = computePriceChange(current[k], previous[k]);
    }
  }
  return result;
}

/**
 * Formats a PriceChange object into display text and colors (SM-64).
 * @param {PriceChange} change Price change object.
 * @returns {FormattedPriceChange} Display strings and color styling.
 */
export function formatPriceChange(change: PriceChange): FormattedPriceChange {
  if (change.trend === 'up' && change.delta !== null && change.pct !== null) {
    const deltaStr = `+${change.delta.toFixed(2)}`;
    const pctStr = `(+${change.pct.toFixed(1)}%)`;
    return {
      trendText: '▲ Up',
      trendColor: '#dc2626',
      changeText: `${deltaStr} ${pctStr}`,
    };
  }

  if (
    change.trend === 'down' &&
    change.delta !== null &&
    change.pct !== null
  ) {
    const absDelta = Math.abs(change.delta).toFixed(2);
    const absPct = Math.abs(change.pct).toFixed(1);
    return {
      trendText: '▼ Down',
      trendColor: '#16a34a',
      changeText: `−${absDelta} (−${absPct}%)`,
    };
  }

  if (change.trend === 'flat') {
    return {
      trendText: '▬ Flat',
      trendColor: '#4b5563',
      changeText: '0.00 (0.0%)',
    };
  }

  return {
    trendText: '—',
    trendColor: '#9ca3af',
    changeText: '—',
  };
}
