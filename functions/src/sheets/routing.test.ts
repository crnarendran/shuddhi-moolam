import { ensureYearTab, sheetsClient } from './routing';

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
    process.env.MASTER_SHEET_ID = 'test-sheet-id';
  });

  afterEach(() => {
    delete process.env.MASTER_SHEET_ID;
  });

  it('should throw if MASTER_SHEET_ID is missing', async () => {
    delete process.env.MASTER_SHEET_ID;
    await expect(ensureYearTab(2026)).rejects.toThrow(
      'MASTER_SHEET_ID environment variable not set.'
    );
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
      spreadsheetId: 'test-sheet-id',
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
      spreadsheetId: 'test-sheet-id',
      requestBody: expect.objectContaining({
        requests: [
          { addSheet: { properties: { title: '2026' } } },
        ],
      }),
    });

    // Writes headers
    expect(sheetsClient.spreadsheets.values.update).toHaveBeenCalledWith({
      spreadsheetId: 'test-sheet-id',
      range: '2026!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: expect.objectContaining({
        values: expect.any(Array),
      }),
    });
  });
});
