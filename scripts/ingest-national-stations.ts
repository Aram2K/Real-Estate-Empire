/**
 * Ingest passenger stations from SNCF Open Data for collection departments.
 * This complements the IDFM source and keeps regional distance scoring based on
 * official station coordinates rather than hand-entered points.
 *
 * Source: https://ressources.data.sncf.com/explore/dataset/gares-de-voyageurs/
 */
import { prisma } from "../src/lib/db/prisma";
import { COLLECTION_DEPARTMENT_CODES } from "../src/lib/constants";
import { fetchJson } from "./_lib/http";
import { log } from "./_lib/log";

interface SncfStation {
  id: string;
  nom: string;
  codeinsee?: string;
  codes_uic?: string;
  position_geographique?: { lat: number; lon: number };
}

interface Page { total_count: number; results: SncfStation[] }

const SOURCE = "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/gares-de-voyageurs/records";

async function main() {
  log.step("Ingesting national SNCF passenger stations for collection markets…");
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  let saved = 0;

  while (offset < total) {
    const page = await fetchJson<Page>(`${SOURCE}?limit=100&offset=${offset}`);
    total = page.total_count;
    for (const row of page.results) {
      const position = row.position_geographique;
      const department = row.codeinsee?.slice(0, 2);
      if (!position || !department || !COLLECTION_DEPARTMENT_CODES.includes(department as never)) continue;
      const stableId = `SNCF:${row.id || row.codes_uic}`;
      await prisma.station.upsert({
        where: { idRefZdc: stableId },
        update: { nom: row.nom, modes: "TRAIN", lines: "SNCF", lat: position.lat, lon: position.lon },
        create: { idRefZdc: stableId, nom: row.nom, modes: "TRAIN", lines: "SNCF", lat: position.lat, lon: position.lon },
      });
      saved++;
    }
    offset += page.results.length;
    if (page.results.length === 0) break;
  }

  log.ok(`National SNCF passenger stations ingested: ${saved}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  log.error(String(error));
  await prisma.$disconnect();
  process.exit(1);
});
