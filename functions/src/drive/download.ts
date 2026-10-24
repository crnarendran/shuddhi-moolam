import { drive } from './watch';
import * as logger from 'firebase-functions/logger';

// Extraction uploads via the Gemini File API (SM-29 Phase 2), which
// handles far larger files than the old ~20 MB inline cap, so this guard
// only exists to reject clearly-bad inputs. Overridable via env.
const MAX_PDF_SIZE_BYTES =
  (parseInt(process.env.MAX_PDF_SIZE_MB || '', 10) || 50) * 1024 * 1024;

/**
 * Downloads a PDF file from Google Drive into a Buffer.
 * Checks mimeType and size constraints before downloading, and extracts
 * the uploader's email address if present (SM-62).
 * @param {string} fileId - The ID of the Drive file to download.
 * @returns {Promise<object>} Buffer, filename, and optional uploader email.
 */
export async function downloadPdf(
  fileId: string
): Promise<{ buffer: Buffer; filename: string; uploaderEmail?: string }> {
  logger.info(`Fetching metadata for file ${fileId}`);

  const meta = await drive.files.get({
    fileId,
    fields:
      'mimeType, size, name, ' +
      'lastModifyingUser(emailAddress), owners(emailAddress)',
  });

  const { mimeType, size, name, lastModifyingUser, owners } = meta.data;

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

  const uploaderEmail =
    lastModifyingUser?.emailAddress || owners?.[0]?.emailAddress;

  logger.info(`Downloading file ${fileId} (${sizeBytes} bytes)`);

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return {
    buffer: Buffer.from(response.data as ArrayBuffer),
    filename: name || fileId,
    ...(uploaderEmail ? { uploaderEmail } : {}),
  };
}
