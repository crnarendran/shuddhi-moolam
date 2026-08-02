/* eslint-disable @typescript-eslint/no-explicit-any */
import { upsertRow } from './upsert';
import { sheetsClient } from './routing';
import { MASTER_SHEET_ID } from '../config';
import { ExtractionRecord } from '../gemini/schema';

// mock the google sheets client
jest.mock('./routing', () => ({
  sheetsClient: {
    spreadsheets: {
      values: {
        append: jest.fn(),
        get: jest.fn(),
        update: jest.fn(),
      },
    },
  },
}));

// keep the post-write sort a no-op here so upsert's own read/write
// assertions are unaffected (sort has its own tests in sort.test.ts)
jest.mock('./sort');

describe('upsertRow', () => {
  const mockDate = new Date('2026-08-02T12:00:00Z');
  let RealDate: DateConstructor;

  beforeAll(() => {
    RealDate = global.Date;
    const mockDateFn = function(this: Date, ...args: any[]) {
      if (args.length === 0) return mockDate;
      return new (RealDate as any)(...args);
    };
    mockDateFn.now = () => mockDate.getTime();
    global.Date = mockDateFn as any;
  });

  afterAll(() => {
    global.Date = RealDate;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockRecord: ExtractionRecord = {
    filename: 'test.pdf',
    date: '27/07/2026',
    crca_bundle_mumbai: '47,500',
    crca_bundle_chennai: '48,000',
    melting_foundry_scrap_mumbai: '46,500',
    fe_mn_hc_mumbai: '95',
    fe_si_70_75_mumbai: '109',
    low_sulp_cal_petro_coke: '59',
    fe_si_mg_mumbai: '190',
    cu_lme: '13617',
    cu_domestic: '1,390,103',
    fe_cr_mumbai: '140',
    pig_iron_foundry_gr_pune: '48,000',
    source_pages: 'crca_bundle_mumbai: 4',
  };

  const expectedValues = [
    [
      'test.pdf',
      '27/07/2026',
      '47,500',
      '48,000',
      '46,500',
      '95',
      '109',
      '59',
      '190',
      '13617',
      '1,390,103',
      '140',
      '48,000',
      'crca_bundle_mumbai: 4',
      '2026-08-02T12:00:00.000Z',
    ]
  ];

  it('maps record to row and appends to sheet if date not found', async () => {
    (sheetsClient.spreadsheets.values.get as jest.Mock).mockResolvedValue({
      data: { values: [['15/07/2026'], ['20/07/2026']] }
    });

    const action = await upsertRow('Data_2026', { ...mockRecord });

    expect(action).toBe('insert');
    expect(sheetsClient.spreadsheets.values.get).toHaveBeenCalledWith({
      spreadsheetId: MASTER_SHEET_ID,
      range: 'Data_2026!B:B'
    });
    expect(sheetsClient.spreadsheets.values.append).toHaveBeenCalledTimes(1);
    expect(sheetsClient.spreadsheets.values.append).toHaveBeenCalledWith({
      spreadsheetId: MASTER_SHEET_ID,
      range: 'Data_2026!A:O',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: expectedValues }
    });
    expect(sheetsClient.spreadsheets.values.update).not.toHaveBeenCalled();
  });

  it('updates existing row if date is found', async () => {
    (sheetsClient.spreadsheets.values.get as jest.Mock).mockResolvedValue({
      data: { values: [['15/07/2026'], ['27/07/2026']] }
    }); // Match at index 1 -> row 2

    const action = await upsertRow('Data_2026', { ...mockRecord });

    expect(action).toBe('update');
    expect(sheetsClient.spreadsheets.values.append).not.toHaveBeenCalled();
    expect(sheetsClient.spreadsheets.values.update).toHaveBeenCalledTimes(1);
    expect(sheetsClient.spreadsheets.values.update).toHaveBeenCalledWith({
      spreadsheetId: MASTER_SHEET_ID,
      range: 'Data_2026!A2:O2',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: expectedValues }
    });
  });
});
