import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { downloadPdf } from '../drive/download';
import { extractPricesFromPdf } from '../gemini/extract';
import { ensureYearTab } from '../sheets/routing';
import { upsertRow } from '../sheets/upsert';
import { logAuditTrail } from '../sheets/audit';
import { sendAlert } from '../utils/alert';
import { recordStage } from './telemetry';

const geminiApiKeySecret = defineSecret('GEMINI_API_KEY');

export const processPendingPdf = onDocumentWritten(
  {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    document: `${require('../config').FIRESTORE_COLLECTION}/{fileId}`,
    secrets: [geminiApiKeySecret],
    timeoutSeconds: 300,
    maxInstances: 2,
    concurrency: 1
  },
  async (event) => {
    const after = event.data?.after;
    const before = event.data?.before;

    // Only trigger if status just became 'detected'
    if (
      after?.data()?.status === 'detected' &&
      before?.data()?.status !== 'detected'
    ) {
      const fileId = (event.params as Record<string, string>).fileId;
      logger.info(`Started processing pending PDF`, { fileId });

      try {
        // 1. Download
        await recordStage(fileId, 'downloading');
        const { buffer: pdfBuffer, filename } = await downloadPdf(fileId);

        // Update the document with fileName so the dashboard can display it
        if (event.data?.after) {
          await event.data.after.ref.update({ fileName: filename });
        }

        // 2. Extract
        await recordStage(fileId, 'extracting');
        const { data: record, usage } = await extractPricesFromPdf(pdfBuffer);

        // Overwrite the filename with the full path/filename
        record.filename = filename;

        // 3. Ensure tab
        await recordStage(fileId, 'routing');
        const tabTitle = await ensureYearTab(record.date);

        // 4. Append
        await recordStage(fileId, 'upserting');
        const action = await upsertRow(tabTitle, record);
        await logAuditTrail(action, record);

        // 4.5 Insert into Historical Collection
        const [day, month, year] = record.date.split('/');
        const docId = `${year}-${month}-${day}`;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const historicalCol = require('../config').HISTORICAL_COLLECTION;
        await getFirestore().collection(historicalCol).doc(docId).set(record);

        // Also add to history subcollection
        const timestampId = new Date().getTime().toString();
        await getFirestore()
          .collection(historicalCol)
          .doc(docId)
          .collection('history')
          .doc(timestampId)
          .set(record);

        // 5. Success
        await recordStage(fileId, 'appended', {
          gemini: {
            tokensIn: usage.promptTokenCount || 0,
            tokensOut: usage.candidatesTokenCount || 0,
          },
          year: parseInt(record.date.split('/')[2] || '0', 10),
          targetTab: tabTitle,
          completedAt: Date.now()
        });

        logger.info(`Successfully processed PDF`, {
          fileId,
          costTokens: usage.totalTokenCount,
        });

      } catch (err: unknown) {
        // 6. Failure handling
        const error = err as Error;
        logger.error(`Failed to process PDF`, { fileId, error: error.message });

        await recordStage(fileId, 'failed', {
          error: { stage: 'process', message: error.message }
        });

        await sendAlert(
          'Pipeline Extraction Failed',
          `File ID ${fileId} failed to process: ${error.message}`,
          fileId
        );
      }
    }
  }
);
