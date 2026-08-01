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
    const mockRecord: ExtractionRecord = {
      newsletter_issue: 'JULY 27-AUGUST 02',
      month: 'JULY-AUGUST',
      year: 2026,
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

    process.env.MASTER_SHEET_ID = 'test-sheet-id';

    await appendRow('Data_2026', mockRecord);

    expect(sheetsClient.spreadsheets.values.append).toHaveBeenCalledTimes(1);
    expect(sheetsClient.spreadsheets.values.append).toHaveBeenCalledWith({
      spreadsheetId: 'test-sheet-id',
      range: 'Data_2026!A:O',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            'JULY 27-AUGUST 02',
            'JULY-AUGUST',
            2026,
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
          ]
        ]
      }
    });
  });
});
