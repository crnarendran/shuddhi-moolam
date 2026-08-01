import { drive } from './watch';
import * as logger from 'firebase-functions/logger';

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Downloads a PDF file from Google Drive into a Buffer.
 * Checks mimeType and size constraints before downloading.
 * @param {string} fileId - The ID of the Drive file to download.
 * @returns {Promise<{buffer: Buffer, filename: string}>} A Buffer
 * containing the PDF bytes and its filename.
 */
export async function downloadPdf(
  fileId: string
): Promise<{buffer: Buffer, filename: string}> {
  logger.info(`Fetching metadata for file ${fileId}`);

  const meta = await drive.files.get({
    fileId,
    fields: 'mimeType, size, name',
  });

  const { mimeType, size, name } = meta.data;

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

  return {
    buffer: Buffer.from(response.data as ArrayBuffer),
    filename: name || fileId
  };
}
