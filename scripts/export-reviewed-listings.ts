/** Export active, source-linked, non-demo listings as reviewable JSONL chunks. */
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db/prisma";
import { chunkRecords, toJsonLines, type ExportableListing } from "../src/lib/sources/exportRecords";

function option(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function main() {
  const outputDirectory = path.resolve(option("output", "scripts/reviewed/database-export"));
  const chunkSize = Number(option("chunk-size", "500"));
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) throw new Error("--chunk-size must be a positive integer");

  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      url: { startsWith: "https://" },
      property: {
        isDemo: false,
        codeCommune: { not: null },
        surface: { not: null },
        rooms: { not: null },
        propertyType: { not: null },
      },
    },
    include: { source: { select: { key: true } }, property: true },
    orderBy: [{ source: { key: "asc" } }, { externalId: "asc" }],
  });

  const records: ExportableListing[] = listings.map((listing) => ({
    source: listing.source.key,
    externalId: listing.externalId,
    url: listing.url!,
    status: "ACTIVE",
    firstSeenAt: listing.firstSeenAt.toISOString(),
    lastSeenAt: listing.lastSeenAt.toISOString(),
    priceCents: listing.price,
    sellerType: listing.sellerType,
    sellerName: listing.sellerName,
    property: {
      dedupeKey: listing.property.dedupeKey,
      communeCode: listing.property.codeCommune!,
      addressLine: listing.property.addressLine,
      longitude: listing.property.lon,
      latitude: listing.property.lat,
      surface: listing.property.surface!,
      rooms: listing.property.rooms!,
      propertyType: listing.property.propertyType!,
      dpe: listing.property.dpe,
      ges: listing.property.ges,
    },
  }));

  await mkdir(outputDirectory, { recursive: true });
  for (const file of await readdir(outputDirectory)) {
    if (/^listings-\d{4}\.jsonl$/.test(file) || file === "manifest.json") {
      await rm(path.join(outputDirectory, file));
    }
  }

  const chunks = chunkRecords(records, chunkSize);
  const files: Array<{ file: string; records: number }> = [];
  for (const [index, chunk] of chunks.entries()) {
    const file = `listings-${String(index + 1).padStart(4, "0")}.jsonl`;
    await writeFile(path.join(outputDirectory, file), toJsonLines(chunk), "utf8");
    files.push({ file, records: chunk.length });
  }

  const manifest = {
    format: "idf-investment-radar/source-listings-jsonl-v1",
    generatedAt: new Date().toISOString(),
    filters: ["ACTIVE", "isDemo=false", "HTTPS source URL", "complete core property fields"],
    records: records.length,
    chunkSize,
    files,
  };
  await writeFile(path.join(outputDirectory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`Exported ${records.length} listings to ${files.length} chunk(s) in ${outputDirectory}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
