import type { Cents, DscrBand, DscrResult } from "./types";

/**
 * Debt Service Coverage Ratio = net operating income / annual debt service.
 *
 * When there is no debt service (fully cash / zero principal) the ratio is
 * conventionally infinite; we return `Infinity` and classify it EXCELLENT.
 */
export function computeDscr(
  noiAnnualCents: Cents,
  annualDebtServiceCents: Cents
): DscrResult {
  const dscr =
    annualDebtServiceCents > 0
      ? noiAnnualCents / annualDebtServiceCents
      : Infinity;

  return { dscr, band: classifyDscr(dscr) };
}

export function classifyDscr(dscr: number): DscrBand {
  if (dscr < 1.0) return "NEGATIVE";
  if (dscr < 1.1) return "FRAGILE";
  if (dscr < 1.2) return "ACCEPTABLE";
  if (dscr < 1.3) return "STRONG";
  return "EXCELLENT";
}
