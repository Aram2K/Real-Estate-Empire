import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MARKET_PERIOD } from "@/lib/constants";
import { versionedMemo } from "@/lib/db/dataVersion";
import { roundGeometry } from "@/lib/geo/simplify";

/** Market segments that exist in MarketMetric; only these are cached. */
const SEGMENTS = new Set(["APT", "HOUSE", "ALL"]);

async function buildBody(segment: string): Promise<string> {
  const communes = await prisma.commune.findMany({
    where: { code: { not: "75056" }, geojson: { not: null } },
    select: { code: true, nom: true, departement: true, geojson: true },
  });
  const metrics = await prisma.marketMetric.findMany({
    where: { period: MARKET_PERIOD, segment },
  });
  const metricByCode = new Map(metrics.map((m) => [m.communeCode, m]));

  const features = [];
  for (const c of communes) {
    const m = metricByCode.get(c.code);
    if (!m) continue;
    let geometry: unknown;
    try {
      geometry = roundGeometry(JSON.parse(c.geojson!), 3);
    } catch {
      continue;
    }
    features.push({
      type: "Feature",
      properties: {
        code: c.code,
        nom: c.nom,
        departement: c.departement,
        medianPriceM2: m.medianPriceM2,
        medianRentM2: m.medianRentM2,
        estGrossYield: m.estGrossYield,
        priceTrend5y: m.priceTrend5y,
        hotspotScore: m.hotspotScore,
        transportScore: m.transportScore,
        appreciationScore: m.appreciationScore,
        rentalDemandScore: m.rentalDemandScore,
        dvfSampleSize: m.dvfSampleSize,
      },
      geometry,
    });
  }

  return JSON.stringify({ type: "FeatureCollection", features });
}

/**
 * The serialized collection per segment, rebuilt only after the database changes.
 *
 * The previous cache was never invalidated, so after compute:market or
 * compute:scores the map kept serving old commune figures until a restart. It
 * also re-serialized the ~3 MB collection on every request. Keying on the data
 * version fixes the first; caching the string fixes the second.
 */
const loaders = new Map<string, () => Promise<string>>();
function loadBody(segment: string): Promise<string> {
  let load = loaders.get(segment);
  if (!load) {
    load = versionedMemo(`hotspots:${segment}:${MARKET_PERIOD}`, () => buildBody(segment));
    loaders.set(segment, load);
  }
  return load();
}

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? "APT";
  // An unknown segment matches no metrics; build it uncached so arbitrary query
  // strings cannot grow the cache.
  const body = SEGMENTS.has(segment) ? await loadBody(segment) : await buildBody(segment);
  return new Response(body, { headers: { "content-type": "application/json" } });
}
