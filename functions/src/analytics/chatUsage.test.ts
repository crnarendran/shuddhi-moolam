import { estimateTokens, estimateChatCostUsd } from './chatUsage';

describe('chat usage estimates', () => {
  it('estimates tokens at ~4 chars each', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
  });

  it('estimates cost from tokens and scales linearly', () => {
    expect(estimateChatCostUsd(0, 0)).toBe(0);
    const a = estimateChatCostUsd(1_000_000, 0);
    const b = estimateChatCostUsd(2_000_000, 0);
    expect(b).toBeCloseTo(a * 2, 9);
    expect(a).toBeGreaterThan(0);
  });
});
