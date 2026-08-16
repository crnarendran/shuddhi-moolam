import {
  onCall, HttpsError, type CallableRequest,
} from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { downloadPdf } from '../drive/download';
import { extractPricesFromPdf } from '../gemini/extract';

const geminiApiKeySecret = defineSecret('GEMINI_API_KEY');
const ADMIN_EMAILS = ['crnarendran@gmail.com'];

// The fields most useful for the extraction-accuracy probe: the confusable
// dense-table ferro alloys, plus the Rs/tonne items whose kg decimals we are
// trying to preserve (SM-54).
const WATCH_KEYS = [
  'inoculant_2_6mm_mumbai', 'fe_mn_hc_mumbai', 'fe_si_mg_mumbai',
  'fe_cr_mumbai', 'crca_bundle_mumbai', 'crca_bundle_chennai',
  'pig_iron_sg_grade_a_pune', 'pig_iron_foundry_gr_pune',
] as const;

interface ProbeInput {
  fileId?: string;
  thinkingBudget?: number;
  forceInline?: boolean;
  runs?: number;
}

/**
 * Admin-only, side-effect-free extraction probe (SM-55). Downloads a Drive
 * PDF and re-runs the extractor with a chosen thinking budget / route N times,
 * returning only the watched fields — so we can compare inline vs File-API,
 * thinking budgets, and run-to-run determinism WITHOUT writing to the Sheet or
 * Firestore. The Drive service account must be able to read the fileId.
 * @param {CallableRequest} request { fileId, thinkingBudget?, forceInline?,
 *   runs? }.
 * @returns {Promise<object>} filename, size, config, and per-run watched
 *   fields + token usage.
 */
export const probeExtraction = onCall(
  { secrets: [geminiApiKeySecret], timeoutSeconds: 540, memory: '1GiB' },
  async (request: CallableRequest) => {
    const caller = (request.auth?.token.email || '').toLowerCase();
    if (!request.auth || !ADMIN_EMAILS.includes(caller)) {
      throw new HttpsError('permission-denied', 'Admins only.');
    }
    const data = request.data as ProbeInput;
    const fileId = (data.fileId || '').trim();
    if (!fileId) throw new HttpsError('invalid-argument', 'fileId required.');
    const runs = Math.min(Math.max(Math.floor(data.runs ?? 1), 1), 4);
    const thinkingBudget = Math.max(
      Math.floor(data.thinkingBudget ?? 1024), 1024
    );
    const forceInline = !!data.forceInline;

    const { buffer, filename } = await downloadPdf(fileId);
    const sizeMb = Number((buffer.length / 1048576).toFixed(2));

    const results: Array<Record<string, unknown>> = [];
    for (let i = 0; i < runs; i++) {
      const { data: rec, route, usage } = await extractPricesFromPdf(
        buffer, { thinkingBudget, forceInline }
      );
      const source = rec as Record<string, unknown>;
      const watched: Record<string, unknown> = {};
      for (const k of WATCH_KEYS) watched[k] = source[k];
      results.push({
        run: i + 1,
        route,
        watched,
        sourcePages: source.source_pages,
        totalTokens: usage.totalTokenCount,
        thinkingTokens: usage.thoughtsTokenCount,
      });
    }

    return { filename, sizeMb, thinkingBudget, forceInline, runs, results };
  }
);
