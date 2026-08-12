/**
 * Guards the environment-resolution invariant (retro-2026-08-12 #1):
 * the deploy workflow sets APP_ENV from the branch name, so production
 * arrives as 'main' (NOT 'prod'). Both must map to production; a regression
 * here silently routes prod to dev data.
 *
 * Tests the pure `isProduction` predicate rather than the module constants,
 * because the deploy step `sed`-hardcodes APP_ENV before tests run, which
 * would otherwise pin the constants to a single env.
 */
import { isProduction } from './config';

describe('isProduction', () => {
  it('maps main (the prod branch name) to production', () => {
    expect(isProduction('main')).toBe(true);
  });

  it('maps prod to production', () => {
    expect(isProduction('prod')).toBe(true);
  });

  it('does not treat staging as production', () => {
    expect(isProduction('staging')).toBe(false);
  });

  it('does not treat dev as production', () => {
    expect(isProduction('dev')).toBe(false);
  });
});
