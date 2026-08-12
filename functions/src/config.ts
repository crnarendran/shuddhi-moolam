export const APP_ENV = process.env.APP_ENV || 'dev';

/**
 * Whether an environment name denotes production. The deploy workflow sets
 * APP_ENV from the branch name, so production arrives as 'main' (not 'prod');
 * both must map to production. See knowledge/infrastructure.md.
 * @param {string} env The APP_ENV value (branch name at deploy time).
 * @returns {boolean} True for production ('prod' or 'main').
 */
export function isProduction(env: string): boolean {
  return env === 'prod' || env === 'main';
}

const isProd = isProduction(APP_ENV);

export const DRIVE_ROOT_FOLDER_ID =
  isProd ? '1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb' :
    APP_ENV === 'staging' ? '19Dbuq7mq94oRninpgRmDLj7EGNmCqamb' :
      '1rvSE-rAW2mf1krmCepYM9va9oHoFEDNN';

export const MASTER_SHEET_ID =
  isProd ? '1DNB8wkqGiVZ1fED4tSVI43PdNY6cY9NdYO6HsZJ-hoY' :
    APP_ENV === 'staging' ? '15xWbByMNZ8nyK9CObZfbQ-_YxGrUJEe8uwnIN4CpYcY' :
      '1XgYRTqWmiFoHmSrN-sWAxzDzxEl_YeKGeUk-XqMtpgE';

export const FIRESTORE_COLLECTION =
  isProd ? 'pipeline_runs' :
    APP_ENV === 'staging' ? 'pipeline_runs_staging' :
      'pipeline_runs_dev';

export const HISTORICAL_COLLECTION =
  isProd ? 'historical_prices' :
    APP_ENV === 'staging' ? 'historical_prices_staging' :
      'historical_prices_dev';

