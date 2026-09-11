import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/db/prisma";
import { createCommuneResolver, parseLeboncoinCard, type LeboncoinCard as RawCard } from "../src/lib/sources/leboncoin/bulk";


async function input(): Promise<RawCard[]> {
  const file = process.argv[2];
  const raw = file ? await readFile(file, "utf8") : await new Promise<string>((resolve, reject) => {
    let value = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => value += chunk);
    process.stdin.on("end", () => resolve(value));
    process.stdin.on("error", reject);
  });
  return JSON.parse(raw);
}

async function main() {
  const cards = await input();
  const parsed = [...new Map(cards.map(parseLeboncoinCard).filter((x): x is NonNullable<ReturnType<typeof parseLeboncoinCard>> => !!x).map(x => [x.externalId, x])).values()];
  const communes = await prisma.commune.findMany({ select: { code: true, nom: true, departement: true } });
  const resolveCommune = createCommuneResolver(communes);
  const source = await prisma.propertySource.upsert({
    where: { key: "leboncoin-bulk" },
    update: { label: "Leboncoin · public search results", enabled: true },
    create: { key: "leboncoin-bulk", label: "Leboncoin · public search results", enabled: true },
  });
  const seen = new Date();
  let imported = 0, unmatched = 0;
  for (let offset = 0; offset < parsed.length; offset += 100) {
    const batch = parsed.slice(offset, offset + 100);
    await prisma.$transaction(async tx => {
      for (const item of batch) {
        const commune = resolveCommune(item.city, item.postalCode);
        if (!commune) { unmatched++; continue; }
        const communeCode = commune.code;
        const property = await tx.property.upsert({
          where: { dedupeKey: `lbc:${item.externalId}` },
          update: { codeCommune: communeCode, surface: item.surface, rooms: item.rooms, propertyType: item.propertyType, dpe: item.dpe, isDemo: false },
          create: { dedupeKey: `lbc:${item.externalId}`, codeCommune: communeCode, addressLine: `${commune.nom} — exact address not published`, surface: item.surface, rooms: item.rooms, propertyType: item.propertyType, dpe: item.dpe, isDemo: false },
        });
        const listing = await tx.listing.upsert({
          where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
          update: { propertyId: property.id, url: item.url, price: item.price, lastSeenAt: seen, status: "ACTIVE", sellerType: item.sellerType },
          create: { sourceId: source.id, externalId: item.externalId, propertyId: property.id, url: item.url, price: item.price, firstSeenAt: seen, lastSeenAt: seen, status: "ACTIVE", sellerType: item.sellerType, title: `${item.rooms}P · ${item.surface} m² · ${commune.nom}`, description: `Public search result observed on Leboncoin. Availability and the exact address must be confirmed with the advertiser.` },
        });
        const history = await tx.priceHistory.findFirst({ where: { listingId: listing.id }, select: { id: true } });
        if (!history) await tx.priceHistory.create({ data: { listingId: listing.id, price: item.price, observedAt: seen } });
        imported++;
      }
    }, { timeout: 60_000 });
    console.log(`Processed ${Math.min(offset + batch.length, parsed.length)}/${parsed.length}`);
  }
  console.log(JSON.stringify({ cards: cards.length, parsed: parsed.length, imported, unmatched }));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
