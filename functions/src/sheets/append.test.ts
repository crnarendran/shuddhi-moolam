import { appendRow } from './append';
import { sheetsClient } from './routing';
import { ExtractionRecord } from '../gemini/schema';

// mock the google sheets client
jest.mock('./routing', () => ({
  sheetsClient: {
    spreadsheets: {
      values: {
        append: jest.fn(),
      },
    },
  },
}));

describe('appendRow', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps record to row and appends to sheet', async () => {
    const record: ExtractionRecord = {
      newsletter_issue_date: '2026-08-01',
      year: 2026,
      crca_bundle_mumbai: '100',
      crca_bundle_chennai: '110',
      melting_foundry_scrap_mumbai: '120',
      fe_mn_hc_mumbai: '130',
      fe_si_70_75_mumbai: '140',
      low_sulp_cal_petro_coke: '150',
      fe_si_mg_mumbai: '160',
      cu_lme: '170',
      cu_domestic: '180',
      fe_cr_mumbai: '190',
      pig_iron_foundry_gr_pune: '200',
    };

    process.env.MASTER_SHEET_ID = 'test-sheet-id';

    await appendRow('Data_2026', record);

    expect(sheetsClient.spreadsheets.values.append).toHaveBeenCalledTimes(1);
    expect(sheetsClient.spreadsheets.values.append).toHaveBeenCalledWith({
      spreadsheetId: 'test-sheet-id',
      range: 'Data_2026!A:M',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            '2026-08-01',
            2026,
            '100',
            '110',
            '120',
            '130',
            '140',
            '150',
            '160',
            '170',
            '180',
            '190',
            '200'
          ]
        ]
      }
    });
  });
});
