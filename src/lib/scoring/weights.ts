/** Scoring weights, straight from the PRD. Named so they read as documentation. */

export const INVESTMENT_WEIGHTS = {
  cashFlow: 23,
  allInGrossYield: 19,
  rentalDemand: 14,
  transportCatalyst: 14,
  appreciation: 14,
  propertyQuality: 4,
  resaleLiquidity: 5,
  safety: 7,
} as const;

export const APPRECIATION_WEIGHTS = {
  transport: 25,
  redevelopment: 20,
  affordability: 15,
  priceTrajectory: 10,
  population: 10,
  employment: 10,
  rentalDemand: 10,
} as const;

export const RENTAL_DEMAND_WEIGHTS = {
  transport: 40,
  employmentAccess: 30,
  population: 20,
  rentLevel: 10,
} as const;
