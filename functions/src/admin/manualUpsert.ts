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
  isValidManualDate, dateToDocId, sanitizeManualValues, CORE_KEYS,
} from './manualEntry';
import { type ExtractionRecord } from '../gemini/schema';

interface ManualInput {
  date?: string;
  values?: Record<string, unknown>;
  filename?: string;
  clearOverride?: boolean;
}

/**
 * Snapshots the current auto commodity values from an existing record so that
 * Clear can restore them later.
 * @param {Record<string, unknown>} existing - The existing historical doc.
 * @returns {Record<string, string>} The component values as strings.
 */
function snapshotValues(
  existing: Record<string, unknown>
): Record<string, string> {
  const snap: Record<string, string> = {};
  for (const k of CORE_KEYS) {
    const v = existing[k];
    if (v !== undefined && v !== null && v !== '') snap[k] = String(v);
  }
  return snap;
}

/**
 * Extracts every component value from a record as a string map (blank when
 * absent) — returned to the client so the grid refreshes without a re-fetch.
 * @param {Record<string, unknown>} rec - The record to read.
 * @returns {Record<string, string>} A key→string map over all components.
 */
function componentValues(
  rec: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of CORE_KEYS) {
    const v = rec[k];
    out[k] = v === undefined || v === null ? '' : String(v);
  }
  return out;
}

/**
 * Data-editor-gated manual price entry / correction (SM-57, "break glass").
 * Writes the FINAL kg figures to BOTH the master Sheet and Firestore
 * `historical_prices`, stamping `source: 'manual'` so a later auto run keeps
 * (not overwrites) it. The first override snapshots the prior auto values so
 * `clearOverride` can RESTORE them (a true undo) in both stores. No tonne→kg
 * conversion on this path — values are stored verbatim.
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

    // clearOverride: undo the manual entry. If we snapshotted the prior auto
    // values, RESTORE them in both stores and drop the manual marker; else
    // just drop the marker so auto may overwrite on its next run.
    if (data.clearOverride) {
      const existing = ((await ref.get()).data() || {}) as
        Record<string, unknown>;
      const pre = existing.preManual as Record<string, string> | undefined;
      const now = new Date().toISOString();
      if (pre && Object.keys(pre).length > 0) {
        const restored: Record<string, unknown> = { ...existing, ...pre };
        delete restored.source;
        delete restored.manualBy;
        delete restored.manualAt;
        delete restored.preManual;
        restored.date = date;
        restored.last_modified_date = now;
        const tab = await ensureYearTab(date);
        await upsertRow(tab, restored as unknown as ExtractionRecord);
        // Full replace so the manual marker + snapshot are removed.
        await ref.set(restored);
        logger.info('Manual override cleared (restored auto values)', {
          docId, by: caller, restored: Object.keys(pre),
        });
        return {
          success: true, docId, cleared: true, restored: true,
          source: 'auto', manualFields: [],
          values: componentValues(restored),
        };
      }
      await ref.set(
        { source: 'auto', manualBy: null, manualAt: null, manualFields: [] },
        { merge: true }
      );
      logger.info('Manual override cleared (no snapshot to restore)', {
        docId, by: caller,
      });
      return {
        success: true, docId, cleared: true, restored: false,
        source: 'auto', manualFields: [], values: componentValues(existing),
      };
    }

    const { clean, rejected } = sanitizeManualValues(data.values || {});
    if (Object.keys(clean).length === 0) {
      throw new HttpsError('invalid-argument', 'No valid values provided.');
    }

    // Merge onto any existing record so partial edits keep other fields.
    const existing = ((await ref.get()).data() || {}) as
      Record<string, unknown>;
    const alreadyManual = existing.source === 'manual';
    // Snapshot the pre-manual (auto) values on the FIRST override only, so a
    // later Clear can restore them. Preserve the original snapshot on re-edits.
    const preManual = alreadyManual
      ? (existing.preManual as Record<string, string> | undefined)
      : snapshotValues(existing);
    // Track which fields carry a manual override (for field-level badges).
    const prevFields = alreadyManual && Array.isArray(existing.manualFields)
      ? existing.manualFields as string[] : [];
    const manualFields = Array.from(
      new Set([...prevFields, ...Object.keys(clean)])
    );
    const now = new Date().toISOString();
    const record = {
      ...existing,
      ...clean,
      date,
      filename: data.filename || existing.filename || `manual-${docId}`,
      source: 'manual',
      manualBy: caller,
      manualAt: now,
      manualFields,
      ...(preManual ? { preManual } : {}),
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
      source: 'manual', manualFields,
      values: componentValues(record as unknown as Record<string, unknown>),
    };
  }
);
