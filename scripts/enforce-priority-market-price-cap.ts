import { prisma } from "../src/lib/db/prisma";
import { COLLECTION_MARKETS, MAX_PURCHASE_PRICE_EUROS } from "../src/lib/constants";

const PRIORITY_MARKETS = new Set(["Le Mans", "Angers", "Reims", "Poitiers", "Rennes", "Rouen"]);
const communeCodes = COLLECTION_MARKETS
  .filter((market) => PRIORITY_MARKETS.has(market.city))
  .flatMap((market) => [...market.communeCodes]);
const maxPriceCents = MAX_PURCHASE_PRICE_EUROS * 100;
const apply = process.argv.includes("--apply");

async function main() {
  const violating = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      price: { gt: maxPriceCents },
      property: { codeCommune: { in: communeCodes } },
    },
    select: {
      id: true,
      url: true,
      price: true,
      property: { select: { codeCommune: true } },
    },
    orderBy: [{ price: "desc" }, { id: "asc" }],
  });

  for (const listing of violating) {
    console.log(`${listing.id}\t${listing.property.codeCommune}\tEUR ${(listing.price / 100).toFixed(0)}\t${listing.url}`);
  }

  if (apply && violating.length > 0) {
    await prisma.listing.updateMany({
      where: { id: { in: violating.map((listing) => listing.id) } },
      data: { status: "WITHDRAWN" },
    });
  }

  console.log(`${apply ? "Withdrew" : "Found"} ${violating.length} active listing(s) above EUR ${MAX_PURCHASE_PRICE_EUROS}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
