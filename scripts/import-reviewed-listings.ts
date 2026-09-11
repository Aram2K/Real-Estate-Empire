/** Import manually reviewed factual records; this script does not crawl websites. */
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "../src/lib/db/prisma";
import { computeAndStoreAnalysis } from "../src/lib/properties/analyzeOne";
import { IDF_DEPARTMENT_CODES } from "../src/lib/constants";

const RecordSchema = z.object({
  url: z.string().url().refine((s) => s.startsWith("https://")),
  observedAt: z.string().datetime({ offset: true }),
  communeCode: z.string().regex(/^\d{5}$/),
  priceEuros: z.number().positive().max(20_000_000),
  surface: z.number().positive(),
  rooms: z.number().int().positive(),
  propertyType: z.enum(["Appartement", "Maison"]).default("Appartement"),
  floor: z.number().int().optional(),
  hasElevator: z.boolean().optional(),
  dpe: z.enum(["A", "B", "C", "D", "E", "F", "G"]).optional(),
  chargesAnnualEuros: z.number().nonnegative().optional(),
  taxeFonciereAnnualEuros: z.number().nonnegative().optional(),
  notes: z.string().min(1),
});

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run import:reviewed -- <reviewed-records.json>");
  const records = z.array(RecordSchema).min(1).parse(JSON.parse(await readFile(file, "utf8")));
  // Check coverage before making any changes.
  const communes = await prisma.commune.findMany({ where: { code: { in: records.map((r) => r.communeCode) } } });
  for (const r of records) {
    const commune = communes.find((c) => c.code === r.communeCode);
    if (!commune || !IDF_DEPARTMENT_CODES.some((d) => d === commune.departement)) {
      throw new Error(`Missing IDF commune coverage: ${r.communeCode}`);
    }
    if (new Date(r.observedAt).getTime() > Date.now()) throw new Error("Observation cannot be in the future");
  }
  const source = await prisma.propertySource.upsert({
    where: { key: "reviewed-public" }, update: { label: "Public listing · manually reviewed" },
    create: { key: "reviewed-public", label: "Public listing · manually reviewed", enabled: true },
  });
  let analyzed = 0;
  for (const r of records) {
    const commune = communes.find((c) => c.code === r.communeCode)!;
    const seen = new Date(r.observedAt);
    const id = await prisma.$transaction(async (tx) => {
      const existing = await tx.listing.findUnique({ where: { sourceId_externalId: { sourceId: source.id, externalId: r.url } } });
      if (existing && existing.lastSeenAt > seen) return existing.propertyId;
      const data = { codeCommune: r.communeCode, addressLine: `${commune.nom} — exact address not published`, surface: r.surface, rooms: r.rooms, propertyType: r.propertyType, floor: r.floor ?? null, hasElevator: r.hasElevator ?? null, dpe: r.dpe ?? null, isDemo: false };
      const property = await tx.property.upsert({
        where: { dedupeKey: `reviewed:${r.url}` }, update: { ...data, addressLine: undefined },
        create: { dedupeKey: `reviewed:${r.url}`, ...data },
      });
      const listingData = {
        propertyId: property.id, price: Math.round(r.priceEuros * 100), url: r.url,
        title: `${r.rooms}P · ${r.surface} m² · ${commune.nom}`,
        description: `Public listing on ${new URL(r.url).hostname} reviewed on ${r.observedAt.slice(0, 10)}. Availability is not confirmed with the advertiser. Exact address was unconfirmed at review: the map can use an approximate town-centre marker.\n\n${r.notes}`,
        charges: r.chargesAnnualEuros == null ? null : Math.round(r.chargesAnnualEuros * 100 / 12),
        taxeFonciere: r.taxeFonciereAnnualEuros == null ? null : Math.round(r.taxeFonciereAnnualEuros * 100),
        status: "ACTIVE", lastSeenAt: seen,
      };
      const listing = await tx.listing.upsert({
        where: { sourceId_externalId: { sourceId: source.id, externalId: r.url } },
        update: listingData, create: { sourceId: source.id, externalId: r.url, firstSeenAt: seen, ...listingData },
      });
      if (!existing || existing.price !== listingData.price) {
        await tx.priceHistory.create({ data: { listingId: listing.id, price: listingData.price, observedAt: seen } });
      }
      return property.id;
    });
    if (await computeAndStoreAnalysis(id)) analyzed++;
    console.log(`${r.url} -> /properties/${id}`);
  }
  console.log(`${records.length} reviewed listings imported; ${analyzed} analyses available.`);
  if (analyzed !== records.length) throw new Error("Some analyses could not be computed");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
