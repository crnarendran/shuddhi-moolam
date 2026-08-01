import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { getWatchState, updatePageToken, drive } from './watch';

const DRIVE_ROOT_FOLDER_ID =
  process.env.DRIVE_ROOT_FOLDER_ID || '1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb';

export const driveWebhook = onRequest(async (req, res) => {
  const channelId = req.headers['x-goog-channel-id'] as string;
  const resourceId = req.headers['x-goog-resource-id'] as string;
  const resourceState = req.headers['x-goog-resource-state'] as string;

  if (!channelId || !resourceId) {
    logger.warn('Missing Google Drive headers in webhook.');
    res.status(400).send('Bad Request');
    return;
  }

  const state = await getWatchState();
  if (
    !state ||
    state.channelId !== channelId ||
    state.resourceId !== resourceId
  ) {
    logger.warn('Webhook channel mismatch or unknown channel.', {
      received: { channelId, resourceId },
      expected: state
        ? { channelId: state.channelId, resourceId: state.resourceId }
        : null,
    });
    res.status(403).send('Forbidden');
    return;
  }

  if (resourceState === 'sync') {
    logger.info('Received sync notification. Returning 200.');
    res.status(200).send('OK');
    return;
  }

  logger.info('Processing Drive changes notification.');

  try {
    let pageToken = state.pageToken;
    let hasMore = true;

    while (hasMore) {
      const response = await drive.changes.list({
        pageToken,
        spaces: 'drive',
      });

      const changes = response.data.changes || [];
      for (const change of changes) {
        if (!change.file || change.removed || change.file.trashed) continue;

        const file = change.file;
        if (file.mimeType !== 'application/pdf') continue;

        const fileId = change.fileId!;

        // Ancestry check
        const inScope = await checkAncestry(fileId);
        if (!inScope) {
          logger.debug(`File ${fileId} is not in target folder tree.`);
          continue;
        }

        // Dedup check
        const db = getFirestore();
        const pipelineDoc = db.doc(`pipeline_runs/${fileId}`);

        const pipelineSnap = await pipelineDoc.get();

        if (pipelineSnap.exists) {
          logger.info(`File ${fileId} already processed or pending.`);
          continue;
        }

        // Handoff to async extraction
        logger.info(`Enqueuing file ${fileId} for extraction.`);
        await pipelineDoc.set({
          fileId,
          status: 'detected',
          detectedAt: Date.now(),
          attempts: 0,
        });
      }

      if (response.data.newStartPageToken) {
        pageToken = response.data.newStartPageToken;
        hasMore = false;
      } else if (response.data.nextPageToken) {
        pageToken = response.data.nextPageToken;
      } else {
        hasMore = false;
      }
    }

    await updatePageToken(pageToken);
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error processing Drive changes', { error });
    res.status(500).send('Internal Error');
  }
});

/**
 * Checks if a file is within the target folder tree.
 * @param {string} fileId - The Drive file ID.
 * @returns {Promise<boolean>} True if the file is in the target
 * tree, false otherwise.
 */
async function checkAncestry(fileId: string): Promise<boolean> {
  let currentId = fileId;
  const maxDepth = 10;
  let depth = 0;

  while (depth < maxDepth) {
    try {
      const res = await drive.files.get({
        fileId: currentId,
        fields: 'parents',
      });
      const parents = res.data.parents || [];
      if (parents.length === 0) return false;

      // Drive allows multiple parents, but we check if any path leads to ROOT
      if (parents.includes(DRIVE_ROOT_FOLDER_ID)) return true;

      // Just take the first parent to climb up
      currentId = parents[0];
      depth++;
    } catch (e) {
      logger.warn(`Failed to fetch parents for ${currentId}`, { e });
      return false;
    }
  }
  return false;
}
