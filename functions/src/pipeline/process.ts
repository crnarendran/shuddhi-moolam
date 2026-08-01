import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { downloadPdf } from '../drive/download';
import { extractPricesFromPdf } from '../gemini/extract';
import { ensureYearTab } from '../sheets/routing';
import { appendRow } from '../sheets/append';
import { sendAlert } from '../utils/alert';

export const processPendingPdf = onDocumentCreated(
  '_system/pending_pdfs/{fileId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const fileId = event.params.fileId;
    const db = getFirestore();
    const pendingRef = snapshot.ref;
    const processedRef = db.collection('_system/processed_pdfs').doc(fileId);
    const deadLetterRef = db.collection('_system/dead_letters').doc(fileId);

    logger.info(`Started processing pending PDF`, { fileId });

    try {
      // 1. Download
      const pdfBuffer = await downloadPdf(fileId);

      // 2. Extract
      const { data: record, usage } = await extractPricesFromPdf(pdfBuffer);

      // 3. Ensure tab
      const tabTitle = await ensureYearTab(record.year);

      // 4. Append
      await appendRow(tabTitle, record);

      // 5. Success cleanup
      await processedRef.set({
        status: 'completed',
        costTokens: usage.totalTokenCount,
      });
      await pendingRef.delete();
      logger.info(`Successfully processed PDF`, {
        fileId,
        costTokens: usage.totalTokenCount,
      });

    } catch (err: unknown) {
      // 6. Failure handling
      const error = err as Error;
      logger.error(`Failed to process PDF`, { fileId, error: error.message });
      await deadLetterRef.set({
        status: 'failed',
        reason: error.message,
        timestamp: new Date().toISOString()
      });
      await pendingRef.delete();
      await sendAlert(
        'Pipeline Extraction Failed',
        `File ID ${fileId} failed to process: ${error.message}`,
        fileId
      );
    }
  }
);
