import { extractPricesFromPdf } from './extract';

const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        }),
      };
    }),
  };
});

describe('Extract Prices from PDF', () => {
  const dummyBuffer = Buffer.from('dummy-pdf-content');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('should throw if GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(extractPricesFromPdf(dummyBuffer)).rejects.toThrow(
      'GEMINI_API_KEY environment variable not set.'
    );
  });

  it('should successfully extract and validate a full record', async () => {
    const validResponse = {
      newsletter_issue_date: 'JULY 27-AUGUST 02, 2026',
      year: 2026,
      crca_bundle_mumbai: '47,500 - 46,500',
      crca_bundle_chennai: '48,000',
      melting_foundry_scrap_mumbai: '',
      fe_mn_hc_mumbai: '123',
      fe_si_70_75_mumbai: '123',
      low_sulp_cal_petro_coke: '123',
      fe_si_mg_mumbai: '123',
      cu_lme: '123',
      cu_domestic: '123',
      fe_cr_mumbai: '123',
      pig_iron_foundry_gr_pune: '123',
    };

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(validResponse),
        usageMetadata: { totalTokenCount: 42 },
      },
    });

    const result = await extractPricesFromPdf(dummyBuffer);
    expect(result).toEqual({
      data: validResponse,
      usage: {
        totalTokenCount: 42,
        promptTokenCount: 0,
        candidatesTokenCount: 0
      }
    });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it(
    'should throw a validation error on missing fields without retrying',
    async () => {
      const invalidResponse = {
        newsletter_issue_date: 'JULY 27-AUGUST 02, 2026',
      // Missing year and other fields
      };

      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => JSON.stringify(invalidResponse) },
      });

      await expect(extractPricesFromPdf(dummyBuffer)).rejects.toThrow();
      // Should not retry on validation error
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

  it('should retry on transient errors and eventually succeed', async () => {
    const validResponse = {
      newsletter_issue_date: 'JULY 27-AUGUST 02, 2026',
      year: 2026,
      crca_bundle_mumbai: '1',
      crca_bundle_chennai: '1',
      melting_foundry_scrap_mumbai: '1',
      fe_mn_hc_mumbai: '1',
      fe_si_70_75_mumbai: '1',
      low_sulp_cal_petro_coke: '1',
      fe_si_mg_mumbai: '1',
      cu_lme: '1',
      cu_domestic: '1',
      fe_cr_mumbai: '1',
      pig_iron_foundry_gr_pune: '1',
    };

    mockGenerateContent
      .mockRejectedValueOnce(new Error('Transient network error'))
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(validResponse),
          usageMetadata: { totalTokenCount: 10 },
        },
      });

    const result = await extractPricesFromPdf(dummyBuffer);
    expect(result).toEqual({
      data: validResponse,
      usage: {
        totalTokenCount: 10,
        promptTokenCount: 0,
        candidatesTokenCount: 0
      }
    });
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  }, 10000); // increase timeout for retries

  it('should fail after max retries', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Persistent error'));

    await expect(extractPricesFromPdf(dummyBuffer)).rejects.toThrow(
      'Extraction failed: Persistent error'
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  }, 10000);
});
