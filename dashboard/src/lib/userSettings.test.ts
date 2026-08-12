import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  shouldMigrateWeights,
  effectiveKeys,
  globallyAllowedKeys,
  type Personalization,
} from './userSettings';

describe('mergeSettings', () => {
  it('shallow-merges top-level keys', () => {
    expect(mergeSettings({ updatedAt: 1 }, { updatedAt: 2 }).updatedAt).toBe(2);
  });

  it('deep-merges costImpact without dropping siblings', () => {
    const cur = { costImpact: { weights: { a: 1 } } };
    const r = mergeSettings(cur, { costImpact: { weights: { a: 2, b: 3 } } });
    expect(r.costImpact?.weights).toEqual({ a: 2, b: 3 });
  });

  it('leaves costImpact untouched when the patch omits it', () => {
    const cur = { costImpact: { weights: { a: 1 } } };
    const r = mergeSettings(cur, { updatedAt: 5 });
    expect(r.costImpact?.weights).toEqual({ a: 1 });
    expect(r.updatedAt).toBe(5);
  });

  it('never emits undefined fields (Firestore rejects them)', () => {
    // First-time personalization write with no costImpact set.
    const r = mergeSettings({}, {
      personalization: { globalExcluded: ['a'], reports: {} },
      updatedAt: 9,
    });
    expect('costImpact' in r).toBe(false);
    expect(Object.values(r).every((v) => v !== undefined)).toBe(true);
    expect(r.personalization?.globalExcluded).toEqual(['a']);
  });
});

describe('shouldMigrateWeights', () => {
  it('migrates when local weights exist and none are stored', () => {
    expect(shouldMigrateWeights(DEFAULT_SETTINGS, { a: 1 })).toBe(true);
  });

  it('does not migrate when the account already has weights', () => {
    expect(
      shouldMigrateWeights({ costImpact: { weights: { a: 1 } } }, { b: 2 })
    ).toBe(false);
  });

  it('does not migrate when there are no local weights', () => {
    expect(shouldMigrateWeights(DEFAULT_SETTINGS, null)).toBe(false);
    expect(shouldMigrateWeights(DEFAULT_SETTINGS, {})).toBe(false);
  });
});

describe('effectiveKeys (exclusion cascade)', () => {
  const all = ['a', 'b', 'c', 'd'];

  it('returns all keys when personalization is undefined', () => {
    expect(effectiveKeys(all, 'seasonal', undefined)).toEqual(all);
  });

  it('removes globally-excluded keys from every report', () => {
    const p: Personalization = { globalExcluded: ['b'], reports: {} };
    expect(effectiveKeys(all, 'seasonal', p)).toEqual(['a', 'c', 'd']);
    expect(effectiveKeys(all, 'spreads', p)).toEqual(['a', 'c', 'd']);
  });

  it('removes report-excluded keys only from that report', () => {
    const p: Personalization = {
      globalExcluded: [],
      reports: { seasonal: { excluded: ['c'] } },
    };
    expect(effectiveKeys(all, 'seasonal', p)).toEqual(['a', 'b', 'd']);
    expect(effectiveKeys(all, 'spreads', p)).toEqual(all);
  });

  it('does not double-count a key excluded both globally and per-report', () => {
    const p: Personalization = {
      globalExcluded: ['a'],
      reports: { seasonal: { excluded: ['a', 'b'] } },
    };
    expect(effectiveKeys(all, 'seasonal', p)).toEqual(['c', 'd']);
  });

  it('preserves input order', () => {
    const p: Personalization = { globalExcluded: ['a'], reports: {} };
    expect(effectiveKeys(all, 'seasonal', p)).toEqual(['b', 'c', 'd']);
  });
});

describe('globallyAllowedKeys', () => {
  it('is the report-level pool: all minus globalExcluded', () => {
    const p: Personalization = { globalExcluded: ['b', 'd'], reports: {} };
    expect(globallyAllowedKeys(['a', 'b', 'c', 'd'], p)).toEqual(['a', 'c']);
  });
});
