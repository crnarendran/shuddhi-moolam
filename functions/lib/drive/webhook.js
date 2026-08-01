"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.driveWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const watch_1 = require("./watch");
const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID || '1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb';
exports.driveWebhook = (0, https_1.onRequest)(async (req, res) => {
    const channelId = req.headers['x-goog-channel-id'];
    const resourceId = req.headers['x-goog-resource-id'];
    const resourceState = req.headers['x-goog-resource-state'];
    if (!channelId || !resourceId) {
        logger.warn('Missing Google Drive headers in webhook.');
        res.status(400).send('Bad Request');
        return;
    }
    const state = await (0, watch_1.getWatchState)();
    if (!state ||
        state.channelId !== channelId ||
        state.resourceId !== resourceId) {
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
            const response = await watch_1.drive.changes.list({
                pageToken,
                spaces: 'drive',
            });
            const changes = response.data.changes || [];
            for (const change of changes) {
                if (!change.file || change.removed || change.file.trashed)
                    continue;
                const file = change.file;
                if (file.mimeType !== 'application/pdf')
                    continue;
                const fileId = change.fileId;
                // Ancestry check
                const inScope = await checkAncestry(fileId);
                if (!inScope) {
                    logger.debug(`File ${fileId} is not in target folder tree.`);
                    continue;
                }
                // Dedup check
                const db = (0, firestore_1.getFirestore)();
                const processedDoc = db.doc(`_system/processed_pdfs/${fileId}`);
                const pendingDoc = db.doc(`_system/pending_pdfs/${fileId}`);
                const [processedSnap, pendingSnap] = await Promise.all([
                    processedDoc.get(),
                    pendingDoc.get(),
                ]);
                if (processedSnap.exists || pendingSnap.exists) {
                    logger.info(`File ${fileId} already processed or pending.`);
                    continue;
                }
                // Handoff to async extraction
                logger.info(`Enqueuing file ${fileId} for extraction.`);
                await pendingDoc.set({
                    fileId,
                    enqueuedAt: Date.now(),
                });
            }
            if (response.data.newStartPageToken) {
                pageToken = response.data.newStartPageToken;
                hasMore = false;
            }
            else if (response.data.nextPageToken) {
                pageToken = response.data.nextPageToken;
            }
            else {
                hasMore = false;
            }
        }
        await (0, watch_1.updatePageToken)(pageToken);
        res.status(200).send('OK');
    }
    catch (error) {
        logger.error('Error processing Drive changes', { error });
        res.status(500).send('Internal Error');
    }
});
/**
 * Checks if a file is within the target folder tree.
 * @param fileId - The file ID to check.
 * @returns True if the file is in the target tree, false otherwise.
 */
async function checkAncestry(fileId) {
    let currentId = fileId;
    const maxDepth = 10;
    let depth = 0;
    while (depth < maxDepth) {
        try {
            const res = await watch_1.drive.files.get({
                fileId: currentId,
                fields: 'parents',
            });
            const parents = res.data.parents || [];
            if (parents.length === 0)
                return false;
            // Drive allows multiple parents, but we check if any path leads to ROOT
            if (parents.includes(DRIVE_ROOT_FOLDER_ID))
                return true;
            // Just take the first parent to climb up
            currentId = parents[0];
            depth++;
        }
        catch (e) {
            logger.warn(`Failed to fetch parents for ${currentId}`, { e });
            return false;
        }
    }
    return false;
}
//# sourceMappingURL=webhook.js.map