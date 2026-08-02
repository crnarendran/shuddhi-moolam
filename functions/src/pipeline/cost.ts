// Gemini per-million-token prices in USD. Defaults are the Flash tier;
// override via env if the model/region differs. Verify against your
// actual model before relying on the figures for billing.
export const GEMINI_INPUT_USD_PER_1M =
  parseFloat(process.env.GEMINI_INPUT_USD_PER_1M || '') || 0.075;
export const GEMINI_OUTPUT_USD_PER_1M =
  parseFloat(process.env.GEMINI_OUTPUT_USD_PER_1M || '') || 0.3;

/**
 * Estimates the USD cost of a Gemini call from its token usage.
 * @param {number} tokensIn - Prompt (input) token count.
 * @param {number} tokensOut - Candidate (output) token count.
 * @returns {number} Estimated cost in USD.
 */
export function estimateGeminiCostUsd(
  tokensIn: number,
  tokensOut: number
): number {
  const inCost = (tokensIn / 1_000_000) * GEMINI_INPUT_USD_PER_1M;
  const outCost = (tokensOut / 1_000_000) * GEMINI_OUTPUT_USD_PER_1M;
  return inCost + outCost;
}
