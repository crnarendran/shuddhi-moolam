import {
  GoogleGenerativeAI,
  GenerationConfig,
  Part,
} from '@google/generative-ai';
import {
  GoogleAIFileManager,
  FileState,
} from '@google/generative-ai/server';
import { extractionRecordSchema, ExtractionRecord } from './schema';
import { buildPromptFields } from './components';
import { mergeRecords } from './consensus';
import * as logger from 'firebase-functions/logger';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const UPLOAD_POLL_INTERVAL_MS = 2000;
const UPLOAD_TIMEOUT_MS = 120000;
/**
 * The max PDF size (bytes) sent inline; larger PDFs use the File API.
 * Inline is the proven path; the File API only kicks in above the ~20 MB
 * inline-request cap. Base64 inflates ~33%, so the 14 MB default stays
 * safely under 20 MB encoded. Overridable via INLINE_MAX_MB.
 * @returns {number} The inline size threshold in bytes.
 */
function inlineMaxBytes(): number {
  const raw = process.env.INLINE_MAX_MB;
  const mb = raw !== undefined && raw !== '' ? parseInt(raw, 10) : 14;
  return (Number.isNaN(mb) ? 14 : mb) * 1024 * 1024;
}

/**
 * Uploads a PDF via the Gemini File API and waits until it is ACTIVE.
 * The File API accepts files far larger than the ~20 MB inline-request
 * cap, so oversized issues no longer fail (SM-29 Phase 2).
 * @param {GoogleAIFileManager} fileManager - The file manager client.
 * @param {Buffer} pdfBuffer - The raw PDF bytes.
 * @returns {Promise<{uri: string; name: string; mimeType: string}>}
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

export interface ExtractOptions {
  /** Gemini thinking budget (min 1024). Defaults to 1024. */
  thinkingBudget?: number;
  /** Force the inline base64 path regardless of size (probe/testing only). */
  forceInline?: boolean;
  /** Gemini model id. Defaults to $GEMINI_MODEL, else gemini-3.6-flash. */
  model?: string;
}

/**
 * Extracts structured pricing data from a newsletter PDF using Gemini.
 * @param {Buffer} pdfBuffer - The raw PDF bytes.
 * @param {ExtractOptions} options - Thinking budget / route overrides.
 * @returns {Promise<{
 *   data: ExtractionRecord;
 *   route: 'inline' | 'file-api';
 *   usage: {
 *     totalTokenCount: number;
 *     promptTokenCount: number;
 *     candidatesTokenCount: number;
 *     thoughtsTokenCount: number;
 *   }
 * }>} The validated extraction record, route used, and token usage.
 */
export async function extractPricesFromPdf(
  pdfBuffer: Buffer,
  options: ExtractOptions = {}
): Promise<{
  data: ExtractionRecord;
  route: 'inline' | 'file-api';
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
  const thinkingBudget = options.thinkingBudget ?? 1024;
  const generationConfig = {
    responseMimeType: 'application/json',
    // 1024 is the minimum budget; 0 causes a 400 Bad Request
    thinkingConfig: { thinkingBudget },
  } as unknown as GenerationConfig;
  const modelName = options.model
    || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const model = genAI.getGenerativeModel({
    model: modelName,
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
    'Read each price as the EXACT printed figure, digit for digit, ' +
    'INCLUDING the hundreds (e.g. "48,500" — never store it as "48,000" ' +
    'or "49,000"). Do NOT round, truncate, or approximate any value to ' +
    'the nearest thousand; the hundreds digits are significant.\n' +
    'If a price is listed as a range (e.g. 42,600 - 42,800), you MUST ' +
    'extract ONLY the upper bound (maximum) value (e.g. 42,800).\n' +
    'IMPORTANT: the Primary Material & Semi-finished Products / Melting ' +
    'Scrap table (approx. page 7) prints TWO weekly-average columns, each ' +
    'headed by a DATE (e.g. "22-05-2026" and "15-05-2026"). These are NOT ' +
    'a price range and must NOT be averaged together. Compare the two ' +
    'column dates and, for every field in that table, extract the SINGLE ' +
    'value under the column with the MOST RECENT (latest) date. The latest ' +
    'date may be the LEFT or the RIGHT column — decide strictly by the ' +
    'dates, never by position. The upper-bound rule above applies only to ' +
    'a genuine min-max range.\n' +
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

  // Normal-sized issues go inline (the proven path); only oversized PDFs
  // that would exceed the inline cap use the File API (SM-29 Phase 2).
  let filePart: Part;
  let fileManager: GoogleAIFileManager | undefined;
  let uploadedName: string | undefined;
  const useInline = options.forceInline
    || pdfBuffer.length <= inlineMaxBytes();
  const route: 'inline' | 'file-api' = useInline ? 'inline' : 'file-api';
  if (useInline) {
    filePart = {
      inlineData: {
        data: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    };
  } else {
    fileManager = new GoogleAIFileManager(apiKey);
    const uploaded = await uploadPdfAndWait(fileManager, pdfBuffer);
    uploadedName = uploaded.name;
    filePart = {
      fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType },
    };
  }

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
          route,
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
    if (fileManager && uploadedName) {
      await fileManager.deleteFile(uploadedName).catch((e) => {
        logger.warn('Failed to delete uploaded file from File API', {
          error: e,
        });
      });
    }
  }
}

/**
 * Runs the extractor `runs` times and returns the per-field consensus (SM-58)
 * so a non-deterministic misread (wrong two-column pick, a rounded value) is
 * outvoted. Token usage is summed across runs (cost telemetry stays honest).
 * @param {Buffer} pdfBuffer - The raw PDF bytes.
 * @param {ExtractOptions} options - Extractor options (thinking budget etc.).
 * @param {number} runs - Number of extraction passes (default 3).
 * @returns {Promise<{data: ExtractionRecord; route: 'inline' | 'file-api';
 *   usage: {totalTokenCount: number; promptTokenCount: number;
 *   candidatesTokenCount: number; thoughtsTokenCount: number}}>} The consensus
 *   record, route, and summed usage.
 */
export async function extractPricesConsensus(
  pdfBuffer: Buffer,
  options: ExtractOptions = {},
  runs = 3
): Promise<{
  data: ExtractionRecord;
  route: 'inline' | 'file-api';
  usage: {
    totalTokenCount: number;
    promptTokenCount: number;
    candidatesTokenCount: number;
    thoughtsTokenCount: number;
  }
}> {
  const n = Math.max(1, Math.floor(runs));
  const results: Awaited<ReturnType<typeof extractPricesFromPdf>>[] = [];
  for (let i = 0; i < n; i++) {
    results.push(await extractPricesFromPdf(pdfBuffer, options));
  }
  const data = mergeRecords(results.map((r) => r.data));
  const sum = (pick: (u: (typeof results)[number]['usage']) => number) =>
    results.reduce((s, r) => s + pick(r.usage), 0);
  return {
    data,
    route: results[0].route,
    usage: {
      totalTokenCount: sum((u) => u.totalTokenCount),
      promptTokenCount: sum((u) => u.promptTokenCount),
      candidatesTokenCount: sum((u) => u.candidatesTokenCount),
      thoughtsTokenCount: sum((u) => u.thoughtsTokenCount),
    },
  };
}
