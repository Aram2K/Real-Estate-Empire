/**
 * Import Leboncoin adverts harvested from a search page's embedded
 * `__NEXT_DATA__` payload (see src/lib/sources/leboncoin/harvest.ts).
 *
 *   npm run import:harvest -- harvest.json
 *   npm run import:harvest -- harvest.json --dry
 *   npm run import:harvest -- harvest.json --no-analyse
 *   cat harvest.json | npm run import:harvest
 */
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "../src/lib/db/prisma";
import { HarvestRowSchema, importHarvestedAds } from "../src/lib/sources/leboncoin/harvest";
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

async function main() {
  const dry = process.argv.includes("--dry");
  const records = z.array(HarvestRowSchema).parse(await input());
  log.step(`${records.length} harvested adverts${dry ? " (dry run)" : ""}`);
  // A large sweep defers analysis so every page lands first; run
  // `npm run compute:analyses:new` once afterwards.
  const analyse = !process.argv.includes("--no-analyse");
  const stats = await importHarvestedAds(records, { dry, analyse });
  log.ok(dry ? "Dry run complete" : "Import complete");
  console.log(JSON.stringify(stats, null, 1));
}

main()
  .catch((e) => {
    log.error(String(e));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
