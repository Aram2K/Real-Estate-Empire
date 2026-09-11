import { pctOf } from "./acquisition";
import type {
  CashFlowResult,
  Cents,
  MortgageResult,
  OperatingInputs,
  ResolvedAssumptions,
} from "./types";

/**
 * Monthly pre-tax cash flow and annual NOI (net operating income, before
 * financing).
 *
 *   operating expenses = non-recoverable copro + taxe foncière/12
 *                        + landlord insurance/12 + maintenance reserve
 *                        + vacancy reserve + management + other
 *
 *   NOI (annual)   = (rent − operating expenses) × 12
 *   cash flow (mo) = rent − mortgage − operating expenses
 *
 * Maintenance / vacancy / management are taken as a % of RENT.
 */
export function computeCashFlow(
  rentCents: Cents,
  mortgage: MortgageResult,
  op: OperatingInputs,
  a: ResolvedAssumptions
): CashFlowResult {
  const nonRecoverableCoproCents = op.nonRecoverableCoproMonthlyCents;
  const taxeFonciereMonthlyCents = Math.round(op.taxeFonciereAnnualCents / 12);
  const landlordInsuranceMonthlyCents = Math.round(
    op.landlordInsuranceAnnualCents / 12
  );
  const maintenanceReserveCents = pctOf(rentCents, a.maintenancePct);
  const vacancyReserveCents = pctOf(rentCents, a.vacancyPct);
  const managementCents = pctOf(rentCents, a.managementPct);
  const otherMonthlyCents = a.otherMonthlyCents;

  const operatingExpensesMonthlyCents =
    nonRecoverableCoproCents +
    taxeFonciereMonthlyCents +
    landlordInsuranceMonthlyCents +
    maintenanceReserveCents +
    vacancyReserveCents +
    managementCents +
    otherMonthlyCents;

  const noiAnnualCents = (rentCents - operatingExpensesMonthlyCents) * 12;

  const monthlyCashFlowCents =
    rentCents - mortgage.monthlyTotalCents - operatingExpensesMonthlyCents;

  return {
    rentCents,
    mortgageMonthlyCents: mortgage.monthlyTotalCents,
    operatingExpensesMonthlyCents,
    monthlyCashFlowCents,
    noiAnnualCents,
    expenseBreakdown: {
      nonRecoverableCoproCents,
      taxeFonciereMonthlyCents,
      landlordInsuranceMonthlyCents,
      maintenanceReserveCents,
      vacancyReserveCents,
      managementCents,
      otherMonthlyCents,
    },
  };
}
