import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { propertyFacts } from "../src/lib/sources/propertyFacts";
const p = new PrismaClient();
async function main() {
  let floors = 0, dates = 0;
  for (const l of await p.listing.findMany({ include: { property: true } })) {
    const facts = propertyFacts(l.description ?? "");
    if (facts.floor !== undefined && l.property.floor == null) {
      await p.property.update({ where: { id: l.propertyId }, data: facts }); floors++;
    }
  }
  for (const file of fs.readdirSync("scripts/reviewed").filter(f => f.endsWith(".json"))) {
    const rows = JSON.parse(fs.readFileSync(`scripts/reviewed/${file}`, "utf8"));
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      if (!r.url || !/^\d{4}-\d{2}-\d{2}$/.test(r.publicationDate ?? "")) continue;
      dates += (await p.listing.updateMany({ where: { url: r.url }, data: { publicationDate: r.publicationDate, publishedAt: null } })).count;
    }
  }
  console.log({ floors, dates });
}
main().finally(() => p.$disconnect());
