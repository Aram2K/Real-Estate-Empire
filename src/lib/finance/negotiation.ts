import { analyzeProperty, type AnalyzeInput } from "./analyze";
import type { Cents, NegotiationScenario, ResolvedAssumptions } from "./types";

const DEFAULT_DISCOUNTS = [0, 5, 10, 15];

/**
 * Recompute the full analysis at a set of discounts off the asking price and
 * return a compact per-scenario summary. Everything (loan, mortgage, fees,
 * cash flow, DSCR, yield, white status) is recomputed from scratch per price —
 * no linear approximation.
 */
export function computeNegotiationScenarios(
  input: AnalyzeInput,
  a: ResolvedAssumptions,
  discountsPct: number[] = DEFAULT_DISCOUNTS
): NegotiationScenario[] {
  return discountsPct.map((discountPct) => {
    const priceCents: Cents = Math.round(
      (input.priceCents * (100 - discountPct)) / 100
    );
    const analysis = analyzeProperty({ ...input, priceCents }, a);
    return {
      label: discountPct === 0 ? "Asking" : `-${discountPct}%`,
      discountPct,
      priceCents,
      monthlyCashFlowCents: analysis.cashFlow.monthlyCashFlowCents,
      dscr: analysis.dscr.dscr,
      allInGrossYieldPct: analysis.yields.allInGrossYieldPct,
      whiteStatus: analysis.whiteStatus,
    };
  });
}
