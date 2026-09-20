import { prisma } from "@/lib/db/prisma";
import { versionedMemo } from "@/lib/db/dataVersion";
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

export function matchesCashFlowFilter(
  monthlyCashFlowCents: number,
  filter: Pick<PropertyFilter, "cashFlowMinCents" | "cashFlowPositiveOnly">
): boolean {
  if (filter.cashFlowMinCents != null && monthlyCashFlowCents < filter.cashFlowMinCents) return false;
  if (filter.cashFlowPositiveOnly && monthlyCashFlowCents <= 0) return false;
  return true;
}

/** One row of the list query: a property, its cheapest active listing and its analysis. */
interface ListRow {
  id: string;
  codeCommune: string | null;
  addressLine: string | null;
  lat: number | null;
  lon: number | null;
  surface: number | null;
  rooms: number | bigint | null;
  propertyType: string | null;
  dpe: string | null;
  isDemo: boolean | number | bigint;
  communeNom: string | null;
  communeDepartement: string | null;
  communeLat: number | null;
  communeLon: number | null;
  price: number | bigint;
  url: string | null;
  sellerType: string;
  sellerName: string | null;
  daysOnMarket: number | bigint | null;
  sourceKey: string;
  investmentScore: number | bigint;
  whiteStatus: string;
  monthlyCashFlow: number | bigint;
  dscr: number;
  grossYield: number;
  allInGrossYield: number;
  investorCash: number | bigint;
  scoresJson: string;
}

// SQLite may hand integer columns back as bigint through a raw query.
const int = (v: number | bigint) => Number(v);
const intOrNull = (v: number | bigint | null) => (v == null ? null : Number(v));

/**
 * Load every list row with one SQL statement.
 *
 * This replaces a Prisma findMany with three nested includes, which spent about
 * 1.7 s turning ~5,000 rows into objects; the equivalent join takes about 0.2 s.
 * It returns exactly what that query did:
 *
 * - only properties with an ACTIVE listing (the inner join on Listing) and an
 *   analysis for the current assumption hash (the inner join on
 *   InvestmentAnalysis) — the old code skipped any property missing either;
 * - the cheapest ACTIVE listing when there are several, with the listing id as
 *   an explicit tie-break so the choice is deterministic;
 * - properties with no commune kept, via the LEFT JOIN on Commune.
 *
 * Rows come back in insertion order, which is the order ties keep after sorting.
 */
async function loadListRows(hash: string): Promise<ListRow[]> {
  return prisma.$queryRaw<ListRow[]>`
    SELECT
      p.id, p.codeCommune, p.addressLine, p.lat, p.lon, p.surface, p.rooms,
      p.propertyType, p.dpe, p.isDemo,
      c.nom AS communeNom, c.departement AS communeDepartement,
      c.lat AS communeLat, c.lon AS communeLon,
      l.price, l.url, l.sellerType, l.sellerName, l.daysOnMarket,
      s.key AS sourceKey,
      a.investmentScore, a.whiteStatus, a.monthlyCashFlow, a.dscr,
      a.grossYield, a.allInGrossYield, a.investorCash, a.scoresJson
    FROM Property p
    LEFT JOIN Commune c ON c.code = p.codeCommune
    JOIN Listing l ON l.id = (
      SELECT x.id FROM Listing x
      WHERE x.propertyId = p.id AND x.status = 'ACTIVE'
      ORDER BY x.price ASC, x.id ASC
      LIMIT 1
    )
    JOIN PropertySource s ON s.id = l.sourceId
    JOIN InvestmentAnalysis a ON a.propertyId = p.id AND a.assumptionHash = ${hash}
    ORDER BY p.rowid
  `;
}

interface ListSnapshot {
  items: readonly PropertyListItem[];
  /** Seller types across each property's ACTIVE listings, not only the one shown. */
  activeSellerTypes: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * Build the full list once. Items are frozen: the snapshot is shared by every
 * request until the data changes, so a caller mutating one would corrupt the
 * results of all the others. Freezing turns that into an immediate error.
 */
async function buildSnapshot(hash: string): Promise<ListSnapshot> {
  const [rows, refs, sellers] = await Promise.all([
    loadListRows(hash),
    loadSpatialRefs(),
    prisma.$queryRaw<{ propertyId: string; sellerType: string }[]>`
      SELECT propertyId, sellerType FROM Listing WHERE status = 'ACTIVE'
    `,
  ]);

  const activeSellerTypes = new Map<string, Set<string>>();
  for (const s of sellers) {
    const set = activeSellerTypes.get(s.propertyId) ?? new Set<string>();
    set.add(s.sellerType);
    activeSellerTypes.set(s.propertyId, set);
  }

  const items: PropertyListItem[] = [];
  for (const p of rows) {
    let scores: { transport?: number; rentalDemand?: number; appreciation?: number; safety?: number | null } = {};
    try {
      scores = JSON.parse(p.scoresJson);
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

    items.push(Object.freeze({
      id: p.id,
      commune: p.communeNom ?? "—",
      communeCode: p.codeCommune,
      departement: p.communeDepartement ?? null,
      addressLine: p.addressLine,
      lat: p.lat,
      lon: p.lon,
      communeLat: p.communeLat ?? null,
      communeLon: p.communeLon ?? null,
      surface: p.surface,
      rooms: intOrNull(p.rooms),
      propertyType: p.propertyType,
      dpe: p.dpe,
      isDemo: Boolean(Number(p.isDemo)),
      source: p.sourceKey,
      sellerType: p.sellerType,
      sellerName: p.sellerName,
      url: p.url,
      priceCents: int(p.price),
      daysOnMarket: intOrNull(p.daysOnMarket),
      investmentScore: int(p.investmentScore),
      whiteStatus: p.whiteStatus,
      monthlyCashFlowCents: int(p.monthlyCashFlow),
      dscr: p.dscr,
      grossYieldPct: p.grossYield,
      allInGrossYieldPct: p.allInGrossYield,
      investorCashCents: int(p.investorCash),
      transportScore: scores.transport ?? 0,
      rentalDemandScore: scores.rentalDemand ?? 0,
      appreciationScore: scores.appreciation ?? 0,
      safetyScore: scores.safety ?? null,
      distToStationM,
      distToFutureM,
      futureName,
      futureYear,
    }));
  }

  return { items, activeSellerTypes };
}

const snapshotLoaders = new Map<string, () => Promise<ListSnapshot>>();

/**
 * The list snapshot for the current data version. It is rebuilt only after the
 * database changes — by this server or by any other process — so warm requests
 * skip the query and the transport distance pass entirely.
 */
function loadSnapshot(hash: string): Promise<ListSnapshot> {
  let load = snapshotLoaders.get(hash);
  if (!load) {
    load = versionedMemo(`properties:list:${hash}`, () => buildSnapshot(hash));
    snapshotLoaders.set(hash, load);
  }
  return load();
}

/**
 * Structural filters. Each mirrors the Prisma `where` clause it replaced,
 * including NULL handling: a property with no value for a filtered field never
 * matches, as in SQL.
 */
function structuralFilter(
  f: PropertyFilter,
  activeSellerTypes: ReadonlyMap<string, ReadonlySet<string>>
): (i: PropertyListItem) => boolean {
  const ids = f.propertyIds ? new Set(f.propertyIds) : null;
  const communes = f.communeCodes?.length ? new Set(f.communeCodes) : null;
  const departements = f.departements?.length ? new Set(f.departements) : null;
  const types = f.propertyType?.length ? new Set(f.propertyType) : null;
  const sellers = f.sellerTypes?.length ? f.sellerTypes : null;
  const roomCounts = f.roomCounts?.length ? new Set(f.roomCounts) : null;
  const roomOr = roomCounts !== null || f.roomsAtLeast != null;

  return (i) => {
    if (ids && !ids.has(i.id)) return false;
    if (f.includeDemo === false && i.isDemo) return false;
    if (communes && (i.communeCode == null || !communes.has(i.communeCode))) return false;
    if (departements && (i.departement == null || !departements.has(i.departement))) return false;
    if (types && (i.propertyType == null || !types.has(i.propertyType))) return false;
    // Any ACTIVE listing of the property counts, not only the cheapest one shown.
    if (sellers) {
      const have = activeSellerTypes.get(i.id);
      if (!have || !sellers.some((s) => have.has(s))) return false;
    }
    if (f.surfaceMin != null && (i.surface == null || i.surface < f.surfaceMin)) return false;
    if (f.surfaceMax != null && (i.surface == null || i.surface > f.surfaceMax)) return false;
    if (f.roomsMin != null && (i.rooms == null || i.rooms < f.roomsMin)) return false;
    if (f.roomsMax != null && (i.rooms == null || i.rooms > f.roomsMax)) return false;
    if (roomOr) {
      if (i.rooms == null) return false;
      const inCounts = roomCounts !== null && roomCounts.has(i.rooms);
      const atLeast = f.roomsAtLeast != null && i.rooms >= f.roomsAtLeast;
      if (!inCounts && !atLeast) return false;
    }
    return true;
  };
}

export async function getProperties(
  filter: PropertyFilter
): Promise<PropertyListItem[]> {
  // Prisma's `id: { in: [] }` matched nothing; keep that for an empty id list.
  if (filter.propertyIds && filter.propertyIds.length === 0) return [];

  const hash = hashAssumptions(resolveAssumptions());
  const snapshot = await loadSnapshot(hash);
  const items = snapshot.items.filter(structuralFilter(filter, snapshot.activeSellerTypes));

  // in-memory numeric / score / distance filters
  const f = filter;
  const filtered = items.filter((i) => {
    if (f.priceMinCents != null && i.priceCents < f.priceMinCents) return false;
    if (f.priceMaxCents != null && i.priceCents > f.priceMaxCents) return false;
    if (f.grossYieldMin != null && i.grossYieldPct < f.grossYieldMin) return false;
    if (f.allInYieldMin != null && i.allInGrossYieldPct < f.allInYieldMin) return false;
    if (!matchesCashFlowFilter(i.monthlyCashFlowCents, f)) return false;
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
