import { processPendingPdf } from './process';
import { downloadPdf } from '../drive/download';
import { extractPricesConsensus } from '../gemini/extract';
import { ensureYearTab } from '../sheets/routing';
import { upsertRow } from '../sheets/upsert';
import { logAuditTrail } from '../sheets/audit';
import { sendAlert } from '../utils/alert';
import { recordStage } from './telemetry';
import {
  sendPipelineSuccessEmail,
  sendPipelineFailureEmail,
  resolveOutcomeRecipients,
} from './outcomeEmail';

// Data returned by the SM-57 sticky-guard read of historical/<docId>.
// undefined → no manual override (normal path); set to a manual record to
// exercise the guard.
let mockManualDocData: Record<string, unknown> | undefined;
let mockPreviousDocData: Record<string, unknown> | null = null;
let mockPreviousDocs: Array<Record<string, unknown>> | null = null;
let mockPreviousQueryThrows = false;
let lastWhereArgs: unknown[] = [];

jest.mock('firebase-admin/firestore', () => {
  const setMock = jest.fn();
  const mockDoc = {
    set: setMock,
    // SM-57 sticky guard reads the existing historical doc here.
    get: jest.fn(() => Promise.resolve({ data: () => mockManualDocData })),
    collection: jest.fn(),
  };

  const createQuery = (hasWhere = false) => {
    const q: {
      doc: jest.Mock;
      where: jest.Mock;
      orderBy: jest.Mock;
      limit: jest.Mock;
      get: jest.Mock;
    } = {
      doc: jest.fn(() => mockDoc),
      where: jest.fn((...args: unknown[]) => {
        lastWhereArgs = args;
        return createQuery(true);
      }),
      orderBy: jest.fn(() => createQuery(hasWhere)),
      limit: jest.fn(() => createQuery(hasWhere)),
      get: jest.fn(() => {
        if (hasWhere) {
          if (mockPreviousQueryThrows) {
            return Promise.reject(new Error('Firestore read error'));
          }
          if (mockPreviousDocs && mockPreviousDocs.length > 0) {
            return Promise.resolve({
              empty: false,
              docs: mockPreviousDocs.map((d, i) => ({
                id: `prev-${i}`,
                data: () => d,
              })),
            });
          }
          if (!mockPreviousDocData) {
            return Promise.resolve({ empty: true, docs: [] });
          }
          return Promise.resolve({
            empty: false,
            docs: [{ id: 'prev-id', data: () => mockPreviousDocData }],
          });
        }
        return Promise.resolve({ empty: true, docs: [] });
      }),
    };
    return q;
  };

  const mockCollection = createQuery(false);
  mockDoc.collection.mockReturnValue(mockCollection);

  return {
    getFirestore: jest.fn(() => ({
      collection: jest.fn(() => mockCollection),
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
jest.mock('./outcomeEmail');

describe('processPendingPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockManualDocData = undefined;
    mockPreviousDocData = null;
    mockPreviousDocs = null;
    mockPreviousQueryThrows = false;
    lastWhereArgs = [];
    (resolveOutcomeRecipients as jest.Mock).mockReturnValue([
      'uploader@example.com',
      'crnarendran@gmail.com',
      'mvsaikishore@gmail.com',
    ]);
    (sendPipelineSuccessEmail as jest.Mock).mockResolvedValue(true);
    (sendPipelineFailureEmail as jest.Mock).mockResolvedValue(true);
  });

  const mockEvent = {
    params: { fileId: '123' },
    data: {
      before: { data: () => ({ status: 'pending' }) },
      after: { data: () => ({ status: 'detected', detectedAt: 1000 }) },
    },
  };

  it('should successfully process a PDF end-to-end', async () => {
    (downloadPdf as jest.Mock).mockResolvedValue({
      buffer: Buffer.from('pdf'),
      filename: 'test.pdf',
      uploaderEmail: 'uploader@example.com',
    });
    (extractPricesConsensus as jest.Mock).mockResolvedValue({
      data: { date: '27/07/2026' },
      route: 'inline',
      usage: {
        totalTokenCount: 150,
        promptTokenCount: 100,
        candidatesTokenCount: 50,
      },
    });
    (ensureYearTab as jest.Mock).mockResolvedValue('2026');
    (upsertRow as jest.Mock).mockResolvedValue('insert');
    (logAuditTrail as jest.Mock).mockResolvedValue(undefined);

    // Cast handler to unknown then invoke
    const handler = processPendingPdf as unknown as {
      run: (e: unknown) => Promise<void>;
    };
    await handler.run(mockEvent);

    expect(downloadPdf).toHaveBeenCalledWith('123');
    expect(extractPricesConsensus).toHaveBeenCalled();
    expect(ensureYearTab).toHaveBeenCalledWith('27/07/2026');
    expect(upsertRow).toHaveBeenCalledWith('2026', {
      date: '27/07/2026',
      filename: 'test.pdf',
    });
    expect(logAuditTrail).toHaveBeenCalledWith('insert', {
      date: '27/07/2026',
      filename: 'test.pdf',
    });
    expect(recordStage).toHaveBeenCalledWith('123', 'downloading');
    expect(recordStage).toHaveBeenCalledWith('123', 'extracting', {
      fileName: 'test.pdf',
      uploaderEmail: 'uploader@example.com',
    });
    expect(recordStage).toHaveBeenCalledWith('123', 'routing');
    expect(recordStage).toHaveBeenCalledWith('123', 'upserting');
    expect(sendPipelineSuccessEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'test.pdf',
        fileId: '123',
        tabTitle: '2026',
        action: 'insert',
        uploaderEmail: 'uploader@example.com',
      })
    );
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
        notification: {
          emailSent: true,
          recipients: expect.any(Array),
          sentAt: expect.any(Number),
        },
      })
    );
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('keeps a manual override: skips writes, flags disagreement',
    async () => {
      mockManualDocData = {
        source: 'manual',
        inoculant_2_6mm_mumbai: '300',
      };
      (downloadPdf as jest.Mock).mockResolvedValue({
        buffer: Buffer.from('pdf'),
        filename: 'test.pdf',
        uploaderEmail: 'uploader@example.com',
      });
      (extractPricesConsensus as jest.Mock).mockResolvedValue({
        data: { date: '18/05/2026', inoculant_2_6mm_mumbai: '308' },
        route: 'inline',
        usage: {
          totalTokenCount: 10,
          promptTokenCount: 5,
          candidatesTokenCount: 5,
        },
      });

      const handler = processPendingPdf as unknown as {
        run: (e: unknown) => Promise<void>;
      };
      await handler.run(mockEvent);

      expect(upsertRow).not.toHaveBeenCalled();
      expect(sendAlert).toHaveBeenCalled();
      expect(sendPipelineSuccessEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'test.pdf',
          fileId: '123',
          action: 'MANUAL_OVERRIDE_KEPT',
          autoVsManualDiffs: expect.any(Array),
        })
      );
      expect(recordStage).toHaveBeenCalledWith(
        '123',
        'appended',
        expect.objectContaining({
          manualOverrideKept: true,
          notification: expect.objectContaining({ emailSent: true }),
        })
      );
    }
  );

  it('queries strictly earlier docId and passes previousRecord to email',
    async () => {
      mockPreviousDocData = {
        date: '20/07/2026',
        copper_cathode: '1379.60',
      };
      (downloadPdf as jest.Mock).mockResolvedValue({
        buffer: Buffer.from('pdf'),
        filename: 'test.pdf',
        uploaderEmail: 'uploader@example.com',
      });
      (extractPricesConsensus as jest.Mock).mockResolvedValue({
        data: { date: '27/07/2026', copper_cathode: '1392.00' },
        route: 'inline',
        usage: { totalTokenCount: 100 },
      });
      (ensureYearTab as jest.Mock).mockResolvedValue('2026');
      (upsertRow as jest.Mock).mockResolvedValue('insert');

      const handler = processPendingPdf as unknown as {
        run: (e: unknown) => Promise<void>;
      };
      await handler.run(mockEvent);

      expect(lastWhereArgs).toEqual(['documentId', '<', '2026-07-27']);
      expect(sendPipelineSuccessEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          previousRecord: mockPreviousDocData,
        })
      );
    }
  );

  it('selects closest earlier issue when multiple earlier docs exist',
    async () => {
      const earlier1 = { date: '13/07/2026', copper_cathode: '1350' };
      const earlier2 = { date: '20/07/2026', copper_cathode: '1379' };
      mockPreviousDocs = [earlier1, earlier2];
      (downloadPdf as jest.Mock).mockResolvedValue({
        buffer: Buffer.from('pdf'),
        filename: 'test.pdf',
        uploaderEmail: 'uploader@example.com',
      });
      (extractPricesConsensus as jest.Mock).mockResolvedValue({
        data: { date: '27/07/2026', copper_cathode: '1392' },
        route: 'inline',
        usage: { totalTokenCount: 100 },
      });
      (ensureYearTab as jest.Mock).mockResolvedValue('2026');
      (upsertRow as jest.Mock).mockResolvedValue('insert');

      const handler = processPendingPdf as unknown as {
        run: (e: unknown) => Promise<void>;
      };
      await handler.run(mockEvent);

      expect(sendPipelineSuccessEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          previousRecord: earlier2,
        })
      );
    }
  );

  it('tolerates previous issue lookup failure and still sends success email',
    async () => {
      mockPreviousQueryThrows = true;
      (downloadPdf as jest.Mock).mockResolvedValue({
        buffer: Buffer.from('pdf'),
        filename: 'test.pdf',
        uploaderEmail: 'uploader@example.com',
      });
      (extractPricesConsensus as jest.Mock).mockResolvedValue({
        data: { date: '27/07/2026' },
        route: 'inline',
        usage: { totalTokenCount: 100 },
      });
      (ensureYearTab as jest.Mock).mockResolvedValue('2026');
      (upsertRow as jest.Mock).mockResolvedValue('insert');

      const handler = processPendingPdf as unknown as {
        run: (e: unknown) => Promise<void>;
      };
      await handler.run(mockEvent);

      expect(sendPipelineSuccessEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          previousRecord: null,
        })
      );
    }
  );

  it('handles failures, records failed stage, alerts', async () => {
    const error = new Error('Extraction failed');
    (downloadPdf as jest.Mock).mockResolvedValue({
      buffer: Buffer.from('pdf'),
      filename: 'test.pdf',
      uploaderEmail: 'uploader@example.com',
    });
    (extractPricesConsensus as jest.Mock).mockRejectedValue(error);

    const handler = processPendingPdf as unknown as {
      run: (e: unknown) => Promise<void>;
    };
    await handler.run(mockEvent);

    expect(sendPipelineFailureEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: '123',
        filename: 'test.pdf',
        failingStage: 'extracting',
        errorMessage: 'Extraction failed',
        uploaderEmail: 'uploader@example.com',
      })
    );
    expect(recordStage).toHaveBeenCalledWith('123', 'failed', {
      error: { stage: 'extracting', message: 'Extraction failed' },
      notification: {
        emailSent: true,
        recipients: expect.any(Array),
        sentAt: expect.any(Number),
      },
    });
    expect(sendAlert).toHaveBeenCalledWith(
      'Pipeline Extraction Failed',
      'File ID 123 failed to process: Extraction failed',
      '123'
    );
  });
});
