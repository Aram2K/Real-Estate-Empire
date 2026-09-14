import { Prisma } from "@prisma/client";
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
 * Bound-parameter budget for one statement. A longer id list is applied in
 * memory instead of as an IN (...) clause.
 */
const MAX_SQL_IDS = 900;

/**
 * Load list rows with one SQL statement.
 *
 * This replaces a Prisma findMany with three nested includes, which spent about
 * 1.7 s turning ~5,000 rows into objects; the equivalent join takes about 0.2 s.
 * It must return exactly what that query did:
 *
 * - only properties with an ACTIVE listing (the inner join on Listing) and an
 *   analysis for the current assumption hash (the inner join on
 *   InvestmentAnalysis) — the old code skipped any property missing either;
 * - the cheapest ACTIVE listing when there are several, with the listing id as
 *   an explicit tie-break so the choice is deterministic;
 * - properties with no commune kept, via the LEFT JOIN on Commune.
 *
 * Each structural filter mirrors the Prisma `where` it replaces, including how
 * it treats NULL. Every value is a bound parameter; nothing supplied by a caller
 * is ever spliced into the SQL text.
 */
async function loadListRows(filter: PropertyFilter, hash: string): Promise<ListRow[]> {
  const clauses: Prisma.Sql[] = [];

  if (filter.propertyIds && filter.propertyIds.length <= MAX_SQL_IDS) {
    clauses.push(Prisma.sql`AND p.id IN (${Prisma.join(filter.propertyIds)})`);
  }
  if (filter.includeDemo === false) clauses.push(Prisma.sql`AND p.isDemo = 0`);
  if (filter.communeCodes?.length) {
    clauses.push(Prisma.sql`AND p.codeCommune IN (${Prisma.join(filter.communeCodes)})`);
  }
  // A relation filter on the optional commune: a property with no commune fails it.
  if (filter.departements?.length) {
    clauses.push(Prisma.sql`AND c.departement IN (${Prisma.join(filter.departements)})`);
  }
  if (filter.propertyType?.length) {
    clauses.push(Prisma.sql`AND p.propertyType IN (${Prisma.join(filter.propertyType)})`);
  }
  // `listings: { some: ... }` — ANY active listing of that seller type qualifies,
  // not only the cheapest one chosen for display.
  if (filter.sellerTypes?.length) {
    clauses.push(Prisma.sql`AND EXISTS (
      SELECT 1 FROM Listing y
      WHERE y.propertyId = p.id AND y.status = 'ACTIVE'
        AND y.sellerType IN (${Prisma.join(filter.sellerTypes)})
    )`);
  }
  if (filter.surfaceMin != null) clauses.push(Prisma.sql`AND p.surface >= ${filter.surfaceMin}`);
  if (filter.surfaceMax != null) clauses.push(Prisma.sql`AND p.surface <= ${filter.surfaceMax}`);
  if (filter.roomsMin != null) clauses.push(Prisma.sql`AND p.rooms >= ${filter.roomsMin}`);
  if (filter.roomsMax != null) clauses.push(Prisma.sql`AND p.rooms <= ${filter.roomsMax}`);
  if (filter.roomCounts?.length || filter.roomsAtLeast != null) {
    const branches: Prisma.Sql[] = [];
    if (filter.roomCounts?.length) {
      branches.push(Prisma.sql`p.rooms IN (${Prisma.join(filter.roomCounts)})`);
    }
    if (filter.roomsAtLeast != null) branches.push(Prisma.sql`p.rooms >= ${filter.roomsAtLeast}`);
    clauses.push(Prisma.sql`AND (${Prisma.join(branches, " OR ")})`);
  }

  const rows = await prisma.$queryRaw<ListRow[]>`
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
    WHERE 1 = 1 ${clauses.length ? Prisma.join(clauses, " ") : Prisma.empty}
    ORDER BY p.rowid
  `;

  if (filter.propertyIds && filter.propertyIds.length > MAX_SQL_IDS) {
    const wanted = new Set(filter.propertyIds);
    return rows.filter((r) => wanted.has(r.id));
  }
  return rows;
}

export async function getProperties(
  filter: PropertyFilter
): Promise<PropertyListItem[]> {
  const hash = hashAssumptions(resolveAssumptions());

  // Prisma's `id: { in: [] }` matches nothing; keep that for an empty id list.
  if (filter.propertyIds && filter.propertyIds.length === 0) return [];

  const [rows, refs] = await Promise.all([loadListRows(filter, hash), loadSpatialRefs()]);

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

    items.push({
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
