import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { downloadPdf } from '../drive/download';
import { extractPricesConsensus } from '../gemini/extract';
import { ensureYearTab } from '../sheets/routing';
import { upsertRow } from '../sheets/upsert';
import { logAuditTrail } from '../sheets/audit';
import { sendAlert } from '../utils/alert';
import { recordStage } from './telemetry';
import { estimateGeminiCostUsd } from './cost';
import { toKgRecord } from './units';
import { detectOutliers } from '../reporting/outliers';

const geminiApiKeySecret = defineSecret('GEMINI_API_KEY');

// Extraction passes to vote over (SM-58). Temperature 0 already makes the
// reads deterministic, so 1 pass by default (single API call). Raise
// CONSENSUS_RUNS to re-enable majority voting if variance ever returns.
const consensusRuns = parseInt(process.env.CONSENSUS_RUNS || '', 10) || 1;

export const processPendingPdf = onDocumentWritten(
  {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    document: `${require('../config').FIRESTORE_COLLECTION}/{fileId}`,
    secrets: [geminiApiKeySecret],
    timeoutSeconds: 540,
    maxInstances: 2,
    concurrency: 1,
    memory: '1GiB'
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
      const detectedAt = after?.data()?.detectedAt as number | undefined;
      logger.info(`Started processing pending PDF`, { fileId });

      try {
        // 1. Download
        await recordStage(fileId, 'downloading');
        const { buffer: pdfBuffer, filename } = await downloadPdf(fileId);

        // 2. Extract (record the filename now so the monitor shows it)
        await recordStage(fileId, 'extracting', { fileName: filename });
        const { data: rawRecord, usage } = await extractPricesConsensus(
          pdfBuffer, {}, consensusRuns
        );
        const record = toKgRecord(rawRecord);

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

        // 4.6 Quality check (SM-56): flag any value that deviates sharply
        // from recent weeks — a safety net for extraction misreads on the
        // dense image tables (e.g. inoculant 308 read as 200). Non-blocking.
        let qualityOutliers: ReturnType<typeof detectOutliers> = [];
        try {
          const histSnap = await getFirestore()
            .collection(historicalCol)
            .orderBy(FieldPath.documentId(), 'desc')
            .limit(9)
            .get();
          const history = histSnap.docs
            .filter((d) => d.id !== docId)
            .map((d) => d.data() as Record<string, unknown>);
          qualityOutliers = detectOutliers(
            record as unknown as Record<string, unknown>, history
          );
          if (qualityOutliers.length > 0) {
            logger.warn('Extraction quality: outliers detected', {
              fileId, outliers: qualityOutliers,
            });
            await sendAlert(
              `Extraction check: ${qualityOutliers.length} outlier(s) ` +
                `in ${filename}`,
              qualityOutliers
                .map((o) =>
                  `${o.label}: ${o.value} vs ~${o.baseline} ` +
                  `(${o.deviationPct > 0 ? '+' : ''}${o.deviationPct}%)`)
                .join('\n'),
              `outlier-${docId}`
            );
          }
        } catch (e) {
          logger.warn('Outlier check failed', { fileId, error: e });
        }

        // 5. Success
        const now = Date.now();
        const tokensIn = usage.promptTokenCount || 0;
        const tokensOut = usage.candidatesTokenCount || 0;
        const thinkingTokens = usage.thoughtsTokenCount || 0;
        const totalTokens = usage.totalTokenCount || 0;
        const estimatedUsd = estimateGeminiCostUsd(
          tokensIn,
          tokensOut,
          thinkingTokens
        );
        await recordStage(fileId, 'appended', {
          gemini: {
            tokensIn,
            tokensOut,
            thinkingTokens,
            totalTokens,
            estCostUsd: estimatedUsd,
          },
          cost: { estimatedUsd },
          qualityOutliers,
          year: parseInt(record.date.split('/')[2] || '0', 10),
          targetTab: tabTitle,
          completedAt: now,
          ...(typeof detectedAt === 'number'
            ? { durationMs: now - detectedAt }
            : {}),
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
