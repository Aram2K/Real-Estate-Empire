import { prisma } from "@/lib/db/prisma";
import { resolveAssumptions } from "@/lib/assumptions/resolve";
import { hashAssumptions } from "@/lib/assumptions/hash";
import { loadSpatialRefs, nearestTransport } from "@/lib/geo/spatialRefs";
import { dpeRank, type PropertyFilter } from "@/lib/filters/schema";

export interface PropertyListItem {
  id: string;
  commune: string;
  communeCode: string | null;
  departement: string | null;
  addressLine: string | null;
  lat: number | null;
  lon: number | null;
  communeLat?: number | null;
  communeLon?: number | null;
  surface: number | null;
  rooms: number | null;
  propertyType: string | null;
  dpe: string | null;
  isDemo: boolean;
  source: string;
  sellerType: string;
  sellerName: string | null;
  url: string | null;
  priceCents: number;
  daysOnMarket: number | null;
  investmentScore: number;
  whiteStatus: string;
  monthlyCashFlowCents: number;
  dscr: number;
  grossYieldPct: number;
  allInGrossYieldPct: number;
  investorCashCents: number;
  transportScore: number;
  rentalDemandScore: number;
  appreciationScore: number;
  safetyScore: number | null;
  distToStationM: number | null;
  distToFutureM: number | null;
  futureName: string | null;
  futureYear: number | null;
}

export async function getProperties(
  filter: PropertyFilter
): Promise<PropertyListItem[]> {
  const hash = hashAssumptions(resolveAssumptions());

  const where: Record<string, unknown> = {};
  if (filter.propertyIds) where.id = { in: filter.propertyIds };
  if (filter.includeDemo === false) where.isDemo = false;
  if (filter.communeCodes?.length) where.codeCommune = { in: filter.communeCodes };
  if (filter.departements?.length)
    where.commune = { departement: { in: filter.departements } };
  if (filter.propertyType?.length) where.propertyType = { in: filter.propertyType };
  if (filter.sellerTypes?.length) where.listings = { some: { status: "ACTIVE", sellerType: { in: filter.sellerTypes } } };
  if (filter.surfaceMin != null || filter.surfaceMax != null) {
    where.surface = {
      ...(filter.surfaceMin != null ? { gte: filter.surfaceMin } : {}),
      ...(filter.surfaceMax != null ? { lte: filter.surfaceMax } : {}),
    };
  }
  if (filter.roomsMin != null || filter.roomsMax != null) {
    where.rooms = {
      ...(filter.roomsMin != null ? { gte: filter.roomsMin } : {}),
      ...(filter.roomsMax != null ? { lte: filter.roomsMax } : {}),
    };
  }

  const [props, refs] = await Promise.all([
    prisma.property.findMany({
      where,
      include: {
        commune: { select: { nom: true, departement: true, lat: true, lon: true } },
        listings: {
          where: { status: "ACTIVE" },
          orderBy: { price: "asc" },
          take: 1,
          include: { source: { select: { key: true } } },
        },
        analyses: { where: { assumptionHash: hash }, take: 1 },
      },
    }),
    loadSpatialRefs(),
  ]);

  const items: PropertyListItem[] = [];
  for (const p of props) {
    const listing = p.listings[0];
    const analysis = p.analyses[0];
    if (!listing || !analysis) continue;

    let scores: { transport?: number; rentalDemand?: number; appreciation?: number; safety?: number | null } = {};
    try {
      scores = JSON.parse(analysis.scoresJson);
    } catch {
      scores = {};
    }

    let distToStationM: number | null = null;
    let distToFutureM: number | null = null;
    let futureName: string | null = null;
    let futureYear: number | null = null;
    if (p.lat != null && p.lon != null) {
      const t = nearestTransport({ lat: p.lat, lon: p.lon }, refs);
      distToStationM = t.station?.metres ?? null;
      distToFutureM = t.future?.metres ?? null;
      futureName = t.future?.item.name ?? null;
      futureYear = t.future?.item.openingYear ?? null;
    }

    items.push({
      id: p.id,
      commune: p.commune?.nom ?? "—",
      communeCode: p.codeCommune,
      departement: p.commune?.departement ?? null,
      addressLine: p.addressLine,
      lat: p.lat,
      lon: p.lon,
      communeLat: p.commune?.lat ?? null,
      communeLon: p.commune?.lon ?? null,
      surface: p.surface,
      rooms: p.rooms,
      propertyType: p.propertyType,
      dpe: p.dpe,
      isDemo: p.isDemo,
      source: listing.source.key,
      sellerType: listing.sellerType,
      sellerName: listing.sellerName,
      url: listing.url,
      priceCents: listing.price,
      daysOnMarket: listing.daysOnMarket,
      investmentScore: analysis.investmentScore,
      whiteStatus: analysis.whiteStatus,
      monthlyCashFlowCents: analysis.monthlyCashFlow,
      dscr: analysis.dscr,
      grossYieldPct: analysis.grossYield,
      allInGrossYieldPct: analysis.allInGrossYield,
      investorCashCents: analysis.investorCash,
      transportScore: scores.transport ?? 0,
      rentalDemandScore: scores.rentalDemand ?? 0,
      appreciationScore: scores.appreciation ?? 0,
      safetyScore: scores.safety ?? null,
      distToStationM,
      distToFutureM,
      futureName,
      futureYear,
    });
  }

  // in-memory numeric / score / distance filters
  const f = filter;
  const filtered = items.filter((i) => {
    if (f.priceMinCents != null && i.priceCents < f.priceMinCents) return false;
    if (f.priceMaxCents != null && i.priceCents > f.priceMaxCents) return false;
    if (f.grossYieldMin != null && i.grossYieldPct < f.grossYieldMin) return false;
    if (f.allInYieldMin != null && i.allInGrossYieldPct < f.allInYieldMin) return false;
    if (f.cashFlowMinCents != null && i.monthlyCashFlowCents < f.cashFlowMinCents)
      return false;
    if (f.dscrMin != null && i.dscr < f.dscrMin) return false;
    if (f.whiteStatus?.length && !f.whiteStatus.includes(i.whiteStatus)) return false;
    if (f.investmentScoreMin != null && i.investmentScore < f.investmentScoreMin)
      return false;
    if (f.rentalDemandMin != null && i.rentalDemandScore < f.rentalDemandMin)
      return false;
    if (f.transportScoreMin != null && i.transportScore < f.transportScoreMin)
      return false;
    if (f.appreciationMin != null && i.appreciationScore < f.appreciationMin)
      return false;
    if (f.safetyMin != null && (i.safetyScore == null || i.safetyScore < f.safetyMin))
      return false;
    if (f.dpeMax && dpeRank(i.dpe) > dpeRank(f.dpeMax)) return false;
    if (
      f.maxDistanceToStationM != null &&
      (i.distToStationM == null || i.distToStationM > f.maxDistanceToStationM)
    )
      return false;
    if (
      f.maxDistanceToGpeM != null &&
      (i.distToFutureM == null || i.distToFutureM > f.maxDistanceToGpeM)
    )
      return false;
    if (
      f.nearGpeHorizonBy != null &&
      (i.futureYear == null || i.futureYear > f.nearGpeHorizonBy)
    )
      return false;
    return true;
  });

  const sort = f.sort ?? "investmentScore";
  filtered.sort((a, b) => {
    switch (sort) {
      case "cashFlow":
        return b.monthlyCashFlowCents - a.monthlyCashFlowCents;
      case "grossYield":
        return b.grossYieldPct - a.grossYieldPct;
      case "allInYield":
        return b.allInGrossYieldPct - a.allInGrossYieldPct;
      case "dscr":
        return b.dscr - a.dscr;
      case "price":
        return a.priceCents - b.priceCents;
      case "safety":
        return (b.safetyScore ?? -1) - (a.safetyScore ?? -1);
      default:
        return b.investmentScore - a.investmentScore;
    }
  });

  return filtered.slice(0, f.limit ?? 300);
}
