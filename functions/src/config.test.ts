/**
 * Guards the environment-resolution invariant (retro-2026-08-12 #1):
 * the deploy workflow sets APP_ENV from the branch name, so production
 * arrives as 'main' (NOT 'prod'). Both must resolve to production
 * resources; a regression here silently routes prod to dev data.
 */

/**
 * Load a fresh copy of ./config with APP_ENV set to `env`.
 * @param {string} env The APP_ENV value to simulate.
 * @returns {typeof import('./config')} The re-evaluated config module.
 */
function loadConfig(env: string): typeof import('./config') {
  process.env.APP_ENV = env;
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('./config') as typeof import('./config');
}

describe('config environment resolution', () => {
  const original = process.env.APP_ENV;

  afterEach(() => {
    process.env.APP_ENV = original;
    jest.resetModules();
  });

  it('treats APP_ENV=main as production', () => {
    const c = loadConfig('main');
    expect(c.FIRESTORE_COLLECTION).toBe('pipeline_runs');
    expect(c.HISTORICAL_COLLECTION).toBe('historical_prices');
  });

  it('treats APP_ENV=prod as production', () => {
    const c = loadConfig('prod');
    expect(c.FIRESTORE_COLLECTION).toBe('pipeline_runs');
    expect(c.HISTORICAL_COLLECTION).toBe('historical_prices');
  });

  it('uses staging resources for APP_ENV=staging', () => {
    const c = loadConfig('staging');
    expect(c.FIRESTORE_COLLECTION).toBe('pipeline_runs_staging');
    expect(c.HISTORICAL_COLLECTION).toBe('historical_prices_staging');
  });

  it('uses dev resources for APP_ENV=dev', () => {
    const c = loadConfig('dev');
    expect(c.FIRESTORE_COLLECTION).toBe('pipeline_runs_dev');
    expect(c.HISTORICAL_COLLECTION).toBe('historical_prices_dev');
  });
});
