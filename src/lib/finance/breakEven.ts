import { computeAcquisitionCost, computeFinancing } from "./acquisition";
import { computeCashFlow } from "./cashflow";
import { computeDscr } from "./dscr";
import { computeMortgage } from "./mortgage";
import { STRONG_CASHFLOW_CENTS } from "./whiteOperation";
import type {
  BreakEvenResult,
  Cents,
  OperatingInputs,
  ResolvedAssumptions,
} from "./types";

const SEARCH_CEILING_CENTS = 1_000_000_000; // €10,000,000
const PRECISION_CENTS = 100; // €1

interface PriceEval {
  cashFlowCents: Cents;
  dscr: number;
}

/** Cash flow and DSCR at a hypothetical purchase price (rent held fixed). */
function evaluateAtPrice(
  priceCents: Cents,
  rentCents: Cents,
  op: OperatingInputs,
  a: ResolvedAssumptions
): PriceEval {
  const acq = computeAcquisitionCost(priceCents, a);
  const fin = computeFinancing(acq, a);
  const mortgage = computeMortgage(fin.loanPrincipalCents, a);
  const cf = computeCashFlow(rentCents, mortgage, op, a);
  const dscr = computeDscr(cf.noiAnnualCents, mortgage.annualDebtServiceCents);
  return { cashFlowCents: cf.monthlyCashFlowCents, dscr: dscr.dscr };
}

/**
 * Largest purchase price for which `predicate` still holds. Cash flow and DSCR
 * are both monotonically decreasing in price (rent and operating costs are
 * price-independent; only the loan/mortgage grow), so a binary search is exact.
 * Returns null when the predicate fails even at price 0 (never achievable).
 */
function maxPriceSatisfying(
  predicate: (e: PriceEval) => boolean,
  rentCents: Cents,
  op: OperatingInputs,
  a: ResolvedAssumptions
): Cents | null {
  const at = (p: Cents) => evaluateAtPrice(p, rentCents, op, a);

  if (!predicate(at(0))) return null;
  if (predicate(at(SEARCH_CEILING_CENTS))) return SEARCH_CEILING_CENTS;

  let lo = 0; // predicate true
  let hi = SEARCH_CEILING_CENTS; // predicate false
  while (hi - lo > PRECISION_CENTS) {
    const mid = Math.floor((lo + hi) / 2);
    if (predicate(at(mid))) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Maximum price that preserves FULL WHITE (cash flow ≥ 0) and STRONG WHITE
 * (cash flow ≥ €100/mo AND DSCR ≥ 1.20). One of the app's flagship features:
 * it turns "is this deal white?" into "at what price would it be?".
 */
export function computeBreakEven(
  rentCents: Cents,
  op: OperatingInputs,
  a: ResolvedAssumptions
): BreakEvenResult {
  const fullWhiteMaxPriceCents = maxPriceSatisfying(
    (e) => e.cashFlowCents >= 0,
    rentCents,
    op,
    a
  );

  const strongWhiteMaxPriceCents = maxPriceSatisfying(
    (e) => e.cashFlowCents >= STRONG_CASHFLOW_CENTS && e.dscr >= 1.2,
    rentCents,
    op,
    a
  );

  return { fullWhiteMaxPriceCents, strongWhiteMaxPriceCents };
}
