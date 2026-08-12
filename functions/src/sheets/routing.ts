import { google } from 'googleapis';
import * as logger from 'firebase-functions/logger';
import { SHEET_HEADERS_FRIENDLY } from './constants';
import { MASTER_SHEET_ID } from '../config';

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
export const sheetsClient = google.sheets({ version: 'v4', auth });

/**
 * Ensures that a tab named <year> exists in the master sheet.
 * If it does not exist, it creates it using a predefined template.
 * @param {string} dateStr - The date string in dd/MM/yyyy format.
 * @returns {Promise<string>} The title of the tab (e.g. "2026").
 */
export async function ensureYearTab(dateStr: string): Promise<string> {
  const masterSheetId = MASTER_SHEET_ID;
  if (!masterSheetId) {
    throw new Error('MASTER_SHEET_ID environment variable not set.');
  }

  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format, expected dd/MM/yyyy: ${dateStr}`);
  }
  const yearStr = parts[2];
  if (yearStr.length !== 4) {
    throw new Error(`Invalid year format, expected 4 digits: ${yearStr}`);
  }

  const tabTitle = `${yearStr}`;
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

  // Initialize the headers
  await sheetsClient.spreadsheets.values.update({
    spreadsheetId: masterSheetId,
    range: `${tabTitle}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [SHEET_HEADERS_FRIENDLY],
    },
  });

  logger.info(`Tab ${tabTitle} created with headers.`);
  return tabTitle;
}
