/** Heuristic: ~4 chars per token for mixed Latin/Cyrillic (spec §8). */
export function roughTokenEstimate(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateUsdRange(params: {
  inputTokens: number;
  /** Estimated output tokens (band for uncertainty). */
  outputTokensLow: number;
  outputTokensHigh: number;
  usdPer1MInput: number;
  usdPer1MOutput: number;
}): { low: number; high: number; mid: number } {
  const inCost =
    (params.inputTokens / 1_000_000) * params.usdPer1MInput;
  const outLow =
    (params.outputTokensLow / 1_000_000) * params.usdPer1MOutput;
  const outHigh =
    (params.outputTokensHigh / 1_000_000) * params.usdPer1MOutput;
  const low = inCost + outLow;
  const high = inCost + outHigh;
  return { low, high, mid: (low + high) / 2 };
}
