/**
 * Re-derive `Listing.sellerType` / `sellerName` for every listing already in the
 * database, from the publisher domain and the advert text we stored at import.
 *
 * Safe to re-run: it is a pure re-classification of existing columns and writes
 * nothing else. Pass --dry to print the distribution without touching any row.
 */
import { prisma } from "../src/lib/db/prisma";
import { classifySeller, type SellerType } from "../src/lib/sources/sellerType";
import { log } from "./_lib/log";

async function main() {
  const dry = process.argv.includes("--dry");

  // This feed is fetched with Leboncoin's owner_type=pro query parameter, so
  // the source itself explicitly identifies every result as professional.
  if (!dry) {
    const bulk = await prisma.listingSource.findUnique({ where: { key: "leboncoin-bulk" } });
    if (bulk) await prisma.listing.updateMany({ where: { sourceId: bulk.id }, data: { sellerType: "AGENCY" } });
  }

  const listings = await prisma.listing.findMany({
    select: { id: true, url: true, title: true, description: true, sellerType: true, sellerName: true },
  });
  log.step(`Classifying ${listings.length} listings…`);

  const tally: Record<SellerType, number> = { AGENCY: 0, INDIVIDUAL: 0, UNKNOWN: 0 };
  const reasons = new Map<string, number>();
  let changed = 0;

  for (const l of listings) {
    const result = classifySeller({
      url: l.url,
      text: [l.title, l.description].filter(Boolean).join("\n"),
      explicit: l.sellerType === "UNKNOWN" ? null : l.sellerType,
    });
    tally[result.type]++;
    reasons.set(result.reason, (reasons.get(result.reason) ?? 0) + 1);

    if (l.sellerType !== result.type || l.sellerName !== result.name) {
      changed++;
      if (!dry) {
        await prisma.listing.update({
          where: { id: l.id },
          data: { sellerType: result.type, sellerName: result.name },
        });
      }
    }
  }

  log.ok(`${dry ? "Would update" : "Updated"} ${changed} listings`);
  console.log("Distribution:", JSON.stringify(tally, null, 1));
  console.log(
    "Top reasons:",
    JSON.stringify(
      Object.fromEntries([...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)),
      null,
      1
    )
  );
  const unknownPct = Math.round((tally.UNKNOWN / Math.max(1, listings.length)) * 100);
  if (unknownPct > 50) {
    log.step(
      `${unknownPct}% are UNKNOWN. Leboncoin's pro/particulier badge is not captured by the ` +
        `current bulk-import payload — re-import with the badge text included to resolve these.`
    );
  }
}

main()
  .catch((e) => {
    log.error(String(e));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
