/* eslint-disable @typescript-eslint/no-explicit-any */
import { upsertRow } from './upsert';
import { sheetsClient } from './routing';
import { MASTER_SHEET_ID } from '../config';
import { ExtractionRecord } from '../gemini/schema';
import { SHEET_HEADERS } from './constants';

// End column letter derived from the header count, so these assertions
// track the registry instead of hard-coding a column.
const END = String.fromCharCode('A'.charCodeAt(0) + SHEET_HEADERS.length - 1);

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
    aluminium_ingot: '339',
    copper_cathode: '1,326',
    tin_ingot: '5,349',
    melting_foundry_scrap_mumbai: '46,500',
    crca_bundle_mumbai: '47,500',
    crca_bundle_chennai: '48,000',
    pig_iron_sg_grade_a_pune: '49,500',
    pig_iron_foundry_gr_pune: '48,000',
    fe_si_70_75_mumbai: '109',
    fe_mn_hc_mumbai: '95',
    inoculant_2_6mm_mumbai: '208',
    fe_cr_mumbai: '140',
    fe_si_mg_mumbai: '190',
    low_sulp_cal_petro_coke: '59',
    calcinated_petroleum_coke_9_4mm: '80',
    lam_coke: '35,000',
    // extended fields are captured in Firestore but must NOT reach the Sheet
    sponge_iron_mg_punjab: '27,500',
    fe_si_70_75_raipur: '110',
    source_pages: 'crca_bundle_mumbai: 7',
  };

  // Derive the expected row straight from SHEET_HEADERS so this can never
  // drift from the registry, and prove extended fields are excluded.
  const expectedValues = [
    SHEET_HEADERS.map((h) => {
      if (h === 'last_modified_date') return '2026-08-02T12:00:00.000Z';
      const v = (mockRecord as Record<string, string>)[h];
      return v !== undefined ? v : '';
    }),
  ];

  it('inserts at the next aligned row (not append) if date not found',
    async () => {
      (sheetsClient.spreadsheets.values.get as jest.Mock).mockResolvedValue({
        // 2 existing column-B rows → new row goes at row 3, column A.
        data: { values: [['15/07/2026'], ['20/07/2026']] }
      });

      const action = await upsertRow('Data_2026', { ...mockRecord });

      expect(action).toBe('insert');
      expect(sheetsClient.spreadsheets.values.get).toHaveBeenCalledWith({
        spreadsheetId: MASTER_SHEET_ID,
        range: 'Data_2026!B:B'
      });
      // Must NOT use append (its table-detection can misalign the row).
      expect(sheetsClient.spreadsheets.values.append).not.toHaveBeenCalled();
      expect(sheetsClient.spreadsheets.values.update).toHaveBeenCalledTimes(1);
      expect(sheetsClient.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: MASTER_SHEET_ID,
        range: `Data_2026!A3:${END}3`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: expectedValues }
      });
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
      range: `Data_2026!A2:${END}2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: expectedValues }
    });
  });
});
