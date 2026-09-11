/**
 * Import Leboncoin adverts harvested from a search page's embedded
 * `__NEXT_DATA__` payload (see src/lib/sources/leboncoin/harvest.ts).
 *
 *   npm run import:harvest -- harvest.json
 *   npm run import:harvest -- harvest.json --dry
 *   cat harvest.json | npm run import:harvest
 */
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "../src/lib/db/prisma";
import { HarvestedAdSchema, importHarvestedAds } from "../src/lib/sources/leboncoin/harvest";
import { log } from "./_lib/log";

async function input(): Promise<unknown> {
  const file = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
  const raw = file
    ? await readFile(file, "utf8")
    : await new Promise<string>((resolve, reject) => {
        let v = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (c) => (v += c));
        process.stdin.on("end", () => resolve(v));
        process.stdin.on("error", reject);
      });
  return JSON.parse(raw);
}

/**
 * Pipe-delimited harvest row, in the field order the search-page extractor emits:
 *   id|ownerType|priceCents|city|zipcode|lat|lng|realEstateType|square|rooms|energy|status
 * Empty fields mean "not stated" and become null rather than a guessed value.
 */
function parsePipeRow(line: string) {
  const f = line.split("|");
  const s = (i: number) => (f[i] === undefined || f[i] === "" ? null : f[i]);
  const num = (i: number) => {
    const v = s(i);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    id: f[0],
    url: `https://www.leboncoin.fr/ad/ventes_immobilieres/${f[0]}`,
    ownerType: s(1),
    priceCents: num(2),
    city: s(3),
    zipcode: s(4),
    lat: num(5),
    lng: num(6),
    // The extractor only emits coordinates for a street-number location, so a
    // present pair is already known to be precise.
    originType: s(5) ? "streetNumber" : null,
    realEstateType: s(7),
    square: num(8),
    rooms: num(9),
    energy: s(10),
    status: s(11),
  };
}

async function main() {
  const dry = process.argv.includes("--dry");
  const raw = await input();
  const rows = Array.isArray(raw) ? raw : [];
  const normalised = rows.map((r) => (typeof r === "string" ? parsePipeRow(r) : r));
  const records = z.array(HarvestedAdSchema).parse(normalised);
  log.step(`${records.length} harvested adverts${dry ? " (dry run)" : ""}`);
  const stats = await importHarvestedAds(records, { dry });
  log.ok(dry ? "Dry run complete" : "Import complete");
  console.log(JSON.stringify(stats, null, 1));
}

main()
  .catch((e) => {
    log.error(String(e));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
