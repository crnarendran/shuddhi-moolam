import {
  onCall, HttpsError, type CallableRequest,
} from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { HISTORICAL_COLLECTION } from '../config';
import { isDataEditor } from '../config/roles';
import { ensureYearTab } from '../sheets/routing';
import { upsertRow } from '../sheets/upsert';
import {
  isValidManualDate, dateToDocId, sanitizeManualValues,
} from './manualEntry';
import { type ExtractionRecord } from '../gemini/schema';

interface ManualInput {
  date?: string;
  values?: Record<string, unknown>;
  filename?: string;
  clearOverride?: boolean;
}

/**
 * Data-editor-gated manual price entry / correction (SM-57, "break glass").
 * Writes the FINAL kg figures to BOTH the master Sheet and Firestore
 * `historical_prices`, stamping `source: 'manual'` so a later auto run keeps
 * (not overwrites) it. `clearOverride` removes the marker to re-enable auto.
 * No tonne→kg conversion on this path — values are stored verbatim.
 * @param {CallableRequest} request - { date, values, filename?,
 *   clearOverride? }.
 * @returns {Promise<object>} Result with docId, action and accepted keys.
 */
export const manualUpsert = onCall(
  { timeoutSeconds: 120, memory: '512MiB' },
  async (request: CallableRequest) => {
    const caller = (request.auth?.token.email || '').toLowerCase();
    if (!request.auth || !isDataEditor(caller)) {
      throw new HttpsError('permission-denied', 'Data editors only.');
    }
    const data = request.data as ManualInput;
    const date = data.date;
    if (!isValidManualDate(date)) {
      throw new HttpsError('invalid-argument', 'date must be dd/MM/yyyy.');
    }
    const docId = dateToDocId(date);
    const db = getFirestore();
    const ref = db.collection(HISTORICAL_COLLECTION).doc(docId);

    // clearOverride: drop the manual marker so auto extraction may overwrite
    // this date again on its next run. The last values are left in place.
    if (data.clearOverride) {
      await ref.set(
        { source: 'auto', manualBy: null, manualAt: null }, { merge: true }
      );
      logger.info('Manual override cleared', { docId, by: caller });
      return { success: true, docId, cleared: true };
    }

    const { clean, rejected } = sanitizeManualValues(data.values || {});
    if (Object.keys(clean).length === 0) {
      throw new HttpsError('invalid-argument', 'No valid values provided.');
    }

    // Merge onto any existing record so partial edits keep other fields.
    const existing = (await ref.get()).data() as ExtractionRecord | undefined;
    const now = new Date().toISOString();
    const record = {
      ...(existing || {}),
      ...clean,
      date,
      filename: data.filename || existing?.filename || `manual-${docId}`,
      source: 'manual',
      manualBy: caller,
      manualAt: now,
      last_modified_date: now,
    } as unknown as ExtractionRecord;

    // Write BOTH stores: the Sheet (human master) and Firestore (what the
    // dashboard reads). Extra marker fields are ignored by the Sheet mapping.
    const tab = await ensureYearTab(date);
    const action = await upsertRow(tab, record);
    await ref.set(record, { merge: true });

    logger.info('Manual price entry saved', {
      docId, by: caller, keys: Object.keys(clean), rejected, action,
    });
    return {
      success: true, docId, action,
      written: Object.keys(clean), rejected,
    };
  }
);
