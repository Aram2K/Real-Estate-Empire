/**
 * Resolve `Listing.sellerType` for adverts already in the database from the
 * advertiser kind stated in Leboncoin's own `__NEXT_DATA__` payload.
 *
 * Input is a compact JSON array of `[adId, ownerType, ownerName?]` triples, as
 * harvested from a search page:
 *
 *   npm run resolve:sellers -- sweep.json
 *   cat sweep.json | npm run resolve:sellers
 *
 * This updates only; it never creates a property or a listing, so sweeping a
 * search page cannot silently grow the corpus. Adverts not already stored are
 * counted as `notStored` and left alone — use `npm run import:harvest` to add
 * them with their full details.
 *
 * `ownerType` is the advert's own statement ("pro" | "private"), so a value
 * written here is recorded fact. Anything unrecognised is left UNKNOWN rather
 * than guessed.
 */
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "../src/lib/db/prisma";
import { sellerTypeOf } from "../src/lib/sources/leboncoin/harvest";
import { log } from "./_lib/log";

const TripleSchema = z.tuple([
  z.union([z.string(), z.number()]).transform(String),
  z.string().nullish(),
  z.string().nullish(),
]);

const InputSchema = z.array(z.union([TripleSchema, z.array(z.any()).min(2)]));

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

async function main() {
  const dry = process.argv.includes("--dry");
  const rows = InputSchema.parse(await input());

  // Accept either the 3-field triple or a wider harvest row whose first two
  // fields are the id and owner type.
  const byId = new Map<string, { type: string; name: string | null }>();
  for (const r of rows as unknown[][]) {
    const id = String(r[0]);
    const type = r[1] == null ? "" : String(r[1]);
    const name = r[2] == null ? null : String(r[2]);
    byId.set(id, { type, name });
  }

  const ids = [...byId.keys()];
  log.step(`${rows.length} harvested rows, ${ids.length} distinct adverts`);

  const existing = await prisma.listing.findMany({
    where: { externalId: { in: ids } },
    select: { id: true, externalId: true, sellerType: true, sellerName: true },
  });
  const stats = {
    harvested: ids.length,
    stored: existing.length,
    notStored: ids.length - existing.length,
    changed: 0,
    alreadyCorrect: 0,
    stillUnknown: 0,
    toAgency: 0,
    toIndividual: 0,
  };

  for (const l of existing) {
    const src = byId.get(l.externalId)!;
    const type = sellerTypeOf(src.type);
    if (type === "UNKNOWN") {
      stats.stillUnknown++;
      continue;
    }
    if (type === "AGENCY") stats.toAgency++;
    else stats.toIndividual++;

    if (l.sellerType === type && l.sellerName === src.name) {
      stats.alreadyCorrect++;
      continue;
    }
    stats.changed++;
    if (!dry) {
      await prisma.listing.update({
        where: { id: l.id },
        data: { sellerType: type, sellerName: src.name },
      });
    }
  }

  const remaining = await prisma.listing.count({ where: { sellerType: "UNKNOWN" } });
  log.ok(`${dry ? "Would update" : "Updated"} ${stats.changed} listings`);
  console.log(JSON.stringify({ ...stats, unknownRemaining: remaining }, null, 1));
}

main()
  .catch((e) => {
    log.error(String(e));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
