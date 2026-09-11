import { prisma } from "../src/lib/db/prisma";
import { GPE_STATIONS, GPE_SOURCE } from "../prisma/seed/gpe-stations";
import { log } from "./_lib/log";

/** Official Société des grands projets announcement page per line. */
const LINE_SOURCE_URL: Record<string, string> = {
  "14": "https://www.grandparisexpress.fr/ligne-14",
  "15": "https://www.grandparisexpress.fr/ligne-15",
  "16": "https://www.grandparisexpress.fr/ligne-16",
  "17": "https://www.grandparisexpress.fr/ligne-17",
  "18": "https://www.grandparisexpress.fr/ligne-18",
};
const FALLBACK_URL = "https://www.grandparisexpress.fr/gpe-avance";

async function main() {
  log.step("Seeding Grand Paris Express future stations…");
  for (const s of GPE_STATIONS) {
    const sourceUrl = LINE_SOURCE_URL[s.line] ?? FALLBACK_URL;
    await prisma.futureTransportProject.upsert({
      where: { name_line: { name: s.name, line: s.line } },
      update: {
        segment: s.segment,
        lon: s.lon,
        lat: s.lat,
        openingYear: s.openingYear,
        openingLabel: s.openingLabel,
        status: s.status,
        confidence: s.confidence,
        source: GPE_SOURCE,
        sourceUrl,
      },
      create: {
        name: s.name,
        line: s.line,
        segment: s.segment,
        lon: s.lon,
        lat: s.lat,
        openingYear: s.openingYear,
        openingLabel: s.openingLabel,
        status: s.status,
        confidence: s.confidence,
        source: GPE_SOURCE,
        sourceUrl,
      },
    });
  }
  log.ok(`GPE future stations seeded: ${GPE_STATIONS.length}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  log.error(String(e));
  await prisma.$disconnect();
  process.exit(1);
});
