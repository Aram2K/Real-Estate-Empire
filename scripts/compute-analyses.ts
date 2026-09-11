/**
 * Compute and cache an InvestmentAnalysis for every property under the current
 * default assumptions. Uses the shared analysis service so the numbers exactly
 * match what the UI recomputes live.
 */
import { prisma } from "../src/lib/db/prisma";
import { resolveAssumptions } from "../src/lib/assumptions/resolve";
import { ensureAssumptionSet } from "../src/lib/assumptions/store";
import { loadMarketMaps, buildAnalysisContext } from "../src/lib/analysis/context";
import { analyzeListing, toAnalysisRecord } from "../src/lib/analysis/service";
import { loadSpatialRefs } from "../src/lib/geo/spatialRefs";
import { log } from "./_lib/log";

async function main() {
  log.step("Computing investment analyses…");

  const assumptions = resolveAssumptions();
  const hash = await ensureAssumptionSet(assumptions);
  const missingOnly = process.argv.includes("--missing-only");

  const [maps, refs] = await Promise.all([loadMarketMaps(), loadSpatialRefs()]);

  const properties = await prisma.property.findMany({
    where: missingOnly ? { analyses: { none: { assumptionHash: hash } } } : undefined,
    include: {
      listings: {
        where: { status: "ACTIVE" },
        orderBy: { price: "asc" },
        take: 1,
      },
    },
  });

  let computed = 0;
  let skipped = 0;
  const writes = [];
  for (const p of properties) {
    const listing = p.listings[0];
    if (!listing || !p.surface) {
      skipped++;
      continue;
    }
    const ctx = buildAnalysisContext(
      {
        priceCents: listing.price,
        surface: p.surface,
        rooms: p.rooms,
        propertyType: p.propertyType,
        dpe: p.dpe,
        hasElevator: p.hasElevator,
        floor: p.floor,
        lat: p.lat,
        lon: p.lon,
        codeCommune: p.codeCommune,
        chargesMonthlyCents: listing.charges,
        taxeFonciereAnnualCents: listing.taxeFonciere,
      },
      maps,
      refs
    );
    if (!ctx) {
      skipped++;
      continue;
    }

    const analysis = analyzeListing(ctx, assumptions);
    const record = toAnalysisRecord(analysis);

    writes.push(prisma.investmentAnalysis.upsert({
      where: { propertyId_assumptionHash: { propertyId: p.id, assumptionHash: hash } },
      update: { ...record, stale: false, computedAt: new Date() },
      create: { propertyId: p.id, assumptionHash: hash, ...record },
    }));
    computed++;
    if (writes.length === 250) {
      await prisma.$transaction(writes.splice(0));
    }
  }
  if (writes.length) await prisma.$transaction(writes);

  log.ok(`Analyses computed: ${computed} (skipped ${skipped})`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  log.error(String(e));
  await prisma.$disconnect();
  process.exit(1);
});
