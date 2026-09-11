import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProperties } from "@/lib/properties/query";
import type { PropertyFilter } from "@/lib/filters/schema";

const Schema = z.object({
  cashFlowMinEuros: z.number().optional(),
  dscrMin: z.number().optional(),
  rentalDemandMin: z.number().optional(),
  budgetEuros: z.number().optional(),
  maxDistanceToStationM: z.number().optional(),
  maxDistanceToGpeM: z.number().optional(),
  departements: z.array(z.string()).optional(),
  includeDemo: z.boolean().optional(),
});

/**
 * Reverse deal finder: the user states the OUTCOME they want; we return only the
 * listings that meet every constraint, ranked by investment score.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const t = parsed.data;

  const filter: PropertyFilter = {
    cashFlowMinCents: t.cashFlowMinEuros != null ? Math.round(t.cashFlowMinEuros * 100) : undefined,
    dscrMin: t.dscrMin,
    rentalDemandMin: t.rentalDemandMin,
    priceMaxCents: t.budgetEuros != null ? Math.round(t.budgetEuros * 100) : undefined,
    maxDistanceToStationM: t.maxDistanceToStationM,
    maxDistanceToGpeM: t.maxDistanceToGpeM,
    departements: t.departements,
    includeDemo: t.includeDemo ?? true,
    sort: "investmentScore",
    limit: 200,
  };

  const items = await getProperties(filter);
  return NextResponse.json({ count: items.length, items });
}
