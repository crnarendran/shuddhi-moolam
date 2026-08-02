export const APP_ENV = process.env.APP_ENV || 'dev';
const isProd = APP_ENV === 'prod' || APP_ENV === 'main';

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

