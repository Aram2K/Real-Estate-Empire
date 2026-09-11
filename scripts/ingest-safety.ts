import fs from "node:fs";
import { createGunzip } from "node:zlib";
import { parse } from "csv-parse";
import { prisma } from "../src/lib/db/prisma";

const INPUT = process.env.SSMSI_FILE ?? ".cache-ssmsi.csv.gz";
const IDF = new Set(["75", "77", "78", "91", "92", "93", "94", "95"]);
const YEARS = new Set(["2023", "2024", "2025"]);
const SOURCE_URL = "https://www.data.gouv.fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales";

type Bucket = { population: number; values: Record<string, number[]> };
const buckets = new Map<string, Bucket>();

function family(indicator: string): "personal" | "property" | "street" | null {
  const s = indicator.toLowerCase();
  if (s.includes("intrafamil")) return null;
  if (s.includes("violences physiques hors") || s.includes("violences sexuelles") || s.includes("vols avec armes") || s.includes("vols violents sans arme")) return "personal";
  if (s.includes("cambriolages de logement") || s.includes("destructions et dégradations") || s.includes("destructions et degradations")) return "property";
  if (s.includes("vols sans violence contre des personnes") || s.includes("vols de véhicule") || s.includes("vols de vehicule") || s.includes("vols dans les véhicules") || s.includes("vols dans les vehicules") || s.includes("accessoires sur véhicules") || s.includes("accessoires sur vehicules")) return "street";
  return null;
}

function numeric(v: unknown) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function percentileScores(values: Map<string, number | null>) {
  const sorted = [...values.values()].filter((x): x is number => x != null).sort((a, b) => a - b);
  const result = new Map<string, number | null>();
  for (const [code, value] of values) {
    if (value == null || !sorted.length) result.set(code, null);
    else {
      const below = sorted.findIndex((v) => v >= value);
      const rank = below < 0 ? sorted.length - 1 : below;
      result.set(code, Math.round(100 * (1 - rank / Math.max(1, sorted.length - 1))));
    }
  }
  return result;
}

async function main() {
  const communes = new Set((await prisma.commune.findMany({ select: { code: true } })).map((c) => c.code));
  const parser = fs.createReadStream(INPUT).pipe(createGunzip()).pipe(parse({ columns: true, delimiter: ";", bom: true, relax_column_count: true }));
  for await (const row of parser) {
    const code = String(row.CODGEO_2026 ?? "");
    if (!IDF.has(code.slice(0, 2)) || !YEARS.has(String(row.annee)) || !communes.has(code)) continue;
    const group = family(String(row.indicateur ?? ""));
    if (!group || row.est_diffuse !== "diff") continue;
    const rate = numeric(row.taux_pour_mille);
    if (rate == null) continue;
    const bucket = buckets.get(code) ?? { population: 0, values: {} };
    bucket.population = Math.max(bucket.population, numeric(row.insee_pop) ?? 0);
    (bucket.values[group] ??= []).push(rate);
    buckets.set(code, bucket);
  }

  const raw = (group: string) => new Map([...buckets].map(([code, b]) => {
    const v = b.values[group] ?? [];
    return [code, v.length ? v.reduce((a, x) => a + x, 0) / v.length : null] as const;
  }));
  const personal = percentileScores(raw("personal"));
  const property = percentileScores(raw("property"));
  const street = percentileScores(raw("street"));

  let written = 0;
  for (const [code, bucket] of buckets) {
    const parts: Array<[number | null | undefined, number]> = [[personal.get(code), .4], [property.get(code), .35], [street.get(code), .25]];
    const available = parts.filter((p): p is [number, number] => p[0] != null);
    if (!available.length) continue;
    const score = Math.round(available.reduce((s, [v, w]) => s + v * w, 0) / available.reduce((s, [, w]) => s + w, 0));
    const observations = Object.values(bucket.values).reduce((n, v) => n + v.length, 0);
    const confidence = observations >= 8 && bucket.population >= 10_000 ? "HIGH" : observations >= 4 && bucket.population >= 3_000 ? "MEDIUM" : "LOW";
    await prisma.neighborhoodMetric.upsert({
      where: { communeCode_period: { communeCode: code, period: "2023-2025" } },
      update: { safetyScore: score, personalSafetyScore: personal.get(code), propertySafetyScore: property.get(code), streetSafetyScore: street.get(code), confidence, population: bucket.population || null, source: "SSMSI — recorded crime", sourceUrl: SOURCE_URL, methodologyVersion: "ssmsi-idf-v1", computedAt: new Date() },
      create: { communeCode: code, period: "2023-2025", safetyScore: score, personalSafetyScore: personal.get(code), propertySafetyScore: property.get(code), streetSafetyScore: street.get(code), confidence, population: bucket.population || null, source: "SSMSI — recorded crime", sourceUrl: SOURCE_URL, methodologyVersion: "ssmsi-idf-v1" },
    });
    written++;
  }
  console.log(`Imported safety metrics for ${written} Île-de-France communes.`);
}

main().finally(() => prisma.$disconnect());
