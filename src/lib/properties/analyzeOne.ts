import { prisma } from "@/lib/db/prisma";
import { resolveAssumptions } from "@/lib/assumptions/resolve";
import { ensureAssumptionSet } from "@/lib/assumptions/store";
import { loadMarketMaps, buildAnalysisContext } from "@/lib/analysis/context";
import { analyzeListing, toAnalysisRecord } from "@/lib/analysis/service";
import { loadSpatialRefs } from "@/lib/geo/spatialRefs";

/** Compute + cache the default-assumptions analysis for a single property. */
export async function computeAndStoreAnalysis(propertyId: string): Promise<boolean> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      listings: { where: { status: "ACTIVE" }, orderBy: { price: "asc" }, take: 1 },
    },
  });
  if (!property || !property.surface) return false;
  const listing = property.listings[0];
  if (!listing) return false;

  const a = resolveAssumptions();
  const hash = await ensureAssumptionSet(a);
  const [maps, refs] = await Promise.all([loadMarketMaps(), loadSpatialRefs()]);

  const ctx = buildAnalysisContext(
    {
      priceCents: listing.price,
      surface: property.surface,
      rooms: property.rooms,
      propertyType: property.propertyType,
      dpe: property.dpe,
      hasElevator: property.hasElevator,
      floor: property.floor,
      lat: property.lat,
      lon: property.lon,
      codeCommune: property.codeCommune,
      chargesMonthlyCents: listing.charges,
      taxeFonciereAnnualCents: listing.taxeFonciere,
    },
    maps,
    refs
  );
  if (!ctx) return false;

  const record = toAnalysisRecord(analyzeListing(ctx, a));
  await prisma.investmentAnalysis.upsert({
    where: { propertyId_assumptionHash: { propertyId, assumptionHash: hash } },
    update: { ...record, stale: false, computedAt: new Date() },
    create: { propertyId, assumptionHash: hash, ...record },
  });
  return true;
}
