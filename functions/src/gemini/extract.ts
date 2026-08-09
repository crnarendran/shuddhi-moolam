import {
  GoogleGenerativeAI,
  GenerationConfig,
} from '@google/generative-ai';
import {
  GoogleAIFileManager,
  FileState,
} from '@google/generative-ai/server';
import { extractionRecordSchema, ExtractionRecord } from './schema';
import { buildPromptFields } from './components';
import * as logger from 'firebase-functions/logger';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const UPLOAD_POLL_INTERVAL_MS = 2000;
const UPLOAD_TIMEOUT_MS = 120000;

/**
 * Uploads a PDF via the Gemini File API and waits until it is ACTIVE.
 * The File API accepts files far larger than the ~20 MB inline-request
 * cap, so oversized issues no longer fail (SM-29 Phase 2).
 * @param {GoogleAIFileManager} fileManager - The file manager client.
 * @param {Buffer} pdfBuffer - The raw PDF bytes.
 * @return {Promise<{uri: string; name: string; mimeType: string}>}
 *   The active file reference.
 */
async function uploadPdfAndWait(
  fileManager: GoogleAIFileManager,
  pdfBuffer: Buffer
): Promise<{ uri: string; name: string; mimeType: string }> {
  const uploaded = await fileManager.uploadFile(pdfBuffer, {
    mimeType: 'application/pdf',
    displayName: 'mmr-newsletter.pdf',
  });
  let file = uploaded.file;
  const startedAt = Date.now();
  while (file.state === FileState.PROCESSING) {
    if (Date.now() - startedAt > UPLOAD_TIMEOUT_MS) {
      throw new Error('File API timed out processing the PDF.');
    }
    await new Promise((r) => setTimeout(r, UPLOAD_POLL_INTERVAL_MS));
    file = await fileManager.getFile(file.name);
  }
  if (file.state === FileState.FAILED) {
    throw new Error('File API failed to process the PDF.');
  }
  return { uri: file.uri, name: file.name, mimeType: file.mimeType };
}

/**
 * Extracts structured pricing data from a newsletter PDF using Gemini.
 * @param {Buffer} pdfBuffer - The raw PDF bytes.
 * @returns {Promise<{
 *   data: ExtractionRecord;
 *   usage: {
 *     totalTokenCount: number;
 *     promptTokenCount: number;
 *     candidatesTokenCount: number;
 *     thoughtsTokenCount: number;
 *   }
 * }>} The validated extraction record and token usage.
 */
export async function extractPricesFromPdf(
  pdfBuffer: Buffer
): Promise<{
  data: ExtractionRecord;
  usage: {
    totalTokenCount: number;
    promptTokenCount: number;
    candidatesTokenCount: number;
    thoughtsTokenCount: number;
  }
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Thinking/reasoning is disabled: this is structured table extraction,
  // not multi-step reasoning, and thinking tokens are billed at the
  // output rate — unbounded thinking was the cause of the SM-29 cost
  // spike. `thinkingConfig` is not declared in this SDK version's types,
  // so it is cast through; the REST API still honours the field.
  const generationConfig = {
    responseMimeType: 'application/json',
    thinkingConfig: { thinkingBudget: 0 },
  } as unknown as GenerationConfig;
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    generationConfig,
  });

  const prompt =
    'You are a data extraction assistant for the Minerals & Metals ' +
    'Review (MMR) weekly newsletter.\n' +
    'Extract the following exact commodity prices from the provided ' +
    'PDF. Each field notes the source table and an approximate page ' +
    'number as a hint; rely on the table/section name to locate the ' +
    'value if pagination differs.\n' +
    'All prices must be returned as strings (with commas intact).\n' +
    'If a price is listed as a range (e.g. 42,600 - 42,800), you MUST ' +
    'extract ONLY the upper bound (maximum) value (e.g. 42,800).\n' +
    'If a value cannot be found, you MUST return an explicit ' +
    'empty string ("") for that field.\n\n' +
    'Required fields:\n' +
    '- date: The issue date from the header of any page, ' +
    'formatted explicitly as dd/MM/yyyy\n' +
    buildPromptFields() +
    '\n- source_pages: A comma-separated string mapping each ' +
    'extracted field name to the page number it was read from, e.g. ' +
    '"crca_bundle_mumbai: 7, lam_coke: 8"\n\n' +
    'Return ONLY valid JSON matching this schema exactly.';

  const fileManager = new GoogleAIFileManager(apiKey);
  const uploaded = await uploadPdfAndWait(fileManager, pdfBuffer);
  const filePart = {
    fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType },
  };

  let attempt = 0;
  let delayMs = INITIAL_BACKOFF_MS;

  try {
    while (attempt < MAX_RETRIES) {
      try {
        attempt++;
        logger.info(
          `Extracting data from PDF (attempt ${attempt}/${MAX_RETRIES})`
        );

        const result = await model.generateContent([prompt, filePart]);
        const text = result.response.text();
        const usageMetadata = result.response.usageMetadata;
        const totalTokenCount = usageMetadata?.totalTokenCount || 0;
        const promptTokenCount = usageMetadata?.promptTokenCount || 0;
        const candidatesTokenCount =
          usageMetadata?.candidatesTokenCount || 0;
        // Reasoning tokens are billed but reported separately (not in
        // candidatesTokenCount) and are absent from this SDK's types.
        const thoughtsTokenCount =
          (usageMetadata as { thoughtsTokenCount?: number })
            ?.thoughtsTokenCount || 0;

        // Parse JSON
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(text);
        } catch (err) {
          throw new Error(
            `Failed to parse Gemini response as JSON: ${text}`
          );
        }

        // Zod validation
        const parsedData = extractionRecordSchema.parse(parsedJson);
        logger.info('Successfully extracted and validated data.');
        return {
          data: parsedData,
          usage: {
            totalTokenCount,
            promptTokenCount,
            candidatesTokenCount,
            thoughtsTokenCount,
          }
        };
      } catch (error: unknown) {
        // Do not retry validation or parsing errors
        const err = error as Error;
        if (
          err.name === 'ZodError' ||
          (err.message && err.message.includes('parse Gemini response'))
        ) {
          logger.error('Data validation failed', { error });
          throw err;
        }

        if (attempt >= MAX_RETRIES) {
          logger.error(`Failed after ${MAX_RETRIES} attempts.`, { error });
          throw new Error(`Extraction failed: ${err.message}`);
        }

        logger.warn(
          `Extraction attempt ${attempt} failed. Retrying in ${delayMs}ms.`,
          { error }
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      }
    }

    throw new Error('Unreachable code reached in extractPricesFromPdf');
  } finally {
    await fileManager.deleteFile(uploaded.name).catch((e) => {
      logger.warn('Failed to delete uploaded file from File API', {
        error: e,
      });
    });
  }
}
