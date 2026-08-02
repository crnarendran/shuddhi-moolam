import { ensureYearTab, sheetsClient } from './routing';
import { MASTER_SHEET_ID } from '../config';

jest.mock('googleapis', () => {
  return {
    google: {
      sheets: jest.fn().mockReturnValue({
        spreadsheets: {
          get: jest.fn(),
          batchUpdate: jest.fn(),
          values: {
            update: jest.fn(),
            append: jest.fn(),
          },
        },
      }),
      auth: {
        GoogleAuth: jest.fn().mockImplementation(() => ({
          getClient: jest.fn().mockResolvedValue({}),
        })),
      },
    },
  };
});

describe('Sheets Routing Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
  });

  it('should reuse existing tab if found', async () => {
    (sheetsClient.spreadsheets.get as jest.Mock).mockResolvedValueOnce({
      data: {
        sheets: [{ properties: { title: '2026' } }],
      },
    });

    const title = await ensureYearTab(2026);
    expect(title).toBe('2026');
    expect(sheetsClient.spreadsheets.get).toHaveBeenCalledWith({
      spreadsheetId: MASTER_SHEET_ID,
    });
    expect(sheetsClient.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    expect(sheetsClient.spreadsheets.values.update).not.toHaveBeenCalled();
  });

  it('should create tab and insert headers if missing', async () => {
    (sheetsClient.spreadsheets.get as jest.Mock).mockResolvedValueOnce({
      data: {
        sheets: [{ properties: { title: 'Data_2025' } }], // Different year
      },
    });

    (sheetsClient.spreadsheets.batchUpdate as jest.Mock).mockResolvedValueOnce(
      {}
    );
    (
      sheetsClient.spreadsheets.values.update as jest.Mock
    ).mockResolvedValueOnce({});

    const title = await ensureYearTab(2026);
    expect(title).toBe('2026');

    expect(sheetsClient.spreadsheets.batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: MASTER_SHEET_ID,
      requestBody: expect.objectContaining({
        requests: [
          { addSheet: { properties: { title: '2026' } } },
        ],
      }),
    });

    // Writes headers
    expect(sheetsClient.spreadsheets.values.update).toHaveBeenCalledWith({
      spreadsheetId: MASTER_SHEET_ID,
      range: '2026!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: expect.objectContaining({
        values: expect.any(Array),
      }),
    });
  });
});
