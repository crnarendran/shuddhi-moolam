import {
  onCall, HttpsError, type CallableRequest,
} from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { HISTORICAL_COLLECTION } from '../config';
import { ensureYearTab } from '../sheets/routing';
import { upsertRow } from '../sheets/upsert';
import { sortTabByDateDesc } from '../sheets/sort';
import { type ExtractionRecord } from '../gemini/schema';

const ADMIN_EMAILS = ['crnarendran@gmail.com'];

interface BackfillResult {
  scanned: number;
  written: number;
  tabs: string[];
  skipped: string[];
}

/**
 * Admin-only, one-time repair (no re-extraction): rewrites every master
 * Sheet row from the authoritative `historical_prices` docs, which already
 * hold the correct kg decimals. Fixes rows the old sort had rounded (47.5 →
 * 48). Each row is upserted with skipSort=true, then each affected tab is
 * sorted once. Firestore is the source of truth and is not modified; no
 * Gemini calls are made.
 * @param {CallableRequest} request - Callable request (auth required).
 * @returns {Promise<BackfillResult>} Counts of docs scanned/written and the
 *   tabs touched.
 */
export const backfillSheetFromHistory = onCall(
  { timeoutSeconds: 540, memory: '512MiB' },
  async (request: CallableRequest): Promise<BackfillResult> => {
    const caller = (request.auth?.token.email || '').toLowerCase();
    if (!request.auth || !ADMIN_EMAILS.includes(caller)) {
      throw new HttpsError('permission-denied', 'Admins only.');
    }

    const snap = await getFirestore().collection(HISTORICAL_COLLECTION).get();
    const tabs = new Set<string>();
    const skipped: string[] = [];
    let written = 0;

    for (const doc of snap.docs) {
      const record = doc.data() as ExtractionRecord;
      const date = record?.date;
      if (typeof date !== 'string' || date.split('/').length !== 3) {
        skipped.push(doc.id);
        continue;
      }
      try {
        const tab = await ensureYearTab(date);
        await upsertRow(tab, record, true);
        tabs.add(tab);
        written++;
      } catch (e) {
        logger.warn('Backfill row failed', { docId: doc.id, error: e });
        skipped.push(doc.id);
      }
    }

    for (const tab of tabs) {
      await sortTabByDateDesc(tab);
    }

    logger.info('Sheet backfill complete', {
      scanned: snap.size, written, tabs: [...tabs], skipped,
    });
    return { scanned: snap.size, written, tabs: [...tabs], skipped };
  }
);
