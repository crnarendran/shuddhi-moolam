import { sheetsClient } from './routing';
import { SHEET_HEADERS } from './constants';
import { ExtractionRecord } from '../gemini/schema';
import { MASTER_SHEET_ID } from '../config';

/**
 * Maps the extraction record to an array of values in the order
 * defined by SHEET_HEADERS, and appends the row to the specified tab.
 *
 * Idempotency is enforced by the caller (the router) using the
 * Firestore processed store (SM-03).
 * @param {string} tabTitle - The name of the tab to append to.
 * @param {ExtractionRecord} record - The extracted data record.
 * @returns {Promise<void>} Resolves when the append is complete.
 */
export async function appendRow(
  tabTitle: string,
  record: ExtractionRecord
): Promise<void> {
  const masterSheetId = MASTER_SHEET_ID;
  if (!masterSheetId) {
    throw new Error('MASTER_SHEET_ID environment variable not set.');
  }

  // Map the record to a string/number array based on SHEET_HEADERS
  const rowArray = SHEET_HEADERS.map((header) => {
    const val = record[header as keyof ExtractionRecord];
    return val !== undefined ? val : '';
  });

  // Determine the column letter of the last header
  const endColumnLetter = String.fromCharCode(
    'A'.charCodeAt(0) + SHEET_HEADERS.length - 1
  );
  const range = `${tabTitle}!A:${endColumnLetter}`;

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId: masterSheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [rowArray],
    },
  });
}
