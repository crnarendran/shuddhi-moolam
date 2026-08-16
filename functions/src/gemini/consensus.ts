import { type ExtractionRecord } from './schema';

// Fields carried straight through from the first run rather than voted on.
const PASSTHROUGH = new Set(['source_pages', 'filename']);

/**
 * Parses a raw price cell (with commas / a range) to a number, or null.
 * @param {string} raw - The raw value.
 * @returns {number | null} The numeric value (range midpoint), or null.
 */
function parseNum(raw: string): number | null {
  const parts = raw
    .split(/\s*(?:-|–|—|to)\s*/i)
    .map((p) => parseFloat(p.replace(/,/g, '').trim()))
    .filter((n) => !isNaN(n));
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/**
 * Picks the consensus of several string readings of one field: the value that
 * appears at least twice (majority) wins; if all readings differ, the median
 * by numeric value is used (robust to a single wild misread). Empty readings
 * are ignored unless every reading is empty. Pure (SM-58).
 * @param {string[]} values - One reading per extraction run.
 * @returns {string} The agreed value.
 */
export function consensusValue(values: string[]): string {
  const present = values.filter(
    (v) => v !== undefined && v !== null && v !== ''
  );
  if (present.length === 0) return values[0] ?? '';

  const counts = new Map<string, number>();
  for (const v of present) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = present[0];
  let bestCount = 0;
  for (const [v, c] of counts) if (c > bestCount) { best = v; bestCount = c; }
  if (bestCount >= 2) return best;

  // All distinct — take the median by numeric value.
  const nums = present
    .map((v) => ({ v, n: parseNum(v) }))
    .filter((x): x is { v: string; n: number } => x.n !== null)
    .sort((a, b) => a.n - b.n);
  if (nums.length === 0) return present[0];
  return nums[Math.floor(nums.length / 2)].v;
}

/**
 * Merges several extraction records into one by per-field consensus, so
 * non-deterministic misreads (wrong two-column pick, a rounded value) are
 * outvoted (SM-58). Passthrough fields (source_pages, filename) come from the
 * first record.
 * @param {ExtractionRecord[]} records - One record per run (each already
 *   schema-valid).
 * @returns {ExtractionRecord} The merged record.
 */
export function mergeRecords(records: ExtractionRecord[]): ExtractionRecord {
  if (records.length === 1) return records[0];
  const first = records[0] as Record<string, unknown>;
  const keys = new Set<string>();
  records.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));

  const merged: Record<string, unknown> = {};
  for (const key of keys) {
    if (PASSTHROUGH.has(key)) {
      merged[key] = first[key];
      continue;
    }
    const readings = records.map((r) => {
      const v = (r as Record<string, unknown>)[key];
      return v === undefined || v === null ? '' : String(v);
    });
    merged[key] = consensusValue(readings);
  }
  return merged as ExtractionRecord;
}
