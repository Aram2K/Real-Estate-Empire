import { STRONG_CASHFLOW_CENTS } from "@/lib/finance/whiteOperation";

/** Presentation helpers for scores / statuses. Safe for client + server. */

/** Vivid red→green scale for investment scores so differences are legible. */
export function scoreColor(score: number): string {
  if (score >= 85) return "#15803d"; // deep green
  if (score >= 75) return "#22c55e"; // green
  if (score >= 65) return "#84cc16"; // lime
  if (score >= 55) return "#eab308"; // yellow
  if (score >= 45) return "#f97316"; // orange
  return "#ef4444"; // red
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Interesting";
  if (score >= 60) return "Watch";
  return "Weak";
}

export const WHITE_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  EXCELLENT: { label: "Excellent", color: "#065f46", bg: "#a7f3d0" },
  STRONG: { label: "Strong White", color: "#166534", bg: "#bbf7d0" },
  FULL: { label: "Full White", color: "#0e7490", bg: "#a5f3fc" },
  NOT_WHITE: { label: "Not White", color: "#7f1d1d", bg: "#fecaca" },
};

export function dscrBandLabel(dscr: number): string {
  if (!Number.isFinite(dscr) || dscr >= 1.3) return "Excellent";
  if (dscr >= 1.2) return "Strong";
  if (dscr >= 1.1) return "Acceptable";
  if (dscr >= 1.0) return "Fragile";
  return "Negative";
}

function lerpStops(stops: [number, number, number][], t: number): string {
  const x = Math.max(0, Math.min(1, t));
  const seg = x * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = stops[i];
  const b = stops[i + 1];
  const rgb = a.map((c, k) => Math.round(c + (b[k] - c) * f));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/** "Good" ramp for scores/yield: red (low) → yellow → green (high). */
export function rampScore(t: number): string {
  return lerpStops(
    [
      [239, 68, 68], // red
      [249, 115, 22], // orange
      [234, 179, 8], // yellow
      [132, 204, 22], // lime
      [21, 128, 61], // green
    ],
    t
  );
}

/** Neutral magnitude ramp for prices/rents: light → deep indigo. */
export function rampMagnitude(t: number): string {
  return lerpStops(
    [
      [224, 231, 255], // indigo-100
      [129, 140, 248], // indigo-400
      [67, 56, 202], // indigo-700
      [30, 27, 75], // indigo-950
    ],
    t
  );
}

/**
 * Cash-flow colour, aligned with the opération-blanche bands in
 * `src/lib/finance/whiteOperation.ts` so the colour means the same thing
 * everywhere it appears:
 *
 *   < €0        red    — NOT_WHITE, the owner tops up every month
 *   €0 … €100   amber  — FULL white, but no margin for vacancy or repairs
 *   ≥ €100      green  — STRONG white territory
 */
export function cashFlowColor(cents: number | null | undefined): string {
  return cashFlowStyle(cents).color;
}

/**
 * Foreground + background for a cash-flow chip.
 *
 * €0 is a hard boundary, not a soft one: below it the owner tops the mortgage up
 * every month, which is precisely the outcome an opération blanche exists to
 * avoid. So negative is red — never amber. Amber is reserved for deals that
 * clear €0 but sit under the €100/mo STRONG threshold, where one void month
 * wipes out the year.
 */
export function cashFlowStyle(cents: number | null | undefined): {
  color: string;
  bg: string;
} {
  if (cents == null || Number.isNaN(cents)) return { color: "#334155", bg: "#e2e8f0" };
  if (cents < 0) return { color: "#991b1b", bg: "#fee2e2" }; // red
  if (cents < STRONG_CASHFLOW_CENTS) return { color: "#92400e", bg: "#fef3c7" }; // amber
  return { color: "#166534", bg: "#dcfce7" }; // green
}

/** Plain-language reason behind `cashFlowColor`, for tooltips / title text. */
export function cashFlowLabel(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "No cash-flow estimate";
  if (cents < 0) return "Negative — you top this up every month";
  if (cents < STRONG_CASHFLOW_CENTS) return "Breaks even, but with a thin margin";
  return "Positive with margin";
}
