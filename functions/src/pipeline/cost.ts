// Gemini per-million-token prices in USD. Defaults are the Flash tier;
// override via env if the model/region differs. Verify against your
// actual model before relying on the figures for billing.
export const GEMINI_INPUT_USD_PER_1M =
  parseFloat(process.env.GEMINI_INPUT_USD_PER_1M || '') || 0.075;
export const GEMINI_OUTPUT_USD_PER_1M =
  parseFloat(process.env.GEMINI_OUTPUT_USD_PER_1M || '') || 0.3;

/**
 * Estimates the USD cost of a Gemini call from its token usage.
 *
 * Thinking ("reasoning") tokens are billed at the output rate but are
 * reported by the API in a separate `thoughtsTokenCount`, NOT inside
 * `candidatesTokenCount`. Omitting them under-reports the true cost (the
 * cause of the SM-29 bill surprise), so they are charged here alongside
 * the candidate output tokens.
 * @param {number} tokensIn - Prompt (input) token count.
 * @param {number} tokensOut - Candidate (output) token count.
 * @param {number} thinkingTokens - Reasoning tokens (billed as output).
 * @return {number} Estimated cost in USD.
 */
export function estimateGeminiCostUsd(
  tokensIn: number,
  tokensOut: number,
  thinkingTokens = 0
): number {
  const inCost = (tokensIn / 1_000_000) * GEMINI_INPUT_USD_PER_1M;
  const outTokens = tokensOut + thinkingTokens;
  const outCost = (outTokens / 1_000_000) * GEMINI_OUTPUT_USD_PER_1M;
  return inCost + outCost;
}
