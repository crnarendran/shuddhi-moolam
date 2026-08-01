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
exports.downloadPdf = downloadPdf;
const watch_1 = require("./watch");
const logger = __importStar(require("firebase-functions/logger"));
const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
/**
 * Downloads a PDF file from Google Drive into a Buffer.
 * Checks mimeType and size constraints before downloading.
 * @param fileId - The ID of the Drive file to download.
 * @returns A Buffer containing the PDF bytes.
 */
async function downloadPdf(fileId) {
    logger.info(`Fetching metadata for file ${fileId}`);
    const meta = await watch_1.drive.files.get({
        fileId,
        fields: 'mimeType, size',
    });
    const { mimeType, size } = meta.data;
    if (mimeType !== 'application/pdf') {
        throw new Error(`Invalid mimeType: expected application/pdf but got ${mimeType}`);
    }
    const sizeBytes = parseInt(size || '0', 10);
    if (sizeBytes > MAX_PDF_SIZE_BYTES) {
        throw new Error(`File too large: ${sizeBytes} bytes exceeds limit of ` +
            `${MAX_PDF_SIZE_BYTES}`);
    }
    logger.info(`Downloading file ${fileId} (${sizeBytes} bytes)`);
    const response = await watch_1.drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
}
//# sourceMappingURL=download.js.map