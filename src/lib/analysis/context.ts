import { prisma } from "@/lib/db/prisma";
import { MARKET_PERIOD } from "@/lib/constants";
import {
  transportInputsForPoint,
  type SpatialRefs,
} from "@/lib/geo/spatialRefs";
import type { AnalysisContext } from "./service";
import type { RentBandM2 } from "./estimate";

export interface MarketMaps {
  populationByCommune: Map<string, number | null>;
  deptByCommune: Map<string, string>;
  rentBandByCommune: Map<string, RentBandM2>;
  aptPriceByCommune: Map<string, { medianPriceM2: number | null; priceTrend5y: number | null }>;
  deptMedianAptByDept: Map<string, number | null>;
  safetyByCommune: Map<string, number | null>;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const v = [...nums].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

/** Load the commune-level maps needed to build analysis contexts in bulk. */
export async function loadMarketMaps(): Promise<MarketMaps> {
  const communes = await prisma.commune.findMany({
    select: { code: true, population: true, departement: true },
  });
  const rents = await prisma.rentReference.findMany({
    where: { segment: "ALL_APT" },
  });
  const metrics = await prisma.marketMetric.findMany({
    where: { period: MARKET_PERIOD, segment: "APT" },
  });
  const neighborhood = await prisma.neighborhoodMetric.findMany({
    orderBy: { period: "desc" },
    select: { communeCode: true, safetyScore: true },
  });

  const populationByCommune = new Map<string, number | null>();
  const deptByCommune = new Map<string, string>();
  for (const c of communes) {
    populationByCommune.set(c.code, c.population);
    deptByCommune.set(c.code, c.departement);
  }

  const rentBandByCommune = new Map<string, RentBandM2>();
  for (const r of rents) {
    if (!r.codeCommune) continue;
    const existing = rentBandByCommune.get(r.codeCommune);
    // encadrement (PARIS_QUARTIER) wins for Paris arrondissements
    if (!existing || r.scope === "PARIS_QUARTIER") {
      rentBandByCommune.set(r.codeCommune, {
        predCents: r.rentM2Pred,
        lowCents: r.rentM2Low,
        highCents: r.rentM2High,
      });
    }
  }

  const aptPriceByCommune = new Map<string, { medianPriceM2: number | null; priceTrend5y: number | null }>();
  const deptToPrices = new Map<string, number[]>();
  for (const m of metrics) {
    aptPriceByCommune.set(m.communeCode, {
      medianPriceM2: m.medianPriceM2,
      priceTrend5y: m.priceTrend5y,
    });
    const dept = deptByCommune.get(m.communeCode);
    if (dept && m.medianPriceM2 != null) {
      const arr = deptToPrices.get(dept) ?? [];
      arr.push(m.medianPriceM2);
      deptToPrices.set(dept, arr);
    }
  }
  const deptMedianAptByDept = new Map<string, number | null>();
  for (const [dept, arr] of deptToPrices) deptMedianAptByDept.set(dept, median(arr));
  const safetyByCommune = new Map<string, number | null>();
  for (const row of neighborhood) {
    if (!safetyByCommune.has(row.communeCode)) safetyByCommune.set(row.communeCode, row.safetyScore);
  }

  return {
    populationByCommune,
    deptByCommune,
    rentBandByCommune,
    aptPriceByCommune,
    deptMedianAptByDept,
    safetyByCommune,
  };
}

export interface PropertyForContext {
  priceCents: number;
  surface: number | null;
  rooms?: number | null;
  propertyType?: string | null;
  dpe?: string | null;
  hasElevator?: boolean | null;
  floor?: number | null;
  lat?: number | null;
  lon?: number | null;
  codeCommune?: string | null;
  chargesMonthlyCents?: number | null;
  taxeFonciereAnnualCents?: number | null;
}

const FALLBACK_RENT_BAND: RentBandM2 = { predCents: 1_800, lowCents: 1_600, highCents: 2_000 };

/** Assemble the full analysis context for one property. Returns null if unusable. */
export function buildAnalysisContext(
  p: PropertyForContext,
  maps: MarketMaps,
  refs: SpatialRefs
): AnalysisContext | null {
  if (!p.surface || p.surface <= 0 || !p.priceCents) return null;
  const code = p.codeCommune ?? "";

  const rentBand = maps.rentBandByCommune.get(code) ?? FALLBACK_RENT_BAND;
  const aptPrice = maps.aptPriceByCommune.get(code);
  const dept = maps.deptByCommune.get(code) ?? code.slice(0, 2);

  const transport =
    p.lat != null && p.lon != null
      ? transportInputsForPoint({ lat: p.lat, lon: p.lon }, refs)
      : {
          nearestExistingStationM: null,
          nearestFutureStationM: null,
          futureStationOpeningYear: null,
          distinctNearbyLines: 0,
          nearestHubM: null,
        };

  return {
    priceCents: p.priceCents,
    surface: p.surface,
    rooms: p.rooms,
    propertyType: p.propertyType,
    dpe: p.dpe,
    hasElevator: p.hasElevator,
    floor: p.floor,
    rentBand,
    chargesMonthlyCents: p.chargesMonthlyCents,
    taxeFonciereAnnualCents: p.taxeFonciereAnnualCents,
    population: maps.populationByCommune.get(code) ?? null,
    communePriceM2Cents: aptPrice?.medianPriceM2 ?? null,
    deptMedianPriceM2Cents: maps.deptMedianAptByDept.get(dept) ?? null,
    priceTrend5yPct: aptPrice?.priceTrend5y ?? null,
    safetyScore: maps.safetyByCommune.get(code) ?? null,
    transport,
  };
}
