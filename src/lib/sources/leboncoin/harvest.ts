/**
 * Import Leboncoin adverts harvested from a search page's embedded
 * `__NEXT_DATA__` payload.
 *
 * That payload states `owner.type` ("pro" | "private") per advert, which the
 * rendered card does not show. Seller type recorded through this path is
 * therefore the advert's own statement, not an inference — the distinction the
 * rest of the seller-type code is built around. An advert whose payload omits
 * the field stays UNKNOWN.
 *
 * Shared by the CLI (`npm run import:harvest`) and the local harvest endpoint.
 */
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createCommuneResolver } from "@/lib/sources/leboncoin/bulk";
import { computeAndStoreAnalysis } from "@/lib/properties/analyzeOne";
import { IDF_DEPARTMENT_CODES } from "@/lib/constants";

export const HarvestedAdSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  url: z.string().url().optional(),
  ownerType: z.string().nullish(),
  ownerName: z.string().nullish(),
  priceCents: z.number().int().positive().max(2_000_000_000).nullish(),
  city: z.string().nullish(),
  zipcode: z.string().nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  originType: z.string().nullish(),
  realEstateType: z.string().nullish(),
  square: z.number().positive().max(100_000).nullish(),
  rooms: z.number().int().positive().max(50).nullish(),
  energy: z.string().nullish(),
  status: z.string().nullish(),
});

export type HarvestedAd = z.infer<typeof HarvestedAdSchema>;

export interface HarvestStats {
  received: number;
  distinct: number;
  created: number;
  updated: number;
  sellerAgency: number;
  sellerIndividual: number;
  sellerUnknown: number;
  skippedNoCommune: number;
  skippedOutsideIdf: number;
  skippedIncomplete: number;
  inactive: number;
  analysed: number;
}

/** Leboncoin's owner.type -> our SellerType. Anything else is not a claim. */
export function sellerTypeOf(
  ownerType: string | null | undefined
): "AGENCY" | "INDIVIDUAL" | "UNKNOWN" {
  const t = (ownerType ?? "").toLowerCase();
  if (t === "pro") return "AGENCY";
  if (t === "private" || t === "part" || t === "particulier") return "INDIVIDUAL";
  return "UNKNOWN";
}

/** real_estate_type: "1" house, "2" flat. */
export function propertyTypeOf(v: string | null | undefined): "Appartement" | "Maison" | null {
  if (v === "1") return "Maison";
  if (v === "2") return "Appartement";
  return null;
}

export function dpeOf(energy: string | null | undefined): string | null {
  const e = (energy ?? "").trim().toUpperCase();
  return /^[A-G]$/.test(e) ? e : null;
}

export async function importHarvestedAds(
  records: HarvestedAd[],
  opts: { dry?: boolean; analyse?: boolean } = {}
): Promise<HarvestStats> {
  const { dry = false, analyse = true } = opts;

  // Last one wins per ad id, so re-harvesting a page is harmless.
  const byId = new Map<string, HarvestedAd>();
  for (const r of records) byId.set(r.id, r);
  const items = [...byId.values()];

  const stats: HarvestStats = {
    received: records.length,
    distinct: items.length,
    created: 0,
    updated: 0,
    sellerAgency: 0,
    sellerIndividual: 0,
    sellerUnknown: 0,
    skippedNoCommune: 0,
    skippedOutsideIdf: 0,
    skippedIncomplete: 0,
    inactive: 0,
    analysed: 0,
  };
  if (!items.length) return stats;

  const communes = await prisma.commune.findMany({
    select: { code: true, nom: true, departement: true },
  });
  const resolveCommune = createCommuneResolver(communes);

  const source = await prisma.propertySource.upsert({
    where: { key: "leboncoin-bulk" },
    update: { enabled: true },
    create: { key: "leboncoin-bulk", label: "Leboncoin · public search results", enabled: true },
  });

  const seen = new Date();
  const newPropertyIds: string[] = [];

  for (const it of items) {
    if (it.status && it.status !== "active") {
      stats.inactive++;
      continue;
    }
    if (!it.priceCents || !it.square || !it.zipcode) {
      stats.skippedIncomplete++;
      continue;
    }
    const commune = resolveCommune(it.city ?? "", it.zipcode);
    if (!commune) {
      stats.skippedNoCommune++;
      continue;
    }
    if (!IDF_DEPARTMENT_CODES.some((d) => d === commune.departement)) {
      stats.skippedOutsideIdf++;
      continue;
    }

    const sellerType = sellerTypeOf(it.ownerType);
    if (sellerType === "AGENCY") stats.sellerAgency++;
    else if (sellerType === "INDIVIDUAL") stats.sellerIndividual++;
    else stats.sellerUnknown++;

    if (dry) continue;

    // Only trust coordinates the advert says came from a street number; a
    // city centroid must never feed transport-distance scoring.
    const precise = it.originType === "streetNumber" && it.lat != null && it.lng != null;
    const url = it.url ?? `https://www.leboncoin.fr/ad/ventes_immobilieres/${it.id}`;
    const dedupeKey = `lbc:${it.id}`;

    const existing = await prisma.property.findUnique({
      where: { dedupeKey },
      select: { id: true },
    });

    const propertyData = {
      codeCommune: commune.code,
      surface: it.square,
      rooms: it.rooms ?? null,
      propertyType: propertyTypeOf(it.realEstateType),
      dpe: dpeOf(it.energy),
      isDemo: false,
      ...(precise ? { lat: it.lat!, lon: it.lng! } : {}),
    };

    const property = await prisma.property.upsert({
      where: { dedupeKey },
      update: propertyData,
      create: {
        dedupeKey,
        addressLine: precise ? null : `${commune.nom} — exact address not published`,
        ...propertyData,
      },
    });
    if (existing) stats.updated++;
    else {
      stats.created++;
      newPropertyIds.push(property.id);
    }

    const listingData = {
      propertyId: property.id,
      url,
      price: it.priceCents,
      lastSeenAt: seen,
      status: "ACTIVE",
      sellerType,
      sellerName: it.ownerName ?? null,
      title: `${it.rooms ?? "?"}P · ${it.square} m² · ${commune.nom}`,
    };

    const previous = await prisma.listing.findUnique({
      where: { sourceId_externalId: { sourceId: source.id, externalId: it.id } },
      select: { id: true, price: true },
    });

    const listing = await prisma.listing.upsert({
      where: { sourceId_externalId: { sourceId: source.id, externalId: it.id } },
      update: listingData,
      create: {
        sourceId: source.id,
        externalId: it.id,
        firstSeenAt: seen,
        description:
          "Public search result observed on Leboncoin. The advertiser kind is taken from the advert's own payload. Availability and the exact address must be confirmed with the advertiser.",
        ...listingData,
      },
    });

    // Record a price point only on a genuine change, so re-harvests do not
    // inflate the price history.
    if (!previous || previous.price !== it.priceCents) {
      await prisma.priceHistory.create({
        data: { listingId: listing.id, price: it.priceCents, observedAt: seen },
      });
    }
  }

  if (!dry && analyse) {
    for (const id of newPropertyIds) {
      if (await computeAndStoreAnalysis(id)) stats.analysed++;
    }
  }

  return stats;
}
