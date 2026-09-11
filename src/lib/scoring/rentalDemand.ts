import { RENTAL_DEMAND_WEIGHTS as W } from "./weights";
import { linScore, weighted } from "./util";

export interface RentalDemandInputs {
  population: number | null;
  nearestHubM: number | null;
  transportScore: number; // 0–100
  medianRentM2Cents: number | null;
}

/**
 * Rental Demand Score (PRD §8) — MVP approximation from open data.
 *
 * A rigorous version would use listing velocity, vacancy and INSEE
 * socio-economics (Phase 2). Here we proxy structural demand from transport
 * access, employment proximity, market depth (population) and rent level.
 */
export function rentalDemandScore(i: RentalDemandInputs): number {
  const transport = i.transportScore;
  const employmentAccess = linScore(i.nearestHubM, 15_000, 0); // 0 m → 100
  const population = linScore(i.population, 2_000, 120_000); // depth of market
  const rentLevel = linScore(i.medianRentM2Cents, 800, 3_000); // €8 → €30 /m²

  return Math.round(
    weighted([
      { score: transport, weight: W.transport },
      { score: employmentAccess, weight: W.employmentAccess },
      { score: population, weight: W.population },
      { score: rentLevel, weight: W.rentLevel },
    ])
  );
}
