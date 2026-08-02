import { sheetsClient } from './routing';
import { SHEET_HEADERS } from './constants';
import { ExtractionRecord } from '../gemini/schema';
import { MASTER_SHEET_ID } from '../config';
import * as logger from 'firebase-functions/logger';

/**
 * Logs an audit trail row to Google Sheets
 * @param {'insert' | 'update'} action - The action performed
 * @param {ExtractionRecord} record - The extracted record
 */
export async function logAuditTrail(
  action: 'insert' | 'update',
  record: ExtractionRecord
): Promise<void> {
  const masterSheetId = MASTER_SHEET_ID;
  if (!masterSheetId) {
    throw new Error('MASTER_SHEET_ID environment variable not set.');
  }

  const timestamp = new Date().toISOString();

  // Map the record to a string/number array based on SHEET_HEADERS
  const recordValues = SHEET_HEADERS.map((header) => {
    const val = record[header as keyof ExtractionRecord];
    return val !== undefined ? val : '';
  });

  const rowArray = [timestamp, action, ...recordValues];

  const endColumnCode = 'A'.charCodeAt(0) + rowArray.length - 1;
  let endColumnLetter = '';
  if (endColumnCode > 'Z'.charCodeAt(0)) {
    endColumnLetter = 'A' + String.fromCharCode(endColumnCode - 26);
  } else {
    endColumnLetter = String.fromCharCode(endColumnCode);
  }

  const range = `Audit_Log!A:${endColumnLetter}`;

  try {
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: masterSheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowArray],
      },
    });
  } catch (error) {
    logger.error('Failed to write to Audit_Log', { error, record });
    throw error;
  }
}
