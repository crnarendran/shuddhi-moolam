/* eslint-disable max-len, jsdoc/require-param, jsdoc/require-returns, @typescript-eslint/no-unused-vars, jsdoc/require-jsdoc, jsdoc/require-param-description, jsdoc/require-param-type */
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { startDriveWatch, stopDriveWatch, getWatchState } from './drive/watch';
import { driveWebhook as _driveWebhook } from './drive/webhook';
import { processPendingPdf as _processPendingPdf } from './pipeline/process';
import { chatEndpoint as _chatEndpoint } from './analytics/chat';
import {
  createInvitation as _createInvitation,
  acceptInvitation as _acceptInvitation,
  resendInvitation as _resendInvitation,
  revokeInvitation as _revokeInvitation,
} from './sharing/invitations';
import {
  setUserPlan as _setUserPlan,
  listUserPlans as _listUserPlans,
} from './sharing/entitlements';
import { seedEnvData as _seedEnvData } from './admin/seedEnvData';
import { probeExtraction as _probeExtraction } from './admin/probeExtraction';
import {
  backfillSheetFromHistory as _backfillSheetFromHistory,
} from './admin/backfillSheet';
import { manualUpsert as _manualUpsert } from './admin/manualUpsert';
import { getFirestore } from 'firebase-admin/firestore';
import { latestMoMBreaches, breachSummary } from './reporting/alerts';
import { sendAlert } from './utils/alert';
import { PriceRecord } from './reporting/aggregate';

import { sheetsClient } from './sheets/routing';
import { MASTER_SHEET_ID } from './config';
import { SHEET_HEADERS_FRIENDLY } from './sheets/constants';

initializeApp();

/**
 * A sample function to verify scaffolding.
 */
const _helloWorld = onRequest((request, response) => {
  logger.info('Hello logs!', { structuredData: true });
  response.send('Hello from Firebase!');
});

/**
 * Admin callable to manually register a drive watch channel.
 */
const _registerWatch = onCall(async (request) => {
  const { webhookUrl } = request.data;
  if (!webhookUrl) {
    throw new HttpsError('invalid-argument', 'webhookUrl is required');
  }

  const state = await getWatchState();
  if (state) {
    logger.info('Stopping existing watch channel before registering new one.');
    await stopDriveWatch(state.channelId, state.resourceId);
  }

  const newState = await startDriveWatch(webhookUrl);
  return { success: true, watchState: newState };
});

/**
 * Scheduled function to renew the drive watch channel before it expires.
 * Runs every 24 hours.
 */
const _renewWatch = onSchedule('every 24 hours', async () => {
  const state = await getWatchState();
  if (!state) {
    logger.warn('No active watch channel found. Skipping renewal.');
    return;
  }

  const now = Date.now();
  const timeUntilExpiry = state.expiration - now;

  // Renew if expiring within 48 hours
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
  if (timeUntilExpiry > FORTY_EIGHT_HOURS) {
    logger.info('Channel does not expire within 48 hours. Skipping renewal.');
    return;
  }

  logger.info('Channel expiring soon. Renewing watch channel.');

  try {
    await startDriveWatch(state.webhookUrl);
    logger.info('Successfully renewed watch channel. Stopping old channel.');
    await stopDriveWatch(state.channelId, state.resourceId);
  } catch (error) {
    logger.error('Failed to renew watch channel', { error });
  }
});

/**
 * Weekly price-movement alert (SM-19): flags commodities whose latest
 * month-over-month change breaches the threshold and sends an alert.
 */
const _priceReviewAlert = onSchedule('0 9 * * 1', async () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const hist = require('./config').HISTORICAL_COLLECTION;
  const snap = await getFirestore().collection(hist).get();
  const records = snap.docs.map((d) => d.data() as PriceRecord);
  const threshold = parseFloat(process.env.PRICE_ALERT_THRESHOLD || '') || 5;
  const breaches = latestMoMBreaches(records, threshold);
  if (breaches.length === 0) {
    logger.info('Price review: no commodities breached the threshold.');
    return;
  }
  const noun = breaches.length === 1 ? 'commodity' : 'commodities';
  await sendAlert(
    `Price review: ${breaches.length} ${noun} moved >${threshold}%`,
    breachSummary(breaches),
    'price-review'
  );
});

/**
 * Callable to re-run extraction for a single already-tracked PDF. Flips
 * its run doc back to 'detected', which re-triggers processPendingPdf.
 * Backs the dashboard "Reprocess" button (previously undefined).
 */
const _reprocessPendingPdf = onCall(async (request) => {
  const fileId = (request.data as { fileId?: string })?.fileId;
  if (!fileId) {
    throw new HttpsError('invalid-argument', 'fileId is required');
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const col = require('./config').FIRESTORE_COLLECTION;
  await getFirestore().collection(col).doc(fileId).update({
    status: 'detected',
    detectedAt: Date.now(),
  });
  return { success: true, fileId };
});

const env = process.env.APP_ENV || 'dev';
const isProd = env === 'main' || env === 'prod';
const suffix = isProd ? '' : `_${env}`;

import { createSyncTrigger } from './analytics/syncToBigQuery';
import { FIRESTORE_COLLECTION, HISTORICAL_COLLECTION, COMPANIES_COLLECTION } from './config';

const _syncPipelineRuns = createSyncTrigger(FIRESTORE_COLLECTION, FIRESTORE_COLLECTION);
const _syncHistoricalPrices = createSyncTrigger(HISTORICAL_COLLECTION, HISTORICAL_COLLECTION);
const _syncCompanies = createSyncTrigger(COMPANIES_COLLECTION, COMPANIES_COLLECTION);

module.exports = {
  [`driveWebhook${suffix}`]: _driveWebhook,
  [`processPendingPdf${suffix}`]: _processPendingPdf,
  [`helloWorld${suffix}`]: _helloWorld,
  [`registerWatch${suffix}`]: _registerWatch,
  [`renewWatch${suffix}`]: _renewWatch,
  [`chatEndpoint${suffix}`]: _chatEndpoint,
  [`priceReviewAlert${suffix}`]: _priceReviewAlert,
  [`reprocessPendingPdf${suffix}`]: _reprocessPendingPdf,
  [`syncPipelineRunsToBigQuery${suffix}`]: _syncPipelineRuns,
  [`syncHistoricalPricesToBigQuery${suffix}`]: _syncHistoricalPrices,
  [`syncCompaniesToBigQuery${suffix}`]: _syncCompanies,
  [`createInvitation${suffix}`]: _createInvitation,
  [`acceptInvitation${suffix}`]: _acceptInvitation,
  [`resendInvitation${suffix}`]: _resendInvitation,
  [`revokeInvitation${suffix}`]: _revokeInvitation,
  [`setUserPlan${suffix}`]: _setUserPlan,
  [`listUserPlans${suffix}`]: _listUserPlans,
  [`seedEnvData${suffix}`]: _seedEnvData,
  [`probeExtraction${suffix}`]: _probeExtraction,
  [`backfillSheetFromHistory${suffix}`]: _backfillSheetFromHistory,
  [`manualUpsert${suffix}`]: _manualUpsert,
  [`clearTabs${suffix}`]: onRequest(async (request, response) => {
    try {
      if (!MASTER_SHEET_ID) throw new Error('No MASTER_SHEET_ID');

      const doc = await sheetsClient.spreadsheets.get({
        spreadsheetId: MASTER_SHEET_ID,
      });
      const sheets = doc.data.sheets || [];

      // Reset every year tab (a 4-digit title): clear all rows AND
      // rewrite row 1 with the current headers. Clearing data alone
      // leaves a stale header, so a re-extraction's new columns would
      // land misaligned under the old labels (the SM-29 prod bug).
      const yearTabs = sheets
        .map((s) => s.properties?.title || '')
        .filter((t) => /^\d{4}$/.test(t));
      for (const title of yearTabs) {
        await sheetsClient.spreadsheets.values.clear({
          spreadsheetId: MASTER_SHEET_ID,
          range: `${title}!A:Z`,
        });
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId: MASTER_SHEET_ID,
          range: `${title}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [SHEET_HEADERS_FRIENDLY] },
        });
      }

      // Refresh the Audit_Log header row too.
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: MASTER_SHEET_ID,
        range: 'Audit_Log!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['Timestamp', 'Action', ...SHEET_HEADERS_FRIENDLY]],
        },
      });

      response.send(
        `Reset ${yearTabs.length} year tab(s) and Audit_Log headers.`
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      logger.error('Failed to clear tabs', { error: msg });
      response.status(500).send(msg);
    }
  }),
};

