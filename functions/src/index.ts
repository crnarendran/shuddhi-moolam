import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { startDriveWatch, stopDriveWatch, getWatchState } from './drive/watch';
import { driveWebhook as _driveWebhook } from './drive/webhook';
import { processPendingPdf as _processPendingPdf } from './pipeline/process';

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

const env = process.env.APP_ENV || 'dev';
const isProd = env === 'main' || env === 'prod';
const suffix = isProd ? '' : `_${env}`;

module.exports = {
  [`driveWebhook${suffix}`]: _driveWebhook,
  [`processPendingPdf${suffix}`]: _processPendingPdf,
  [`helloWorld${suffix}`]: _helloWorld,
  [`registerWatch${suffix}`]: _registerWatch,
  [`renewWatch${suffix}`]: _renewWatch,
};

