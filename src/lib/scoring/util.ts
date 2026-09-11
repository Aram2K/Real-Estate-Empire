export function clamp(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Linear 0–100 score. `value === atZero` → 0, `value === atHundred` → 100,
 * clamped outside the range. Works for decreasing signals too (pass
 * atZero > atHundred). Nullish/NaN → 0.
 */
export function linScore(
  value: number | null | undefined,
  atZero: number,
  atHundred: number
): number {
  if (value == null || Number.isNaN(value)) return 0;
  const t = (value - atZero) / (atHundred - atZero);
  return clamp(t * 100);
}

export function round(x: number): number {
  return Math.round(x);
}

/** Weighted average of {score, weight} parts; weights need not sum to 1. */
export function weighted(parts: { score: number; weight: number }[]): number {
  const totalW = parts.reduce((s, p) => s + p.weight, 0);
  if (totalW === 0) return 0;
  const sum = parts.reduce((s, p) => s + p.score * p.weight, 0);
  return clamp(sum / totalW);
}
