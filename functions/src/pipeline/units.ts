import { COMPONENTS } from '../gemini/components';
import { type ExtractionRecord } from '../gemini/schema';

// Commodities the newsletter quotes in Rs/tonne.
const TONNE_KEYS = new Set(
  COMPONENTS.filter((c) => c.unit === 'Rs/tonne').map((c) => c.key)
);

/** Normalizes a raw price cell to a number (range midpoint), or null. */
function normalizePrice(raw: unknown): number | null {
  if (typeof raw !== 'string') {
    return typeof raw === 'number' && isFinite(raw) ? raw : null;
  }
  const parts = raw
    .split(/\s*(?:-|–|—|to)\s*/i)
    .map((p) => parseFloat(p.replace(/,/g, '').trim()))
    .filter((n) => !isNaN(n));
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/**
 * Returns a copy of an extraction record with every Rs/tonne commodity value
 * converted to Rs/kg (÷1000). A field that doesn't parse to a number is left
 * as-is (e.g. a blank cell).
 * Note: we convert the result back to string to satisfy the ExtractionRecord schema.
 * @param {ExtractionRecord} record - A raw record from extraction.
 * @returns {ExtractionRecord} A canonical (Rs/kg) copy.
 */
export function toKgRecord(record: ExtractionRecord): ExtractionRecord {
  const out: ExtractionRecord = { ...record };
  for (const key of TONNE_KEYS) {
    if (!(key in out)) continue;
    const val = out[key as keyof ExtractionRecord];
    const n = normalizePrice(val);
    if (n !== null) {
      (out as any)[key] = String(n / 1000);
    }
  }
  return out;
}
