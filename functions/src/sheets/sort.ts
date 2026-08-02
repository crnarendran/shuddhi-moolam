import { sheetsClient } from './routing';
import { SHEET_HEADERS } from './constants';
import { MASTER_SHEET_ID } from '../config';

/**
 * Converts a dd/MM/yyyy date string into a sortable numeric key
 * (yyyymmdd). Unparseable input yields -1 so such rows sort last in a
 * descending sort.
 * @param {unknown} dateStr - The date value from column B.
 * @returns {number} A comparable numeric key.
 */
function dateSortKey(dateStr: unknown): number {
  if (typeof dateStr !== 'string') return -1;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return -1;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return -1;
  return year * 10000 + month * 100 + day;
}

/**
 * Re-sorts a year tab's data rows (row 2 onward; the header row is
 * preserved) so the newest issue date is on top. Sorts chronologically
 * by column B, not lexicographically; unparseable dates fall to the
 * bottom. A tab with 0 or 1 data rows is left untouched.
 * @param {string} tabTitle - The tab to sort (e.g. "2026").
 * @returns {Promise<void>} Resolves when the sort write completes.
 */
export async function sortTabByDateDesc(tabTitle: string): Promise<void> {
  const masterSheetId = MASTER_SHEET_ID;
  if (!masterSheetId) {
    throw new Error('MASTER_SHEET_ID environment variable not set.');
  }

  const endColumnLetter = String.fromCharCode(
    'A'.charCodeAt(0) + SHEET_HEADERS.length - 1
  );
  const range = `${tabTitle}!A2:${endColumnLetter}`;

  const resp = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: masterSheetId,
    range,
  });

  const rows = resp.data.values || [];
  if (rows.length < 2) return;

  const sorted = [...rows].sort(
    (a, b) => dateSortKey(b[1]) - dateSortKey(a[1])
  );

  const padded = sorted.map((row) => {
    const copy = [...row];
    while (copy.length < SHEET_HEADERS.length) copy.push('');
    return copy;
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId: masterSheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: padded },
  });
}
