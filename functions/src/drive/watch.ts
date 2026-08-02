import { google } from 'googleapis';
import { getFirestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import * as logger from 'firebase-functions/logger';

// Assume application default credentials (e.g. the function's service account)
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

export const drive = google.drive({ version: 'v3', auth });

import { APP_ENV } from '../config';

const WATCH_DOC_PATH = '_system/drive_watch' + (APP_ENV === 'main' || APP_ENV === 'prod' ? '' : '_' + APP_ENV);

export interface WatchState {
  channelId: string;
  resourceId: string;
  expiration: number;
  webhookUrl: string;
  pageToken: string;
}

/**
 * Registers a new changes.watch channel for the service account's Drive.
 * We rely on the webhook handler to filter out changes not in the target
 * folder.
 * @param {string} webhookUrl - The URL that Google Drive should POST to.
 * @returns {Promise<{ channelId: string; resourceId: string;
 * expiration: number; webhookUrl: string; }>} The active watch
 * channel details.
 */
export async function startDriveWatch(webhookUrl: string): Promise<WatchState> {
  const channelId = crypto.randomUUID();

  // Expiry is max 1 week (604800000 ms). We use 6 days.
  const expiration = Date.now() + 6 * 24 * 60 * 60 * 1000;

  logger.info(`Starting drive changes.watch with channel ${channelId}`);

  // Need a start token to watch changes
  const tokenRes = await drive.changes.getStartPageToken({});
  const pageToken = tokenRes.data.startPageToken;

  if (!pageToken) {
    throw new Error('Failed to get start page token for Drive changes.');
  }

  const res = await drive.changes.watch({
    pageToken,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
      expiration: expiration.toString(),
    },
  });

  const state: WatchState = {
    channelId: res.data.id as string,
    resourceId: res.data.resourceId as string,
    expiration: parseInt(res.data.expiration || expiration.toString(), 10),
    webhookUrl,
    pageToken,
  };

  const db = getFirestore();
  await db.doc(WATCH_DOC_PATH).set(state);

  return state;
}

/**
 * Stops an existing drive watch channel.
 * @param {string} channelId - The UUID of the channel.
 * @param {string} resourceId - The opaque ID of the watched resource.
 */
export async function stopDriveWatch(
  channelId: string,
  resourceId: string,
): Promise<void> {
  logger.info(`Stopping drive watch channel ${channelId}`);
  try {
    await drive.channels.stop({
      requestBody: {
        id: channelId,
        resourceId: resourceId,
      },
    });
  } catch (err) {
    logger.warn('Failed to stop drive channel, it may have already expired.', {
      err,
    });
  }
}

/**
 * Retrieves the current watch state from Firestore.
 * @returns {Promise<{ channelId: string; resourceId: string;
 * expiration: number; webhookUrl: string; } | null>} The active
 * watch state, or null if none exists.
 */
export async function getWatchState(): Promise<WatchState | null> {
  const db = getFirestore();
  const snap = await db.doc(WATCH_DOC_PATH).get();
  if (!snap.exists) return null;
  return snap.data() as WatchState;
}

/**
 * Updates the stored page token after processing changes.
 * @param {string} token - The next page token.
 */
export async function updatePageToken(token: string): Promise<void> {
  const db = getFirestore();
  await db.doc(WATCH_DOC_PATH).update({ pageToken: token });
}
