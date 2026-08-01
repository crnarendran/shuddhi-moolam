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
exports.drive = void 0;
exports.startDriveWatch = startDriveWatch;
exports.stopDriveWatch = stopDriveWatch;
exports.getWatchState = getWatchState;
exports.updatePageToken = updatePageToken;
const googleapis_1 = require("googleapis");
const firestore_1 = require("firebase-admin/firestore");
const crypto = __importStar(require("crypto"));
const logger = __importStar(require("firebase-functions/logger"));
// Assume application default credentials (e.g. the function's service account)
const auth = new googleapis_1.google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
exports.drive = googleapis_1.google.drive({ version: 'v3', auth });
const WATCH_DOC_PATH = '_system/drive_watch';
/**
 * Registers a new changes.watch channel for the service account's Drive.
 * We rely on the webhook handler to filter out changes not in the target
 * folder.
 * @param webhookUrl - The URL of our webhook (SM-03).
 * @returns The new watch state.
 */
async function startDriveWatch(webhookUrl) {
    const channelId = crypto.randomUUID();
    // Expiry is max 1 week (604800000 ms). We use 6 days.
    const expiration = Date.now() + 6 * 24 * 60 * 60 * 1000;
    logger.info(`Starting drive changes.watch with channel ${channelId}`);
    // Need a start token to watch changes
    const tokenRes = await exports.drive.changes.getStartPageToken({});
    const pageToken = tokenRes.data.startPageToken;
    if (!pageToken) {
        throw new Error('Failed to get start page token for Drive changes.');
    }
    const res = await exports.drive.changes.watch({
        pageToken,
        requestBody: {
            id: channelId,
            type: 'web_hook',
            address: webhookUrl,
            expiration: expiration.toString(),
        },
    });
    const state = {
        channelId: res.data.id,
        resourceId: res.data.resourceId,
        expiration: parseInt(res.data.expiration || expiration.toString(), 10),
        webhookUrl,
        pageToken,
    };
    const db = (0, firestore_1.getFirestore)();
    await db.doc(WATCH_DOC_PATH).set(state);
    return state;
}
/**
 * Stops an existing drive watch channel.
 * @param channelId - The channel ID.
 * @param resourceId - The resource ID from the watch response.
 */
async function stopDriveWatch(channelId, resourceId) {
    logger.info(`Stopping drive watch channel ${channelId}`);
    try {
        await exports.drive.channels.stop({
            requestBody: {
                id: channelId,
                resourceId: resourceId,
            },
        });
    }
    catch (err) {
        logger.warn('Failed to stop drive channel, it may have already expired.', {
            err,
        });
    }
}
/**
 * Retrieves the current watch state from Firestore.
 * @returns The current watch state, or null if none exists.
 */
async function getWatchState() {
    const db = (0, firestore_1.getFirestore)();
    const snap = await db.doc(WATCH_DOC_PATH).get();
    if (!snap.exists)
        return null;
    return snap.data();
}
/**
 * Updates the stored page token after processing changes.
 * @param token - The new page token.
 */
async function updatePageToken(token) {
    const db = (0, firestore_1.getFirestore)();
    await db.doc(WATCH_DOC_PATH).update({ pageToken: token });
}
//# sourceMappingURL=watch.js.map