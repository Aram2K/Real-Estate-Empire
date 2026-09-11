import { APPRECIATION_WEIGHTS as W } from "./weights";
import { clamp, linScore, weighted } from "./util";

export interface AppreciationInputs {
  transportScore: number; // 0–100
  nearestFutureStationM: number | null;
  futureStationOpeningYear?: number | null;
  /** commune median €/m² (cents) vs department median (cents). */
  communePriceM2Cents: number | null;
  departmentMedianPriceM2Cents: number | null;
  priceTrend5yPct: number | null; // CAGR of median €/m²
  population: number | null;
  nearestHubM: number | null;
  rentalDemandScore: number; // 0–100
}

/**
 * Appreciation Potential Score (PRD §12) — ESTIMATE, never a guarantee.
 *
 * Weights: transport 25, redevelopment 20, affordability 15, price trajectory 10,
 * population 10, employment 10, rental demand 10.
 *
 * MVP proxies (flagged): "redevelopment" is approximated from proximity to a
 * future GPE station (major regeneration typically accompanies new lines) since
 * a dedicated ZAC/ANRU dataset is a Phase-2 ingest; "population" uses market
 * depth rather than growth (no INSEE trend yet).
 */
export function appreciationScore(i: AppreciationInputs): number {
  const transport = i.transportScore;

  // redevelopment proxy: close future station + earlier opening → higher
  let redevelopment = 0;
  if (i.nearestFutureStationM != null) {
    const proximity = linScore(i.nearestFutureStationM, 3_000, 0); // 0 m → 100
    const horizon =
      i.futureStationOpeningYear != null
        ? linScore(i.futureStationOpeningYear, 2032, 2026) // sooner → higher
        : 40;
    redevelopment = clamp(0.6 * proximity + 0.4 * horizon);
  }

  // affordability: cheaper than the department median → more headroom
  let affordability = 50;
  if (i.communePriceM2Cents != null && i.departmentMedianPriceM2Cents) {
    const ratio = i.communePriceM2Cents / i.departmentMedianPriceM2Cents;
    affordability = linScore(ratio, 1.3, 0.7); // 30% below → 100, 30% above → 0
  }

  const priceTrajectory = linScore(i.priceTrend5yPct, -2, 6); // -2%/yr → 0, +6% → 100
  const population = linScore(i.population, 2_000, 120_000);
  const employment = linScore(i.nearestHubM, 15_000, 0);
  const demand = i.rentalDemandScore;

  return Math.round(
    weighted([
      { score: transport, weight: W.transport },
      { score: redevelopment, weight: W.redevelopment },
      { score: affordability, weight: W.affordability },
      { score: priceTrajectory, weight: W.priceTrajectory },
      { score: population, weight: W.population },
      { score: employment, weight: W.employment },
      { score: demand, weight: W.rentalDemand },
    ])
  );
}
