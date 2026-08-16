/* eslint-disable @typescript-eslint/no-explicit-any */
import { sortTabByDateDesc } from './sort';
import { sheetsClient } from './routing';
import { MASTER_SHEET_ID } from '../config';
import { SHEET_HEADERS } from './constants';

const END = String.fromCharCode('A'.charCodeAt(0) + SHEET_HEADERS.length - 1);

jest.mock('./routing', () => ({
  sheetsClient: {
    spreadsheets: {
      values: {
        get: jest.fn(),
        update: jest.fn(),
      },
    },
  },
}));

describe('sortTabByDateDesc', () => {
  afterEach(() => jest.clearAllMocks());

  it('rewrites data rows newest-first by dd/MM/yyyy date (col B)', async () => {
    (sheetsClient.spreadsheets.values.get as jest.Mock).mockResolvedValue({
      data: {
        values: [
          ['a.pdf', '06/04/2026', 'x'],
          ['b.pdf', '13/03/2026', 'y'],
          ['c.pdf', '27/07/2026', 'z'],
        ],
      },
    });

    await sortTabByDateDesc('2026');

    expect(sheetsClient.spreadsheets.values.get).toHaveBeenCalledWith({
      spreadsheetId: MASTER_SHEET_ID,
      range: `2026!A2:${END}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });
    const call = (sheetsClient.spreadsheets.values.update as jest.Mock).mock
      .calls[0][0];
    expect(call.range).toBe(`2026!A2:${END}`);
    const writtenDates = call.requestBody.values.map((r: any[]) => r[1]);
    expect(writtenDates).toEqual(['27/07/2026', '06/04/2026', '13/03/2026']);
  });

  it('sorts an unparseable date to the bottom', async () => {
    (sheetsClient.spreadsheets.values.get as jest.Mock).mockResolvedValue({
      data: {
        values: [
          ['a.pdf', 'N/A', 'x'],
          ['b.pdf', '27/07/2026', 'z'],
          ['c.pdf', '06/04/2026', 'y'],
        ],
      },
    });

    await sortTabByDateDesc('2026');

    const call = (sheetsClient.spreadsheets.values.update as jest.Mock).mock
      .calls[0][0];
    const writtenDates = call.requestBody.values.map((r: any[]) => r[1]);
    expect(writtenDates).toEqual(['27/07/2026', '06/04/2026', 'N/A']);
  });

  it('preserves decimal kg prices (no rounding round-trip)', async () => {
    // Regression: an earlier version read FORMATTED_VALUE, so a 47.5 shown
    // under a 0-decimal column format read back as "48" and got persisted,
    // rounding the sheet. With UNFORMATTED_VALUE the true 47.5 survives.
    (sheetsClient.spreadsheets.values.get as jest.Mock).mockResolvedValue({
      data: {
        values: [
          ['a.pdf', '06/04/2026', 47.5, 53.3],
          ['b.pdf', '27/07/2026', 48, 50],
        ],
      },
    });

    await sortTabByDateDesc('2026');

    const call = (sheetsClient.spreadsheets.values.update as jest.Mock).mock
      .calls[0][0];
    const written = call.requestBody.values;
    // newest (27/07) first, then 06/04 with its decimals intact
    expect(written[1][2]).toBe(47.5);
    expect(written[1][3]).toBe(53.3);
  });

  it('does nothing when there are 0 or 1 data rows', async () => {
    (sheetsClient.spreadsheets.values.get as jest.Mock).mockResolvedValue({
      data: { values: [['a.pdf', '27/07/2026', 'z']] },
    });

    await sortTabByDateDesc('2026');

    expect(sheetsClient.spreadsheets.values.update).not.toHaveBeenCalled();
  });
});
