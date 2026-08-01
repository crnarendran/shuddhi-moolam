import { processPendingPdf } from './process';
import { downloadPdf } from '../drive/download';
import { extractPricesFromPdf } from '../gemini/extract';
import { ensureYearTab } from '../sheets/routing';
import { appendRow } from '../sheets/append';
import { sendAlert } from '../utils/alert';
import { recordStage } from './telemetry';

jest.mock('firebase-admin/firestore');
jest.mock('firebase-functions/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../drive/download');
jest.mock('../gemini/extract');
jest.mock('../sheets/routing');
jest.mock('../sheets/append');
jest.mock('../utils/alert');
jest.mock('./telemetry');

describe('processPendingPdf', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEvent = {
    params: { fileId: '123' },
    data: {
      before: { data: () => ({ status: 'pending' }) },
      after: { data: () => ({ status: 'detected' }) }
    },
  };

  it('should successfully process a PDF end-to-end', async () => {
    (downloadPdf as jest.Mock).mockResolvedValue(Buffer.from('pdf'));
    (extractPricesFromPdf as jest.Mock).mockResolvedValue({
      data: { year: 2026 },
      usage: {
        totalTokenCount: 150,
        promptTokenCount: 100,
        candidatesTokenCount: 50
      },
    });
    (ensureYearTab as jest.Mock).mockResolvedValue('2026');
    (appendRow as jest.Mock).mockResolvedValue(undefined);

    // Cast handler to unknown then invoke
    const handler = processPendingPdf as unknown as {
      run: (e: unknown) => Promise<void>
    };
    await handler.run(mockEvent);

    expect(downloadPdf).toHaveBeenCalledWith('123');
    expect(extractPricesFromPdf).toHaveBeenCalled();
    expect(ensureYearTab).toHaveBeenCalledWith(2026);
    expect(appendRow).toHaveBeenCalledWith('2026', { year: 2026 });
    expect(recordStage).toHaveBeenCalledWith('123', 'downloading');
    expect(recordStage).toHaveBeenCalledWith('123', 'extracting');
    expect(recordStage).toHaveBeenCalledWith('123', 'routing');
    expect(recordStage).toHaveBeenCalledWith(
      '123',
      'appended',
      expect.objectContaining({
        gemini: { tokensIn: 100, tokensOut: 50 },
        year: 2026,
        targetTab: '2026',
      })
    );
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('handles failures, records failed stage, alerts', async () => {
    const error = new Error('Extraction failed');
    (downloadPdf as jest.Mock).mockResolvedValue(Buffer.from('pdf'));
    (extractPricesFromPdf as jest.Mock).mockRejectedValue(error);

    const handler = processPendingPdf as unknown as {
      run: (e: unknown) => Promise<void>
    };
    await handler.run(mockEvent);

    expect(recordStage).toHaveBeenCalledWith('123', 'failed', {
      error: { stage: 'process', message: 'Extraction failed' }
    });
    expect(sendAlert).toHaveBeenCalledWith(
      'Pipeline Extraction Failed',
      'File ID 123 failed to process: Extraction failed',
      '123'
    );
  });
});
