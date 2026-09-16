// Shared number formatting for reports. One place so price/cost precision
// stays consistent across every chart and table (SM-50): 1 decimal by default,
// locale thousands grouping, null → em dash. Pass `digits` for the few spots
// that want more precision (e.g. cost-impact deltas).

/**
 * Formats a number for display with up to `digits` decimal places (default 1),
 * grouped per locale; null renders as an em dash.
 * @param {number | null} n - The value to format.
 * @param {number} digits - Maximum decimal places (default 1).
 * @returns {string} The formatted value, or '—' for null.
 */
export function fmtNum(n: number | null, digits = 1): string {
  return n === null
    ? '—'
    : n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** Most decimal places any chart shows (tooltips, data points). */
export const CHART_MAX_DIGITS = 2;

/**
 * Formats a chart value for tooltips: at most 2 decimal places, locale
 * grouping, no zero-padding. Anything that isn't a finite number — ECharts
 * passes null/undefined/'-' for gaps — renders as an em dash. Use this as a
 * chart's `valueFormatter` so raw floats (e.g. 46.81999999999999) never show.
 * @param {unknown} v - The value ECharts hands the formatter.
 * @returns {string} The formatted value, or '—' for a gap.
 */
export function fmtChartValue(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v)
    ? fmtNum(v, CHART_MAX_DIGITS)
    : '—';
}
