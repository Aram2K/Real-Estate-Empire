/**
 * Generate demo listings from real DVF medians so the map is alive with zero
 * external listing feeds. Every demo property is flagged isDemo=true and styled
 * distinctly in the UI — it is NOT a real for-sale listing. Some are priced below
 * the local median to surface "opération blanche" opportunities.
 */
import { prisma } from "../src/lib/db/prisma";
import { MARKET_PERIOD } from "../src/lib/constants";
import { log } from "./_lib/log";

interface Variant {
  surface: number;
  discount: number;
  rooms: number;
  dpe: string;
  floor: number;
  elevator: boolean;
}

const VARIANTS: Variant[] = [
  { surface: 30, discount: 0.92, rooms: 1, dpe: "D", floor: 2, elevator: true },
  { surface: 45, discount: 1.0, rooms: 2, dpe: "E", floor: 3, elevator: true },
  { surface: 64, discount: 0.87, rooms: 3, dpe: "C", floor: 1, elevator: false },
];

async function clearDemo() {
  const src = await prisma.propertySource.findUnique({ where: { key: "demo" } });
  const demoProps = await prisma.property.findMany({
    where: { isDemo: true },
    select: { id: true },
  });
  const ids = demoProps.map((p) => p.id);
  if (ids.length) {
    await prisma.investmentAnalysis.deleteMany({ where: { propertyId: { in: ids } } });
    await prisma.savedProperty.deleteMany({ where: { propertyId: { in: ids } } });
  }
  if (src) {
    const listings = await prisma.listing.findMany({
      where: { sourceId: src.id },
      select: { id: true },
    });
    const lids = listings.map((l) => l.id);
    if (lids.length)
      await prisma.priceHistory.deleteMany({ where: { listingId: { in: lids } } });
    await prisma.listing.deleteMany({ where: { sourceId: src.id } });
  }
  await prisma.property.deleteMany({ where: { isDemo: true } });
}

async function main() {
  log.step("Seeding demo listings from DVF medians…");

  const source = await prisma.propertySource.upsert({
    where: { key: "demo" },
    update: { label: "Demo (from DVF)" },
    create: { key: "demo", label: "Demo (from DVF)", enabled: true },
  });

  await clearDemo();

  const metrics = await prisma.marketMetric.findMany({
    where: {
      period: MARKET_PERIOD,
      segment: "APT",
      medianPriceM2: { not: null },
      dvfSampleSize: { gte: 5 },
    },
  });

  const communes = await prisma.commune.findMany({
    where: { code: { in: metrics.map((m) => m.communeCode) } },
    select: { code: true, nom: true, lat: true, lon: true },
  });
  const communeByCode = new Map(communes.map((c) => [c.code, c]));

  let created = 0;
  for (const m of metrics) {
    const commune = communeByCode.get(m.communeCode);
    if (!commune || commune.lat == null || commune.lon == null) continue;
    const priceM2 = m.medianPriceM2!;

    for (let i = 0; i < VARIANTS.length; i++) {
      const v = VARIANTS[i];
      const priceCents = Math.round(priceM2 * v.surface * v.discount);
      const lat = commune.lat + (i - 1) * 0.0007;
      const lon = commune.lon + (i - 1) * 0.0009;

      const property = await prisma.property.create({
        data: {
          dedupeKey: `demo:${m.communeCode}:${i}`,
          addressLine: `${commune.nom}`,
          codeCommune: m.communeCode,
          lat,
          lon,
          surface: v.surface,
          rooms: v.rooms,
          propertyType: "Appartement",
          dpe: v.dpe,
          hasElevator: v.elevator,
          floor: v.floor,
          isDemo: true,
        },
      });

      await prisma.listing.create({
        data: {
          sourceId: source.id,
          externalId: `${m.communeCode}-${i}`,
          title: `${v.rooms}P ${v.surface} m² — ${commune.nom}`,
          description: `Demo listing generated from DVF median €/m² for ${commune.nom}.`,
          price: priceCents,
          status: "ACTIVE",
          daysOnMarket: 10 + i * 15,
          propertyId: property.id,
        },
      });
      created++;
    }
  }

  log.ok(`Demo listings created: ${created}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  log.error(String(e));
  await prisma.$disconnect();
  process.exit(1);
});
