/* eslint-disable @typescript-eslint/no-explicit-any */
import { sortTabByDateDesc } from './sort';
import { sheetsClient } from './routing';
import { MASTER_SHEET_ID } from '../config';

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
      range: '2026!A2:O',
    });
    const call = (sheetsClient.spreadsheets.values.update as jest.Mock).mock
      .calls[0][0];
    expect(call.range).toBe('2026!A2:O');
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

  it('does nothing when there are 0 or 1 data rows', async () => {
    (sheetsClient.spreadsheets.values.get as jest.Mock).mockResolvedValue({
      data: { values: [['a.pdf', '27/07/2026', 'z']] },
    });

    await sortTabByDateDesc('2026');

    expect(sheetsClient.spreadsheets.values.update).not.toHaveBeenCalled();
  });
});
