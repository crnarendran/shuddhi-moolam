import { processPendingPdf } from './process';
import { downloadPdf } from '../drive/download';
import { extractPricesFromPdf } from '../gemini/extract';
import { ensureYearTab } from '../sheets/routing';
import { appendRow } from '../sheets/append';
import { sendAlert } from '../utils/alert';
import { getFirestore } from 'firebase-admin/firestore';

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

describe('processPendingPdf', () => {
  const mockDelete = jest.fn();
  const mockProcessedSet = jest.fn();
  const mockDeadLetterSet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirestore as jest.Mock).mockReturnValue({
      collection: (path: string) => ({
        doc: () => {
          if (path === '_system/processed_pdfs') {
            return { set: mockProcessedSet };
          }
          if (path === '_system/dead_letters') {
            return { set: mockDeadLetterSet };
          }
          return { set: jest.fn() };
        }
      })
    });
  });

  const mockEvent = {
    params: { fileId: '123' },
    data: { ref: { delete: mockDelete } },
  };

  it('should successfully process a PDF end-to-end', async () => {
    (downloadPdf as jest.Mock).mockResolvedValue(Buffer.from('pdf'));
    (extractPricesFromPdf as jest.Mock).mockResolvedValue({
      data: { year: 2026 },
      usage: { totalTokenCount: 150 },
    });
    (ensureYearTab as jest.Mock).mockResolvedValue('Data_2026');
    (appendRow as jest.Mock).mockResolvedValue(undefined);

    // Cast handler to unknown then invoke
    const handler = processPendingPdf as unknown as {
      run: (e: unknown) => Promise<void>
    };
    await handler.run(mockEvent);

    expect(downloadPdf).toHaveBeenCalledWith('123');
    expect(extractPricesFromPdf).toHaveBeenCalled();
    expect(ensureYearTab).toHaveBeenCalledWith(2026);
    expect(appendRow).toHaveBeenCalledWith('Data_2026', { year: 2026 });
    expect(mockProcessedSet).toHaveBeenCalledWith({
      status: 'completed',
      costTokens: 150,
    });
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeadLetterSet).not.toHaveBeenCalled();
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('handles failures, dead-letters, deletes doc, alerts', async () => {
    const error = new Error('Extraction failed');
    (downloadPdf as jest.Mock).mockResolvedValue(Buffer.from('pdf'));
    (extractPricesFromPdf as jest.Mock).mockRejectedValue(error);

    const handler = processPendingPdf as unknown as {
      run: (e: unknown) => Promise<void>
    };
    await handler.run(mockEvent);

    expect(mockDeadLetterSet).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      reason: 'Extraction failed',
      timestamp: expect.any(String),
    }));
    expect(mockDelete).toHaveBeenCalled();
    expect(sendAlert).toHaveBeenCalledWith(
      'Pipeline Extraction Failed',
      'File ID 123 failed to process: Extraction failed',
      '123'
    );
    expect(mockProcessedSet).not.toHaveBeenCalled();
  });
});
