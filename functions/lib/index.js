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
exports.renewWatch = exports.registerWatch = exports.helloWorld = exports.driveWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const watch_1 = require("./drive/watch");
const webhook_1 = require("./drive/webhook");
Object.defineProperty(exports, "driveWebhook", { enumerable: true, get: function () { return webhook_1.driveWebhook; } });
(0, app_1.initializeApp)();
/**
 * A sample function to verify scaffolding.
 */
exports.helloWorld = (0, https_1.onRequest)((request, response) => {
    logger.info('Hello logs!', { structuredData: true });
    response.send('Hello from Firebase!');
});
/**
 * Admin callable to manually register a drive watch channel.
 */
exports.registerWatch = (0, https_1.onCall)(async (request) => {
    const { webhookUrl } = request.data;
    if (!webhookUrl) {
        throw new https_1.HttpsError('invalid-argument', 'webhookUrl is required');
    }
    const state = await (0, watch_1.getWatchState)();
    if (state) {
        logger.info('Stopping existing watch channel before registering new one.');
        await (0, watch_1.stopDriveWatch)(state.channelId, state.resourceId);
    }
    const newState = await (0, watch_1.startDriveWatch)(webhookUrl);
    return { success: true, watchState: newState };
});
/**
 * Scheduled function to renew the drive watch channel before it expires.
 * Runs every 24 hours.
 */
exports.renewWatch = (0, scheduler_1.onSchedule)('every 24 hours', async () => {
    const state = await (0, watch_1.getWatchState)();
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
        await (0, watch_1.startDriveWatch)(state.webhookUrl);
        logger.info('Successfully renewed watch channel. Stopping old channel.');
        await (0, watch_1.stopDriveWatch)(state.channelId, state.resourceId);
    }
    catch (error) {
        logger.error('Failed to renew watch channel', { error });
    }
});
//# sourceMappingURL=index.js.map