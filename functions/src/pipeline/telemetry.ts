import { getFirestore } from 'firebase-admin/firestore';
import { FIRESTORE_COLLECTION } from '../config';
import { type Outlier } from '../reporting/outliers';

export type PipelineStatus =
  | 'detected'
  | 'downloading'
  | 'extracting'
  | 'validating'
  | 'routing'
  | 'upserting'
  | 'appended'
  | 'failed'
  | 'dead_letter';

export interface PipelineRun {
  fileId: string;
  fileName?: string;
  folderPath?: string;
  status: PipelineStatus;
  stages: Record<string, { startedAt: number; endedAt?: number; ok?: boolean }>;
  detectedAt: number;
  completedAt?: number;
  issueDate?: string;
  year?: number;
  targetTab?: string;
  appendedRange?: string;
  extractSummary?: Record<string, unknown>;
  error?: { stage: string; message: string; code?: string };
  attempts: number;
  gemini?: {
    tokensIn: number;
    tokensOut: number;
    thinkingTokens?: number;
    totalTokens?: number;
    estCostUsd?: number;
  };
  durationMs?: number;
  cost?: { estimatedUsd: number };
  /** Values that deviated sharply from recent weeks (SM-56). */
  qualityOutliers?: Outlier[];
  /** A manual override existed, so auto writes were skipped (SM-57). */
  manualOverrideKept?: boolean;
  /** Fields where the fresh auto read disagreed with the manual value. */
  autoVsManualDiffs?: { key: string; auto: string; manual: string }[];
}

/**
 * Records a pipeline stage and updates the pipeline run document.
 * @param {string} fileId The ID of the file being processed.
 * @param {PipelineStatus} status The new status of the pipeline run.
 * @param {Partial<PipelineRun>} patch Optional fields to update on the record.
 * @returns {Promise<void>} A promise that resolves when the update is complete.
 */
export async function recordStage(
  fileId: string,
  status: PipelineStatus,
  patch?: Partial<PipelineRun>
) {
  const db = getFirestore();
  const ref = db.collection(FIRESTORE_COLLECTION).doc(fileId);
  const now = Date.now();

  const update: Record<string, unknown> = {
    status,
    ...patch,
    [`stages.${status}`]: { startedAt: now, ok: true },
  };

  await ref.set(update, { merge: true });
}
