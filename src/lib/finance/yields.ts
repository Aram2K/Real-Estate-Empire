import type { Cents, YieldResult } from "./types";

function annual(rentMonthlyCents: Cents): Cents {
  return rentMonthlyCents * 12;
}

/**
 * Yield metrics. All percentages are returned as plain numbers (e.g. 8.53).
 *
 * Cash-on-cash is deliberately `null` when the investor contributes ≤ €0: the
 * ratio is undefined/infinite and must not be shown as a misleading number. The
 * UI surfaces "Investor Cash Required: €0" instead and foregrounds cash flow,
 * DSCR and all-in yield.
 */
export function computeYields(params: {
  rentMonthlyCents: Cents;
  priceCents: Cents;
  totalInvestmentCents: Cents;
  noiAnnualCents: Cents;
  monthlyCashFlowCents: Cents;
  investorCashCents: Cents;
}): YieldResult {
  const rentAnnual = annual(params.rentMonthlyCents);

  const grossYieldPct =
    params.priceCents > 0 ? (rentAnnual / params.priceCents) * 100 : 0;

  const allInGrossYieldPct =
    params.totalInvestmentCents > 0
      ? (rentAnnual / params.totalInvestmentCents) * 100
      : 0;

  const netYieldBeforeFinancingPct =
    params.totalInvestmentCents > 0
      ? (params.noiAnnualCents / params.totalInvestmentCents) * 100
      : 0;

  const cashOnCashPct =
    params.investorCashCents > 0
      ? ((params.monthlyCashFlowCents * 12) / params.investorCashCents) * 100
      : null;

  return {
    grossYieldPct,
    allInGrossYieldPct,
    netYieldBeforeFinancingPct,
    cashOnCashPct,
  };
}
