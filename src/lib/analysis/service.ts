import { analyzeProperty } from "@/lib/finance";
import type { FullAnalysis, RentEstimate, ResolvedAssumptions } from "@/lib/finance/types";
import {
  appreciationScore,
  investmentScore,
  rentalDemandScore,
  transportCatalystScore,
  type InvestmentScoreParts,
  type TransportInputs,
} from "@/lib/scoring";
import { estimateOperating, estimateRent, type RentBandM2 } from "./estimate";

export interface AnalysisContext {
  priceCents: number;
  surface: number;
  rooms?: number | null;
  propertyType?: string | null;
  dpe?: string | null;
  hasElevator?: boolean | null;
  floor?: number | null;

  rentBand: RentBandM2;
  chargesMonthlyCents?: number | null;
  taxeFonciereAnnualCents?: number | null;

  population: number | null;
  communePriceM2Cents: number | null;
  deptMedianPriceM2Cents: number | null;
  priceTrend5yPct: number | null;
  safetyScore: number | null;

  transport: TransportInputs;
}

export interface AreaScores {
  transport: number;
  rentalDemand: number;
  appreciation: number;
  safety: number | null;
}

export interface ListingAnalysis {
  finance: FullAnalysis;
  rent: RentEstimate;
  areaScores: AreaScores;
  investmentScore: number;
  scoreParts: InvestmentScoreParts;
}

/**
 * The integration point: given a property + its market/geo context + an
 * assumption set, produce the full deterministic analysis (finance) and the
 * scores. Pure — all context is passed in.
 */
export function analyzeListing(
  ctx: AnalysisContext,
  a: ResolvedAssumptions
): ListingAnalysis {
  const rent = estimateRent(ctx.rentBand, ctx.surface);
  const operating = estimateOperating(ctx.surface, {
    chargesMonthlyCents: ctx.chargesMonthlyCents,
    taxeFonciereAnnualCents: ctx.taxeFonciereAnnualCents,
  });

  const transport = transportCatalystScore(ctx.transport);

  const demand = rentalDemandScore({
    population: ctx.population,
    nearestHubM: ctx.transport.nearestHubM,
    transportScore: transport,
    medianRentM2Cents: ctx.rentBand.predCents,
  });

  const appreciation = appreciationScore({
    transportScore: transport,
    nearestFutureStationM: ctx.transport.nearestFutureStationM,
    futureStationOpeningYear: ctx.transport.futureStationOpeningYear,
    communePriceM2Cents: ctx.communePriceM2Cents,
    departmentMedianPriceM2Cents: ctx.deptMedianPriceM2Cents,
    priceTrend5yPct: ctx.priceTrend5yPct,
    population: ctx.population,
    nearestHubM: ctx.transport.nearestHubM,
    rentalDemandScore: demand,
  });

  const finance = analyzeProperty(
    {
      priceCents: ctx.priceCents,
      rent,
      operating,
      rentalDemandScore: demand,
    },
    a
  );

  const invest = investmentScore({
    monthlyCashFlowCents: finance.cashFlow.monthlyCashFlowCents,
    allInGrossYieldPct: finance.yields.allInGrossYieldPct,
    rentalDemandScore: demand,
    transportScore: transport,
    appreciationScore: appreciation,
    dpe: ctx.dpe,
    hasElevator: ctx.hasElevator,
    floor: ctx.floor,
    population: ctx.population,
    safetyScore: ctx.safetyScore,
  });

  return {
    finance,
    rent,
    areaScores: { transport, rentalDemand: demand, appreciation, safety: ctx.safetyScore },
    investmentScore: invest.score,
    scoreParts: invest.parts,
  };
}

/** Flatten to the columns stored in InvestmentAnalysis (DSCR clamped for storage). */
export function toAnalysisRecord(a: ListingAnalysis) {
  const dscr = Number.isFinite(a.finance.dscr.dscr)
    ? a.finance.dscr.dscr
    : 99.99;
  return {
    monthlyCashFlow: a.finance.cashFlow.monthlyCashFlowCents,
    noiAnnual: a.finance.cashFlow.noiAnnualCents,
    dscr,
    grossYield: a.finance.yields.grossYieldPct,
    allInGrossYield: a.finance.yields.allInGrossYieldPct,
    netYield: a.finance.yields.netYieldBeforeFinancingPct,
    investorCash: a.finance.financing.investorCashCents,
    whiteStatus: a.finance.whiteStatus,
    breakEvenFull: a.finance.breakEven.fullWhiteMaxPriceCents,
    breakEvenStrong: a.finance.breakEven.strongWhiteMaxPriceCents,
    investmentScore: a.investmentScore,
    scoresJson: JSON.stringify({
      ...a.areaScores,
      parts: a.scoreParts,
      dscrBand: a.finance.dscr.band,
    }),
  };
}
