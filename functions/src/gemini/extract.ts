import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractionRecordSchema, ExtractionRecord } from './schema';
import * as logger from 'firebase-functions/logger';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Extracts structured pricing data from a newsletter PDF using Gemini.
 * @param {Buffer} pdfBuffer - The raw PDF bytes.
 * @returns {Promise<{
 *   data: ExtractionRecord;
 *   usage: {
 *     totalTokenCount: number;
 *     promptTokenCount: number;
 *     candidatesTokenCount: number;
 *   }
 * }>} The validated extraction record.
 */
export async function extractPricesFromPdf(
  pdfBuffer: Buffer
): Promise<{
  data: ExtractionRecord;
  usage: {
    totalTokenCount: number;
    promptTokenCount: number;
    candidatesTokenCount: number;
  }
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const prompt =
    'You are a data extraction assistant.\n' +
    'Extract the following exact commodity prices from the provided PDF.\n' +
    'The issue date should be exactly as printed on the front page.\n' +
    'All prices must be returned as strings (with commas intact).\n' +
    'If a price is listed as a range (e.g. 42,600 - 42,800), you MUST ' +
    'extract ONLY the upper bound (maximum) value (e.g. 42,800).\n' +
    'If a value cannot be found, you MUST return an explicit ' +
    'empty string ("") for that field.\n\n' +
    'Required fields:\n' +
    '- date: The issue date from the header of any page, ' +
    'formatted explicitly as dd/MM/yyyy\n' +
    '- crca_bundle_mumbai: Melting Scrap (CRCA – Bundle) LSLP (Mumbai)\n' +
    '- crca_bundle_chennai: Melting Scrap (CRCA – Bundle) LSLP (Chennai)\n' +
    '- melting_foundry_scrap_mumbai: Melting Scrap (Mumbai) (Foundry)\n' +
    '- fe_mn_hc_mumbai: Ferro Manganese HC (Ferro Alloys - Mumbai)\n' +
    '- fe_si_70_75_mumbai: Ferro Silicon (70-75%) (Ferro Alloys - Mumbai)\n' +
    '- low_sulp_cal_petro_coke: Low Sulp. cal Petro. Coke 98% (Raipur)\n' +
    '- fe_si_mg_mumbai: Ferro Silicon Magnesium (Ferro Alloys - Mumbai)\n' +
    '- cu_lme: LME Settlement Rate, Copper Grade A\n' +
    '- cu_domestic: Domestic / MMR Landed price for Copper\n' +
    '- fe_cr_mumbai: Ferro Chromium (High or Low Carbon), Mumbai market\n' +
    '- pig_iron_foundry_gr_pune: Pig Iron Foundry Grade - A (Pune)\n' +
    '- source_pages: A comma-separated string mapping each extracted column ' +
    'name to its page number, e.g. "crca_bundle_mumbai: 4, cu_lme: 1"\n\n' +
    'Return ONLY valid JSON matching this schema exactly.';

  const inlineData = {
    inlineData: {
      data: pdfBuffer.toString('base64'),
      mimeType: 'application/pdf',
    },
  };

  let attempt = 0;
  const isTest =
    process.env.NODE_ENV === 'test' ||
    process.env.JEST_WORKER_ID !== undefined;
  let delayMs = isTest ? 0 : INITIAL_BACKOFF_MS;

  while (attempt < MAX_RETRIES) {
    try {
      attempt++;
      logger.info(
        `Extracting data from PDF (attempt ${attempt}/${MAX_RETRIES})`
      );

      const result = await model.generateContent([prompt, inlineData]);
      const text = result.response.text();
      const usageMetadata = result.response.usageMetadata;
      const totalTokenCount = usageMetadata?.totalTokenCount || 0;
      const promptTokenCount = usageMetadata?.promptTokenCount || 0;
      const candidatesTokenCount = usageMetadata?.candidatesTokenCount || 0;

      // Parse JSON
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
        if (Array.isArray(parsedJson) && parsedJson.length > 0) {
          parsedJson = parsedJson[0];
        }
      } catch (err) {
        throw new Error(`Failed to parse Gemini response as JSON: ${text}`);
      }

      // Zod validation
      const parsedData = extractionRecordSchema.parse(parsedJson);
      logger.info('Successfully extracted and validated data.');
      return {
        data: parsedData,
        usage: { totalTokenCount, promptTokenCount, candidatesTokenCount }
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
}
