import { computeAcquisitionCost, computeFinancing } from "./acquisition";
import { computeBreakEven } from "./breakEven";
import { computeCashFlow } from "./cashflow";
import { computeDscr } from "./dscr";
import { computeMortgage } from "./mortgage";
import { classifyWhiteOperation } from "./whiteOperation";
import { computeYields } from "./yields";
import type {
  Cents,
  FullAnalysis,
  OperatingInputs,
  RentEstimate,
  ResolvedAssumptions,
} from "./types";

export interface AnalyzeInput {
  priceCents: Cents;
  rent: RentEstimate;
  operating: OperatingInputs;
  /** Feeds the EXCELLENT white-operation gate; optional. */
  rentalDemandScore?: number | null;
}

/** Pick the rent figure the assumptions call for. Optimistic is never used. */
export function selectRent(
  rent: RentEstimate,
  a: ResolvedAssumptions
): Cents {
  return a.rentScenario === "CONSERVATIVE"
    ? rent.conservativeCents
    : rent.marketCents;
}

/**
 * Full deterministic analysis of one property under one resolved assumption set.
 * This is the single entry point the rest of the app calls.
 */
export function analyzeProperty(
  input: AnalyzeInput,
  a: ResolvedAssumptions
): FullAnalysis {
  const rentCents = selectRent(input.rent, a);

  const acquisition = computeAcquisitionCost(input.priceCents, a);
  const financing = computeFinancing(acquisition, a);
  const mortgage = computeMortgage(financing.loanPrincipalCents, a);
  const cashFlow = computeCashFlow(rentCents, mortgage, input.operating, a);

  const dscr = computeDscr(
    cashFlow.noiAnnualCents,
    mortgage.annualDebtServiceCents
  );

  const yields = computeYields({
    rentMonthlyCents: rentCents,
    priceCents: input.priceCents,
    totalInvestmentCents: acquisition.totalInvestmentCents,
    noiAnnualCents: cashFlow.noiAnnualCents,
    monthlyCashFlowCents: cashFlow.monthlyCashFlowCents,
    investorCashCents: financing.investorCashCents,
  });

  const whiteStatus = classifyWhiteOperation({
    monthlyCashFlowCents: cashFlow.monthlyCashFlowCents,
    dscr: dscr.dscr,
    grossYieldPct: yields.grossYieldPct,
    rentalDemandScore: input.rentalDemandScore,
  });

  const breakEven = computeBreakEven(rentCents, input.operating, a);

  return {
    acquisition,
    financing,
    mortgage,
    cashFlow,
    yields,
    dscr,
    whiteStatus,
    breakEven,
  };
}
