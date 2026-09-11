import type {
  AcquisitionBreakdown,
  Cents,
  FinancingBreakdown,
  ResolvedAssumptions,
} from "./types";

/** Percentage of an integer-cent amount, rounded to the nearest cent. */
export function pctOf(amountCents: Cents, pct: number): Cents {
  return Math.round((amountCents * pct) / 100);
}

/**
 * Total acquisition cost = price + notary + agency + guarantee + bank fees +
 * renovation + furniture. Notary/agency are computed as a % of price; the rest
 * are fixed cent amounts from the assumptions.
 */
export function computeAcquisitionCost(
  priceCents: Cents,
  a: ResolvedAssumptions
): AcquisitionBreakdown {
  const notaryFeesCents = pctOf(priceCents, a.notaryPct);
  const agencyFeesCents = pctOf(priceCents, a.agencyPct);
  const totalInvestmentCents =
    priceCents +
    notaryFeesCents +
    agencyFeesCents +
    a.guaranteeFeesCents +
    a.bankFeesCents +
    a.renovationCents +
    a.furnitureCents;

  return {
    priceCents,
    notaryFeesCents,
    agencyFeesCents,
    guaranteeFeesCents: a.guaranteeFeesCents,
    bankFeesCents: a.bankFeesCents,
    renovationCents: a.renovationCents,
    furnitureCents: a.furnitureCents,
    totalInvestmentCents,
  };
}

/**
 * Loan principal and investor cash contribution.
 *
 * - If an explicit `downPaymentCents` is given, loan = totalCost − downPayment.
 * - Otherwise loan = financingPct% of the PURCHASE PRICE (French convention:
 *   "financement à 110%" ≈ price + fees). The loan is capped at the total
 *   acquisition cost, so the investor never "over-borrows" in this model.
 *
 * `investorCashCents` is floored at 0 — the €0-down case the product centers on.
 */
export function computeFinancing(
  acq: AcquisitionBreakdown,
  a: ResolvedAssumptions
): FinancingBreakdown {
  let loanPrincipalCents: Cents;

  if (a.downPaymentCents != null) {
    const down = Math.max(0, Math.min(a.downPaymentCents, acq.totalInvestmentCents));
    loanPrincipalCents = acq.totalInvestmentCents - down;
  } else {
    const raw = pctOf(acq.priceCents, a.financingPct);
    loanPrincipalCents = Math.min(raw, acq.totalInvestmentCents);
  }

  const investorCashCents = Math.max(
    0,
    acq.totalInvestmentCents - loanPrincipalCents
  );

  return { loanPrincipalCents, investorCashCents };
}
