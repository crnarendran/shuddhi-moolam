export const APP_ENV = process.env.APP_ENV || 'dev';

export const DRIVE_ROOT_FOLDER_ID =
  APP_ENV === 'prod' ? '1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb' :
    APP_ENV === 'staging' ? '19Dbuq7mq94oRninpgRmDLj7EGNmCqamb' :
      '1rvSE-rAW2mf1krmCepYM9va9oHoFEDNN';

export const MASTER_SHEET_ID =
  APP_ENV === 'prod' ? '1DNB8wkqGiVZ1fED4tSVI43PdNY6cY9NdYO6HsZJ-hoY' :
    APP_ENV === 'staging' ? '15xWbByMNZ8nyK9CObZfbQ-_YxGrUJEe8uwnIN4CpYcY' :
      '1XgYRTqWmiFoHmSrN-sWAxzDzxEl_YeKGeUk-XqMtpgE';

export const FIRESTORE_COLLECTION =
  APP_ENV === 'prod' ? 'pipeline_runs' :
    APP_ENV === 'staging' ? 'pipeline_runs_staging' :
      'pipeline_runs_dev';

export const HISTORICAL_COLLECTION =
  APP_ENV === 'prod' ? 'historical_prices' :
    APP_ENV === 'staging' ? 'historical_prices_staging' :
      'historical_prices_dev';
