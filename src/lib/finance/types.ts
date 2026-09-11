/**
 * Finance domain types.
 *
 * MONEY CONVENTION: every monetary value in this module is an INTEGER number of
 * euro-cents. Never store or accumulate currency as a float. Percentages are
 * plain numbers where `3.6` means 3.6%, `7.5` means 7.5%.
 */

export type Cents = number;

/** Rent estimate band for a property (cents / month). Optimistic is never used in calculations. */
export interface RentEstimate {
  conservativeCents: Cents;
  marketCents: Cents;
  optimisticCents: Cents;
}

export type RentScenario = "CONSERVATIVE" | "MARKET";

/**
 * A fully-resolved assumption set (global defaults ⊕ user global ⊕ per-property
 * override, already merged). The finance engine only ever sees resolved values.
 */
export interface ResolvedAssumptions {
  // Financing
  ratePct: number; // annual nominal mortgage rate, e.g. 3.6
  termYears: number; // 20 | 25 | custom
  financingPct: number; // 100 | 110 | custom — loan as % of purchase price
  downPaymentCents?: Cents; // if set, overrides financingPct (explicit apport)
  insurancePct: number; // borrower insurance, annual % of principal, e.g. 0.30

  // Acquisition costs
  notaryPct: number; // % of price, e.g. 7.5 (older properties)
  agencyPct: number; // % of price (often already in advertised price → default 0)
  guaranteeFeesCents: Cents; // mortgage guarantee (caution / hypothèque)
  bankFeesCents: Cents; // application / dossier fees
  renovationCents: Cents;
  furnitureCents: Cents;

  // Operating assumptions
  vacancyPct: number; // % of rent held as vacancy reserve
  maintenancePct: number; // % of rent held as maintenance reserve
  managementPct: number; // % of rent for property management
  otherMonthlyCents: Cents; // any other recurring monthly cost

  // Which rent figure to feed the calculation
  rentScenario: RentScenario;
}

/** Property-specific operating inputs that do not depend on price. */
export interface OperatingInputs {
  nonRecoverableCoproMonthlyCents: Cents; // landlord's share of copro charges
  taxeFonciereAnnualCents: Cents;
  landlordInsuranceAnnualCents: Cents; // PNO / GLI etc.
}

export interface AcquisitionBreakdown {
  priceCents: Cents;
  notaryFeesCents: Cents;
  agencyFeesCents: Cents;
  guaranteeFeesCents: Cents;
  bankFeesCents: Cents;
  renovationCents: Cents;
  furnitureCents: Cents;
  totalInvestmentCents: Cents;
}

export interface FinancingBreakdown {
  loanPrincipalCents: Cents;
  investorCashCents: Cents; // apport = total cost − loan (floored at 0)
}

export interface MortgageResult {
  monthlyPrincipalInterestCents: Cents;
  monthlyInsuranceCents: Cents;
  monthlyTotalCents: Cents;
  annualDebtServiceCents: Cents; // monthlyTotal × 12
}

export interface CashFlowResult {
  rentCents: Cents; // monthly rent used
  mortgageMonthlyCents: Cents;
  operatingExpensesMonthlyCents: Cents;
  monthlyCashFlowCents: Cents;
  noiAnnualCents: Cents; // net operating income, before financing
  expenseBreakdown: {
    nonRecoverableCoproCents: Cents;
    taxeFonciereMonthlyCents: Cents;
    landlordInsuranceMonthlyCents: Cents;
    maintenanceReserveCents: Cents;
    vacancyReserveCents: Cents;
    managementCents: Cents;
    otherMonthlyCents: Cents;
  };
}

export interface YieldResult {
  grossYieldPct: number; // annual rent / price
  allInGrossYieldPct: number; // annual rent / total investment cost
  netYieldBeforeFinancingPct: number; // NOI / total investment cost
  cashOnCashPct: number | null; // null when investor cash ≤ 0 (undefined/infinite)
}

export type DscrBand =
  | "NEGATIVE"
  | "FRAGILE"
  | "ACCEPTABLE"
  | "STRONG"
  | "EXCELLENT";

export interface DscrResult {
  dscr: number;
  band: DscrBand;
}

export type WhiteStatus = "NOT_WHITE" | "FULL" | "STRONG" | "EXCELLENT";

export interface BreakEvenResult {
  fullWhiteMaxPriceCents: Cents | null;
  strongWhiteMaxPriceCents: Cents | null;
}

export interface NegotiationScenario {
  label: string; // "Asking", "-5%", ...
  discountPct: number;
  priceCents: Cents;
  monthlyCashFlowCents: Cents;
  dscr: number;
  allInGrossYieldPct: number;
  whiteStatus: WhiteStatus;
}

/** Everything the engine produces for one property under one assumption set. */
export interface FullAnalysis {
  acquisition: AcquisitionBreakdown;
  financing: FinancingBreakdown;
  mortgage: MortgageResult;
  cashFlow: CashFlowResult;
  yields: YieldResult;
  dscr: DscrResult;
  whiteStatus: WhiteStatus;
  breakEven: BreakEvenResult;
}
