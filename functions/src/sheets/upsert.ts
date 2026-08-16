import { sheetsClient } from './routing';
import { SHEET_HEADERS } from './constants';
import { ExtractionRecord } from '../gemini/schema';
import { MASTER_SHEET_ID } from '../config';
import { sortTabByDateDesc } from './sort';

/**
 * Maps the extraction record to an array of values in the order
 * defined by SHEET_HEADERS, and appends or updates the row in the
 * specified tab.
 *
 * Idempotency is enforced by checking if the date exists.
 * @param {string} tabTitle - The name of the tab to append to.
 * @param {ExtractionRecord} record - The extracted data record.
 * @param {boolean} skipSort - When true, skip the per-row re-sort (the
 *   caller is responsible for sorting once at the end — used by the bulk
 *   backfill to avoid one full-tab sort per row).
 * @returns {Promise<'insert' | 'update'>} Resolves when complete.
 */
export async function upsertRow(
  tabTitle: string,
  record: ExtractionRecord,
  skipSort = false
): Promise<'insert' | 'update'> {
  const masterSheetId = MASTER_SHEET_ID;
  if (!masterSheetId) {
    throw new Error('MASTER_SHEET_ID environment variable not set.');
  }

  record.last_modified_date = new Date().toISOString();

  // Map the record to a string/number array based on SHEET_HEADERS
  const rowArray = SHEET_HEADERS.map((header) => {
    const val = record[header as keyof ExtractionRecord];
    return val !== undefined ? val : '';
  });

  // Determine the column letter of the last header
  const endColumnLetter = String.fromCharCode(
    'A'.charCodeAt(0) + SHEET_HEADERS.length - 1
  );

  // 1. Fetch dates from column B (index 1) to see if we have a match
  const getResponse = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: masterSheetId,
    range: `${tabTitle}!B:B`, // date is in B
  });

  const rows = getResponse.data.values || [];
  let existingRowIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === record.date) {
      existingRowIndex = i + 1; // 1-indexed
      break;
    }
  }

  if (existingRowIndex > 0) {
    // 2. Update existing row
    const range =
      `${tabTitle}!A${existingRowIndex}:${endColumnLetter}${existingRowIndex}`;
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: masterSheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowArray],
      },
    });
    if (!skipSort) await sortTabByDateDesc(tabTitle);
    return 'update';
  } else {
    // 3. Append new row
    const range = `${tabTitle}!A:${endColumnLetter}`;
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: masterSheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowArray],
      },
    });
    if (!skipSort) await sortTabByDateDesc(tabTitle);
    return 'insert';
  }
}
