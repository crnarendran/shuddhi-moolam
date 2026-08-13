const mode = import.meta.env.MODE;

/**
 * The Vite deployment script sets --mode to the git branch name ('dev', 'staging', 'main').
 * If running locally, mode defaults to 'development'.
 */
const isProd = mode === 'main' || mode === 'prod';

/** 
 * Keep production pointing to the legacy 'companies' collection for zero-downtime.
 * Isolate staging and dev into their own silos. 
 */
export const COMPANIES_COLLECTION = isProd
  ? 'companies'
  : mode === 'staging'
  ? 'companies_staging'
  : 'companies_dev';
