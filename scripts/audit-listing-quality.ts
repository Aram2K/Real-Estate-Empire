/** Audit stored active listings with the current evidence-based classifier. */
import { prisma } from "../src/lib/db/prisma";
import { classifySuspiciousListing, type SuspiciousReason } from "../src/lib/sources/listingQuality";

const apply = process.argv.includes("--apply");
const parisOnly = process.argv.includes("--paris");
const textualWithdrawalReasons = new Set<SuspiciousReason>([
  "NON_WHOLE_PROPERTY",
  "HOUSEBOAT",
  "ANCILLARY_SPACE_ONLY",
  "NON_STANDARD_SALE",
  "MULTI_UNIT_PROGRAM",
  "OCCUPIED_PROPERTY",
]);

async function main() {
  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      ...(parisOnly ? { property: { commune: { departement: "75" } } } : {}),
    },
    include: { property: { include: { commune: true } }, source: true },
  });

  const findings = listings.flatMap((listing) => {
    const quality = classifySuspiciousListing({
      title: listing.title,
      description: listing.description,
      priceCents: listing.price,
      surface: listing.property.surface,
      propertyType: listing.property.propertyType,
    });
    const evidenceReasons = quality.reasons.filter((reason) => textualWithdrawalReasons.has(reason));
    return evidenceReasons.length ? [{ listing, evidenceReasons }] : [];
  });

  for (const { listing, evidenceReasons } of findings) {
    console.log(JSON.stringify({
      id: listing.id,
      externalId: listing.externalId,
      source: listing.source.key,
      commune: listing.property.commune?.nom ?? null,
      priceEuros: listing.price / 100,
      surface: listing.property.surface,
      title: listing.title,
      reasons: evidenceReasons,
      url: listing.url,
    }));
    if (apply) {
      await prisma.$transaction([
        prisma.listing.update({ where: { id: listing.id }, data: { status: "WITHDRAWN" } }),
        prisma.listingReview.upsert({
          where: { listingId: listing.id },
          update: { outcome: "WITHDRAWN", reasons: JSON.stringify(evidenceReasons), reviewedAt: new Date() },
          create: { listingId: listing.id, outcome: "WITHDRAWN", reasons: JSON.stringify(evidenceReasons) },
        }),
      ]);
    }
  }
  console.error(`${findings.length} evidence-backed exclusion(s) found among ${listings.length} active listing(s)${apply ? "; withdrawn" : "; dry run"}.`);
}

main().finally(() => prisma.$disconnect());
