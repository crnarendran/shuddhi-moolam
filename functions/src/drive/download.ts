import { drive } from './watch';
import * as logger from 'firebase-functions/logger';

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Downloads a PDF file from Google Drive into a Buffer.
 * Checks mimeType and size constraints before downloading.
 * @param {string} fileId - The ID of the Drive file to download.
 * @returns {Promise<Buffer>} A Buffer containing the PDF bytes.
 */
export async function downloadPdf(fileId: string): Promise<Buffer> {
  logger.info(`Fetching metadata for file ${fileId}`);

  const meta = await drive.files.get({
    fileId,
    fields: 'mimeType, size',
  });

  const { mimeType, size } = meta.data;

  if (mimeType !== 'application/pdf') {
    throw new Error(
      `Invalid mimeType: expected application/pdf but got ${mimeType}`
    );
  }

  const sizeBytes = parseInt(size || '0', 10);
  if (sizeBytes > MAX_PDF_SIZE_BYTES) {
    throw new Error(
      `File too large: ${sizeBytes} bytes exceeds limit of ` +
      `${MAX_PDF_SIZE_BYTES}`
    );
  }

  logger.info(`Downloading file ${fileId} (${sizeBytes} bytes)`);

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}
