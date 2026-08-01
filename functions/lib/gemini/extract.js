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
exports.extractPricesFromPdf = extractPricesFromPdf;
const generative_ai_1 = require("@google/generative-ai");
const schema_1 = require("./schema");
const logger = __importStar(require("firebase-functions/logger"));
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
/**
 * Extracts structured pricing data from a newsletter PDF using Gemini.
 * @param pdfBuffer - The raw PDF bytes.
 * @returns The validated extraction record.
 */
async function extractPricesFromPdf(pdfBuffer) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable not set.');
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
            responseMimeType: 'application/json',
        },
    });
    const prompt = 'You are a data extraction assistant.\n' +
        'Extract the following exact commodity prices from the provided PDF.\n' +
        'The issue date should be exactly as printed on the front page.\n' +
        'All prices must be returned verbatim as strings ' +
        '(including ranges and commas).\n' +
        'If a value cannot be found, you MUST return an explicit ' +
        'empty string ("") for that field.\n\n' +
        'Required fields:\n' +
        '- newsletter_issue_date: Issue date range, e.g. "JULY 27-AUGUST 02"\n' +
        '- year: 4-digit publication year (integer)\n' +
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
        '- pig_iron_foundry_gr_pune: Pig Iron Foundry Grade - A (Pune)\n\n' +
        'Return ONLY valid JSON matching this schema exactly.';
    const inlineData = {
        inlineData: {
            data: pdfBuffer.toString('base64'),
            mimeType: 'application/pdf',
        },
    };
    let attempt = 0;
    let delayMs = INITIAL_BACKOFF_MS;
    while (attempt < MAX_RETRIES) {
        try {
            attempt++;
            logger.info(`Extracting data from PDF (attempt ${attempt}/${MAX_RETRIES})`);
            const result = await model.generateContent([prompt, inlineData]);
            const text = result.response.text();
            // Parse JSON
            let parsedJson;
            try {
                parsedJson = JSON.parse(text);
            }
            catch (err) {
                throw new Error(`Failed to parse Gemini response as JSON: ${text}`);
            }
            // Zod validation
            const parsedData = schema_1.extractionRecordSchema.parse(parsedJson);
            logger.info('Successfully extracted and validated data.');
            return parsedData;
        }
        catch (error) {
            // Do not retry validation or parsing errors
            const err = error;
            if (err.name === 'ZodError' ||
                (err.message && err.message.includes('parse Gemini response'))) {
                logger.error('Data validation failed', { error });
                throw err;
            }
            if (attempt >= MAX_RETRIES) {
                logger.error(`Failed after ${MAX_RETRIES} attempts.`, { error });
                throw new Error(`Extraction failed: ${err.message}`);
            }
            logger.warn(`Extraction attempt ${attempt} failed. Retrying in ${delayMs}ms.`, { error });
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            delayMs *= 2;
        }
    }
    throw new Error('Unreachable code reached in extractPricesFromPdf');
}
//# sourceMappingURL=extract.js.map