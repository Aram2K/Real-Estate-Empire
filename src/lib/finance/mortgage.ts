import type { Cents, MortgageResult, ResolvedAssumptions } from "./types";

/**
 * Standard fixed-rate amortized mortgage payment.
 *
 *   M = P · r / (1 − (1 + r)^(−n))
 *
 * where r is the monthly rate and n the number of months. Borrower insurance is
 * modeled the common French way: a flat annual % of the ORIGINAL principal,
 * divided by 12 (constant over the life of the loan).
 */
export function computeMortgage(
  principalCents: Cents,
  a: ResolvedAssumptions
): MortgageResult {
  const n = Math.round(a.termYears * 12);
  const r = a.ratePct / 100 / 12;

  let monthlyPrincipalInterestCents: Cents;
  if (principalCents <= 0 || n <= 0) {
    monthlyPrincipalInterestCents = 0;
  } else if (r === 0) {
    monthlyPrincipalInterestCents = Math.round(principalCents / n);
  } else {
    const factor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    monthlyPrincipalInterestCents = Math.round(principalCents * factor);
  }

  const monthlyInsuranceCents = Math.round(
    (principalCents * a.insurancePct) / 100 / 12
  );

  const monthlyTotalCents =
    monthlyPrincipalInterestCents + monthlyInsuranceCents;

  return {
    monthlyPrincipalInterestCents,
    monthlyInsuranceCents,
    monthlyTotalCents,
    annualDebtServiceCents: monthlyTotalCents * 12,
  };
}
