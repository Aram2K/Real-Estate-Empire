/**
 * Re-derive `Listing.sellerType` / `sellerName` for every listing already in the
 * database, from the publisher domain and the advert text we stored at import.
 *
 * Safe to re-run: it is a pure re-classification of existing columns and writes
 * nothing else. Pass --dry to print the distribution without touching any row.
 *
 * PROVENANCE OVERRIDE
 * -------------------
 * Some feeds are collected with a portal-side advertiser filter already applied
 * (e.g. a Leboncoin search run with `owner_type=pro` returns only professional
 * adverts). That fact lives in how the batch was COLLECTED, not in anything the
 * stored advert text can prove, so this script will not infer it.
 *
 * If you know a source was collected that way, assert it explicitly:
 *
 *   npm run backfill:seller -- --source-is=leboncoin-bulk:AGENCY
 *
 * Without that flag such listings stay UNKNOWN, which is the honest answer: the
 * Deals filter would otherwise hide genuine private sales behind a label the
 * data never supported.
 */
import { prisma } from "../src/lib/db/prisma";
import { classifySeller, type SellerType } from "../src/lib/sources/sellerType";
import { log } from "./_lib/log";

async function main() {
  const dry = process.argv.includes("--dry");

  // Operator-asserted provenance, e.g. --source-is=leboncoin-bulk:AGENCY
  const asserted = new Map<string, SellerType>();
  for (const arg of process.argv) {
    const m = arg.match(/^--source-is=([^:]+):(AGENCY|INDIVIDUAL)$/);
    if (m) asserted.set(m[1], m[2] as SellerType);
  }
  const assertedSourceIds = new Map<string, SellerType>();
  for (const [key, type] of asserted) {
    const src = await prisma.propertySource.findUnique({ where: { key } });
    if (!src) throw new Error(`--source-is names an unknown source key: ${key}`);
    assertedSourceIds.set(src.id, type);
    log.step(`Provenance asserted: every listing from "${key}" is ${type}`);
  }

  const listings = await prisma.listing.findMany({
    select: { id: true, url: true, title: true, description: true, sellerType: true, sellerName: true, sourceId: true },
  });
  log.step(`Classifying ${listings.length} listings…`);

  const tally: Record<SellerType, number> = { AGENCY: 0, INDIVIDUAL: 0, UNKNOWN: 0 };
  const reasons = new Map<string, number>();
  let changed = 0;

  for (const l of listings) {
    // NB: never feed the row's current sellerType back in as `explicit`. That
    // makes this script self-confirming -- it would re-assert whatever a prior
    // run wrote and could never correct a bad label. Re-derivation starts from
    // the advert alone, plus any explicit operator assertion above.
    const override = assertedSourceIds.get(l.sourceId);
    const result = override
      ? { type: override, name: null, reason: "asserted by --source-is" }
      : classifySeller({
          url: l.url,
          text: [l.title, l.description].filter(Boolean).join(String.fromCharCode(10)),
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
