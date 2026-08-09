import { extractionRecordSchema } from './schema';
import {
  ALL_KEYS,
  CORE_KEYS,
  EXTENDED_KEYS,
  ARCHIVED_KEYS,
} from './components';

const META = ['filename', 'date', 'source_pages', 'last_modified_date'];

describe('extraction schema', () => {
  const shape = extractionRecordSchema.shape as Record<string, unknown>;
  const keys = Object.keys(shape);

  it('covers exactly the registry components plus metadata', () => {
    const priceKeys = keys.filter((k) => !META.includes(k));
    expect(priceKeys.sort()).toEqual([...ALL_KEYS].sort());
  });

  it('requires every core component (no optional core fields)', () => {
    for (const k of CORE_KEYS) {
      const field = shape[k] as { isOptional: () => boolean };
      expect(field.isOptional()).toBe(false);
    }
  });

  it('makes every non-core (extended + archived) component optional', () => {
    for (const k of [...EXTENDED_KEYS, ...ARCHIVED_KEYS]) {
      const field = shape[k] as { isOptional: () => boolean };
      expect(field.isOptional()).toBe(true);
    }
  });

  it('accepts a full record and rejects a missing core field', () => {
    const base: Record<string, string> = { date: '01/08/2026' };
    for (const k of CORE_KEYS) base[k] = '';
    base.source_pages = '';
    expect(() => extractionRecordSchema.parse(base)).not.toThrow();

    const missing = { ...base };
    delete missing.aluminium_ingot;
    expect(() => extractionRecordSchema.parse(missing)).toThrow();
  });
});
