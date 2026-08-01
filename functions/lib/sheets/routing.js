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
exports.sheetsClient = void 0;
exports.ensureYearTab = ensureYearTab;
const googleapis_1 = require("googleapis");
const logger = __importStar(require("firebase-functions/logger"));
const constants_1 = require("./constants");
const auth = new googleapis_1.google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
exports.sheetsClient = googleapis_1.google.sheets({ version: 'v4', auth });
/**
 * Ensures that a tab named Data_<year> exists in the master sheet.
 * If it doesn't exist, it creates the tab and writes the canonical headers.
 * @param year - The 4-digit year from the extraction record.
 * @returns The title of the tab (e.g. "Data_2026").
 */
async function ensureYearTab(year) {
    const masterSheetId = process.env.MASTER_SHEET_ID;
    if (!masterSheetId) {
        throw new Error('MASTER_SHEET_ID environment variable not set.');
    }
    const tabTitle = `Data_${year}`;
    logger.info(`Checking for tab ${tabTitle} in sheet ${masterSheetId}`);
    const doc = await exports.sheetsClient.spreadsheets.get({
        spreadsheetId: masterSheetId,
    });
    const existingSheet = doc.data.sheets?.find((s) => s.properties?.title === tabTitle);
    if (existingSheet) {
        logger.info(`Tab ${tabTitle} already exists.`);
        return tabTitle;
    }
    logger.info(`Tab ${tabTitle} does not exist. Creating...`);
    await exports.sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: masterSheetId,
        requestBody: {
            requests: [
                {
                    addSheet: {
                        properties: {
                            title: tabTitle,
                        },
                    },
                },
            ],
        },
    });
    await exports.sheetsClient.spreadsheets.values.update({
        spreadsheetId: masterSheetId,
        range: `${tabTitle}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [constants_1.SHEET_HEADERS],
        },
    });
    logger.info(`Tab ${tabTitle} created with headers.`);
    return tabTitle;
}
//# sourceMappingURL=routing.js.map