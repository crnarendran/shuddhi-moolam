import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  shouldMigrateWeights,
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
