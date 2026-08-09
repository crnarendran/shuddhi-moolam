import { extractPricesFromPdf } from './extract';
import { CORE_KEYS } from './components';

/**
 * Builds a minimal valid Gemini response: the issue date, every core
 * field set to the given value, and a source_pages string.
 * @param {string} value - The price value to assign to each core field.
 * @return {Record<string, string>} A schema-valid response object.
 */
function makeValidResponse(value: string): Record<string, string> {
  const resp: Record<string, string> = { date: '27/07/2026' };
  for (const k of CORE_KEYS) resp[k] = value;
  resp.source_pages = 'crca_bundle_mumbai: 7';
  return resp;
}

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
    const validResponse = makeValidResponse('123');

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
        // Missing date and other fields
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
    const validResponse = makeValidResponse('1');
    validResponse.source_pages = 'crca_bundle_mumbai: 1';

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
