import { COMPONENTS } from '../gemini/components';

// The commodity keys a manual entry may set — the extraction component
// registry. Non-registry keys (or structural fields like date/filename) are
// rejected so the tool can only touch real price cells.
export const CORE_KEYS: ReadonlySet<string> = new Set(
  COMPONENTS.map((c) => c.key)
);

/**
 * Validates a manual-entry date string as a real dd/MM/yyyy calendar date.
 * @param {unknown} date - The candidate date.
 * @returns {boolean} True if it is a valid dd/MM/yyyy date.
 */
export function isValidManualDate(date: unknown): date is string {
  if (typeof date !== 'string') return false;
  const parts = date.split('/');
  if (parts.length !== 3) return false;
  const [dd, mm, yyyy] = parts.map((p) => parseInt(p, 10));
  if ([dd, mm, yyyy].some((n) => Number.isNaN(n))) return false;
  if (yyyy < 2000 || yyyy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return false;
  }
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1 &&
    d.getUTCDate() === dd;
}

/**
 * Converts a dd/MM/yyyy date into the Firestore doc id (YYYY-MM-DD).
 * @param {string} date - A valid dd/MM/yyyy date.
 * @returns {string} The YYYY-MM-DD document id.
 */
export function dateToDocId(date: string): string {
  const [dd, mm, yyyy] = date.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parses a price cell (string with commas, or a number) to a number, or null.
 * @param {unknown} raw - The raw value.
 * @returns {number | null} The numeric value or null.
 */
export function parseNum(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const n = parseFloat(raw.replace(/,/g, '').trim());
  return Number.isNaN(n) ? null : n;
}

/**
 * Filters a manual-values payload to registry keys with a usable value,
 * coercing each to a string (the final kg figure, stored verbatim). Empty /
 * unparseable values and non-registry keys are dropped and reported.
 * @param {Record<string, unknown>} values - The raw values payload.
 * @param {ReadonlySet<string>} keys - Allowed keys (defaults to CORE_KEYS).
 * @returns {{ clean: Record<string, string>; rejected: string[] }} The
 *   accepted values and the list of rejected keys.
 */
export function sanitizeManualValues(
  values: Record<string, unknown>,
  keys: ReadonlySet<string> = CORE_KEYS
): { clean: Record<string, string>; rejected: string[] } {
  const clean: Record<string, string> = {};
  const rejected: string[] = [];
  for (const [k, v] of Object.entries(values || {})) {
    if (!keys.has(k)) { rejected.push(k); continue; }
    const n = parseNum(v);
    if (n === null) { rejected.push(k); continue; }
    clean[k] = String(n);
  }
  return { clean, rejected };
}

export interface FieldDiff {
  key: string;
  auto: string;
  manual: string;
}

/**
 * Compares an auto-extracted record against the stored manual record over the
 * registry keys, returning materially different fields (SM-57 sticky-flag).
 * A difference is material when the relative gap exceeds `tolerance` (default
 * 1%) with a small absolute floor so tiny kg values don't false-positive.
 * @param {Record<string, unknown>} auto - The freshly extracted values.
 * @param {Record<string, unknown>} manual - The stored manual values.
 * @param {ReadonlySet<string>} keys - Keys to compare (defaults to CORE_KEYS).
 * @param {number} tolerance - Relative difference threshold (0.01 = 1%).
 * @returns {FieldDiff[]} The materially different fields.
 */
export function diffAutoVsManual(
  auto: Record<string, unknown>,
  manual: Record<string, unknown>,
  keys: ReadonlySet<string> = CORE_KEYS,
  tolerance = 0.01
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const key of keys) {
    const a = parseNum(auto[key]);
    const m = parseNum(manual[key]);
    if (a === null || m === null) continue;
    const gap = Math.abs(a - m);
    const rel = gap / Math.max(Math.abs(m), 1e-9);
    if (gap > 0.05 && rel > tolerance) {
      diffs.push({ key, auto: String(a), manual: String(m) });
    }
  }
  return diffs;
}
