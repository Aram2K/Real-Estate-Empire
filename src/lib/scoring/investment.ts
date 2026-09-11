import { INVESTMENT_WEIGHTS as W } from "./weights";
import { clamp, linScore, weighted } from "./util";

const DPE_SCORE: Record<string, number> = {
  A: 100,
  B: 90,
  C: 78,
  D: 64,
  E: 48,
  F: 30,
  G: 15,
};

/** Property quality from DPE + amenities. Unknown DPE → neutral 50. */
export function propertyQualityScore(input: {
  dpe?: string | null;
  hasElevator?: boolean | null;
  floor?: number | null;
}): number {
  let base = input.dpe ? (DPE_SCORE[input.dpe.toUpperCase()] ?? 50) : 50;
  if (input.hasElevator) base += 5;
  if (input.floor != null && input.floor === 0) base -= 5; // ground floor
  return Math.round(clamp(base));
}

/** Resale liquidity proxy: bigger market + better transport → easier resale. */
export function resaleLiquidityScore(input: {
  population: number | null;
  transportScore: number;
}): number {
  return Math.round(
    weighted([
      { score: linScore(input.population, 2_000, 120_000), weight: 50 },
      { score: input.transportScore, weight: 50 },
    ])
  );
}

export function cashFlowScore(monthlyCashFlowCents: number): number {
  // −€200/mo → 0, +€300/mo → 100
  return Math.round(linScore(monthlyCashFlowCents, -20_000, 30_000));
}

export function yieldScore(allInGrossYieldPct: number): number {
  // 5% → 0, 12% → 100 (7% ≈ 29, 8.5% ≈ 50, 10% ≈ 71)
  return Math.round(linScore(allInGrossYieldPct, 5, 12));
}

export interface InvestmentScoreParts {
  cashFlow: number;
  allInGrossYield: number;
  rentalDemand: number;
  transportCatalyst: number;
  appreciation: number;
  propertyQuality: number;
  resaleLiquidity: number;
  safety: number | null;
}

export interface InvestmentScoreResult {
  score: number;
  parts: InvestmentScoreParts;
}

/**
 * Overall Investment Score (PRD §19). Yield alone never decides — a high-yield
 * property in a weak-demand / weak-transport area scores below a solid all-round
 * one, exactly because demand + transport + appreciation together outweigh it.
 */
export function investmentScore(input: {
  monthlyCashFlowCents: number;
  allInGrossYieldPct: number;
  rentalDemandScore: number;
  transportScore: number;
  appreciationScore: number;
  dpe?: string | null;
  hasElevator?: boolean | null;
  floor?: number | null;
  population: number | null;
  safetyScore?: number | null;
}): InvestmentScoreResult {
  const parts: InvestmentScoreParts = {
    cashFlow: cashFlowScore(input.monthlyCashFlowCents),
    allInGrossYield: yieldScore(input.allInGrossYieldPct),
    rentalDemand: Math.round(clamp(input.rentalDemandScore)),
    transportCatalyst: Math.round(clamp(input.transportScore)),
    appreciation: Math.round(clamp(input.appreciationScore)),
    propertyQuality: propertyQualityScore(input),
    resaleLiquidity: resaleLiquidityScore({
      population: input.population,
      transportScore: input.transportScore,
    }),
    safety: input.safetyScore == null ? null : Math.round(clamp(input.safetyScore)),
  };

  const score = Math.round(
    weighted([
      { score: parts.cashFlow, weight: W.cashFlow },
      { score: parts.allInGrossYield, weight: W.allInGrossYield },
      { score: parts.rentalDemand, weight: W.rentalDemand },
      { score: parts.transportCatalyst, weight: W.transportCatalyst },
      { score: parts.appreciation, weight: W.appreciation },
      { score: parts.propertyQuality, weight: W.propertyQuality },
      { score: parts.resaleLiquidity, weight: W.resaleLiquidity },
      ...(parts.safety == null ? [] : [{ score: parts.safety, weight: W.safety }]),
    ])
  );

  return { score, parts };
}
