/**
 * Ingest DVF géolocalisée (real notarised sale transactions).
 *
 * CRITICAL: `valeur_fonciere` is the price of the whole MUTATION, repeated on
 * every row of that mutation. We group by id_mutation and count the value once.
 * For a clean €/m² signal we keep mutations with exactly ONE residential local
 * (Appartement/Maison, surface > 0) — the dominant, cleanest case (a flat/house
 * plus its cave/parking dependency still counts as one residential local).
 * Multi-dwelling mutations are excluded to avoid distorting medians.
 *
 * Usage:
 *   tsx scripts/ingest-dvf.ts                 # all IDF depts, all years
 *   tsx scripts/ingest-dvf.ts 93 92 94 75     # specific departments
 *   tsx scripts/ingest-dvf.ts 93 --years 2024,2025
 */
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { prisma } from "../src/lib/db/prisma";
import { DVF_YEARS, IDF_DEPARTMENT_CODES } from "../src/lib/constants";
import { fetchGzipText } from "./_lib/http";
import { log } from "./_lib/log";

interface DvfRow {
  id_mutation: string;
  date_mutation: string;
  nature_mutation: string;
  valeur_fonciere: string;
  surface_reelle_bati: string;
  type_local: string;
  nombre_pieces_principales: string;
  code_commune: string;
  longitude: string;
  latitude: string;
}

interface Comp {
  idMutation: string;
  rowHash: string;
  dateMutation: Date;
  natureMutation: string;
  valeurFonciere: number; // cents
  surfaceBati: number;
  typeLocal: string;
  pieces: number | null;
  prixM2: number; // cents
  codeCommune: string;
  lon: number;
  lat: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const deps: string[] = [];
  let years: number[] = [...DVF_YEARS];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--years") {
      years = args[++i].split(",").map((y) => Number(y.trim()));
    } else if (/^\d{2,3}$/.test(args[i])) {
      deps.push(args[i]);
    }
  }
  return {
    deps: deps.length ? deps : IDF_DEPARTMENT_CODES,
    years,
  };
}

function buildComps(rows: DvfRow[]): Comp[] {
  // group rows by mutation
  const byMutation = new Map<string, DvfRow[]>();
  for (const r of rows) {
    if (r.nature_mutation !== "Vente") continue;
    const arr = byMutation.get(r.id_mutation) ?? [];
    arr.push(r);
    byMutation.set(r.id_mutation, arr);
  }

  const comps: Comp[] = [];
  const seen = new Set<string>();
  for (const [idMutation, mrows] of byMutation) {
    const locals = mrows.filter(
      (r) =>
        (r.type_local === "Appartement" || r.type_local === "Maison") &&
        Number(r.surface_reelle_bati) > 0
    );
    if (locals.length !== 1) continue; // keep clean single-dwelling mutations

    const r = locals[0];
    const valeurEuros = Number(r.valeur_fonciere);
    const surface = Number(r.surface_reelle_bati);
    const lon = Number(r.longitude);
    const lat = Number(r.latitude);
    if (!valeurEuros || !surface || !lon || !lat) continue;

    const valeurCents = Math.round(valeurEuros * 100);
    const prixM2 = Math.round(valeurCents / surface);
    const rowHash = createHash("sha1")
      .update(`${idMutation}|${surface}|${lat}|${lon}|${r.type_local}`)
      .digest("hex");
    if (seen.has(rowHash)) continue;
    seen.add(rowHash);

    comps.push({
      idMutation,
      rowHash,
      dateMutation: new Date(r.date_mutation),
      natureMutation: r.nature_mutation,
      valeurFonciere: valeurCents,
      surfaceBati: surface,
      typeLocal: r.type_local,
      pieces: r.nombre_pieces_principales
        ? Number(r.nombre_pieces_principales)
        : null,
      prixM2,
      codeCommune: r.code_commune,
      lon,
      lat,
    });
  }
  return comps;
}

async function ingestDeptYear(dep: string, year: number): Promise<number> {
  const url = `https://files.data.gouv.fr/geo-dvf/latest/csv/${year}/departements/${dep}.csv.gz`;
  let text: string;
  try {
    text = await fetchGzipText(url);
  } catch (e) {
    log.warn(`dept ${dep} ${year}: ${String(e)} — skipping`);
    return 0;
  }
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as DvfRow[];
  const comps = buildComps(rows);

  // idempotent: clear this dept-year, then insert fresh
  await prisma.saleComparable.deleteMany({
    where: {
      codeCommune: { startsWith: dep },
      dateMutation: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  });

  const BATCH = 2000;
  for (let i = 0; i < comps.length; i += BATCH) {
    await prisma.saleComparable.createMany({ data: comps.slice(i, i + BATCH) });
  }
  return comps.length;
}

async function main() {
  const { deps, years } = parseArgs();
  log.step(`Ingesting DVF for depts [${deps.join(", ")}], years [${years.join(", ")}]…`);
  let total = 0;
  for (const dep of deps) {
    let deptTotal = 0;
    for (const year of years) {
      const n = await ingestDeptYear(dep, year);
      deptTotal += n;
    }
    total += deptTotal;
    log.ok(`dept ${dep}: ${deptTotal} clean residential sales`);
  }
  log.ok(`DVF comparables ingested: ${total}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  log.error(String(e));
  await prisma.$disconnect();
  process.exit(1);
});
