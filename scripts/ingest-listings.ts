/**
 * Ingest real listings from enabled licensed adapters (currently Melo /
 * Stream.Estate). No-ops cleanly when no API key is configured or the account
 * has no credits — the app stays fully functional on open data + demo + manual.
 */
import { prisma } from "../src/lib/db/prisma";
import { IDF_DEPARTMENT_CODES } from "../src/lib/constants";
import { getEnabledAdapters } from "../src/lib/sources/registry";
import { geocodeAddress } from "../src/lib/geo/geocode";
import { computeAndStoreAnalysis } from "../src/lib/properties/analyzeOne";
import type { NormalizedListing } from "../src/lib/sources/types";
import { log } from "./_lib/log";

async function upsertOne(l: NormalizedListing, sourceId: string): Promise<string | null> {
  let { lat, lon, codeCommune } = l;

  // Fill missing geo from the address if needed.
  if ((lat == null || lon == null || !codeCommune) && l.addressLine) {
    const geo = await geocodeAddress(l.addressLine);
    if (geo) {
      lat = lat ?? geo.lat;
      lon = lon ?? geo.lon;
      codeCommune = codeCommune ?? geo.codeCommune;
    }
  }
  if (lat == null || lon == null || !l.surface) return null;

  const dedupeKey = `${l.sourceKey}:${codeCommune ?? "?"}:${Math.round(
    lat * 1e4
  )}:${Math.round(lon * 1e4)}:${l.surface}`;

  const property = await prisma.property.upsert({
    where: { dedupeKey },
    update: {
      addressLine: l.addressLine ?? undefined,
      codeCommune: codeCommune ?? undefined,
      lat,
      lon,
      surface: l.surface ?? undefined,
      rooms: l.rooms ?? undefined,
      propertyType: l.propertyType ?? undefined,
      dpe: l.dpe ?? undefined,
      floor: l.floor ?? undefined,
      hasElevator: l.hasElevator ?? undefined,
    },
    create: {
      dedupeKey,
      addressLine: l.addressLine,
      codeCommune,
      lat,
      lon,
      surface: l.surface,
      rooms: l.rooms,
      propertyType: l.propertyType,
      dpe: l.dpe,
      floor: l.floor,
      hasElevator: l.hasElevator,
      isDemo: false,
    },
  });

  const existing = await prisma.listing.findUnique({
    where: { sourceId_externalId: { sourceId, externalId: l.externalId } },
  });

  if (existing && existing.price !== l.priceCents) {
    // price change → record history
    await prisma.priceHistory.create({
      data: { listingId: existing.id, price: existing.price },
    });
  }

  await prisma.listing.upsert({
    where: { sourceId_externalId: { sourceId, externalId: l.externalId } },
    update: {
      price: l.priceCents,
      charges: l.chargesMonthlyCents ?? null,
      taxeFonciere: l.taxeFonciereAnnualCents ?? null,
      url: l.url ?? null,
      title: l.title ?? null,
      description: l.description ?? null,
      lastSeenAt: new Date(),
      propertyId: property.id,
    },
    create: {
      sourceId,
      externalId: l.externalId,
      price: l.priceCents,
      charges: l.chargesMonthlyCents ?? null,
      taxeFonciere: l.taxeFonciereAnnualCents ?? null,
      url: l.url ?? null,
      title: l.title ?? null,
      description: l.description ?? null,
      propertyId: property.id,
    },
  });

  return property.id;
}

async function main() {
  const adapters = getEnabledAdapters();
  if (adapters.length === 0) {
    log.warn(
      "No listing adapters available (set MELO_API_KEY to enable Melo). " +
        "App runs on open data + demo + manual import."
    );
    await prisma.$disconnect();
    return;
  }

  for (const adapter of adapters) {
    log.step(`Fetching listings from ${adapter.label}…`);
    const source = await prisma.propertySource.upsert({
      where: { key: adapter.key },
      update: { label: adapter.label },
      create: { key: adapter.key, label: adapter.label, enabled: true },
    });

    let listings: NormalizedListing[] = [];
    try {
      listings = await adapter.fetchListings({
        departements: IDF_DEPARTMENT_CODES,
        propertyTypes: ["Appartement", "Maison"],
        maxPages: 10,
      });
    } catch (e) {
      log.warn(`${adapter.label}: ${String(e)}`);
    }

    if (listings.length === 0) {
      log.warn(
        `${adapter.label}: 0 listings returned (likely no account credits yet). Nothing ingested.`
      );
      continue;
    }

    const ids = new Set<string>();
    for (const l of listings) {
      const id = await upsertOne(l, source.id);
      if (id) ids.add(id);
    }
    for (const id of ids) await computeAndStoreAnalysis(id);
    log.ok(`${adapter.label}: ingested ${ids.size} properties`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  log.error(String(e));
  await prisma.$disconnect();
  process.exit(1);
});
