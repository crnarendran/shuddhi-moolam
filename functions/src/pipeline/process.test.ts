import { processPendingPdf } from './process';
import { downloadPdf } from '../drive/download';
import { extractPricesConsensus } from '../gemini/extract';
import { ensureYearTab } from '../sheets/routing';
import { upsertRow } from '../sheets/upsert';
import { logAuditTrail } from '../sheets/audit';
import { sendAlert } from '../utils/alert';
import { recordStage } from './telemetry';

// Data returned by the SM-57 sticky-guard read of historical/<docId>.
// undefined → no manual override (normal path); set to a manual record to
// exercise the guard.
let mockManualDocData: Record<string, unknown> | undefined;

jest.mock('firebase-admin/firestore', () => {
  const setMock = jest.fn();
  const mockDoc = {
    set: setMock,
    // SM-57 sticky guard reads the existing historical doc here.
    get: jest.fn(() => Promise.resolve({ data: () => mockManualDocData })),
    collection: jest.fn(),
  };
  // The SM-56 outlier check queries recent history via
  // orderBy(...).limit(...).get(); declare those upfront so the chain works.
  const mockCollection = {
    doc: jest.fn(() => mockDoc),
    orderBy: jest.fn(),
    limit: jest.fn(),
    get: jest.fn(() => Promise.resolve({ docs: [] })),
  };
  mockCollection.orderBy.mockReturnValue(mockCollection);
  mockCollection.limit.mockReturnValue(mockCollection);
  mockDoc.collection.mockReturnValue(mockCollection);

  return {
    getFirestore: jest.fn(() => ({
      collection: jest.fn(() => mockCollection)
    })),
    FieldPath: { documentId: jest.fn(() => 'documentId') },
  };
});

jest.mock('firebase-functions/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
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
    mockManualDocData = undefined;
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
    (extractPricesConsensus as jest.Mock).mockResolvedValue({
      data: { date: '27/07/2026' },
      route: 'inline',
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
    expect(extractPricesConsensus).toHaveBeenCalled();
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
    expect(recordStage).toHaveBeenCalledWith('123', 'extracting', {
      fileName: 'test.pdf',
    });
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

  it('keeps a manual override: skips writes, flags disagreement', async () => {
    // inoculant is Rs/kg (not tonne→kg converted) so the raw value is the
    // final value — auto 308 vs stored manual 300 → material diff.
    mockManualDocData = {
      source: 'manual', inoculant_2_6mm_mumbai: '300',
    };
    (downloadPdf as jest.Mock).mockResolvedValue({
      buffer: Buffer.from('pdf'), filename: 'test.pdf',
    });
    (extractPricesConsensus as jest.Mock).mockResolvedValue({
      data: { date: '18/05/2026', inoculant_2_6mm_mumbai: '308' },
      route: 'inline',
      usage: {
        totalTokenCount: 10, promptTokenCount: 5, candidatesTokenCount: 5,
      },
    });

    const handler = processPendingPdf as unknown as {
      run: (e: unknown) => Promise<void>
    };
    await handler.run(mockEvent);

    // Neither store is overwritten.
    expect(upsertRow).not.toHaveBeenCalled();
    // The disagreement is surfaced.
    expect(sendAlert).toHaveBeenCalled();
    expect(recordStage).toHaveBeenCalledWith(
      '123', 'appended',
      expect.objectContaining({ manualOverrideKept: true })
    );
  });

  it('handles failures, records failed stage, alerts', async () => {
    const error = new Error('Extraction failed');
    (downloadPdf as jest.Mock).mockResolvedValue({
      buffer: Buffer.from('pdf'),
      filename: 'test.pdf'
    });
    (extractPricesConsensus as jest.Mock).mockRejectedValue(error);

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
