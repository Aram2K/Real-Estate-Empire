import { prisma } from "@/lib/db/prisma";
import type { ResolvedAssumptions } from "@/lib/finance/types";
import { hashAssumptions } from "./hash";

function toColumns(a: ResolvedAssumptions) {
  return {
    ratePct: a.ratePct,
    termYears: a.termYears,
    financingPct: a.financingPct,
    downPaymentCents: a.downPaymentCents ?? null,
    insurancePct: a.insurancePct,
    notaryPct: a.notaryPct,
    agencyPct: a.agencyPct,
    guaranteeFeesCents: a.guaranteeFeesCents,
    bankFeesCents: a.bankFeesCents,
    renovationCents: a.renovationCents,
    furnitureCents: a.furnitureCents,
    vacancyPct: a.vacancyPct,
    maintenancePct: a.maintenancePct,
    managementPct: a.managementPct,
    otherMonthlyCents: a.otherMonthlyCents,
    rentScenario: a.rentScenario,
  };
}

/** Ensure an AssumptionSet row exists for these assumptions; return its hash. */
export async function ensureAssumptionSet(
  a: ResolvedAssumptions,
  scope: "GLOBAL" | "USER" | "PROPERTY" = "GLOBAL"
): Promise<string> {
  const hash = hashAssumptions(a);
  await prisma.assumptionSet.upsert({
    where: { hash },
    update: {},
    create: { scope, hash, ...toColumns(a) },
  });
  return hash;
}
