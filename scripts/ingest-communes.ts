/**
 * Ingest IDF commune boundaries from geo.api.gouv.fr, plus the 20 Paris
 * arrondissements (codes 75101–75120) from Paris open data — because DVF, rent
 * control and INSEE all work at arrondissement level while geo.api treats Paris
 * as the single commune 75056.
 */
import { prisma } from "../src/lib/db/prisma";
import { IDF_DEPARTMENTS } from "../src/lib/constants";
import { fetchJson } from "./_lib/http";
import { log } from "./_lib/log";

interface GeoFeature {
  properties: { nom: string; code: string; population?: number; surface?: number };
  geometry: unknown;
}
interface FeatureCollection {
  features: GeoFeature[];
}

/** Rough centroid: mean of all [lon,lat] pairs in a GeoJSON geometry. */
function centroid(geometry: unknown): { lon: number; lat: number } | null {
  const pts: [number, number][] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      if (
        node.length === 2 &&
        typeof node[0] === "number" &&
        typeof node[1] === "number"
      ) {
        pts.push([node[0], node[1]]);
      } else {
        node.forEach(walk);
      }
    }
  };
  walk((geometry as { coordinates?: unknown })?.coordinates);
  if (pts.length === 0) return null;
  const sum = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return { lon: sum[0] / pts.length, lat: sum[1] / pts.length };
}

async function ingestDepartment(dep: string): Promise<number> {
  const url = `https://geo.api.gouv.fr/departements/${dep}/communes?format=geojson&geometry=contour&fields=nom,code,population,surface`;
  const fc = await fetchJson<FeatureCollection>(url);
  let n = 0;
  for (const f of fc.features) {
    const c = centroid(f.geometry);
    await prisma.commune.upsert({
      where: { code: f.properties.code },
      update: {
        nom: f.properties.nom,
        departement: dep,
        population: f.properties.population ?? null,
        surfaceKm2: f.properties.surface != null ? f.properties.surface / 100 : null,
        lon: c?.lon ?? null,
        lat: c?.lat ?? null,
        geojson: JSON.stringify(f.geometry),
      },
      create: {
        code: f.properties.code,
        nom: f.properties.nom,
        departement: dep,
        isArrondissement: false,
        population: f.properties.population ?? null,
        surfaceKm2: f.properties.surface != null ? f.properties.surface / 100 : null,
        lon: c?.lon ?? null,
        lat: c?.lat ?? null,
        geojson: JSON.stringify(f.geometry),
      },
    });
    n++;
  }
  return n;
}

async function ingestParisArrondissements(): Promise<number> {
  const url =
    "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/arrondissements/exports/geojson";
  const fc = await fetchJson<{
    features: {
      properties: Record<string, unknown>;
      geometry: unknown;
    }[];
  }>(url);
  let n = 0;
  for (const f of fc.features) {
    const p = f.properties;
    const arr = Number(p.c_ar);
    if (!arr) continue;
    const code = `751${String(arr).padStart(2, "0")}`;
    const nom = String(p.l_ar ?? `Paris ${arr}e`);
    const surfaceM2 = Number(p.surface ?? 0);
    const c = centroid(f.geometry);
    await prisma.commune.upsert({
      where: { code },
      update: {
        nom,
        departement: "75",
        isArrondissement: true,
        parentCode: "75056",
        surfaceKm2: surfaceM2 ? surfaceM2 / 1_000_000 : null,
        lon: c?.lon ?? null,
        lat: c?.lat ?? null,
        geojson: JSON.stringify(f.geometry),
      },
      create: {
        code,
        nom,
        departement: "75",
        isArrondissement: true,
        parentCode: "75056",
        surfaceKm2: surfaceM2 ? surfaceM2 / 1_000_000 : null,
        lon: c?.lon ?? null,
        lat: c?.lat ?? null,
        geojson: JSON.stringify(f.geometry),
      },
    });
    n++;
  }
  return n;
}

async function main() {
  log.step("Ingesting IDF commune boundaries…");
  let total = 0;
  for (const { code, name } of IDF_DEPARTMENTS) {
    const n = await ingestDepartment(code);
    total += n;
    log.ok(`${code} ${name}: ${n} communes`);
  }
  const arr = await ingestParisArrondissements();
  log.ok(`Paris arrondissements: ${arr}`);
  log.ok(`Communes ingested: ${total + arr}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  log.error(String(e));
  await prisma.$disconnect();
  process.exit(1);
});
