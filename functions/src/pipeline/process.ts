import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { downloadPdf } from '../drive/download';
import { extractPricesFromPdf } from '../gemini/extract';
import { ensureYearTab } from '../sheets/routing';
import { appendRow } from '../sheets/append';
import { sendAlert } from '../utils/alert';
import { recordStage } from './telemetry';

const geminiApiKeySecret = defineSecret('GEMINI_API_KEY');

export const processPendingPdf = onDocumentWritten(
  {
    document: 'pipeline_runs/{fileId}',
    secrets: [geminiApiKeySecret]
  },
  async (event) => {
    const after = event.data?.after;
    const before = event.data?.before;

    // Only trigger if status just became 'detected'
    if (
      after?.data()?.status === 'detected' &&
      before?.data()?.status !== 'detected'
    ) {
      const fileId = event.params.fileId;
      logger.info(`Started processing pending PDF`, { fileId });

      try {
        // 1. Download
        await recordStage(fileId, 'downloading');
        const pdfBuffer = await downloadPdf(fileId);

        // 2. Extract
        await recordStage(fileId, 'extracting');
        const { data: record, usage } = await extractPricesFromPdf(pdfBuffer);

        // 3. Ensure tab (we could use 'validating' too but the plan
        // says routing)
        await recordStage(fileId, 'routing');
        const tabTitle = await ensureYearTab(record.year);

        // 4. Append
        await appendRow(tabTitle, record);

        // 5. Success
        await recordStage(fileId, 'appended', {
          gemini: {
            tokensIn: usage.promptTokenCount || 0,
            tokensOut: usage.candidatesTokenCount || 0,
          },
          year: record.year,
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
