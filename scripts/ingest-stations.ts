/**
 * Ingest existing IDF rail stations from Île-de-France Mobilités. The source has
 * one row per station-per-line, so we dedupe on id_ref_zdc and accumulate the
 * set of modes and lines that serve each physical station.
 */
import { prisma } from "../src/lib/db/prisma";
import { fetchJson } from "./_lib/http";
import { log } from "./_lib/log";

interface StationFeature {
  properties: {
    id_ref_zdc?: string | number;
    nom_zdc?: string;
    nom_gares?: string;
    mode?: string;
    res_com?: string;
    indice_lig?: string;
  };
  geometry: { type: string; coordinates: [number, number] };
}

interface Acc {
  nom: string;
  lon: number;
  lat: number;
  modes: Set<string>;
  lines: Set<string>;
}

async function main() {
  log.step("Ingesting IDFM rail stations…");
  const url =
    "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/emplacement-des-gares-idf/exports/geojson";
  const fc = await fetchJson<{ features: StationFeature[] }>(url);

  const byZdc = new Map<string, Acc>();
  for (const f of fc.features) {
    const p = f.properties;
    const id = p.id_ref_zdc != null ? String(p.id_ref_zdc) : null;
    if (!id || !f.geometry?.coordinates) continue;
    const [lon, lat] = f.geometry.coordinates;
    const nom = p.nom_zdc || p.nom_gares || "Station";
    const acc = byZdc.get(id) ?? {
      nom,
      lon,
      lat,
      modes: new Set<string>(),
      lines: new Set<string>(),
    };
    if (p.mode) acc.modes.add(p.mode);
    if (p.res_com) acc.lines.add(p.res_com);
    else if (p.indice_lig) acc.lines.add(p.indice_lig);
    byZdc.set(id, acc);
  }

  let n = 0;
  for (const [id, acc] of byZdc) {
    await prisma.station.upsert({
      where: { idRefZdc: id },
      update: {
        nom: acc.nom,
        modes: [...acc.modes].join(","),
        lines: [...acc.lines].join(","),
        lon: acc.lon,
        lat: acc.lat,
      },
      create: {
        idRefZdc: id,
        nom: acc.nom,
        modes: [...acc.modes].join(","),
        lines: [...acc.lines].join(","),
        lon: acc.lon,
        lat: acc.lat,
      },
    });
    n++;
  }
  log.ok(`Stations ingested (deduped): ${n} (from ${fc.features.length} rows)`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  log.error(String(e));
  await prisma.$disconnect();
  process.exit(1);
});
