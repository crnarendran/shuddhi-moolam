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
});
