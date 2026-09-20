/**
 * Ingest rent references:
 *  - Carte des Loyers 2025 (predicted asking rent €/m²/month per commune),
 *    apartments + houses, for the 8 IDF departments.
 *  - Paris encadrement des loyers (legal reference rents per quartier),
 *    aggregated to arrondissement level — Carte des Loyers only has a single
 *    figure for all of Paris (75056), so intra-Paris rent must come from here.
 *
 * Carte des Loyers CSV quirks: ';' separator, ',' decimal, keep INSEE_C as text.
 */
import { parse } from "csv-parse/sync";
import { prisma } from "../src/lib/db/prisma";
import { COLLECTION_DEPARTMENT_CODES } from "../src/lib/constants";
import { fetchJson, fetchText } from "./_lib/http";
import { log } from "./_lib/log";

const RENT_YEAR = 2025;

const CARTE_SLUG =
  "carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025";

const SEGMENT_BY_FILE: Record<string, string> = {
  "pred-app-mef-dhup.csv": "ALL_APT",
  "pred-app12-mef-dhup.csv": "T1_T2",
  "pred-app3-mef-dhup.csv": "T3_PLUS",
  "pred-mai-mef-dhup.csv": "HOUSE",
};

function num(s: string | undefined): number | null {
  if (s == null || s === "") return null;
  const v = Number(s.replace(",", "."));
  return Number.isNaN(v) ? null : v;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

async function resolveCarteResources(): Promise<Record<string, string>> {
  const ds = await fetchJson<{ resources: { title: string; url: string }[] }>(
    `https://www.data.gouv.fr/api/1/datasets/${CARTE_SLUG}/`
  );
  const out: Record<string, string> = {};
  for (const r of ds.resources) {
    for (const file of Object.keys(SEGMENT_BY_FILE)) {
      if (r.url.endsWith(file)) out[file] = r.url;
    }
  }
  return out;
}

interface CarteRow {
  INSEE_C: string;
  DEP: string;
  loypredm2: string;
  "lwr.IPm2": string;
  "upr.IPm2": string;
  TYPPRED: string;
  nbobs_com: string;
  R2_adj: string;
}

async function ingestCarteFile(url: string, segment: string): Promise<number> {
  const text = await fetchText(url);
  const rows = parse(text, {
    columns: true,
    delimiter: ";",
    skip_empty_lines: true,
    relax_column_count: true,
  }) as CarteRow[];

  const data = rows
    .filter((r) => (COLLECTION_DEPARTMENT_CODES as readonly string[]).includes(r.DEP))
    .map((r) => {
      const pred = num(r.loypredm2);
      if (pred == null) return null;
      return {
        scope: "COMMUNE",
        codeCommune: r.INSEE_C,
        segment,
        rentM2Pred: Math.round(pred * 100),
        rentM2Low: num(r["lwr.IPm2"]) != null ? Math.round(num(r["lwr.IPm2"])! * 100) : null,
        rentM2High: num(r["upr.IPm2"]) != null ? Math.round(num(r["upr.IPm2"])! * 100) : null,
        typPred: r.TYPPRED ?? null,
        nbObs: r.nbobs_com ? Number(r.nbobs_com) : null,
        r2Adj: num(r.R2_adj),
        year: RENT_YEAR,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const BATCH = 2000;
  for (let i = 0; i < data.length; i += BATCH) {
    await prisma.rentReference.createMany({ data: data.slice(i, i + BATCH) });
  }
  return data.length;
}

interface EncadrementRecord {
  annee: string | number;
  code_grand_quartier: string | number;
  piece: number;
  meuble_txt: string;
  ref: number;
  min: number;
  max: number;
}

async function ingestParisEncadrement(): Promise<number> {
  const records = await fetchJson<EncadrementRecord[]>(
    "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/logement-encadrement-des-loyers/exports/json"
  );
  if (!records.length) return 0;
  const latestYear = Math.max(...records.map((r) => Number(r.annee)));

  // aggregate non-furnished reference rents per arrondissement
  const byArr = new Map<string, { ref: number[]; min: number[]; max: number[] }>();
  for (const r of records) {
    if (Number(r.annee) !== latestYear) continue;
    if (!/non/i.test(r.meuble_txt ?? "")) continue; // non meublé
    const cgq = String(r.code_grand_quartier);
    const arr = cgq.substring(3, 5);
    if (!arr) continue;
    const code = `751${arr}`;
    const acc = byArr.get(code) ?? { ref: [], min: [], max: [] };
    if (r.ref) acc.ref.push(r.ref);
    if (r.min) acc.min.push(r.min);
    if (r.max) acc.max.push(r.max);
    byArr.set(code, acc);
  }

  let n = 0;
  for (const [code, acc] of byArr) {
    const ref = median(acc.ref);
    if (ref == null) continue;
    await prisma.rentReference.create({
      data: {
        scope: "PARIS_QUARTIER",
        codeCommune: code,
        segment: "ALL_APT",
        rentM2Pred: Math.round(ref * 100),
        rentM2Low: median(acc.min) != null ? Math.round(median(acc.min)! * 100) : null,
        rentM2High: median(acc.max) != null ? Math.round(median(acc.max)! * 100) : null,
        typPred: "encadrement",
        year: latestYear,
      },
    });
    n++;
  }
  return n;
}

async function main() {
  log.step("Ingesting rent references…");

  // Replace only the active regional markets. Historical IDF/Paris reference
  // rows remain available for older listings already in the database.
  await prisma.rentReference.deleteMany({
    where: {
      year: RENT_YEAR,
      OR: COLLECTION_DEPARTMENT_CODES.map((code) => ({ codeCommune: { startsWith: code } })),
    },
  });

  const resources = await resolveCarteResources();
  let total = 0;
  for (const [file, segment] of Object.entries(SEGMENT_BY_FILE)) {
    const url = resources[file];
    if (!url) {
      log.warn(`Carte des Loyers: ${file} not found on data.gouv — skipping`);
      continue;
    }
    const n = await ingestCarteFile(url, segment);
    total += n;
    log.ok(`Carte des Loyers ${segment}: ${n} IDF communes`);
  }

  log.ok(`Rent references ingested: ${total}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  log.error(String(e));
  await prisma.$disconnect();
  process.exit(1);
});
