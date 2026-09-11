import type { OperatingInputs, RentEstimate } from "@/lib/finance/types";

/** Default operating-cost heuristics (used when a listing lacks real figures). */
const NONREC_COPRO_PER_M2_YEAR_CENTS = 2_000; // €20 /m² /yr landlord-borne
const TAXE_FONCIERE_PER_M2_YEAR_CENTS = 1_400; // €14 /m² /yr
const LANDLORD_INSURANCE_ANNUAL_CENTS = 15_000; // €150 /yr (PNO)
const NONREC_SHARE_OF_CHARGES = 0.35; // landlord's non-recoverable share of copro

export interface RentBandM2 {
  predCents: number; // €/m²/month
  lowCents: number | null;
  highCents: number | null;
}

/** Monthly rent estimate for a dwelling from a €/m² band and its surface. */
export function estimateRent(band: RentBandM2, surface: number): RentEstimate {
  const market = Math.round(band.predCents * surface);
  const low =
    band.lowCents != null
      ? Math.round(band.lowCents * surface)
      : Math.round(market * 0.9);
  const high =
    band.highCents != null
      ? Math.round(band.highCents * surface)
      : Math.round(market * 1.1);
  return {
    conservativeCents: low,
    marketCents: market,
    optimisticCents: high,
  };
}

export function estimateOperating(
  surface: number,
  opts: {
    chargesMonthlyCents?: number | null;
    taxeFonciereAnnualCents?: number | null;
  } = {}
): OperatingInputs {
  const nonRecoverableCoproMonthlyCents =
    opts.chargesMonthlyCents != null
      ? Math.round(opts.chargesMonthlyCents * NONREC_SHARE_OF_CHARGES)
      : Math.round((surface * NONREC_COPRO_PER_M2_YEAR_CENTS) / 12);

  const taxeFonciereAnnualCents =
    opts.taxeFonciereAnnualCents != null
      ? opts.taxeFonciereAnnualCents
      : Math.round(surface * TAXE_FONCIERE_PER_M2_YEAR_CENTS);

  return {
    nonRecoverableCoproMonthlyCents,
    taxeFonciereAnnualCents,
    landlordInsuranceAnnualCents: LANDLORD_INSURANCE_ANNUAL_CENTS,
  };
}
