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
