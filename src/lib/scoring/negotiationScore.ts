import { clamp } from "./util";

export interface NegotiationInputs {
  daysOnMarket?: number | null;
  priceReductionCount?: number | null;
  /** total % dropped from first seen to now, e.g. 5.6 */
  totalReductionPct?: number | null;
  /** listing €/m² vs local DVF median €/m², e.g. +8 means 8% above market. */
  priceVsDvfPct?: number | null;
  dpe?: string | null;
  vacant?: boolean | null;
  renovationNeeded?: boolean | null;
  urgencyKeywords?: boolean | null;
}

/**
 * Negotiation Opportunity Score (PRD §27), 0–100. Higher = more room / more
 * seller motivation. Signals are additive and capped.
 */
export function negotiationScore(i: NegotiationInputs): number {
  let s = 0;

  const dom = i.daysOnMarket ?? 0;
  if (dom > 90) s += 25;
  else if (dom > 60) s += 18;
  else if (dom > 30) s += 10;

  const cuts = i.priceReductionCount ?? 0;
  if (cuts >= 2) s += 20;
  else if (cuts === 1) s += 12;

  const drop = i.totalReductionPct ?? 0;
  if (drop >= 10) s += 10;
  else if (drop >= 5) s += 6;

  const overMarket = i.priceVsDvfPct ?? 0;
  if (overMarket >= 15) s += 15;
  else if (overMarket >= 8) s += 10;
  else if (overMarket >= 3) s += 5;

  const dpe = i.dpe?.toUpperCase();
  if (dpe === "F" || dpe === "G") s += 10;

  if (i.vacant) s += 8;
  if (i.renovationNeeded) s += 8;
  if (i.urgencyKeywords) s += 12;

  return Math.round(clamp(s));
}
