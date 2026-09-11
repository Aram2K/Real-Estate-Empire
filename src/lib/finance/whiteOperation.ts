import type { Cents, WhiteStatus } from "./types";

/**
 * "Opération blanche" classification. The cash-flow figure passed in has ALREADY
 * had every operating cost and the full mortgage subtracted (see computeCashFlow),
 * so "rent covers everything" is simply cash flow ≥ 0.
 *
 *   NOT_WHITE  cash flow < 0
 *   FULL       cash flow ≥ 0
 *   STRONG     cash flow ≥ €100/mo AND DSCR ≥ 1.20
 *   EXCELLENT  cash flow ≥ €200/mo AND gross yield ≥ 9% AND DSCR ≥ 1.25
 *              AND rental-demand score ≥ 70
 */
export const STRONG_CASHFLOW_CENTS = 10_000; // €100
export const EXCELLENT_CASHFLOW_CENTS = 20_000; // €200

export function classifyWhiteOperation(params: {
  monthlyCashFlowCents: Cents;
  dscr: number;
  grossYieldPct: number;
  rentalDemandScore: number | null | undefined;
}): WhiteStatus {
  const { monthlyCashFlowCents, dscr, grossYieldPct } = params;
  const demand = params.rentalDemandScore ?? 0;

  if (monthlyCashFlowCents < 0) return "NOT_WHITE";

  const isStrong = monthlyCashFlowCents >= STRONG_CASHFLOW_CENTS && dscr >= 1.2;

  const isExcellent =
    monthlyCashFlowCents >= EXCELLENT_CASHFLOW_CENTS &&
    grossYieldPct >= 9 &&
    dscr >= 1.25 &&
    demand >= 70;

  if (isExcellent) return "EXCELLENT";
  if (isStrong) return "STRONG";
  return "FULL";
}
