import type { ResolvedAssumptions } from "@/lib/finance/types";

/**
 * Global default assumptions (PRD §47). Every one is user-overridable, globally
 * in /settings or per-property as a what-if. The finance engine only ever sees a
 * fully-resolved set (see resolve.ts).
 */
export const DEFAULT_ASSUMPTIONS: ResolvedAssumptions = {
  ratePct: 3.6,
  termYears: 25,
  financingPct: 110,
  insurancePct: 0.3,

  notaryPct: 7.5,
  agencyPct: 0,
  guaranteeFeesCents: 0,
  bankFeesCents: 100_000, // €1,000
  renovationCents: 0,
  furnitureCents: 0,

  vacancyPct: 5,
  maintenancePct: 5,
  managementPct: 0,
  otherMonthlyCents: 0,

  rentScenario: "MARKET",
};
