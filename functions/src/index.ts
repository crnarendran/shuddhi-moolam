import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { startDriveWatch, stopDriveWatch, getWatchState } from './drive/watch';
import { driveWebhook as _driveWebhook } from './drive/webhook';
import { processPendingPdf as _processPendingPdf } from './pipeline/process';
import { chatEndpoint as _chatEndpoint } from './analytics/chat';
import { getFirestore } from 'firebase-admin/firestore';
import { latestMoMBreaches, breachSummary } from './reporting/alerts';
import { sendAlert } from './utils/alert';
import { PriceRecord } from './reporting/aggregate';

import { initializeApp } from 'firebase-admin/app';
import { sheetsClient } from './sheets/routing';
import { MASTER_SHEET_ID } from './config';
import { SHEET_HEADERS } from './sheets/constants';

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

const env = process.env.APP_ENV || 'dev';
const isProd = env === 'main' || env === 'prod';
const suffix = isProd ? '' : `_${env}`;

module.exports = {
  [`driveWebhook${suffix}`]: _driveWebhook,
  [`processPendingPdf${suffix}`]: _processPendingPdf,
  [`helloWorld${suffix}`]: _helloWorld,
  [`registerWatch${suffix}`]: _registerWatch,
  [`renewWatch${suffix}`]: _renewWatch,
  [`chatEndpoint${suffix}`]: _chatEndpoint,
  [`priceReviewAlert${suffix}`]: _priceReviewAlert,
  [`clearTabs${suffix}`]: onRequest(async (request, response) => {
    try {
      if (!MASTER_SHEET_ID) throw new Error('No MASTER_SHEET_ID');

      const doc = await sheetsClient.spreadsheets.get({
        spreadsheetId: MASTER_SHEET_ID,
      });
      const sheets = doc.data.sheets || [];
      type DelReq = { deleteSheet: { sheetId: number | null | undefined } };
      const requests: DelReq[] = [];

      const sheet2025 = sheets.find(
        (s) => s.properties?.title === '2025'
      );
      if (sheet2025) {
        requests.push({
          deleteSheet: { sheetId: sheet2025.properties?.sheetId },
        });
      }

      if (requests.length > 0) {
        await sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId: MASTER_SHEET_ID,
          requestBody: { requests },
        });
      }

      await sheetsClient.spreadsheets.values.clear({
        spreadsheetId: MASTER_SHEET_ID,
        range: '2026!A2:Z',
      });

      // Update Audit_Log headers
      const userFriendlyHeaders = SHEET_HEADERS.map((header: string) =>
        header
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      );
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: MASTER_SHEET_ID,
        range: 'Audit_Log!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['Timestamp', 'Action', ...userFriendlyHeaders]],
        },
      });

      response.send('Tabs cleared and Audit_Log headers updated successfully.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      logger.error('Failed to clear tabs', { error: msg });
      response.status(500).send(msg);
    }
  }),
};

