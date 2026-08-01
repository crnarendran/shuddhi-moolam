import { google } from 'googleapis';
import * as logger from 'firebase-functions/logger';
import { SHEET_HEADERS } from './constants';

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
export const sheetsClient = google.sheets({ version: 'v4', auth });

/**
 * Ensures that a tab named Data_<year> exists in the master sheet.
 * If it doesn't exist, it creates the tab and writes the canonical headers.
 * @param {number} year - The 4-digit year from the extraction record.
 * @returns {Promise<string>} The title of the tab (e.g. "Data_2026").
 */
export async function ensureYearTab(year: number): Promise<string> {
  const masterSheetId = process.env.MASTER_SHEET_ID;
  if (!masterSheetId) {
    throw new Error('MASTER_SHEET_ID environment variable not set.');
  }

  const tabTitle = `Data_${year}`;
  logger.info(`Checking for tab ${tabTitle} in sheet ${masterSheetId}`);

  const doc = await sheetsClient.spreadsheets.get({
    spreadsheetId: masterSheetId,
  });

  const existingSheet = doc.data.sheets?.find(
    (s) => s.properties?.title === tabTitle
  );

  if (existingSheet) {
    logger.info(`Tab ${tabTitle} already exists.`);
    return tabTitle;
  }

  logger.info(`Tab ${tabTitle} does not exist. Creating...`);

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId: masterSheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: tabTitle,
            },
          },
        },
      ],
    },
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId: masterSheetId,
    range: `${tabTitle}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [SHEET_HEADERS],
    },
  });

  logger.info(`Tab ${tabTitle} created with headers.`);
  return tabTitle;
}
