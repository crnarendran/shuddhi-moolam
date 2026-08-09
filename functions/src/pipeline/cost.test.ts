import {
  estimateGeminiCostUsd,
  GEMINI_INPUT_USD_PER_1M,
  GEMINI_OUTPUT_USD_PER_1M,
} from './cost';

describe('estimateGeminiCostUsd', () => {
  it('computes cost from input and output tokens', () => {
    const cost = estimateGeminiCostUsd(1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(
      GEMINI_INPUT_USD_PER_1M + GEMINI_OUTPUT_USD_PER_1M,
      6
    );
  });

  it('returns 0 for zero tokens', () => {
    expect(estimateGeminiCostUsd(0, 0)).toBe(0);
  });

  it('scales linearly with token count', () => {
    expect(estimateGeminiCostUsd(500_000, 0)).toBeCloseTo(
      GEMINI_INPUT_USD_PER_1M / 2,
      6
    );
  });

  it('bills thinking tokens at the output rate', () => {
    expect(estimateGeminiCostUsd(0, 0, 1_000_000)).toBeCloseTo(
      GEMINI_OUTPUT_USD_PER_1M,
      6
    );
  });

  it('adds thinking tokens onto the candidate output tokens', () => {
    const split = estimateGeminiCostUsd(0, 500_000, 500_000);
    const combined = estimateGeminiCostUsd(0, 1_000_000, 0);
    expect(split).toBeCloseTo(combined, 9);
  });

  it('defaults thinking tokens to zero (backward compatible)', () => {
    expect(estimateGeminiCostUsd(1_000_000, 1_000_000)).toBe(
      estimateGeminiCostUsd(1_000_000, 1_000_000, 0)
    );
  });
});
