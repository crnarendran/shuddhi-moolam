import { extractPricesFromPdf } from './extract';
import { CORE_KEYS } from './components';

/**
 * Builds a minimal valid Gemini response: the issue date, every core
 * field set to the given value, and a source_pages string.
 * @param {string} value - The price value to assign to each core field.
 * @returns {Record<string, string>} A schema-valid response object.
 */
function makeValidResponse(value: string): Record<string, string> {
  const resp: Record<string, string> = { date: '27/07/2026' };
  for (const k of CORE_KEYS) resp[k] = value;
  resp.source_pages = 'crca_bundle_mumbai: 7';
  return resp;
}

const mockGenerateContent = jest.fn();
const mockUploadFile = jest.fn();
const mockGetFile = jest.fn();
const mockDeleteFile = jest.fn();

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

jest.mock('@google/generative-ai/server', () => ({
  GoogleAIFileManager: jest.fn().mockImplementation(() => ({
    uploadFile: mockUploadFile,
    getFile: mockGetFile,
    deleteFile: mockDeleteFile,
  })),
  FileState: { PROCESSING: 'PROCESSING', ACTIVE: 'ACTIVE', FAILED: 'FAILED' },
}));

/**
 * Sets the File-API mock to return a file already in the given state.
 * @param {string} state - The FileState value to report.
 * @returns {void}
 */
function mockUploadState(state: string): void {
  mockUploadFile.mockResolvedValue({
    file: {
      name: 'files/abc',
      uri: 'https://generativelanguage.googleapis.com/v1/files/abc',
      mimeType: 'application/pdf',
      state,
    },
  });
}

describe('Extract Prices from PDF', () => {
  const dummyBuffer = Buffer.from('dummy-pdf-content');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
    // Default: upload succeeds and the file is immediately ACTIVE.
    mockUploadState('ACTIVE');
    mockDeleteFile.mockResolvedValue(undefined);
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
        candidatesTokenCount: 0,
        thoughtsTokenCount: 0
      }
    });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('captures reasoning tokens from usageMetadata', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(makeValidResponse('1')),
        usageMetadata: {
          totalTokenCount: 500,
          promptTokenCount: 100,
          candidatesTokenCount: 20,
          thoughtsTokenCount: 380,
        },
      },
    });

    const result = await extractPricesFromPdf(dummyBuffer);
    expect(result.usage.thoughtsTokenCount).toBe(380);
    expect(result.usage.candidatesTokenCount).toBe(20);
  });

  it('uploads via the File API and deletes the file afterward', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(makeValidResponse('1')),
        usageMetadata: { totalTokenCount: 10 },
      },
    });

    await extractPricesFromPdf(dummyBuffer);

    expect(mockUploadFile).toHaveBeenCalledTimes(1);
    expect(mockUploadFile).toHaveBeenCalledWith(
      dummyBuffer,
      expect.objectContaining({ mimeType: 'application/pdf' })
    );
    // The prompt is sent with a fileData part, not inline base64.
    const parts = mockGenerateContent.mock.calls[0][0];
    expect(parts[1]).toEqual({
      fileData: expect.objectContaining({ mimeType: 'application/pdf' }),
    });
    expect(mockDeleteFile).toHaveBeenCalledWith('files/abc');
  });

  it('polls until the uploaded file becomes ACTIVE', async () => {
    mockUploadState('PROCESSING');
    mockGetFile.mockResolvedValueOnce({
      name: 'files/abc',
      uri: 'https://x/files/abc',
      mimeType: 'application/pdf',
      state: 'ACTIVE',
    });
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(makeValidResponse('1')),
        usageMetadata: { totalTokenCount: 10 },
      },
    });

    await extractPricesFromPdf(dummyBuffer);
    expect(mockGetFile).toHaveBeenCalledWith('files/abc');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  }, 10000);

  it('throws if the File API reports a FAILED upload', async () => {
    mockUploadState('FAILED');
    await expect(extractPricesFromPdf(dummyBuffer)).rejects.toThrow(
      /File API failed/
    );
    expect(mockGenerateContent).not.toHaveBeenCalled();
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
        candidatesTokenCount: 0,
        thoughtsTokenCount: 0
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
