import { processPendingPdf } from './process';
import { downloadPdf } from '../drive/download';
import { extractPricesFromPdf } from '../gemini/extract';
import { ensureYearTab } from '../sheets/routing';
import { upsertRow } from '../sheets/upsert';
import { logAuditTrail } from '../sheets/audit';
import { sendAlert } from '../utils/alert';
import { recordStage } from './telemetry';

jest.mock('firebase-admin/firestore', () => {
  const setMock = jest.fn();
  const mockDoc = { set: setMock, collection: jest.fn() };
  const mockCollection = { doc: jest.fn(() => mockDoc) };
  mockDoc.collection.mockReturnValue(mockCollection);

  return {
    getFirestore: jest.fn(() => ({
      collection: jest.fn(() => mockCollection)
    })),
  };
});

jest.mock('firebase-functions/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../drive/download');
jest.mock('../gemini/extract');
jest.mock('../sheets/routing');
jest.mock('../sheets/upsert');
jest.mock('../sheets/audit');
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
      after: { data: () => ({ status: 'detected', detectedAt: 1000 }) }
    },
  };

  it('should successfully process a PDF end-to-end', async () => {
    (downloadPdf as jest.Mock).mockResolvedValue({
      buffer: Buffer.from('pdf'),
      filename: 'test.pdf'
    });
    (extractPricesFromPdf as jest.Mock).mockResolvedValue({
      data: { date: '27/07/2026' },
      usage: {
        totalTokenCount: 150,
        promptTokenCount: 100,
        candidatesTokenCount: 50
      },
    });
    (ensureYearTab as jest.Mock).mockResolvedValue('2026');
    (upsertRow as jest.Mock).mockResolvedValue('insert');
    (logAuditTrail as jest.Mock).mockResolvedValue(undefined);

    // Cast handler to unknown then invoke
    const handler = processPendingPdf as unknown as {
      run: (e: unknown) => Promise<void>
    };
    await handler.run(mockEvent);

    expect(downloadPdf).toHaveBeenCalledWith('123');
    expect(extractPricesFromPdf).toHaveBeenCalled();
    expect(ensureYearTab).toHaveBeenCalledWith('27/07/2026');
    expect(upsertRow).toHaveBeenCalledWith('2026', {
      date: '27/07/2026',
      filename: 'test.pdf'
    });
    expect(logAuditTrail).toHaveBeenCalledWith('insert', {
      date: '27/07/2026',
      filename: 'test.pdf'
    });
    expect(recordStage).toHaveBeenCalledWith('123', 'downloading');
    expect(recordStage).toHaveBeenCalledWith('123', 'extracting');
    expect(recordStage).toHaveBeenCalledWith('123', 'routing');
    expect(recordStage).toHaveBeenCalledWith(
      '123',
      'appended',
      expect.objectContaining({
        gemini: expect.objectContaining({
          tokensIn: 100,
          tokensOut: 50,
          estCostUsd: expect.any(Number),
        }),
        cost: { estimatedUsd: expect.any(Number) },
        durationMs: expect.any(Number),
        year: 2026,
        targetTab: '2026',
      })
    );
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('handles failures, records failed stage, alerts', async () => {
    const error = new Error('Extraction failed');
    (downloadPdf as jest.Mock).mockResolvedValue({
      buffer: Buffer.from('pdf'),
      filename: 'test.pdf'
    });
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
